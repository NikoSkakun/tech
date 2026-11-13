/**
 * Field math: Coulomb superposition (E, φ), Gilbert "magnetic charge" poles, point dipole, straight wire,
 * solenoid, current loop; RK4 streamline integration. All SI; positions in metres.
 */
import { COULOMB_K, MU_0_H_PER_M } from './constants';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const vec3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const vAdd = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const vSub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const vScale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const vDot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const vCross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const vLength = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
export const vDistance = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export function vNormalize(a: Vec3): Vec3 {
  const l = vLength(a);
  return l > 0 ? vScale(a, 1 / l) : vec3();
}

// ---------------------------------------------------------------- electrostatics

export interface PointCharge {
  position: Vec3;
  chargeC: number;
}

/**
 * E⃗(r) = Σ k·qᵢ·(r − rᵢ)/(|r − rᵢ|² + ε²)^(3/2), V/m (Coulomb superposition). `softeningM` ε = 0 gives the
 * exact field; the `charge-field` documents use ε = 2 mm for line integration only (§3).
 */
export function electricField(charges: readonly PointCharge[], p: Vec3, softeningM = 0): Vec3 {
  let ex = 0;
  let ey = 0;
  let ez = 0;
  const eps2 = softeningM * softeningM;
  for (const c of charges) {
    const dx = p.x - c.position.x;
    const dy = p.y - c.position.y;
    const dz = p.z - c.position.z;
    const r2 = dx * dx + dy * dy + dz * dz + eps2;
    if (r2 === 0) continue;
    const f = (COULOMB_K * c.chargeC) / (r2 * Math.sqrt(r2));
    ex += f * dx;
    ey += f * dy;
    ez += f * dz;
  }
  return { x: ex, y: ey, z: ez };
}

/** φ(r) = Σ k·qᵢ/√(|r − rᵢ|² + ε²), V. ε = 0 → exact potential. */
export function electricPotential(charges: readonly PointCharge[], p: Vec3, softeningM = 0): number {
  let phi = 0;
  const eps2 = softeningM * softeningM;
  for (const c of charges) {
    const d2 = (p.x - c.position.x) ** 2 + (p.y - c.position.y) ** 2 + (p.z - c.position.z) ** 2 + eps2;
    if (d2 === 0) return c.chargeC > 0 ? Infinity : -Infinity;
    phi += (COULOMB_K * c.chargeC) / Math.sqrt(d2);
  }
  return phi;
}

/** Coulomb force magnitude F = k·|q₁q₂|/r², N. */
export function coulombForce(q1C: number, q2C: number, distanceM: number): number {
  return (COULOMB_K * Math.abs(q1C * q2C)) / (distanceM * distanceM);
}

// ---------------------------------------------------------------- magnetostatics

/** Gilbert model pole: "magnetic charge" q_m in A·m (N pole positive). */
export interface MagneticPole {
  position: Vec3;
  strengthAm: number;
}

/** B(r) = (μ₀/4π)·Σ q_m,i·(r − r_i)/|r − r_i|³, T (`magnetism` М1). */
export function poleField(poles: readonly MagneticPole[], p: Vec3, softeningM = 0): Vec3 {
  let bx = 0;
  let by = 0;
  let bz = 0;
  const eps2 = softeningM * softeningM;
  const k = MU_0_H_PER_M / (4 * Math.PI);
  for (const q of poles) {
    const dx = p.x - q.position.x;
    const dy = p.y - q.position.y;
    const dz = p.z - q.position.z;
    const r2 = dx * dx + dy * dy + dz * dz + eps2;
    if (r2 === 0) continue;
    const f = (k * q.strengthAm) / (r2 * Math.sqrt(r2));
    bx += f * dx;
    by += f * dy;
    bz += f * dz;
  }
  return { x: bx, y: by, z: bz };
}

/** Exact point-dipole field B = (μ₀/4π)·(3(m·r̂)r̂ − m)/r³, T. */
export function dipoleField(momentAm2: Vec3, dipolePosition: Vec3, p: Vec3): Vec3 {
  const r = vSub(p, dipolePosition);
  const d = vLength(r);
  if (d === 0) return vec3();
  const rh = vScale(r, 1 / d);
  const k = MU_0_H_PER_M / (4 * Math.PI * d * d * d);
  return vScale(vSub(vScale(rh, 3 * vDot(momentAm2, rh)), momentAm2), k);
}

/** |B| of an infinite straight wire at distance r: μ₀·I/(2π·r), T. */
export function wireFieldMagnitude(currentA: number, distanceM: number): number {
  return (MU_0_H_PER_M * Math.abs(currentA)) / (2 * Math.PI * distanceM);
}

/**
 * Field of an infinite straight wire through `origin` along unit `direction` (conventional current I > 0
 * flows along `direction`): B = μ₀·I/(2π·ρ)·(d̂ × ρ̂), T (right-hand rule).
 */
export function wireField(currentA: number, origin: Vec3, direction: Vec3, p: Vec3): Vec3 {
  const d = vNormalize(direction);
  const rel = vSub(p, origin);
  const rho = vSub(rel, vScale(d, vDot(rel, d)));
  const r2 = vDot(rho, rho);
  if (r2 === 0) return vec3();
  return vScale(vCross(d, rho), (MU_0_H_PER_M * currentA) / (2 * Math.PI * r2));
}

/** Long-solenoid interior field B = μ₀·(N/l)·I, T. */
export function solenoidFieldAir(turns: number, lengthM: number, currentA: number): number {
  return (MU_0_H_PER_M * turns * currentA) / lengthM;
}

/**
 * On-axis field of a finite solenoid (radius a, length l, centred at z = 0):
 * B(z) = (μ₀·N·I/2l)·[(z + l/2)/√((z + l/2)² + a²) − (z − l/2)/√((z − l/2)² + a²)], T.
 */
export function solenoidAxisField(turns: number, lengthM: number, radiusM: number, currentA: number, zM: number): number {
  const u = zM + lengthM / 2;
  const v = zM - lengthM / 2;
  return ((MU_0_H_PER_M * turns * currentA) / (2 * lengthM)) * (u / Math.hypot(u, radiusM) - v / Math.hypot(v, radiusM));
}

/** On-axis field of a single circular loop: B(z) = μ₀·I·a²/(2·(a² + z²)^(3/2)), T. */
export function loopAxisField(currentA: number, radiusM: number, zM: number): number {
  return (MU_0_H_PER_M * currentA * radiusM * radiusM) / (2 * Math.pow(radiusM * radiusM + zM * zM, 1.5));
}

/**
 * Flux of a point dipole (moment m along the axis) through a coaxial loop of radius a at axial distance z:
 * Φ(z) = μ₀·m·a²/(2·(a² + z²)^(3/2)), Wb (reciprocity with {@link loopAxisField}; `magnetism` М5).
 */
export function dipoleFluxThroughLoop(momentAm2: number, radiusM: number, zM: number): number {
  return (MU_0_H_PER_M * momentAm2 * radiusM * radiusM) / (2 * Math.pow(radiusM * radiusM + zM * zM, 1.5));
}

// ---------------------------------------------------------------- streamlines

export type VectorField = (p: Vec3) => Vec3;

/**
 * One classical RK4 step along the *normalised* field direction (arc-length parametrisation):
 * dp/ds = ±F/|F|. Returns `null` where the field vanishes (stagnation point).
 */
export function rk4StreamStep(field: VectorField, p: Vec3, stepM: number, direction: 1 | -1 = 1): Vec3 | null {
  const dir = (q: Vec3): Vec3 | null => {
    const f = field(q);
    const l = vLength(f);
    return l > 0 && Number.isFinite(l) ? vScale(f, direction / l) : null;
  };
  const k1 = dir(p);
  if (!k1) return null;
  const k2 = dir(vAdd(p, vScale(k1, stepM / 2)));
  if (!k2) return null;
  const k3 = dir(vAdd(p, vScale(k2, stepM / 2)));
  if (!k3) return null;
  const k4 = dir(vAdd(p, vScale(k3, stepM)));
  if (!k4) return null;
  return vAdd(p, vScale(vAdd(vAdd(k1, vScale(k2, 2)), vAdd(vScale(k3, 2), k4)), stepM / 6));
}

export type StreamlineEnd = 'sink' | 'boundary' | 'maxSteps' | 'stagnation';

export interface StreamlineOptions {
  stepM: number;
  maxSteps: number;
  /** Integrate along (+1) or against (−1) the field. */
  direction?: 1 | -1;
  /** Per-point step multiplier (adaptive refinement near sources), default 1. */
  stepScale?: (p: Vec3) => number;
  /** Stop condition: return a reason to stop *after* reaching the point, or null to continue. */
  stop?: (p: Vec3) => Exclude<StreamlineEnd, 'maxSteps' | 'stagnation'> | null;
}

export interface Streamline {
  points: Vec3[];
  end: StreamlineEnd;
}

/** Traces a field line from `seed` with RK4 until a stop condition, stagnation or `maxSteps`. */
export function traceStreamline(field: VectorField, seed: Vec3, options: StreamlineOptions): Streamline {
  const points: Vec3[] = [seed];
  let p = seed;
  for (let i = 0; i < options.maxSteps; i++) {
    const h = options.stepM * (options.stepScale ? options.stepScale(p) : 1);
    const next = rk4StreamStep(field, p, h, options.direction ?? 1);
    if (!next) return { points, end: 'stagnation' };
    points.push(next);
    p = next;
    const reason = options.stop?.(p) ?? null;
    if (reason) return { points, end: reason };
  }
  return { points, end: 'maxSteps' };
}
