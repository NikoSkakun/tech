/**
 * `plant-wind` M2 (actuator disk, Betz) and M3 (simplified qualitative airfoil and blade kinematics).
 */
import { DEG } from '../core/S3-sim/num';

/* ------------------------------------------------ M2 ------------------------------------------------------ */

export interface ActuatorDisk {
  /** Axial induction a (slider 0…0.45). */
  a: number;
  cp: number;
  ct: number;
  /** Speeds as fractions of v: upstream 1, at the rotor 1 − a, far wake 1 − 2a. */
  vRotorRel: number;
  vWakeRel: number;
  /** Stream-tube diameters relative to D: upstream √(1 − a), far wake √((1 − a)/(1 − 2a)). */
  d1Rel: number;
  d2Rel: number;
  /** Snap to the Betz optimum (soft magnet ±0.01 around 1/3). */
  atBetz: boolean;
}

export const BETZ_A = 1 / 3;
export const BETZ_CP = 16 / 27;

export function actuatorDisk(aIn: number): ActuatorDisk {
  let a = Math.min(0.45, Math.max(0, aIn));
  const atBetz = Math.abs(a - BETZ_A) <= 0.01;
  if (atBetz) a = BETZ_A;
  return {
    a,
    cp: 4 * a * (1 - a) ** 2,
    ct: 4 * a * (1 - a),
    vRotorRel: 1 - a,
    vWakeRel: 1 - 2 * a,
    d1Rel: Math.sqrt(1 - a),
    d2Rel: Math.sqrt((1 - a) / (1 - 2 * a)),
    atBetz,
  };
}

/* ------------------------------------------------ M3 ------------------------------------------------------ */

/** Cubic Hermite between (x0, y0, m0) and (x1, y1, m1); slopes per unit x. */
function hermite(x: number, x0: number, y0: number, m0: number, x1: number, y1: number, m1: number): number {
  const h = x1 - x0;
  const t = (x - x0) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * m0 + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * m1
  );
}

const CL_SLOPE_PER_DEG = 2 * Math.PI * DEG * 0.9;

/**
 * Lift coefficient (simplified, «спрощено»): 2π·α·0.9 up to 12°; Hermite saturation to C_L,max = 1.4 at 16°;
 * Hermite fall to 0.9 at 25°; constant beyond. Range −5…25°.
 */
export function liftCoefficient(alphaDeg: number): number {
  if (alphaDeg <= 12) return CL_SLOPE_PER_DEG * alphaDeg;
  if (alphaDeg <= 16) return hermite(alphaDeg, 12, CL_SLOPE_PER_DEG * 12, CL_SLOPE_PER_DEG, 16, 1.4, 0);
  if (alphaDeg <= 25) return hermite(alphaDeg, 16, 1.4, 0, 25, 0.9, 0);
  return 0.9;
}

/** Drag coefficient: 0.008 + 0.012·(α/10°)² up to 12°; Hermite rise to 0.35 at 25° (slope-continuous). */
export function dragCoefficient(alphaDeg: number): number {
  const a = Math.abs(alphaDeg);
  if (a <= 12) return 0.008 + 0.012 * (a / 10) ** 2;
  const y12 = 0.008 + 0.012 * 1.44;
  const m12 = (0.024 * 12) / 100;
  if (a <= 25) return hermite(a, 12, y12, m12, 25, 0.35, (0.35 - y12) / 13);
  return 0.35;
}

export interface AirfoilState {
  cl: number;
  cd: number;
  /** Glide ratio C_L/C_D. */
  liftToDrag: number;
  /** Separation vortices appear from ~14°. */
  stalled: boolean;
}

export function airfoil(alphaDeg: number): AirfoilState {
  const cl = liftCoefficient(alphaDeg);
  const cd = dragCoefficient(alphaDeg);
  return { cl, cd, liftToDrag: cl / cd, stalled: alphaDeg >= 14 };
}

/**
 * Blade kinematics at r/R: φ = atan((1 − a)/(λ·r/R)) (inflow angle), twist θ = φ − α_design
 * (λ = 8, a = 1/3, α_design = 6°). r/R = 1 → φ 4.76°, θ −1.2°; 0.25 → 18.4°, 12.4°.
 */
export function bladeSection(rOverR: number, lambda = 8, a = 1 / 3, alphaDesignDeg = 6) {
  const x = Math.max(1e-3, rOverR);
  const phiDeg = Math.atan((1 - a) / (lambda * x)) / DEG;
  /** Relative speed direction for drawing: tangential ω·r vs axial v(1 − a), as multiples of v. */
  return { phiDeg, twistDeg: phiDeg - alphaDesignDeg, tangentialRel: lambda * x, axialRel: 1 - a };
}
