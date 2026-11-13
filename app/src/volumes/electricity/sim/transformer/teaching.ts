/**
 * `transformer` Т1 (steps `mutual-induction`, `turns-ratio`): ideal transformer + magnetising current + winding
 * resistance. U₁ = 230 V, k = N₁/N₂, ℰ₂ = U₁/k; R_w = 0,02 Ω (referred to the secondary); I₂ = ℰ₂/(R_load + R_w);
 * U₂ = I₂·R_load; I₁ = √((I₂/k)² + I_m²); b = 500/N₁; I_m = 0,02·b (b ≤ 1,2), 0,02·b + 2·(b − 1,2)² above
 * (saturation chip for b > 1,2, i.e. N₁ < 417); P₂ = U₂I₂, P₁ = P₂ + I₂²R_w + P₀, P₀ = 2 W·b². Overload chip
 * I₁ > 1,2 A; I₁ > 3 A → protection opens the load (I₂ = 0). DC: U₂ = 0, I₁ = U₁/R₁ = 115 A (R₁ = 2 Ω).
 * Step 1 frequency slider: ℰ₂ ∝ f/50 (constant primary current amplitude, hence flux); f = 0 → DC case.
 */
import { clamp } from '../core/S1-sim/math';

export const TEACHING = {
  primaryV: 230,
  windingOhm: 0.02,
  primaryDcOhm: 2,
  ratedPrimaryA: 1,
  overloadA: 1.2,
  tripA: 3,
  magnetisingA: 0.02,
  saturationKnee: 1.2,
  noLoadLossW: 2,
  n1Range: { min: 300, max: 1000, step: 50, default: 500 },
  n2Range: { min: 10, max: 2000, step: 10, default: 50 },
  loadRangeOhm: { min: 1, max: 1000, default: 2.3 },
  frequencyRangeHz: { min: 0, max: 100, step: 1, default: 50 },
} as const;

export interface TeachingParams {
  primaryTurns: number;
  secondaryTurns: number;
  loadOhm: number;
  /** «Розімкнути навантаження» (or protection tripped). */
  loadConnected: boolean;
  supply: 'ac' | 'dc';
}

export interface TeachingResult {
  ratio: number;
  /** Relative core flux density b = 500/N₁. */
  fluxRelative: number;
  saturated: boolean;
  magnetisingA: number;
  /** No-load secondary EMF ℰ₂, V. */
  secondaryEmfV: number;
  secondaryV: number;
  secondaryA: number;
  primaryA: number;
  outputW: number;
  inputW: number;
  noLoadLossW: number;
  overload: boolean;
  /** Protection opened the load (I₁ would exceed 3 A). */
  tripped: boolean;
  /** Volts per turn U₁/N₁. */
  voltsPerTurn: number;
  /** DC supply: primary limited only by the winding resistance (overheat chip). */
  dcOverheat: boolean;
}

export const magnetisingCurrentA = (fluxRelative: number): number =>
  TEACHING.magnetisingA * fluxRelative + (fluxRelative > TEACHING.saturationKnee ? 2 * (fluxRelative - TEACHING.saturationKnee) ** 2 : 0);

export function teachingTransformer(p: TeachingParams): TeachingResult {
  const n1 = clamp(p.primaryTurns, TEACHING.n1Range.min, TEACHING.n1Range.max);
  const n2 = clamp(p.secondaryTurns, TEACHING.n2Range.min, TEACHING.n2Range.max);
  const k = n1 / n2;
  const b = 500 / n1;
  const im = magnetisingCurrentA(b);
  const base = { ratio: k, fluxRelative: b, saturated: b > TEACHING.saturationKnee, magnetisingA: im, voltsPerTurn: TEACHING.primaryV / n1 };
  if (p.supply === 'dc') {
    const i1 = TEACHING.primaryV / TEACHING.primaryDcOhm;
    return { ...base, secondaryEmfV: 0, secondaryV: 0, secondaryA: 0, primaryA: i1, outputW: 0, inputW: i1 * i1 * TEACHING.primaryDcOhm, noLoadLossW: 0, overload: true, tripped: false, dcOverheat: true };
  }
  const e2 = TEACHING.primaryV / k;
  const p0 = TEACHING.noLoadLossW * b * b;
  const solve = (connected: boolean): Omit<TeachingResult, keyof typeof base | 'tripped' | 'dcOverheat'> => {
    const r = clamp(p.loadOhm, TEACHING.loadRangeOhm.min, TEACHING.loadRangeOhm.max);
    const i2 = connected ? e2 / (r + TEACHING.windingOhm) : 0;
    const u2 = connected ? i2 * r : e2;
    const i1 = Math.hypot(i2 / k, im);
    const p2 = u2 * i2;
    return { secondaryEmfV: e2, secondaryV: u2, secondaryA: i2, primaryA: i1, outputW: p2, inputW: p2 + i2 * i2 * TEACHING.windingOhm + p0, noLoadLossW: p0, overload: i1 > TEACHING.overloadA };
  };
  const loaded = solve(p.loadConnected);
  if (p.loadConnected && loaded.primaryA > TEACHING.tripA) return { ...base, ...solve(false), tripped: true, dcOverheat: false };
  return { ...base, ...loaded, tripped: false, dcOverheat: false };
}

/** Step 1 frequency demo: secondary EMF amplitude ∝ f/50 at constant primary current amplitude; 0 Hz = DC. */
export const frequencyDemoEmfV = (frequencyHz: number, emfAt50HzV: number): number => (emfAt50HzV * clamp(frequencyHz, 0, 100)) / 50;
