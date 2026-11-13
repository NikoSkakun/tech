/**
 * MPPT: perturb-and-observe with an optional global scan (`lab-pv` §M2, `lab-inverter` step 7;
 * oracle `tools/ref-models/C6-labs/mppt_po.py`).
 *
 *   state: V_ref, d ∈ {−1, +1}, P_prev
 *   init:  V_ref = 0.8·Voc, d = −1, P_prev = P(V_ref)
 *   step:  V_ref += d·ΔV;  P = V_ref·I(V_ref);  if P < P_prev: d = −d;  P_prev = P
 *   I(V):  linear interpolation over the sampled curve (points sorted by V)
 *   scan:  V_j = Voc·(0.1 + 0.85·j/40), j = 0…40 → V_ref = argmax P(V_j), then P&O continues
 */
import { interp1 } from './num';
import { type IvPoint } from './pv';

/** A sampled I-V curve with I(V) by linear interpolation (what a real tracker "sees"). */
export class SampledCurve {
  readonly vs: Float64Array;
  readonly is: Float64Array;
  readonly vocV: number;
  readonly mpp: IvPoint;

  constructor(points: readonly IvPoint[]) {
    const sorted = [...points].sort((a, b) => a.vV - b.vV);
    this.vs = Float64Array.from(sorted, (p) => p.vV);
    this.is = Float64Array.from(sorted, (p) => p.iA);
    this.vocV = sorted.length ? sorted[sorted.length - 1]!.vV : 0;
    let best: IvPoint = { vV: 0, iA: 0, pW: 0 };
    for (const p of sorted) if (p.pW > best.pW) best = p;
    this.mpp = best;
  }

  /** I(V); 0 above V_oc, I at the lowest sampled voltage below it. */
  currentAt(vV: number): number {
    if (vV > this.vocV) return 0;
    return interp1(this.vs, this.is, vV);
  }

  powerAt(vV: number): number {
    return vV * this.currentAt(vV);
  }
}

export interface PoState {
  vRefV: number;
  /** Perturbation direction. */
  dir: -1 | 1;
  pPrevW: number;
  /** Power at the current operating point, W. */
  pW: number;
  iterations: number;
}

/** Initial P&O state on a curve: V_ref = 0.8·Voc, d = −1. */
export function poInit(curve: SampledCurve, v0V?: number): PoState {
  const v = v0V ?? 0.8 * curve.vocV;
  const p = curve.powerAt(v);
  return { vRefV: v, dir: -1, pPrevW: p, pW: p, iterations: 0 };
}

/** One P&O iteration (mutates and returns `s`). V_ref is kept within [0, 1.05·Voc] to stay on the chart. */
export function poIterate(s: PoState, curve: SampledCurve, deltaVV: number): PoState {
  s.vRefV = Math.min(Math.max(s.vRefV + s.dir * deltaVV, 0), 1.05 * Math.max(curve.vocV, deltaVV));
  const p = curve.powerAt(s.vRefV);
  if (p < s.pPrevW) s.dir = s.dir === 1 ? -1 : 1;
  s.pPrevW = p;
  s.pW = p;
  s.iterations++;
  return s;
}

export interface ScanResult {
  /** The probed points (for the «trolley on a rope» animation). */
  samples: { vV: number; pW: number }[];
  best: { vV: number; pW: number };
}

/** Global scan: 41 points V_j = Voc·(0.1 + 0.85·j/n). */
export function globalScan(curve: SampledCurve, n = 40): ScanResult {
  const samples: { vV: number; pW: number }[] = [];
  let best = { vV: 0, pW: -Infinity };
  for (let j = 0; j <= n; j++) {
    const v = curve.vocV * (0.1 + (0.85 * j) / n);
    const p = curve.powerAt(v);
    samples.push({ vV: v, pW: p });
    if (p > best.pW) best = { vV: v, pW: p };
  }
  return { samples, best };
}
