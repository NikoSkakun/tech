/**
 * `matter` «Модель симуляції» §1 (materials) and §5 (step `resistance`):
 * ρ(T) = ρ₂₀·(1 + α·(T − 20)) + Δρ_imp, T in °C, −100…+300 °C (linear model, chip «спрощена модель»);
 * Matthiessen impurities Δρ_imp = x·1,0×10⁻⁸ Ω·m per 1 % (x = 0…2 %, step 0,1).
 * Hg sub-scene: ρ = 0 below T_c = 4,15 K, ρ_res = 1×10⁻¹⁰ Ω·m above (step graph only).
 */
import { KELVIN_OFFSET } from '../core/S1-sim/constants';
import { clamp } from '../core/S1-sim/math';

export type MetalId = 'Cu' | 'Al' | 'Fe' | 'W' | 'NiCr';

export const METALS: Readonly<Record<MetalId, { resistivity20OhmM: number; alphaPerK: number }>> = {
  Cu: { resistivity20OhmM: 1.68e-8, alphaPerK: 0.0039 },
  Al: { resistivity20OhmM: 2.65e-8, alphaPerK: 0.004 },
  Fe: { resistivity20OhmM: 9.7e-8, alphaPerK: 0.0055 },
  W: { resistivity20OhmM: 5.6e-8, alphaPerK: 0.0045 },
  NiCr: { resistivity20OhmM: 1.1e-6, alphaPerK: 0.0004 },
};

export const RESISTANCE_RANGES = {
  temperatureC: { min: -100, max: 300, step: 5, default: 20 },
  impurityPct: { min: 0, max: 2, step: 0.1, default: 0 },
} as const;

/** Δρ per 1 % impurity, Ω·m (illustrative). */
export const IMPURITY_RESISTIVITY_PER_PCT = 1.0e-8;

export function resistivityOhmM(metal: MetalId, temperatureC: number, impurityPct = 0): number {
  const m = METALS[metal];
  const t = clamp(temperatureC, RESISTANCE_RANGES.temperatureC.min, RESISTANCE_RANGES.temperatureC.max);
  const x = clamp(impurityPct, RESISTANCE_RANGES.impurityPct.min, RESISTANCE_RANGES.impurityPct.max);
  return m.resistivity20OhmM * (1 + m.alphaPerK * (t - 20)) + x * IMPURITY_RESISTIVITY_PER_PCT;
}

export interface ResistanceVisuals {
  resistivityOhmM: number;
  /** Ion jitter amplitude ∝ √T_K, normalised to 1 at 20 °C. */
  jitterRelative: number;
  /** Scattering frequency ∝ ρ, normalised to 1 for pure Cu at 20 °C. */
  scatteringRelative: number;
}

export function resistanceVisuals(metal: MetalId, temperatureC: number, impurityPct = 0): ResistanceVisuals {
  const rho = resistivityOhmM(metal, temperatureC, impurityPct);
  return {
    resistivityOhmM: rho,
    jitterRelative: Math.sqrt((temperatureC + KELVIN_OFFSET) / (20 + KELVIN_OFFSET)),
    scatteringRelative: rho / METALS.Cu.resistivity20OhmM,
  };
}

export const MERCURY = { criticalTemperatureK: 4.15, residualResistivityOhmM: 1e-10, range: { min: 2, max: 10, step: 0.05 } } as const;

export function mercuryResistivityOhmM(temperatureK: number): { resistivityOhmM: number; superconducting: boolean } {
  const sc = temperatureK < MERCURY.criticalTemperatureK;
  return { resistivityOhmM: sc ? 0 : MERCURY.residualResistivityOhmM, superconducting: sc };
}
