/**
 * `lab-inverter` §M6 / step 8: synchronisation (manual or PLL), relay closing, P/Q phasors, anti-islanding.
 *
 * PLL (§M6): Δφ = wrap(θ_g − θ_i) ∈ (−π, π]; f_i = 50 + K_p·Δφ [Hz, Δφ in rad]; θ_i += 2π·f_i·dt, dt = 1e-4 s.
 * Sync check: |Δf| ≤ 0.1 Hz ∧ |Δφ| ≤ 10° ∧ |ΔU| ≤ 5 %.
 * Anti-islanding (simplified active frequency drift, laboratory settings — «спрощена модель»): after the grid
 * disappears with balanced P, f(t) = 50 + 2·t Hz; trip threshold 51.0 Hz (window 49.0…51.0) → detection after
 * 0.5 s, relay opens 0.1 s later (0.6 s ≤ 2 s).
 */
import { GRID_F_HZ, GRID_INDUCTANCE_H, phasorFromPQ, type PhasorResult } from '../core/S3-sim/inverter';

export const PLL_DT_S = 1e-4;
export const SYNC_LIMITS = { dfHz: 0.1, dphiDeg: 10, duRel: 0.05 } as const;
export const ISLANDING = { driftHzPerS: 2, fMinHz: 49, fMaxHz: 51, relayDelayS: 0.1 } as const;
/** Inverter apparent power limit for the P/Q sliders, VA. */
export const LI6_S_MAX_VA = 6000;

/** Wrap an angle into (−π, π]. */
export function wrapPi(x: number): number {
  let y = Math.atan2(Math.sin(x), Math.cos(x));
  if (y <= -Math.PI) y += 2 * Math.PI;
  return y;
}

export interface SyncCheck {
  dfHz: number;
  dphiDeg: number;
  duRel: number;
  inSync: boolean;
}

export function syncCheck(dfHz: number, dphiDeg: number, duRel: number): SyncCheck {
  return {
    dfHz,
    dphiDeg,
    duRel,
    inSync:
      Math.abs(dfHz) <= SYNC_LIMITS.dfHz + 1e-12 &&
      Math.abs(dphiDeg) <= SYNC_LIMITS.dphiDeg + 1e-12 &&
      Math.abs(duRel) <= SYNC_LIMITS.duRel + 1e-12,
  };
}

/**
 * Inrush current when the relay closes out of sync: |U_inv∠Δφ − U_g∠0| / X (peak of the RMS phasor
 * difference over the grid reactance, A RMS). Illustrative («удар струму»).
 */
export function inrushCurrentA(dphiDeg: number, uInvV = 230, uGridV = 230, lH = GRID_INDUCTANCE_H): number {
  const x = 2 * Math.PI * GRID_F_HZ * lH;
  const d = (dphiDeg * Math.PI) / 180;
  return Math.hypot(uInvV * Math.cos(d) - uGridV, uInvV * Math.sin(d)) / x;
}

/** P/Q sliders with the apparent-power limit: Q is clipped so that √(P² + Q²) ≤ 6 kVA. */
export function dispatchPQ(
  pW: number,
  qVar: number,
  sMaxVa = LI6_S_MAX_VA,
): PhasorResult & { qLimited: boolean } {
  const p = Math.min(Math.max(pW, 0), sMaxVa);
  const qMax = Math.sqrt(Math.max(0, sMaxVa * sMaxVa - p * p));
  const q = Math.max(-qMax, Math.min(qMax, qVar));
  return { ...phasorFromPQ(p, q), qLimited: q !== qVar };
}

export interface GridTieParams {
  /** Manual inverter frequency, Hz (49.0…51.0, default 50.40). */
  manualFreqHz: number;
  /** PLL gain K_p, Hz/rad (default 5). */
  kpHzPerRad: number;
  /** Inverter voltage magnitude used for the sync check, V. */
  uInvV: number;
  /** 'grid-following' stops after islanding; 'grid-forming' keeps 230 V / 50 Hz behind the relay. */
  control: 'grid-following' | 'grid-forming';
}

export const GRID_TIE_DEFAULTS: Readonly<GridTieParams> = Object.freeze({
  manualFreqHz: 50.4,
  kpHzPerRad: 5,
  uInvV: 230,
  control: 'grid-following',
});

export interface GridTieState {
  timeS: number;
  thetaGridRad: number;
  thetaInvRad: number;
  fInvHz: number;
  /** Phase error θ_g − θ_i wrapped, degrees. */
  dphiDeg: number;
  sync: SyncCheck;
  pllOn: boolean;
  relayClosed: boolean;
  /** Last relay closing: soft (in sync) or an inrush event. */
  lastClose: { soft: boolean; inrushA: number } | null;
  gridPresent: boolean;
  /** Seconds since the grid disappeared (−1 while present). */
  islandTimeS: number;
  /** Anti-islanding detected (frequency outside the window). */
  islandingDetected: boolean;
  /** Time from grid loss to relay opening, s (when it happened). */
  tripTimeS: number | null;
  /** Inverter output active (false after a grid-following trip). */
  outputOn: boolean;
}

export function createGridTie(initial: Partial<GridTieParams> = {}) {
  let params: GridTieParams = { ...GRID_TIE_DEFAULTS, ...initial };
  const state: GridTieState = {
    timeS: 0,
    thetaGridRad: 0,
    thetaInvRad: Math.PI / 2,
    fInvHz: params.manualFreqHz,
    dphiDeg: -90,
    sync: syncCheck(params.manualFreqHz - GRID_F_HZ, -90, 0),
    pllOn: false,
    relayClosed: false,
    lastClose: null,
    gridPresent: true,
    islandTimeS: -1,
    islandingDetected: false,
    tripTimeS: null,
    outputOn: true,
  };
  let detectedAt = -1;

  function micro(h: number): void {
    state.timeS += h;
    // §M6 order: Δφ is evaluated before both phases advance (otherwise a one-step phase lag remains).
    const err = wrapPi(state.thetaGridRad - state.thetaInvRad);
    if (state.gridPresent) state.thetaGridRad = wrapPi(state.thetaGridRad + 2 * Math.PI * GRID_F_HZ * h);
    if (state.relayClosed && state.gridPresent) {
      // Locked to the grid.
      state.fInvHz = GRID_F_HZ;
      state.thetaInvRad = state.thetaGridRad;
    } else if (!state.gridPresent && state.relayClosed) {
      // Island with balanced P: active frequency drift.
      state.islandTimeS += h;
      state.fInvHz = GRID_F_HZ + ISLANDING.driftHzPerS * state.islandTimeS;
      state.thetaInvRad = wrapPi(state.thetaInvRad + 2 * Math.PI * state.fInvHz * h);
      if (
        !state.islandingDetected &&
        (state.fInvHz >= ISLANDING.fMaxHz || state.fInvHz <= ISLANDING.fMinHz)
      ) {
        state.islandingDetected = true;
        detectedAt = state.islandTimeS;
      }
      if (state.islandingDetected && state.islandTimeS >= detectedAt + ISLANDING.relayDelayS - 1e-12) {
        state.relayClosed = false;
        state.tripTimeS = state.islandTimeS;
        state.outputOn = params.control === 'grid-forming';
        if (params.control === 'grid-forming') state.fInvHz = GRID_F_HZ;
      }
    } else {
      if (!state.gridPresent && state.islandTimeS >= 0) state.islandTimeS += h;
      state.fInvHz = state.pllOn ? GRID_F_HZ + params.kpHzPerRad * err : state.fInvHz;
      state.thetaInvRad = wrapPi(state.thetaInvRad + 2 * Math.PI * state.fInvHz * h);
    }
  }

  function readouts(): void {
    state.dphiDeg = (wrapPi(state.thetaGridRad - state.thetaInvRad) * 180) / Math.PI;
    state.sync = syncCheck(state.fInvHz - GRID_F_HZ, state.dphiDeg, params.uInvV / 230 - 1);
  }

  return {
    state,
    step(dt: number): void {
      if (!(dt > 0)) return;
      let rem = dt;
      while (rem > 1e-15) {
        const h = Math.min(PLL_DT_S, rem);
        micro(h);
        rem -= h;
      }
      readouts();
    },
    set(p: Partial<GridTieParams>): void {
      params = { ...params, ...p };
      if (!state.pllOn && !state.relayClosed && p.manualFreqHz !== undefined)
        state.fInvHz = params.manualFreqHz;
      readouts();
    },
    /** Manual phase slider (−180…180°): sets θ_i = θ_g − Δφ. */
    setPhaseErrorDeg(dphiDeg: number): void {
      state.thetaInvRad = wrapPi(state.thetaGridRad - (dphiDeg * Math.PI) / 180);
      readouts();
    },
    enablePll(on = true): void {
      state.pllOn = on;
      if (!on) state.fInvHz = params.manualFreqHz;
    },
    /** «Замкнути реле»: soft in sync, inrush otherwise (the relay closes either way). */
    closeRelay(): { soft: boolean; inrushA: number } {
      readouts();
      const r = { soft: state.sync.inSync, inrushA: inrushCurrentA(state.dphiDeg, params.uInvV) };
      state.lastClose = r;
      state.relayClosed = true;
      state.outputOn = true;
      return r;
    },
    /** «Вимкнути мережу» (false) / restore (true). */
    setGrid(present: boolean): void {
      state.gridPresent = present;
      if (!present) {
        state.islandTimeS = 0;
        state.islandingDetected = false;
        state.tripTimeS = null;
        detectedAt = -1;
      } else {
        state.islandTimeS = -1;
      }
    },
    params(): Readonly<GridTieParams> {
      return params;
    },
    reset(): void {
      detectedAt = -1;
      Object.assign(state, {
        timeS: 0,
        thetaGridRad: 0,
        thetaInvRad: Math.PI / 2,
        fInvHz: params.manualFreqHz,
        pllOn: false,
        relayClosed: false,
        lastClose: null,
        gridPresent: true,
        islandTimeS: -1,
        islandingDetected: false,
        tripTimeS: null,
        outputOn: true,
      });
      readouts();
    },
  };
}

export type GridTie = ReturnType<typeof createGridTie>;

/** PLL lock time from an initial phase error (s until |Δφ| < 2°), K_p in Hz/rad — closed-form loop of §M6. */
export function pllLockTimeS(initialErrDeg: number, kpHzPerRad: number, thresholdDeg = 2, maxS = 5): number {
  let thG = 0;
  let thI = (-initialErrDeg * Math.PI) / 180;
  let t = 0;
  while (t < maxS) {
    const err = wrapPi(thG - thI);
    const f = GRID_F_HZ + kpHzPerRad * err;
    thI += 2 * Math.PI * f * PLL_DT_S;
    thG += 2 * Math.PI * GRID_F_HZ * PLL_DT_S;
    t += PLL_DT_S;
    if (Math.abs((err * 180) / Math.PI) < thresholdDeg) return t;
  }
  return Infinity;
}
