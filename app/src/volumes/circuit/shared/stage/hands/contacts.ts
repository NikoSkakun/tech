/**
 * Contacts of the loose parts (`solver.ts`): a part against a wall (the board, a limit — planes) and the two parts
 * against each other (capsules). A pooled list, rebuilt every substep.
 */
import { Vector3 } from 'three';
import type { Body, Capsule, Shape } from './body';

/** Penetration allowed before anything pushes back (resting contacts stay in touch). */
export const SLOP = 0.004;
/** Height of a fence (board units): about the wire's top on its staples, with the part's own roundness. */
export const FENCE = 0.35;

/**
 * A plane n·p ≥ o; `push` caps the speed at which it corrects a penetration (soft limit walls). A `fence` (the
 * limits along the wire) pushes the part's centre of mass, not the point that crosses it: there is nothing there
 * to lean on, so it may stop a part but never hold one up.
 */
export interface Wall {
  n: Vector3;
  o: number;
  friction: number;
  push: number;
  fence?: boolean;
}

export interface Contact {
  a: Body;
  b: Body | null;
  p: Vector3;
  n: Vector3;
  depth: number;
  friction: number;
  push: number;
  restitution: number;
  /** Accumulated normal impulse, and the accumulated friction impulse (in the contact's plane). */
  jn: number;
  jt: Vector3;
  /** Target normal velocity (bounce), fixed at the start of the substep. */
  bounce: number;
}

const pool: Contact[] = [];
let used = 0;
/** Start a new substep's contact list. */
export function resetContacts(): void {
  used = 0;
}
/** The contacts gathered since `resetContacts()` (a view on the pool: valid until the next reset). */
export function contacts(): readonly Contact[] {
  return pool.slice(0, used);
}
function contact(): Contact {
  const c =
    pool[used] ??
    (pool[used] = {
      a: null as unknown as Body,
      b: null,
      p: new Vector3(),
      n: new Vector3(),
      depth: 0,
      friction: 0,
      push: 0,
      restitution: 0,
      jn: 0,
      jt: new Vector3(),
      bounce: 0,
    });
  used++;
  c.jn = 0;
  c.jt.set(0, 0, 0);
  c.bounce = 0;
  return c;
}

const c0 = new Vector3();
const ax = new Vector3();
const perp = new Vector3();
const pt = new Vector3();
const RIM = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];

/** Deepest points of a shape against a wall (one for a sphere, one per end of a lying cylinder). */
export function wallContacts(body: Body, s: Shape, wall: Wall): void {
  body.toBoard(s.c, c0);
  const add = (p: Vector3): void => {
    // a fence is low: only what reaches down to the board's layer meets it
    if (wall.fence && p.y > FENCE) return;
    const d = wall.n.dot(p) - wall.o;
    if (d > SLOP * 2) return;
    const c = contact();
    c.a = body;
    c.b = null;
    c.p.copy(wall.fence ? body.x : p);
    c.n.copy(wall.n);
    c.depth = -d;
    c.friction = Math.sqrt(wall.friction * body.spec.friction);
    c.push = wall.push;
    c.restitution = body.spec.restitution;
  };
  if (s.kind === 'sphere') {
    if (!wall.fence) return add(pt.copy(c0).addScaledVector(wall.n, -s.r));
    // the sphere's section at the fence's height (or at its centre, if that is lower)
    const y = Math.min(c0.y, FENCE);
    const r2 = s.r * s.r - (c0.y - y) ** 2;
    if (r2 <= 0) return;
    return add(pt.set(c0.x, y, c0.z).addScaledVector(wall.n, -Math.sqrt(r2)));
  }
  ax.copy(s.axis).applyQuaternion(body.q);
  // the rim's lowest point against the wall: −n with its component along the axis taken out
  perp.copy(wall.n).negate().addScaledVector(ax, wall.n.dot(ax));
  const flat = perp.length() < 0.25;
  for (const end of [-1, 1]) {
    const cap = pt.copy(c0).addScaledVector(ax, end * s.half);
    if (!flat) {
      add(cap.addScaledVector(perp.normalize(), s.r));
      continue;
    }
    // standing on (or leaning on) a cap: four points of its rim, so it stands instead of spinning on one point
    const u = new Vector3(1, 0, 0).cross(ax);
    if (u.lengthSq() < 1e-4) u.set(0, 0, 1).cross(ax);
    u.normalize();
    const v = new Vector3().crossVectors(ax, u);
    const base = cap.clone();
    for (const a of RIM)
      add(
        pt
          .copy(base)
          .addScaledVector(u, Math.cos(a) * s.r)
          .addScaledVector(v, Math.sin(a) * s.r),
      );
  }
}

/** Closest points of two segments (p1…q1, p2…q2) → parameters s, t in 0…1 (Ericson, RTCD §5.1.9). */
export function closest(p1: Vector3, q1: Vector3, p2: Vector3, q2: Vector3): [number, number] {
  const d1 = q1.clone().sub(p1);
  const d2 = q2.clone().sub(p2);
  const r = p1.clone().sub(p2);
  const a = d1.dot(d1);
  const e = d2.dot(d2);
  const f = d2.dot(r);
  if (a < 1e-9 && e < 1e-9) return [0, 0];
  if (a < 1e-9) return [0, clamp01(f / e)];
  const c = d1.dot(r);
  if (e < 1e-9) return [clamp01(-c / a), 0];
  const b = d1.dot(d2);
  const den = a * e - b * b;
  let s = den > 1e-9 ? clamp01((b * f - c * e) / den) : 0;
  let t = (b * s + f) / e;
  if (t < 0) {
    t = 0;
    s = clamp01(-c / a);
  } else if (t > 1) {
    t = 1;
    s = clamp01((b - c) / a);
  }
  return [s, t];
}
const clamp01 = (x: number): number => Math.min(Math.max(x, 0), 1);

const pa = new Vector3();
const qa = new Vector3();
const pb = new Vector3();
const qb = new Vector3();
/** The two parts against each other: every capsule pair. `a` is pushed along n (from b to a). */
export function pairContacts(a: Body, b: Body): void {
  for (const ca of a.spec.capsules)
    for (const cb of b.spec.capsules) {
      capsule(a, ca, pa, qa);
      capsule(b, cb, pb, qb);
      const [s, t] = closest(pa, qa, pb, qb);
      const x = pa.clone().lerp(qa, s);
      const y = pb.clone().lerp(qb, t);
      const d = x.distanceTo(y);
      const r = ca.r + cb.r;
      if (d > r + SLOP * 2 || d < 1e-6) continue;
      const c = contact();
      c.a = a;
      c.b = b;
      c.n.subVectors(x, y).divideScalar(d);
      c.p.copy(y).addScaledVector(c.n, cb.r);
      c.depth = r - d;
      c.friction = Math.sqrt(a.spec.friction * b.spec.friction);
      c.push = 3;
      c.restitution = Math.min(a.spec.restitution, b.spec.restitution);
    }
}
function capsule(body: Body, c: Capsule, a: Vector3, b: Vector3): void {
  body.toBoard(c.a, a);
  body.toBoard(c.b, b);
}
