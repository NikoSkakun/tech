/**
 * Streamline integration for arbitrary vector fields (pure math, unit-tested).
 *
 * A field line is the curve whose tangent is the field direction: dp/ds = F(p) / |F(p)|. It is integrated
 * with the classical 4th-order Runge–Kutta scheme at a fixed step in arc length `s`, so step size controls
 * geometric accuracy independently of field strength (which varies by orders of magnitude near sources).
 */
import { Vector3 } from 'three';
import type { VectorField } from './sources';

export interface StreamlineOptions {
  /** Arc-length step, units. Default 0.05. */
  step?: number;
  /** Stop after this length, units. Default 20. */
  maxLength?: number;
  /** Stop when the line leaves this sphere (centre, radius). */
  bounds?: { center: Vector3; radius: number };
  /** Stop when the line comes within `radius` of any of these points (charges, poles: sinks / sources). */
  stops?: readonly { position: Vector3; radius: number }[];
  /** Integrate against the field instead of along it. Default false. */
  backward?: boolean;
  /** Also integrate the other way from the seed and join both halves. Default false. */
  bothWays?: boolean;
  /** Detect a line that returns to its seed (magnetic loops) and mark it closed. Default true. */
  detectLoop?: boolean;
  /** Stop where the field is weaker than this. Default 1e-6. */
  minField?: number;
}

export interface Streamline {
  points: Vector3[];
  /** Field magnitude at every point (for brightness / width). */
  magnitude: number[];
  /** True when the line closed on itself. */
  closed: boolean;
  length: number;
}

const k1 = new Vector3();
const k2 = new Vector3();
const k3 = new Vector3();
const k4 = new Vector3();
const tmp = new Vector3();

function direction(field: VectorField, p: Vector3, sign: number, out: Vector3): number {
  field(p, out);
  const m = out.length();
  if (m > 0) out.multiplyScalar(sign / m);
  return m;
}

function trace(field: VectorField, seed: Vector3, sign: number, o: StreamlineOptions): Streamline {
  const h = o.step ?? 0.05;
  const maxLength = o.maxLength ?? 20;
  const minField = o.minField ?? 1e-6;
  const detectLoop = o.detectLoop ?? true;
  const points: Vector3[] = [seed.clone()];
  const magnitude: number[] = [direction(field, seed, sign, k1)];
  const p = seed.clone();
  let length = 0;
  let closed = false;
  const maxSteps = Math.ceil(maxLength / h);
  for (let i = 0; i < maxSteps; i++) {
    const m = direction(field, p, sign, k1);
    if (m < minField) break;
    direction(field, tmp.copy(p).addScaledVector(k1, h / 2), sign, k2);
    direction(field, tmp.copy(p).addScaledVector(k2, h / 2), sign, k3);
    direction(field, tmp.copy(p).addScaledVector(k3, h), sign, k4);
    p.addScaledVector(k1, h / 6).addScaledVector(k2, h / 3).addScaledVector(k3, h / 3).addScaledVector(k4, h / 6);
    length += h;
    points.push(p.clone());
    magnitude.push(m);
    if (o.bounds && p.distanceTo(o.bounds.center) > o.bounds.radius) break;
    if (o.stops?.some((s) => p.distanceTo(s.position) < s.radius)) break;
    if (detectLoop && length > h * 8 && p.distanceTo(seed) < h * 0.75) {
      closed = true;
      points.pop();
      magnitude.pop();
      break;
    }
  }
  return { points, magnitude, closed, length };
}

/** Integrate one field line from `seed`. */
export function streamline(field: VectorField, seed: Vector3, o: StreamlineOptions = {}): Streamline {
  const forward = trace(field, seed, o.backward ? -1 : 1, o);
  if (!o.bothWays || forward.closed) return forward;
  const back = trace(field, seed, o.backward ? 1 : -1, o);
  // join: reversed backward half (without the duplicated seed) + forward half → runs along the field
  const points = [...back.points.slice(1).reverse(), ...forward.points];
  const magnitude = [...back.magnitude.slice(1).reverse(), ...forward.magnitude];
  return { points, magnitude, closed: false, length: forward.length + back.length };
}

/** Integrate one line per seed. */
export function streamlines(field: VectorField, seeds: readonly Vector3[], o: StreamlineOptions = {}): Streamline[] {
  return seeds.map((s) => streamline(field, s, o));
}

/** `n` seeds evenly spread on a sphere of `radius` around `center` (Fibonacci lattice) — lines of a charge. */
export function seedsOnSphere(center: Vector3, radius: number, n: number): Vector3[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: n }, (_, i) => {
    const y = 1 - ((i + 0.5) / n) * 2;
    const r = Math.sqrt(1 - y * y);
    return new Vector3(Math.cos(i * golden) * r, y, Math.sin(i * golden) * r).multiplyScalar(radius).add(center);
  });
}

/** `n` seeds on a circle of `radius` around `center` in the plane with the given `normal`. */
export function seedsOnRing(center: Vector3, normal: Vector3, radius: number, n: number, phase = 0): Vector3[] {
  const nn = normal.clone().normalize();
  const u = new Vector3(Math.abs(nn.y) < 0.99 ? 0 : 1, Math.abs(nn.y) < 0.99 ? 1 : 0, 0).cross(nn).normalize();
  const v = new Vector3().crossVectors(nn, u);
  return Array.from({ length: n }, (_, i) => {
    const a = phase + (i / n) * Math.PI * 2;
    return center.clone().addScaledVector(u, Math.cos(a) * radius).addScaledVector(v, Math.sin(a) * radius);
  });
}

/** `n` seeds evenly spaced on the segment a → b (inclusive). */
export function seedsOnLine(a: Vector3, b: Vector3, n: number): Vector3[] {
  return Array.from({ length: n }, (_, i) => a.clone().lerp(b, n === 1 ? 0.5 : i / (n - 1)));
}
