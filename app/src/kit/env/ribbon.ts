/**
 * Path utilities shared by roads, rails, fences, rivers and anything else laid along a route:
 * rounding + resampling + draping a 2D route on a ground, lateral offsets, and the "ribbon" strip geometry
 * (a slightly raised slab, so roads read as crisp layered shapes and never z-fight with the terrain).
 */
import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import type { AddOptions, Builder } from '../core/builder';
import { pathAt, pathLength, roundPath, type Pt } from '../core/geo';

export interface DrapeOptions {
  /** Height source; without it the path stays at y = 0. */
  ground?: { heightAt(x: number, z: number): number };
  /** Height above the ground. Default 0. */
  lift?: number;
  /** Sample spacing in metres. Default 1.5. */
  step?: number;
  /** Corner radius of the route. Default 6. */
  bend?: number;
  closed?: boolean;
}

/** Round the corners of an [x, z] route, resample it evenly and drop it on the ground. */
export function drape(route: readonly Pt[], o: DrapeOptions = {}): Vector3[] {
  const raw = route.map(([x, z]) => new Vector3(x, 0, z));
  if (o.closed) raw.push(raw[0]!.clone(), raw[1]!.clone());
  let rounded = roundPath(raw, o.bend ?? 6, 6);
  if (o.closed) {
    // drop the duplicated lead-in so the loop closes on the rounded corner
    const first = rounded.findIndex((p) => p.distanceTo(raw[1]!) < (o.bend ?? 6) * 1.01);
    rounded = rounded.slice(Math.max(first, 0), rounded.length - 1);
    rounded.push(rounded[0]!.clone());
  }
  const length = pathLength(rounded);
  const n = Math.max(2, Math.round(length / (o.step ?? 1.5)));
  const out: Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const p = pathAt(rounded, (i / n) * length, new Vector3());
    p.y = (o.ground ? o.ground.heightAt(p.x, p.z) : 0) + (o.lift ?? 0);
    out.push(p);
  }
  return out;
}

/** Horizontal unit normal (pointing left of the direction of travel) at sample `i` of a path. */
export function sideAt(pts: readonly Vector3[], i: number, out = new Vector3()): Vector3 {
  const a = pts[Math.max(i - 1, 0)]!;
  const b = pts[Math.min(i + 1, pts.length - 1)]!;
  return out.set(b.z - a.z, 0, -(b.x - a.x)).normalize();
}

/** Copy of a path shifted sideways by `d` metres (positive = left) and up by `dy`. */
export function offsetPath(pts: readonly Vector3[], d: number, dy = 0): Vector3[] {
  const side = new Vector3();
  return pts.map((p, i) => p.clone().addScaledVector(sideAt(pts, i, side), d).setY(p.y + dy));
}

/**
 * Strip of the given width along a path: flat top plus side skirts of `thickness` (default 0.3 m) that reach
 * into the ground. `uv.x` = metres along the path, `uv.y` = 0…1 across.
 */
export function ribbonGeometry(pts: readonly Vector3[], width: number, thickness = 0.3): BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const side = new Vector3();
  let dist = 0;
  pts.forEach((p, i) => {
    if (i > 0) dist += p.distanceTo(pts[i - 1]!);
    sideAt(pts, i, side);
    const lx = p.x + side.x * (width / 2);
    const lz = p.z + side.z * (width / 2);
    const rx = p.x - side.x * (width / 2);
    const rz = p.z - side.z * (width / 2);
    // 6 vertices per sample: top L/R, left skirt top/bottom, right skirt top/bottom
    pos.push(lx, p.y, lz, rx, p.y, rz, lx, p.y, lz, lx, p.y - thickness, lz, rx, p.y, rz, rx, p.y - thickness, rz);
    nor.push(0, 1, 0, 0, 1, 0, side.x, 0, side.z, side.x, 0, side.z, -side.x, 0, -side.z, -side.x, 0, -side.z);
    uv.push(dist, 0, dist, 1, dist, 0, dist, 0, dist, 1, dist, 1);
  });
  for (let i = 0; i < pts.length - 1; i++) {
    const a = i * 6;
    const b = a + 6;
    idx.push(a, a + 1, b, a + 1, b + 1, b); // top
    idx.push(a + 2, b + 2, a + 3, a + 3, b + 2, b + 3); // left skirt
    idx.push(a + 4, a + 5, b + 4, a + 5, b + 5, b + 4); // right skirt
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Add a ribbon to a builder. */
export function addRibbon(
  b: Builder,
  pts: readonly Vector3[],
  width: number,
  o: AddOptions & { thickness?: number } = {},
): void {
  b.add(ribbonGeometry(pts, width, o.thickness), { slot: 'matte', ...o });
}

/** Evenly spaced stations along a path: position, heading (rotation around Y) and index. */
export function stations(
  pts: readonly Vector3[],
  spacing: number,
  fn: (p: Vector3, heading: number, i: number, count: number) => void,
  inset = 0,
): void {
  const length = pathLength(pts) - inset * 2;
  const n = Math.max(1, Math.round(length / spacing));
  const p = new Vector3();
  const t = new Vector3();
  for (let i = 0; i <= n; i++) {
    pathAt(pts, inset + (i / n) * length, p, t);
    fn(p, Math.atan2(t.x, t.z), i, n + 1);
  }
}
