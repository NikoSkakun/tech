/**
 * `lab-pv` step 10 «MPPT: альпініст на P-V кривій» — time-domain wrapper around the P&O tracker (§M2).
 *
 * The ЛМ-440 curve is rebuilt from the current irradiance (cloud ramp 1000 → 300 W/m² in 2 s and back in 2 s,
 * linear) and the partial-shading toggle (section 3 at half the irradiance, i.e. 500 W/m² at 1000).
 * One P&O iteration happens every 1/f_mppt seconds of simulated time.
 */
import {
  type ScanResult,
  SampledCurve,
  globalScan,
  poInit,
  poIterate,
  type PoState,
} from '../core/S3-sim/mppt';
import { PvString } from '../core/S3-sim/pv';

export interface MpptSimParams {
  /** Perturbation step ΔV, V (0.1…3, default 0.5). */
  deltaVV: number;
  /** Iteration rate, Hz (1…20, default 5; visual speed). */
  frequencyHz: number;
  /** «Часткове затінення»: section 3 at half irradiance. */
  partialShading: boolean;
  /** Start/Pause. */
  running: boolean;
  /** Cell temperature, °C (default 25). */
  tcC: number;
}

export const MPPT_SIM_DEFAULTS: Readonly<MpptSimParams> = Object.freeze({
  deltaVV: 0.5,
  frequencyHz: 5,
  partialShading: false,
  running: true,
  tcC: 25,
});

export interface MpptSimState {
  timeS: number;
  /** Current irradiance, W/m². */
  gWm2: number;
  vRefV: number;
  /** Tracker power, W. */
  pW: number;
  /** True MPP of the current curve, W. */
  pMppW: number;
  vMppV: number;
  /** η_MPPT = ΣP/ΣP_mp over the last 10 s (1 before any sample). */
  etaLast10s: number;
  cloudActive: boolean;
  iterations: number;
  /** Last global scan (for the animation), if any. */
  lastScan: ScanResult | null;
}

/** Cloud profile: G(t) linear 1000 → 300 W/m² over 2 s, then back over 2 s. */
export function cloudIrradiance(tSinceStartS: number): number {
  if (tSinceStartS <= 0) return 1000;
  if (tSinceStartS < 2) return 1000 - 350 * tSinceStartS;
  if (tSinceStartS < 4) return 300 + 350 * (tSinceStartS - 2);
  return 1000;
}

function buildCurve(gWm2: number, shading: boolean, tcC: number): SampledCurve {
  const str = new PvString({ modules: [[gWm2, gWm2, shading ? gWm2 / 2 : gWm2]], tcC, bypass: true });
  return new SampledCurve(str.curve(600));
}

export function createMpptSim(initial: Partial<MpptSimParams> = {}) {
  let params: MpptSimParams = { ...MPPT_SIM_DEFAULTS, ...initial };
  let curve = buildCurve(1000, params.partialShading, params.tcC);
  let po: PoState = poInit(curve);
  let acc = 0;
  let cloudStart = -1;
  const window: { t: number; p: number; pm: number }[] = [];
  const state: MpptSimState = {
    timeS: 0,
    gWm2: 1000,
    vRefV: po.vRefV,
    pW: po.pW,
    pMppW: curve.mpp.pW,
    vMppV: curve.mpp.vV,
    etaLast10s: 1,
    cloudActive: false,
    iterations: 0,
    lastScan: null,
  };

  function refresh(): void {
    const g = cloudStart >= 0 ? cloudIrradiance(state.timeS - cloudStart) : 1000;
    if (cloudStart >= 0 && state.timeS - cloudStart >= 4) cloudStart = -1;
    state.cloudActive = cloudStart >= 0;
    if (g !== state.gWm2) {
      state.gWm2 = g;
      curve = buildCurve(g, params.partialShading, params.tcC);
    }
    state.pMppW = curve.mpp.pW;
    state.vMppV = curve.mpp.vV;
  }

  function iterate(): void {
    poIterate(po, curve, params.deltaVV);
    state.vRefV = po.vRefV;
    state.pW = po.pW;
    state.iterations = po.iterations;
    window.push({ t: state.timeS, p: po.pW, pm: curve.mpp.pW });
    while (window.length && window[0]!.t < state.timeS - 10) window.shift();
    let sp = 0;
    let sm = 0;
    for (const w of window) {
      sp += w.p;
      sm += w.pm;
    }
    state.etaLast10s = sm > 0 ? sp / sm : 1;
  }

  return {
    state,
    /** Advance simulated time by dt seconds (any dt; iterations happen at f_mppt). */
    step(dt: number): void {
      if (!(dt > 0)) return;
      const period = 1 / Math.max(0.1, params.frequencyHz);
      let remaining = dt;
      while (remaining > 0) {
        const h = params.running ? Math.min(remaining, period - acc) : remaining;
        state.timeS += h;
        remaining -= h;
        refresh();
        if (!params.running) break;
        acc += h;
        if (acc >= period - 1e-12) {
          acc = 0;
          iterate();
        }
      }
      // Readout of the instantaneous tracker power on the (possibly changed) curve.
      state.pW = curve.powerAt(state.vRefV);
    },
    set(p: Partial<MpptSimParams>): void {
      const shadingChanged = p.partialShading !== undefined && p.partialShading !== params.partialShading;
      const tChanged = p.tcC !== undefined && p.tcC !== params.tcC;
      params = { ...params, ...p };
      if (shadingChanged || tChanged) {
        curve = buildCurve(state.gWm2, params.partialShading, params.tcC);
        state.pMppW = curve.mpp.pW;
        state.vMppV = curve.mpp.vV;
        po.pPrevW = curve.powerAt(po.vRefV);
      }
    },
    /** «Набігла хмара». */
    startCloud(): void {
      cloudStart = state.timeS;
      state.cloudActive = true;
    },
    /** «Глобальне сканування»: probe 41 points, jump to the best one, then P&O continues from there. */
    globalScan(): ScanResult {
      const res = globalScan(curve);
      po = poInit(curve, res.best.vV);
      state.vRefV = po.vRefV;
      state.pW = po.pW;
      state.lastScan = res;
      return res;
    },
    /** Current sampled curve (for drawing the P-V chart). */
    curve(): SampledCurve {
      return curve;
    },
    params(): Readonly<MpptSimParams> {
      return params;
    },
    reset(): void {
      cloudStart = -1;
      acc = 0;
      window.length = 0;
      state.timeS = 0;
      state.gWm2 = 1000;
      curve = buildCurve(1000, params.partialShading, params.tcC);
      po = poInit(curve);
      Object.assign(state, {
        vRefV: po.vRefV,
        pW: po.pW,
        pMppW: curve.mpp.pW,
        vMppV: curve.mpp.vV,
        etaLast10s: 1,
        cloudActive: false,
        iterations: 0,
        lastScan: null,
      });
    },
  };
}

export type MpptSim = ReturnType<typeof createMpptSim>;
