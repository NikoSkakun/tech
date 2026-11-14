/**
 * Glue between the gas-turbine model (M1, `@electricity/sim/plant-gas`) and the hero machine: one sample for
 * the current pressure ratio and turbine-inlet temperature drives the flow colours, the work arrows, the
 * charts and the numbers alike. The T–s contour of the cycle is derived here from the same states (cold-air
 * standard: s measured from state 1, Δs = c_p·ln(T/T_ref) along isobars, irreversible compression and
 * expansion as straight segments in the T–s plane).
 */
import { gasTurbine, GT, type GasTurbineResult } from '@electricity/sim/plant-gas';
import type { GtFlow } from '../parts/gt-flow';
import type { WorkArrows } from '../parts/work-arrows';

export interface GtState {
  r: number;
  titC: number;
  res: GasTurbineResult;
}

export interface TsContour {
  /** States 1…4: s [kJ/(kg·K)], t [°C]. */
  points: { s: number; t: number }[];
  /** Closed contour 1→2→3→4→1 as polyline. */
  loop: { s: number[]; t: number[] };
  /** Lower and upper boundary over a common s grid (for the filled area = work). */
  grid: { s: number[]; lower: number[]; upper: number[] };
}

const K0 = 273.15;

export function tsContour(r: number, titC: number): TsContour {
  const { cp, gamma, t1K } = GT;
  const res = gasTurbine(r, titC);
  const tau = r ** ((gamma - 1) / gamma);
  const T1 = t1K;
  const T2 = res.t2C + K0;
  const T3 = titC + K0;
  const T4 = res.t4C + K0;
  const s2 = cp * Math.log(T2 / (T1 * tau)); // entropy made by compressor losses
  const s3 = s2 + cp * Math.log(T3 / T2);
  const s4 = s3 + cp * Math.log(T4 / (T3 / tau));
  const isobarHigh = (s: number): number => T2 * Math.exp((s - s2) / cp);
  const isobarLow = (s: number): number => T1 * Math.exp(s / cp);
  const loop = { s: [] as number[], t: [] as number[] };
  const push = (s: number, T: number): void => void (loop.s.push(s), loop.t.push(T - K0));
  push(0, T1);
  push(s2, T2);
  for (let k = 1; k <= 24; k++) push(s2 + ((s3 - s2) * k) / 24, isobarHigh(s2 + ((s3 - s2) * k) / 24));
  push(s4, T4);
  for (let k = 23; k >= 0; k--) push((s4 * k) / 24, isobarLow((s4 * k) / 24));
  const grid = { s: [] as number[], lower: [] as number[], upper: [] as number[] };
  const N = 60;
  for (let k = 0; k <= N; k++) {
    const s = (s4 * k) / N;
    const up = s <= s2 ? T1 + ((T2 - T1) * s) / Math.max(1e-6, s2) : s <= s3 ? isobarHigh(s) : T3 + ((T4 - T3) * (s - s3)) / Math.max(1e-6, s4 - s3);
    grid.s.push(s);
    grid.lower.push(isobarLow(s) - K0);
    grid.upper.push(Math.max(isobarLow(s), up) - K0);
  }
  return { points: [{ s: 0, t: T1 - K0 }, { s: s2, t: T2 - K0 }, { s: s3, t: T3 - K0 }, { s: s4, t: T4 - K0 }], loop, grid };
}

export interface GtBinding {
  state: GtState;
  /** Recompute for (r, TIT) if they changed; returns true when the sample changed. */
  set(r: number, titC: number): boolean;
  /** Push the current sample to the flows and arrows. */
  apply(flow: GtFlow, arrows: WorkArrows): void;
}

export function bindGt(): GtBinding {
  const state: GtState = { r: 20, titC: 1600, res: gasTurbine(20, 1600) };
  return {
    state,
    set(r, titC) {
      if (r === state.r && titC === state.titC) return false;
      state.r = r;
      state.titC = titC;
      state.res = gasTurbine(r, titC);
      return true;
    },
    apply(flow, arrows) {
      const { res, titC } = state;
      flow.setTemps(15, res.t2C, titC, res.t4C);
      arrows.set(res.wTurbKJkg, res.wCompKJkg);
    },
  };
}
