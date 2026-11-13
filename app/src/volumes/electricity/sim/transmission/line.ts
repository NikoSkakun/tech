/**
 * transmission ЛЕП-1 (step 5): lossless line, voltage profile, Ferranti effect, surge-impedance loading.
 * Per-unit: U_s = 1 (held), base power P_nat = U²/Z_c (750 kV: 2250 MW), purely active load p = P/P_nat.
 * Receiving-end reactor B (p.u. of 1/Z_c); the toggle uses B = tan(βl/2), which makes U_r = U_s at no load.
 *   c = cos βl + B·sin βl, s = sin βl;  U_r² = (1 + √(1 − 4c²s²p²))/(2c²)  (upper, operating branch)
 *   P_max = 1/(2·c·s); profile U(x) = |U_r·(cos β(l−x) + B·sin β(l−x)) + j·(p/U_r)·sin β(l−x)|
 * (|U_s|² = U_r²c² + p²s²/U_r² from the telegraph equations with I_r = p/U_r − jB·U_r.)
 */
import { clamp } from '@electricity/sim/core/S2-sim/math';

export const BETA_RAD_PER_KM = 1.05e-3;
export const NATURAL_POWER_750_MW = 2250;
export const BASE_KV_750 = 750;
export const LENGTH_RANGE_KM = [50, 700] as const;

export interface LosslessLineParams {
  lengthKm: number;
  /** p = P/P_nat, 0…1,5. */
  loadPu: number;
  reactor: boolean;
}

export interface LosslessLineResult {
  /** null = voltage collapse (no solution, P > P_max). */
  receivingPu: number | null;
  receivingKV: number | null;
  powerMW: number;
  maxPowerPu: number;
  /** Reactor susceptance used [p.u.]. */
  reactorPu: number;
  collapse: boolean;
  /** Receiving voltage inside 0,95…1,05 p.u. */
  inNormalBand: boolean;
}

export function reactorSusceptancePu(lengthKm: number): number {
  return Math.tan((BETA_RAD_PER_KM * lengthKm) / 2);
}

export function solveLosslessLine(p: LosslessLineParams): LosslessLineResult {
  const l = clamp(p.lengthKm, LENGTH_RANGE_KM[0], LENGTH_RANGE_KM[1]);
  const bl = BETA_RAD_PER_KM * l;
  const B = p.reactor ? reactorSusceptancePu(l) : 0;
  const c = Math.cos(bl) + B * Math.sin(bl);
  const s = Math.sin(bl);
  const pu = clamp(p.loadPu, 0, 1.5);
  const disc = 1 - 4 * c * c * s * s * pu * pu;
  const maxPowerPu = 1 / (2 * c * s);
  const ur = disc < 0 ? null : Math.sqrt((1 + Math.sqrt(disc)) / (2 * c * c));
  return {
    receivingPu: ur,
    receivingKV: ur === null ? null : ur * BASE_KV_750,
    powerMW: pu * NATURAL_POWER_750_MW,
    maxPowerPu,
    reactorPu: B,
    collapse: ur === null,
    inNormalBand: ur !== null && ur >= 0.95 && ur <= 1.05,
  };
}

/** Voltage profile U(x) [p.u.] at `samples` points from x = 0 to l (empty on collapse). */
export function voltageProfile(p: LosslessLineParams, samples = 51): { xKm: number; uPu: number }[] {
  const r = solveLosslessLine(p);
  if (r.receivingPu === null) return [];
  const l = clamp(p.lengthKm, LENGTH_RANGE_KM[0], LENGTH_RANGE_KM[1]);
  const ur = r.receivingPu;
  const pu = clamp(p.loadPu, 0, 1.5);
  return Array.from({ length: samples }, (_, i) => {
    const x = (l * i) / (samples - 1);
    const a = BETA_RAD_PER_KM * (l - x);
    const re = ur * (Math.cos(a) + r.reactorPu * Math.sin(a));
    const im = (pu / ur) * Math.sin(a);
    return { xKm: x, uPu: Math.hypot(re, im) };
  });
}

/** Corona glow level of the step-5 inset: bundled+dry 0, bundled+rain 1, single+dry 2, single+rain 3. */
export function coronaLevel(bundled: boolean, rain: boolean): 0 | 1 | 2 | 3 {
  return ((bundled ? 0 : 2) + (rain ? 1 : 0)) as 0 | 1 | 2 | 3;
}
