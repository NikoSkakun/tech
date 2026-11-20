/**
 * The soft, «anti-magnetic» limits of the loose parts (the owner, 2026-11-20): the stand's sides (`REGION`) and,
 * while a part is carried, the other part. Nothing here is an impact: a carried part's target is eased along a
 * wall and lifted over the other part (it glides past above it), and a falling or rolling part is braked as it nears
 * a wall, so that it stops at it — it never crosses and never has to come back.
 */
import { type Quaternion, Vector3 } from 'three';
import type { Body } from './body';
import { closest, outermost, reach } from './contacts';
import { SIDES } from './parts';

/** Width (board units) of the band along a wall in which a carried part eases to its stop. */
const WALL_BAND = 0.25;
/** The clear margin kept between the two parts' outlines while one is carried, and the field's extra reach. */
const MARGIN = 0.06;
const FIELD_BAND = 0.12;
/** Braking of a free part toward a wall (board units/s²): from 4 u/s it stops in 0.8 u. */
const BRAKE = 10;
/** How fast a free part found past a wall (a lamp toppling toward it) is slid back in, u/s. */
const BACK = 0.8;

/** Smooth «not below 0»: d itself well above 0, w·ln 2 at 0, → 0 far below (softplus). */
const ease = (d: number, w: number): number => (d / w > 20 ? d : w * Math.log1p(Math.exp(d / w)));

/** Distance from the part's outline to a side (positive inside), centre of mass at `com`, orientation q. */
function clearance(body: Body, q: Quaternion, com: Vector3, side: (typeof SIDES)[number]): number {
  return side.n.dot(com) - side.o - reach(body, q, side.n);
}

/** The part's outline against the stand's sides now: the smallest clearance (≥ 0 inside; QA). */
export function clearanceOf(body: Body): number {
  return Math.min(...SIDES.map((side) => clearance(body, body.q, body.x, side)));
}

/**
 * Ease a carried part's centre target `com` (orientation q) so that its outline stays inside `REGION`. `free`
 * 0…1 lets the walls go (near the part's own place, which lies outside: the clamps, the socket).
 */
export function keepInside(body: Body, q: Quaternion, com: Vector3, free = 0): Vector3 {
  for (const side of SIDES) {
    const d = clearance(body, q, com, side);
    com.addScaledVector(side.n, (ease(d, WALL_BAND) - d) * (1 - free));
  }
  return com;
}

const a0 = new Vector3();
const a1 = new Vector3();
const b0 = new Vector3();
const b1 = new Vector3();
const x = new Vector3();
const y = new Vector3();
const up = new Vector3();
const ext = new Vector3();
const turn = new Vector3();
/** Smoothing of the rise over the other part (board units). */
const RISE_SOFT = 0.06;
/**
 * Lift a carried part's centre `com` (orientation q) over the other part, softly: their outlines (capsules) keep
 * `MARGIN` + `FIELD_BAND` apart, the carried one rising on the field as it passes over the other — like a magnet
 * over a magnet of the same pole. It never touches, is never stopped or thrown sideways, and the other one is not
 * moved. Nothing happens away from the other part.
 */
export function keepApart(body: Body, q: Quaternion, com: Vector3, other: Body): Vector3 {
  let lift = -Infinity;
  for (const ca of body.spec.capsules)
    for (const cb of other.spec.capsules) {
      a0.copy(ca.a).sub(body.spec.com).applyQuaternion(q).add(com);
      a1.copy(ca.b).sub(body.spec.com).applyQuaternion(q).add(com);
      other.toBoard(cb.a, b0);
      other.toBoard(cb.b, b1);
      const [s, t] = closest(a0, a1, b0, b1);
      x.lerpVectors(a0, a1, s);
      y.lerpVectors(b0, b1, t);
      const r = ca.r + cb.r + MARGIN + FIELD_BAND;
      const across = Math.hypot(x.x - y.x, x.z - y.z);
      if (across >= r) continue;
      // the height this point must have to clear the other's outline by r: a dome over it
      lift = Math.max(lift, y.y + Math.sqrt(r * r - across * across) - x.y);
    }
  if (lift === -Infinity) return com;
  com.y += lift / RISE_SOFT > 20 ? lift : RISE_SOFT * Math.log1p(Math.exp(lift / RISE_SOFT));
  return com;
}

/** A free part nearing a wall is braked so that it comes to rest at it (call every substep, before contacts). */
export function brakeAtWalls(body: Body): void {
  // a lamp still toppling over turns its outline toward a wall without moving at it: `slideBack` takes it in
  if (body.spec.topples && up.set(0, 1, 0).applyQuaternion(body.q).y > 0.35) return;
  for (const side of SIDES) {
    const d = clearance(body, body.q, body.x, side);
    // already over it (only by turning: a toppling lamp): `slideBack` takes it in, the topple goes on undisturbed
    if (d < 0) continue;
    const toward = -side.n.dot(body.v);
    // the fastest approach that can still stop at the wall with BRAKE
    const most = Math.sqrt(2 * BRAKE * d);
    if (toward > most) body.v.addScaledVector(side.n, toward - most);
    // a tumbling part's outermost point comes on by its spin too: that share is calmed as well
    outermost(body, body.q, side.n, ext);
    const spin = -side.n.dot(turn.crossVectors(body.w, ext));
    const left = most - Math.min(toward, most);
    if (spin > left && spin > 1e-6) body.w.multiplyScalar(Math.max(left, 0) / spin);
  }
}

/**
 * A free part whose outline has crossed a wall by turning (a lamp toppling toward it) is slid back in, slowly, as a
 * shift of its position — not a push it could lean on (call every substep, after integrating, h s).
 */
export function slideBack(body: Body, h: number): void {
  for (const side of SIDES) {
    const d = clearance(body, body.q, body.x, side);
    if (d < 0) body.x.addScaledVector(side.n, Math.min(-d, BACK * h));
  }
}
