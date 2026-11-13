/**
 * `generator-ac` Г4 (step `rotating-field`) and step `synchronous-generator`.
 * Г4: n_s = 60f/p; Kloss T(s) = 2T_max/(s/s_k + s_k/s) on the stable branch 0 < s < s_k, solved by bisection;
 * 7,5 kW, p = 2: T_n = 7500/(1455·2π/60) = 49,22 N·m, T_max = 2,5·T_n, s_k = 0,1437; load > 250 % → pull-out
 * (stall). Slip does not depend on p; n = n_s·(1 − s). Start-up animation: fixed 1,5 s ramp (Kloss underestimates
 * the starting torque). Rotating field of three coils: |B| = 1,5·B_max, angle ωt/p (reversed when two phases swap).
 * Synchronous generator: n = 60·50/p; open-circuit EMF with saturation ℰ = ℰ₀·tanh(1,2·i_f)/tanh(1,2),
 * ℰ₀ = 24 kV (DECISIONS §37 reference unit), i_f = 0,5…1,5.
 */
import { bisect, clamp } from '../core/S1-sim/math';

export const INDUCTION_MOTOR = {
  ratedPowerW: 7500,
  ratedSpeedRpm: 1455,
  breakdownRatio: 2.5,
  criticalSlip: 0.1437,
  polePairsRange: { min: 1, max: 4 },
  loadRangePct: { min: 0, max: 300, step: 5, default: 100 },
  overloadZonePct: [150, 250] as const,
  startRampS: 1.5,
} as const;

export const RATED_TORQUE_NM = INDUCTION_MOTOR.ratedPowerW / ((INDUCTION_MOTOR.ratedSpeedRpm * 2 * Math.PI) / 60);
export const BREAKDOWN_TORQUE_NM = INDUCTION_MOTOR.breakdownRatio * RATED_TORQUE_NM;

export const synchronousSpeedRpm = (frequencyHz: number, polePairs: number): number => (60 * frequencyHz) / polePairs;

/** Kloss formula T(s), N·m. */
export function klossTorque(slip: number): number {
  const sk = INDUCTION_MOTOR.criticalSlip;
  return slip <= 0 ? 0 : (2 * BREAKDOWN_TORQUE_NM) / (slip / sk + sk / slip);
}

export interface MotorOperatingPoint {
  /** null when the load exceeds T_max (pull-out). */
  slip: number | null;
  speedRpm: number;
  synchronousRpm: number;
  stalled: boolean;
  zone: 'normal' | 'overload' | 'pullOut';
  /** Rotor bar current indicator ∝ slip (s/s_k, 0…1). */
  rotorCurrentRelative: number;
}

export function inductionMotorPoint(loadPct: number, polePairs = 2, frequencyHz = 50): MotorOperatingPoint {
  const ns = synchronousSpeedRpm(frequencyHz, clamp(Math.round(polePairs), 1, 4));
  const load = clamp(loadPct, INDUCTION_MOTOR.loadRangePct.min, INDUCTION_MOTOR.loadRangePct.max) / 100;
  const sk = INDUCTION_MOTOR.criticalSlip;
  if (load * RATED_TORQUE_NM > BREAKDOWN_TORQUE_NM * (1 + 1e-12)) return { slip: null, speedRpm: 0, synchronousRpm: ns, stalled: true, zone: 'pullOut', rotorCurrentRelative: 1 };
  const s = load <= 0 ? 0 : load >= INDUCTION_MOTOR.breakdownRatio - 1e-12 ? sk : bisect((x) => klossTorque(x) - load * RATED_TORQUE_NM, 1e-12, sk, 100);
  const pct = load * 100;
  return { slip: s, speedRpm: ns * (1 - s), synchronousRpm: ns, stalled: false, zone: pct > INDUCTION_MOTOR.overloadZonePct[0] ? 'overload' : 'normal', rotorCurrentRelative: s / sk };
}

/**
 * Resultant stator field of three coils at 120° fed by a symmetric set: constant magnitude 1,5·B_max rotating
 * mechanically at ω/p (direction −1 after swapping two phases). Returns the angle in rad and |B|/B_max.
 */
export function rotatingFieldAngle(tS: number, frequencyHz = 50, polePairs = 1, direction: 1 | -1 = 1): { angleRad: number; magnitudeRelative: number } {
  return { angleRad: (direction * 2 * Math.PI * frequencyHz * tS) / polePairs, magnitudeRelative: 1.5 };
}

export const SYNCHRONOUS_GENERATOR = { ratedEmfKV: 24, saturation: 1.2, fieldCurrentRange: { min: 0.5, max: 1.5, step: 0.01, default: 1 }, polePairs: { turbo: 1, hydro: 40 } } as const;

/** n = 60·50/p rpm (turbo p = 1 → 3000; hydro p = 40 → 75). */
export const generatorSpeedRpm = (polePairs: number): number => synchronousSpeedRpm(50, polePairs);

/** Open-circuit EMF with core saturation, kV. */
export const openCircuitEmfKV = (fieldCurrentPu: number): number =>
  (SYNCHRONOUS_GENERATOR.ratedEmfKV * Math.tanh(SYNCHRONOUS_GENERATOR.saturation * fieldCurrentPu)) / Math.tanh(SYNCHRONOUS_GENERATOR.saturation);
