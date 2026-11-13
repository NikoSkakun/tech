/**
 * Particle emitters: where particles are born and which way they start moving. An emitter fills a spawn
 * `position` (local space of the particle system) and a unit `direction`; the system applies speed.
 */
import { type BufferGeometry, type Curve, type Matrix4, Vector3 } from 'three';
import type { Rng } from '@/engine/api';

export type Vec3 = readonly [number, number, number];
export type Emitter = (rng: Rng, position: Vector3, direction: Vector3) => void;

export interface AimOptions {
  /** Direction of emission. Default: emitter-specific (outward / normal / tangent / random). */
  axis?: Vec3;
  /** Half-angle of the emission cone around `axis`, radians. Default 0 (exactly along the axis). */
  spread?: number;
}

const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();

/** Uniform direction inside a cone of half-angle `spread` around `axis` (unit). */
export function coneDirection(rng: Rng, axis: Vector3, spread: number, out: Vector3): Vector3 {
  if (spread <= 0) return out.copy(axis);
  const cos = 1 - rng.next() * (1 - Math.cos(spread));
  const sin = Math.sqrt(Math.max(0, 1 - cos * cos));
  const phi = rng.next() * Math.PI * 2;
  // orthonormal basis around the axis
  _a.set(Math.abs(axis.y) < 0.99 ? 0 : 1, Math.abs(axis.y) < 0.99 ? 1 : 0, 0).cross(axis).normalize();
  _b.crossVectors(axis, _a);
  return out
    .copy(axis)
    .multiplyScalar(cos)
    .addScaledVector(_a, sin * Math.cos(phi))
    .addScaledVector(_b, sin * Math.sin(phi));
}

function aimOr(aim: AimOptions | undefined): ((rng: Rng, out: Vector3) => void) | null {
  if (!aim?.axis) return null;
  const axis = new Vector3(...aim.axis).normalize();
  const spread = aim.spread ?? 0;
  return (rng, out) => void coneDirection(rng, axis, spread, out);
}

function randomDirection(rng: Rng, out: Vector3): void {
  const [x, y, z] = rng.onSphere();
  out.set(x, y, z);
}

/** All particles start at `origin`; direction random (or inside the `aim` cone). */
export function pointEmitter(origin: Vec3 = [0, 0, 0], aim?: AimOptions): Emitter {
  const dir = aimOr(aim) ?? randomDirection;
  return (rng, position, direction) => {
    position.set(origin[0], origin[1], origin[2]);
    dir(rng, direction);
  };
}

/** Sphere of `radius` (volume, or surface only); default direction: outward. */
export function sphereEmitter(
  radius: number,
  opts: AimOptions & { surface?: boolean; center?: Vec3 } = {},
): Emitter {
  const dir = aimOr(opts);
  const c = opts.center ?? [0, 0, 0];
  return (rng, position, direction) => {
    const [x, y, z] = rng.onSphere();
    const r = opts.surface ? radius : radius * Math.cbrt(rng.next());
    position.set(c[0] + x * r, c[1] + y * r, c[2] + z * r);
    if (dir) dir(rng, direction);
    else direction.set(x, y, z);
  };
}

/** Axis-aligned box of `size`; default direction: random. */
export function boxEmitter(size: Vec3, opts: AimOptions & { center?: Vec3 } = {}): Emitter {
  const dir = aimOr(opts) ?? randomDirection;
  const c = opts.center ?? [0, 0, 0];
  return (rng, position, direction) => {
    position.set(
      c[0] + rng.signed(size[0] / 2),
      c[1] + rng.signed(size[1] / 2),
      c[2] + rng.signed(size[2] / 2),
    );
    dir(rng, direction);
  };
}

/** Flat disc (or annulus) perpendicular to `axis` (default +Y); default direction: along the axis. */
export function discEmitter(
  radius: number,
  opts: AimOptions & { inner?: number; center?: Vec3 } = {},
): Emitter {
  const axis = new Vector3(...(opts.axis ?? [0, 1, 0])).normalize();
  const u = new Vector3(Math.abs(axis.y) < 0.99 ? 0 : 1, Math.abs(axis.y) < 0.99 ? 1 : 0, 0)
    .cross(axis)
    .normalize();
  const v = new Vector3().crossVectors(axis, u);
  const inner = opts.inner ?? 0;
  const c = opts.center ?? [0, 0, 0];
  const spread = opts.spread ?? 0;
  return (rng, position, direction) => {
    const r = Math.sqrt(inner * inner + rng.next() * (radius * radius - inner * inner));
    const a = rng.next() * Math.PI * 2;
    position
      .set(c[0], c[1], c[2])
      .addScaledVector(u, r * Math.cos(a))
      .addScaledVector(v, r * Math.sin(a));
    coneDirection(rng, axis, spread, direction);
  };
}

/**
 * Surface of a mesh geometry, area-weighted; default direction: the face normal. Pass the mesh's matrix
 * (relative to the particle system) when the geometry is not in the system's local space.
 */
export function surfaceEmitter(geometry: BufferGeometry, opts: AimOptions & { matrix?: Matrix4 } = {}): Emitter {
  const pos = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const triCount = (index ? index.count : pos.count) / 3;
  const corner = (tri: number, k: number, out: Vector3): Vector3 => {
    const i = index ? index.getX(tri * 3 + k) : tri * 3 + k;
    out.fromBufferAttribute(pos, i);
    return opts.matrix ? out.applyMatrix4(opts.matrix) : out;
  };
  // cumulative triangle areas for area-uniform sampling
  const cdf = new Float32Array(triCount);
  let total = 0;
  for (let t = 0; t < triCount; t++) {
    corner(t, 0, _a);
    corner(t, 1, _b);
    corner(t, 2, _c);
    total += _b.sub(_a).cross(_c.sub(_a)).length() * 0.5;
    cdf[t] = total;
  }
  const dir = aimOr(opts);
  return (rng, position, direction) => {
    const target = rng.next() * total;
    let lo = 0;
    let hi = triCount - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid]! < target) lo = mid + 1;
      else hi = mid;
    }
    corner(lo, 0, _a);
    corner(lo, 1, _b);
    corner(lo, 2, _c);
    let u = rng.next();
    let v = rng.next();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    position.copy(_a).addScaledVector(_b.sub(_a), u).addScaledVector(_c.sub(_a), v);
    if (dir) dir(rng, direction);
    else direction.crossVectors(_b, _c).normalize();
  };
}

/** Along a curve (uniform in arc length), optionally inside a tube of `radius`; default direction: tangent. */
export function curveEmitter(curve: Curve<Vector3>, opts: AimOptions & { radius?: number } = {}): Emitter {
  const dir = aimOr(opts);
  const radius = opts.radius ?? 0;
  return (rng, position, direction) => {
    const u = rng.next();
    curve.getPointAt(u, position);
    curve.getTangentAt(u, _a);
    if (radius > 0) {
      const [x, y, z] = rng.onSphere();
      // random offset perpendicular to the tangent
      _b.set(x, y, z).cross(_a);
      if (_b.lengthSq() > 1e-8) position.addScaledVector(_b.normalize(), radius * Math.sqrt(rng.next()));
    }
    if (dir) dir(rng, direction);
    else direction.copy(_a);
  };
}
