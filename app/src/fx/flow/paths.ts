/**
 * Baked paths: curves resampled uniformly in arc length, so "u" along a path means distance, and a constant
 * phase speed means a constant speed on screen. Pure math (no WebGL) — unit-tested.
 */
import { type Curve, Vector3 } from 'three';

export type PathInput = Curve<Vector3> | readonly Vector3[];

export interface BakedPath {
  /** `samples` points, xyz interleaved. Closed paths do not repeat the first point at the end. */
  readonly points: Float32Array;
  readonly samples: number;
  /** Total length in local units. */
  readonly length: number;
  readonly closed: boolean;
}

/** Dense polyline of a path input (curves are subdivided finely enough for smooth arc-length resampling). */
function polyline(input: PathInput, closed: boolean): Vector3[] {
  if (Array.isArray(input)) {
    const pts = (input as readonly Vector3[]).map((p) => p.clone());
    if (closed && pts.length > 1 && pts[0]!.distanceTo(pts[pts.length - 1]!) > 1e-6) pts.push(pts[0]!.clone());
    return pts;
  }
  const curve = input as Curve<Vector3>;
  const pts = curve.getPoints(400);
  if (closed && pts[0]!.distanceTo(pts[pts.length - 1]!) > 1e-6) pts.push(pts[0]!.clone());
  return pts;
}

/** Resample a path to `samples` points equally spaced along its length. */
export function bakePath(input: PathInput, samples = 256, closed = false): BakedPath {
  const pts = polyline(input, closed);
  if (pts.length < 2) throw new Error('bakePath: a path needs at least two points');
  const cum = new Float64Array(pts.length);
  for (let i = 1; i < pts.length; i++) cum[i] = cum[i - 1]! + pts[i]!.distanceTo(pts[i - 1]!);
  const length = cum[pts.length - 1]!;
  const out = new Float32Array(samples * 3);
  const denom = closed ? samples : samples - 1;
  let seg = 0;
  for (let i = 0; i < samples; i++) {
    const d = (i / denom) * length;
    while (seg < pts.length - 2 && cum[seg + 1]! < d) seg++;
    const span = cum[seg + 1]! - cum[seg]!;
    const f = span > 1e-9 ? (d - cum[seg]!) / span : 0;
    const a = pts[seg]!;
    const b = pts[seg + 1]!;
    out[i * 3] = a.x + (b.x - a.x) * f;
    out[i * 3 + 1] = a.y + (b.y - a.y) * f;
    out[i * 3 + 2] = a.z + (b.z - a.z) * f;
  }
  return { points: out, samples, length, closed };
}

/** Point at `u` (0…1 of the length; wraps on closed paths, clamps on open ones). */
export function samplePath(path: BakedPath, u: number, out = new Vector3()): Vector3 {
  const n = path.samples;
  let x: number;
  if (path.closed) x = (u - Math.floor(u)) * n;
  else x = Math.min(Math.max(u, 0), 1) * (n - 1);
  const i0 = Math.min(Math.floor(x), n - 1);
  const f = x - i0;
  const i1 = path.closed ? (i0 + 1) % n : Math.min(i0 + 1, n - 1);
  const p = path.points;
  return out.set(
    p[i0 * 3]! + (p[i1 * 3]! - p[i0 * 3]!) * f,
    p[i0 * 3 + 1]! + (p[i1 * 3 + 1]! - p[i0 * 3 + 1]!) * f,
    p[i0 * 3 + 2]! + (p[i1 * 3 + 2]! - p[i0 * 3 + 2]!) * f,
  );
}

const _a = new Vector3();
const _b = new Vector3();

/** Unit tangent at `u` (central difference over one sample). */
export function tangentPath(path: BakedPath, u: number, out = new Vector3()): Vector3 {
  const h = 0.5 / path.samples;
  samplePath(path, u + h, _a);
  samplePath(path, u - h, _b);
  out.subVectors(_a, _b);
  return out.lengthSq() > 1e-12 ? out.normalize() : out.set(1, 0, 0);
}

/** Join paths end to end into one polyline (routes through a network of pipes or wires). */
export function concatPaths(parts: readonly PathInput[]): Vector3[] {
  const out: Vector3[] = [];
  for (const part of parts) {
    for (const p of polyline(part, false)) {
      const last = out[out.length - 1];
      if (!last || last.distanceTo(p) > 1e-6) out.push(p);
    }
  }
  return out;
}
