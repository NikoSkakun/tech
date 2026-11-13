/**
 * `atom` «Модель симуляції» §1 (step `nucleus`) — illustrative comparison of the Coulomb repulsion of two
 * protons (exact, F_C = k·e²/r²) and an *illustrative* strong attraction F_s = F₀·exp(−(r − r₀)/λ) with a hard
 * core at r₀ (UI must show «спрощена модель»). Parameters reproduce the order of magnitude of the Reid (1968)
 * nucleon–nucleon force.
 */
import { COULOMB_K, ELEMENTARY_CHARGE_C } from '../core/S1-sim/constants';
import { bisect, clamp } from '../core/S1-sim/math';

/** F₀ = 25 000 N at the hard core r₀ = 1,0 fm, decay length λ = 0,45 fm. */
export const STRONG_F0_N = 25000;
export const STRONG_R0_FM = 1.0;
export const STRONG_LAMBDA_FM = 0.45;
/** Drag range of the proton, fm (closer than 1,0 fm is blocked). */
export const NUCLEON_DISTANCE_RANGE_FM = { min: 1.0, max: 6.0 } as const;
/** Log chart axis 1…10⁵ N. */
export const FORCE_CHART_RANGE_N = { min: 1, max: 1e5 } as const;

/** Exact Coulomb force between two protons at centre distance r (fm), N. k·e² = 2,307×10⁻²⁸ N·m². */
export function coulombForceN(distanceFm: number): number {
  const r = distanceFm * 1e-15;
  return (COULOMB_K * ELEMENTARY_CHARGE_C * ELEMENTARY_CHARGE_C) / (r * r);
}

/** Illustrative strong attraction, N (evaluated at max(r, r₀): inside the hard core the proton cannot go). */
export function strongForceN(distanceFm: number): number {
  const r = Math.max(distanceFm, STRONG_R0_FM);
  return STRONG_F0_N * Math.exp(-(r - STRONG_R0_FM) / STRONG_LAMBDA_FM);
}

/** Distance where F_s = F_C ≈ 4,45 fm — the "escape" threshold of the drag interaction. */
export const FORCE_CROSSOVER_FM = bisect((r) => strongForceN(r) - coulombForceN(r), 1, 6);

export interface NucleonForces {
  /** Clamped distance actually used, fm. */
  distanceFm: number;
  coulombN: number;
  strongN: number;
  /** F_s / F_C. */
  ratio: number;
  dominant: 'strong' | 'coulomb';
  /** Released here, the proton flies away (Coulomb wins); otherwise it springs back. */
  escapesOnRelease: boolean;
}

export function nucleonForces(distanceFm: number): NucleonForces {
  const r = clamp(distanceFm, NUCLEON_DISTANCE_RANGE_FM.min, NUCLEON_DISTANCE_RANGE_FM.max);
  const fc = coulombForceN(r);
  const fs = strongForceN(r);
  return { distanceFm: r, coulombN: fc, strongN: fs, ratio: fs / fc, dominant: fs > fc ? 'strong' : 'coulomb', escapesOnRelease: fs <= fc };
}
