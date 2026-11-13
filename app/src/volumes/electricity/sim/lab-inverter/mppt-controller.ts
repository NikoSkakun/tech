/**
 * `lab-inverter` step 7: boost-converter MPPT on a string of 6 × ЛМ-440 (`lab-pv` §M1 model).
 *
 * The boost converter holds the DC link at 400 V, so the PV voltage is set by the duty: U_pv = (1 − D)·400
 * (§M5: D = 1 − U_in/U_link). Auto MPPT = P&O on D, ΔD = 0.005, 5 steps/s. Control: STC → V_mp ≈ 198.4 V,
 * D ≈ 0.504, P ≈ 2639 W.
 */
import { SampledCurve } from '../core/S3-sim/mppt';
import { PvString, uniformString, type IvPoint } from '../core/S3-sim/pv';

export const DC_LINK_V = 400;

/** Sampled curve of a string of `n` ЛМ-440 at G, Tc, with the current scaled by `currentScale` (parallel strings). */
export function stringCurve(gWm2: number, tcC: number, n = 6, currentScale = 1): SampledCurve {
  const pts = new PvString(uniformString(gWm2, tcC, n)).curve(600);
  return new SampledCurve(pts.map((p) => ({ vV: p.vV, iA: p.iA * currentScale, pW: p.pW * currentScale })));
}

/** Sum of the currents of two curves at equal voltage (two strings in parallel on one MPPT). */
export function parallelCurves(a: SampledCurve, b: SampledCurve, nPts = 600): SampledCurve {
  const vMax = Math.max(a.vocV, b.vocV);
  const pts: IvPoint[] = [];
  for (let k = 0; k <= nPts; k++) {
    const v = (vMax * k) / nPts;
    const i = a.currentAt(v) + b.currentAt(v);
    pts.push({ vV: v, iA: i, pW: v * i });
  }
  return new SampledCurve(pts);
}

export interface MismatchResult {
  /** Two MPPTs: Σ P_max. */
  twoMpptW: number;
  /** One MPPT on both strings in parallel: P_max of the summed curve. */
  oneMpptW: number;
  /** Mismatch loss, W and fraction. */
  lossW: number;
  lossFraction: number;
}

/** «Ранок: схід 800, захід 200» — 6 modules per string. */
export function eastWestMismatch(gEastWm2 = 800, gWestWm2 = 200, tcC = 25, n = 6): MismatchResult {
  const e = stringCurve(gEastWm2, tcC, n);
  const w = stringCurve(gWestWm2, tcC, n);
  const two = e.mpp.pW + w.mpp.pW;
  const one = parallelCurves(e, w).mpp.pW;
  return { twoMpptW: two, oneMpptW: one, lossW: two - one, lossFraction: two > 0 ? (two - one) / two : 0 };
}

/**
 * Clipping: with P capped at `capW` the operating point is the highest-voltage point with P ≤ cap, right of the
 * MPP (the «ceiling» on the P-V chart). Returns the MPP itself when it is below the cap.
 */
export function clippedPoint(c: SampledCurve, capW: number): { vV: number; pW: number; clipped: boolean } {
  if (c.mpp.pW <= capW) return { vV: c.mpp.vV, pW: c.mpp.pW, clipped: false };
  let lo = c.mpp.vV;
  let hi = c.vocV;
  for (let k = 0; k < 60; k++) {
    const m = 0.5 * (lo + hi);
    if (c.powerAt(m) > capW) lo = m;
    else hi = m;
  }
  return { vV: hi, pW: c.powerAt(hi), clipped: true };
}

export interface MpptControllerParams {
  gWm2: number;
  tcC: number;
  /** Manual duty D (0…0.8). */
  dutyManual: number;
  auto: boolean;
  /** P&O step ΔD. */
  deltaD: number;
  /** Steps per second. */
  rateHz: number;
  /** «Обрізання»: array 8 kWp on a 6 kW inverter (DC/AC 1.33). */
  clipping: boolean;
}

export const MPPT_CONTROLLER_DEFAULTS: Readonly<MpptControllerParams> = Object.freeze({
  gWm2: 1000,
  tcC: 25,
  dutyManual: 0.3,
  auto: true,
  deltaD: 0.005,
  rateHz: 5,
  clipping: false,
});

/** Clipping demo: array of 8 kWp (current scaled from the 6-module string), AC cap 6 kW. */
export const CLIPPING_ARRAY_KWP = 8;
export const CLIPPING_CAP_W = 6000;

export interface MpptControllerState {
  timeS: number;
  duty: number;
  pvVoltageV: number;
  currentA: number;
  powerW: number;
  mppW: number;
  mppDuty: number;
  clipped: boolean;
}

export function createMpptController(initial: Partial<MpptControllerParams> = {}) {
  let params: MpptControllerParams = { ...MPPT_CONTROLLER_DEFAULTS, ...initial };
  const stcPmp = stringCurve(1000, 25).mpp.pW;
  const build = (): SampledCurve => {
    const scale = params.clipping ? (CLIPPING_ARRAY_KWP * 1000) / stcPmp : 1;
    return stringCurve(params.gWm2, params.tcC, 6, scale);
  };
  let curve = build();
  let duty = params.dutyManual;
  let dir: 1 | -1 = 1;
  let pPrev = 0;
  let acc = 0;
  const state: MpptControllerState = {
    timeS: 0,
    duty,
    pvVoltageV: 0,
    currentA: 0,
    powerW: 0,
    mppW: 0,
    mppDuty: 0,
    clipped: false,
  };

  const capOf = (p: number): number => (params.clipping ? Math.min(p, CLIPPING_CAP_W) : p);

  function readout(): void {
    const v = (1 - duty) * DC_LINK_V;
    const raw = curve.powerAt(v);
    const p = capOf(raw);
    state.clipped = p < raw;
    state.duty = duty;
    state.pvVoltageV = v;
    state.currentA = v > 0 ? p / v : 0;
    state.powerW = p;
    state.mppW = curve.mpp.pW;
    state.mppDuty = 1 - curve.mpp.vV / DC_LINK_V;
  }

  function iterate(): void {
    if (params.clipping && curve.powerAt((1 - duty) * DC_LINK_V) > CLIPPING_CAP_W) {
      // Above the AC limit: move right (higher U, lower D) until P ≤ cap.
      duty = Math.max(0, duty - params.deltaD);
      pPrev = capOf(curve.powerAt((1 - duty) * DC_LINK_V));
      return;
    }
    duty = Math.min(0.8, Math.max(0, duty + dir * params.deltaD));
    const p = capOf(curve.powerAt((1 - duty) * DC_LINK_V));
    if (p < pPrev) dir = dir === 1 ? -1 : 1;
    pPrev = p;
  }

  readout();
  return {
    state,
    step(dt: number): void {
      if (!(dt > 0)) return;
      state.timeS += dt;
      if (params.auto) {
        acc += dt;
        const period = 1 / Math.max(0.1, params.rateHz);
        while (acc >= period - 1e-12) {
          acc -= period;
          iterate();
        }
      } else duty = params.dutyManual;
      readout();
    },
    set(p: Partial<MpptControllerParams>): void {
      const rebuild = p.gWm2 !== undefined || p.tcC !== undefined || p.clipping !== undefined;
      params = { ...params, ...p };
      if (rebuild) curve = build();
      if (!params.auto) duty = params.dutyManual;
      readout();
    },
    curve(): SampledCurve {
      return curve;
    },
    reset(): void {
      duty = params.dutyManual;
      dir = 1;
      pPrev = 0;
      acc = 0;
      state.timeS = 0;
      curve = build();
      readout();
    },
  };
}

export type MpptController = ReturnType<typeof createMpptController>;
