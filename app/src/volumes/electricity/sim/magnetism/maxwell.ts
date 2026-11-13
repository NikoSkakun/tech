/**
 * `magnetism` step `maxwell`: (A) wave slider f = 10⁶…10¹⁸ Hz (log, default 5×10¹⁴) → λ = c/f and spectrum band;
 * c = 1/√(μ₀ε₀). (B) battery 0…24 V, load 1…100 Ω (log, default 12 Ω): I = U/R, P = U·I = U²/R — the Poynting flux
 * through any surface around the resistor equals U·I (12 V, 12 Ω → 1 A, 12 W; 24 V, 1 Ω → 576 W).
 * Visual densities: S arrows ∝ P, E lines ∝ U, B rings ∝ I (normalised to the slider maxima).
 */
import { EPSILON_0_F_PER_M, MU_0_H_PER_M } from '../core/S1-sim/constants';
import { clamp } from '../core/S1-sim/math';
import { emBand, wavelengthFromFrequencyM, type EmBand } from '../core/S1-sim/spectrum';

export const MAXWELL = {
  frequencyRangeHz: { min: 1e6, max: 1e18, default: 5e14 },
  batteryRangeV: { min: 0, max: 24, step: 1, default: 12 },
  loadRangeOhm: { min: 1, max: 100, default: 12 },
} as const;

/** c = 1/√(μ₀·ε₀) ≈ 2,998×10⁸ m/s (recovered from the constants). */
export const speedOfLightFromConstants = (): number => 1 / Math.sqrt(MU_0_H_PER_M * EPSILON_0_F_PER_M);

export function emWave(frequencyHz: number): { wavelengthM: number; band: EmBand } {
  const f = clamp(frequencyHz, MAXWELL.frequencyRangeHz.min, MAXWELL.frequencyRangeHz.max);
  return { wavelengthM: wavelengthFromFrequencyM(f), band: emBand(f) };
}

export function poyntingCircuit(voltageV: number, loadOhm: number): { currentA: number; powerW: number; fieldDensity: number; ringDensity: number; fluxDensity: number } {
  const u = clamp(voltageV, MAXWELL.batteryRangeV.min, MAXWELL.batteryRangeV.max);
  const r = clamp(loadOhm, MAXWELL.loadRangeOhm.min, MAXWELL.loadRangeOhm.max);
  const i = u / r;
  const p = u * i;
  const uMax = MAXWELL.batteryRangeV.max;
  const iMax = uMax / MAXWELL.loadRangeOhm.min;
  return { currentA: i, powerW: p, fieldDensity: u / uMax, ringDensity: i / iMax, fluxDensity: p / (uMax * iMax) };
}
