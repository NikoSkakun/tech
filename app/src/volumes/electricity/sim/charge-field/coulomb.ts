/**
 * `charge-field` step `charge` (electron transfer, charge quantisation) and «Модель симуляції» §2 (step
 * `coulomb`): F = k·|q₁q₂|/r², sign q₁q₂ > 0 → repulsion; arrow length L = L₀·clamp(0,2 + 0,44·log₁₀(F/10⁻⁷ N),
 * 0,2, 3); gravity comparison e–p at a₀.
 */
import {
  BOHR_RADIUS_M,
  COULOMB_K,
  ELECTRON_MASS_KG,
  ELEMENTARY_CHARGE_C,
  GRAVITATIONAL_CONSTANT,
  PROTON_MASS_KG,
} from '../core/S1-sim/constants';
import { clamp } from '../core/S1-sim/math';

// ---------------------------------------------------------------- step `charge`

export interface ChargeTransfer {
  /** Electrons moved from the left cube to the right one (integer, may be negative). */
  electronsMoved: number;
  /** Left cube charge +n·e, C. */
  leftChargeC: number;
  /** Right cube charge −n·e, C. */
  rightChargeC: number;
  /** Always exactly 0 (charge conservation). */
  totalChargeC: number;
}

/** Charge state after moving n electrons left → right (buttons `→ 1 e⁻`, `→ 1000 e⁻`, `→ 10⁹ e⁻`). */
export function chargeTransfer(electronsMoved: number): ChargeTransfer {
  const n = Math.round(electronsMoved);
  const q = n * ELEMENTARY_CHARGE_C;
  return { electronsMoved: n, leftChargeC: q, rightChargeC: -q, totalChargeC: q - q };
}

// ---------------------------------------------------------------- step `coulomb`

export const COULOMB_RANGES = {
  /** Charge sliders, nC (step 1). */
  chargeNC: { min: -50, max: 50, step: 1, default1: 20, default2: -20 },
  /** Distance, m (1…20 cm). */
  distanceM: { min: 0.01, max: 0.2, default: 0.05 },
} as const;

export interface CoulombPair {
  q1NC: number;
  q2NC: number;
  distanceM: number;
  forceN: number;
  kind: 'attraction' | 'repulsion' | 'none';
  /** Arrow length in units of L₀ (0 when F = 0). */
  arrowLengthL0: number;
}

/** L/L₀ = clamp(0,2 + 0,44·log₁₀(F/10⁻⁷ N), 0,2, 3); 0 when F = 0. */
export function coulombArrowLength(forceN: number): number {
  if (!(forceN > 0)) return 0;
  return clamp(0.2 + 0.44 * Math.log10(forceN / 1e-7), 0.2, 3);
}

export function coulombPair(q1NC: number, q2NC: number, distanceM: number): CoulombPair {
  const q1 = clamp(Math.round(q1NC), COULOMB_RANGES.chargeNC.min, COULOMB_RANGES.chargeNC.max);
  const q2 = clamp(Math.round(q2NC), COULOMB_RANGES.chargeNC.min, COULOMB_RANGES.chargeNC.max);
  const r = clamp(distanceM, COULOMB_RANGES.distanceM.min, COULOMB_RANGES.distanceM.max);
  const f = (COULOMB_K * Math.abs(q1 * 1e-9 * q2 * 1e-9)) / (r * r);
  const prod = q1 * q2;
  return { q1NC: q1, q2NC: q2, distanceM: r, forceN: f, kind: prod > 0 ? 'repulsion' : prod < 0 ? 'attraction' : 'none', arrowLengthL0: coulombArrowLength(f) };
}

export interface GravityComparison {
  /** F_e = k·e²/a₀² ≈ 8,24×10⁻⁸ N. */
  electricN: number;
  /** F_g = G·m_e·m_p/a₀² ≈ 3,63×10⁻⁴⁷ N. */
  gravityN: number;
  /** ≈ 2,27×10³⁹. */
  ratio: number;
  /** Log-scale "floors": exponent of each force (10⁻⁴⁸…10⁻⁸ N, 40 floors). */
  electricFloor: number;
  gravityFloor: number;
}

export function gravityComparison(): GravityComparison {
  const r2 = BOHR_RADIUS_M * BOHR_RADIUS_M;
  const fe = (COULOMB_K * ELEMENTARY_CHARGE_C * ELEMENTARY_CHARGE_C) / r2;
  const fg = (GRAVITATIONAL_CONSTANT * ELECTRON_MASS_KG * PROTON_MASS_KG) / r2;
  return { electricN: fe, gravityN: fg, ratio: fe / fg, electricFloor: Math.log10(fe), gravityFloor: Math.log10(fg) };
}
