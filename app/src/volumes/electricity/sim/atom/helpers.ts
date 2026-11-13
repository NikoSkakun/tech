/**
 * Small interaction maths of `atom` steps without a numbered model section:
 * - `dive-in`: scale wheel with stops 10⁻², 10⁻³, 10⁻⁵, 10⁻⁹, 10⁻¹⁰ m, logarithmic interpolation between them;
 * - `electron`: electron balance tilt θ = θ_max·clamp((N − 1836)/1836, −1, 1).
 */
import { ELECTRON_MASS_KG, PROTON_MASS_KG } from '../core/S1-sim/constants';
import { clamp } from '../core/S1-sim/math';

export const SCALE_STOPS_M: readonly number[] = [1e-2, 1e-3, 1e-5, 1e-9, 1e-10];

/**
 * Scale (m) at wheel position `pos` ∈ [0, stops−1]: integer positions are the stops, fractional ones
 * interpolate log₁₀(scale) linearly (the camera flies continuously).
 */
export function scaleAtWheel(pos: number): number {
  const p = clamp(pos, 0, SCALE_STOPS_M.length - 1);
  const i = Math.min(Math.floor(p), SCALE_STOPS_M.length - 2);
  const t = p - i;
  const a = Math.log10(SCALE_STOPS_M[i]);
  const b = Math.log10(SCALE_STOPS_M[i + 1]);
  return 10 ** (a + (b - a) * t);
}

/** m_p/m_e = 1836,15 (CODATA 2022). */
export const PROTON_ELECTRON_MASS_RATIO = PROTON_MASS_KG / ELECTRON_MASS_KG;
/** Electrons that balance one proton on the scales (rounded ratio, as on the chip). */
export const BALANCE_ELECTRONS = 1836;

export interface BalanceState {
  electrons: number;
  /** Tilt angle, rad; negative while the proton pan is lower (N < 1836). */
  tiltRad: number;
  balanced: boolean;
  /** Mass of the electrons pile, kg. */
  electronMassKg: number;
}

export function electronBalance(electrons: number, maxTiltRad: number): BalanceState {
  const n = Math.max(Math.round(electrons), 0);
  return {
    electrons: n,
    tiltRad: maxTiltRad * clamp((n - BALANCE_ELECTRONS) / BALANCE_ELECTRONS, -1, 1),
    balanced: n === BALANCE_ELECTRONS,
    electronMassKg: n * ELECTRON_MASS_KG,
  };
}
