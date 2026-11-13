/**
 * `current` step `current` (electron counter N = I·t/e) and «Модель симуляції» §2 (step `drift`):
 * v_d = I/(n_Cu·e·A), n_Cu = 8,49×10²⁸ m⁻³; electron time over L = 3 m t_e = L/v_d; signal time
 * t_s = L/(0,7·c) (velocity factor 0,7 for PVC cable, shown with «~»); front animation 1,5 s for 3 m
 * («сповільнено ×10⁸»); snail distance s = v_d·t.
 */
import { ELEMENTARY_CHARGE_C } from '../core/S1-sim/constants';
import { clamp } from '../core/S1-sim/math';

/** `current` §1 uses c = 2,998×10⁸ m/s. */
const C_DOC = 2.998e8;
export const COPPER_ELECTRON_DENSITY_PER_M3 = 8.49e28;
export const DRIFT = {
  wireLengthM: 3,
  velocityFactor: 0.7,
  frontSceneS: 1.5,
  currentRangeA: { min: 0.1, max: 16, step: 0.1, default: 1 },
  crossSectionsMm2: [0.5, 1, 1.5, 2.5, 6] as const,
} as const;

/** Step `current`: electrons per second N/t = I/e (0,3 A → 1,87×10¹⁸ e⁻/s). */
export const electronsPerSecond = (currentA: number): number => currentA / ELEMENTARY_CHARGE_C;
/** Step `current` slider 0…10 A; above 1 A the battery becomes a «лабораторне джерело». */
export const CURRENT_STEP = { rangeA: { min: 0, max: 10, step: 0.1, default: 0.3 }, labSupplyAboveA: 1 } as const;

export interface DriftResult {
  driftMPerS: number;
  /** Time for an electron to cross 3 m, s. */
  electronTimeS: number;
  /** Signal time over 3 m, s (≈ 14 ns). */
  signalTimeS: number;
  /** Visual slow-down of the signal front (1,5 s / t_s ≈ 10⁸). */
  slowdown: number;
}

export function drift(currentA: number, crossSectionMm2: number): DriftResult {
  const i = clamp(currentA, DRIFT.currentRangeA.min, DRIFT.currentRangeA.max);
  const vd = i / (COPPER_ELECTRON_DENSITY_PER_M3 * ELEMENTARY_CHARGE_C * crossSectionMm2 * 1e-6);
  const ts = DRIFT.wireLengthM / (DRIFT.velocityFactor * C_DOC);
  return { driftMPerS: vd, electronTimeS: DRIFT.wireLengthM / vd, signalTimeS: ts, slowdown: DRIFT.frontSceneS / ts };
}

/** Snail path after t seconds of real time, m (1 A, 1 mm² → 74 μm/s). */
export const snailDistanceM = (currentA: number, crossSectionMm2: number, tS: number): number => drift(currentA, crossSectionMm2).driftMPerS * tS;
