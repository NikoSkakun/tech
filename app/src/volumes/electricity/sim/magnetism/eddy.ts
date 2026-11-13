/**
 * `magnetism` М6 (step `lenz`) — phenomenological magnetic braking in tubes: m·dv/dt = m·g − k·v, v(0) = 0,
 * magnet 0,02 kg. Cu (1,5 mm wall) v_t = 0,15 m/s → k = m·g/v_t = 1,308 N·s/m; Al k_Al = k_Cu·3,77/5,96 = 0,827;
 * PVC k = 0; slotted Cu k = 0,25·k_Cu. Exact solution: v(t) = v_t(1 − e^(−t/τ)), τ = m/k = v_t/g;
 * x(t) = v_t·t − v_t·τ·(1 − e^(−t/τ)). Pass time of L = 1 m ≈ L/v_t + v_t/g (document estimate; the exact
 * value agrees to < 10⁻⁶ s for these k). Wall heat P = k·v².
 * Lenz ring demo: deflection ∝ magnet speed, max 15°; slotted ring does not react.
 */
import { GRAVITY_M_PER_S2 } from '../core/S1-sim/constants';
import { bisect, clamp } from '../core/S1-sim/math';

export type TubeId = 'pvc' | 'aluminium' | 'copper' | 'copperSlotted';

export const EDDY = { magnetKg: 0.02, tubeLengthM: 1, copperTerminalMPerS: 0.15, alConductivityRatio: 3.77 / 5.96, slotFactor: 0.25, ringMaxDeg: 15, ringFullSpeedMPerS: 1 } as const;

export function brakingCoefficient(tube: TubeId): number {
  const kCu = (EDDY.magnetKg * GRAVITY_M_PER_S2) / EDDY.copperTerminalMPerS;
  switch (tube) {
    case 'pvc':
      return 0;
    case 'copper':
      return kCu;
    case 'aluminium':
      return kCu * EDDY.alConductivityRatio;
    case 'copperSlotted':
      return kCu * EDDY.slotFactor;
  }
}

export const terminalVelocity = (tube: TubeId): number => {
  const k = brakingCoefficient(tube);
  return k > 0 ? (EDDY.magnetKg * GRAVITY_M_PER_S2) / k : Infinity;
};

/** Fall state at time t (exact), from rest at the tube top. */
export function tubeFall(tube: TubeId, tS: number): { distanceM: number; speedMPerS: number; heatW: number } {
  const t = Math.max(tS, 0);
  const k = brakingCoefficient(tube);
  if (k === 0) return { distanceM: 0.5 * GRAVITY_M_PER_S2 * t * t, speedMPerS: GRAVITY_M_PER_S2 * t, heatW: 0 };
  const vt = terminalVelocity(tube);
  const tau = vt / GRAVITY_M_PER_S2;
  const e = Math.exp(-t / tau);
  const v = vt * (1 - e);
  return { distanceM: vt * t - vt * tau * (1 - e), speedMPerS: v, heatW: k * v * v };
}

/** Time to fall through the tube: exact (bisection) and the document's estimate L/v_t + v_t/g. */
export function tubeTransitTime(tube: TubeId, lengthM: number = EDDY.tubeLengthM): { exactS: number; estimateS: number } {
  const vt = terminalVelocity(tube);
  const estimate = Number.isFinite(vt) ? lengthM / vt + vt / GRAVITY_M_PER_S2 : Math.sqrt((2 * lengthM) / GRAVITY_M_PER_S2);
  const exact = bisect((t) => tubeFall(tube, t).distanceM - lengthM, 0, 100);
  return { exactS: exact, estimateS: estimate };
}

/** Lenz ring deflection, degrees: away from an approaching magnet (+), towards a receding one (−). */
export function lenzRingDeflectionDeg(approachSpeedMPerS: number, slotted: boolean): number {
  if (slotted) return 0;
  return clamp((approachSpeedMPerS / EDDY.ringFullSpeedMPerS) * EDDY.ringMaxDeg, -EDDY.ringMaxDeg, EDDY.ringMaxDeg);
}
