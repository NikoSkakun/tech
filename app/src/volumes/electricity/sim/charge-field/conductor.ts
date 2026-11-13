/**
 * `charge-field` step `conductor-in-field` (no numbered model section; textbook electrostatics): an isolated,
 * uncharged conducting sphere of radius R in a uniform field E₀ (slider 0…100 kV/m, step 5, default 50).
 * Outside: E = E₀ẑ + (E₀R³/r³)·(3(ẑ·r̂)r̂ − ẑ) (field of the induced dipole p = 4πε₀R³E₀); inside: E = 0.
 * Induced surface density σ(θ) = 3ε₀E₀·cosθ (σ ∝ E₀, as the step text says); max field at the poles = 3E₀.
 */
import { ELEMENTARY_CHARGE_C, EPSILON_0_F_PER_M } from '../core/S1-sim/constants';
import { vAdd, vDot, vLength, vScale, vec3, type Vec3 } from '../core/S1-sim/field';

export const CONDUCTOR_FIELD_RANGE_V_PER_M = { min: 0, max: 100e3, step: 5e3, default: 50e3 } as const;

/** Field around a sphere centred at the origin in the uniform field E₀ along +z, V/m. */
export function sphereInUniformField(e0VPerM: number, radiusM: number, p: Vec3): Vec3 {
  const r = vLength(p);
  if (r < radiusM) return vec3();
  const rh = vScale(p, 1 / r);
  const z = vec3(0, 0, 1);
  const k = (e0VPerM * radiusM ** 3) / r ** 3;
  return vAdd(vScale(z, e0VPerM), vScale(vAdd(vScale(rh, 3 * vDot(z, rh)), vScale(z, -1)), k));
}

/** σ(θ) = 3ε₀E₀cosθ, C/m² (θ from the +z pole, which faces the field direction). */
export function inducedSurfaceDensity(e0VPerM: number, thetaRad: number): number {
  return 3 * EPSILON_0_F_PER_M * e0VPerM * Math.cos(thetaRad);
}

/** Charge displaced onto one hemisphere: Q = ∫σ dA over 0…π/2 = 3πε₀E₀R², C; also in electrons. */
export function inducedHemisphereCharge(e0VPerM: number, radiusM: number): { chargeC: number; electrons: number } {
  const q = 3 * Math.PI * EPSILON_0_F_PER_M * e0VPerM * radiusM * radiusM;
  return { chargeC: q, electrons: q / ELEMENTARY_CHARGE_C };
}

/** Visual electron-shift fraction for the scene, linear in E₀ (0 at 0, 1 at 100 kV/m). */
export const inducedShiftFraction = (e0VPerM: number): number => Math.min(Math.max(e0VPerM / CONDUCTOR_FIELD_RANGE_V_PER_M.max, 0), 1);
