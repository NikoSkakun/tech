/**
 * The hand's side of a carried part: the pointer as a ray in the board frame (`Cursor`) and the «strong rubber band»
 * (`Carry`) — a critically damped spring from the part to the cursor's point on its working plane, solved exactly
 * per frame (no lag that feels sluggish, no overshoot that wobbles), and an orientation that eases toward its rest
 * with a slight swing along the motion.
 */
import { Quaternion, Ray, Vector3 } from 'three';
import { worldDirToBoard, worldToBoard } from '../tools';

const UP = new Vector3(0, 1, 0);

/** The pointer's pick ray, kept in the board frame. */
export class Cursor {
  readonly ray = new Ray();
  /** False until the first pointer event of a drag. */
  known = false;

  /** Take the pick ray (world space) of a pointer event. */
  set(world: Ray): void {
    worldToBoard(world.origin, this.ray.origin);
    worldDirToBoard(world.direction, this.ray.direction).normalize();
    this.known = true;
  }

  /** The pointer's point on the board-parallel plane at height y (null if the ray runs along it or away). */
  onLevel(y: number, out: Vector3): Vector3 | null {
    const d = this.ray.direction;
    if (Math.abs(d.y) < 1e-4) return null;
    const t = (y - this.ray.origin.y) / d.y;
    return t > 0 ? this.ray.at(t, out) : null;
  }

  /** The pointer's point on the upright plane through p that faces the viewer. */
  onUpright(p: Vector3, out: Vector3): Vector3 | null {
    n.copy(this.ray.direction).setY(0);
    if (n.lengthSq() < 1e-6) return null;
    n.normalize();
    const den = n.dot(this.ray.direction);
    if (Math.abs(den) < 1e-4) return null;
    const t = n.dot(out.copy(p).sub(this.ray.origin)) / den;
    return t > 0 ? this.ray.at(t, out) : null;
  }

  /** The viewer's right along the board (for sideways drags). */
  right(out: Vector3): Vector3 {
    return out.crossVectors(this.ray.direction, UP).setY(0).normalize();
  }

  /** Horizontal direction from the viewer into the scene. */
  forward(out: Vector3): Vector3 {
    return out.copy(this.ray.direction).setY(0).normalize();
  }
}
const n = new Vector3();

/** Angular speed of the band (1/s): it closes 95 % of a gap in ≈ 0.2 s. */
export const BAND = 24;

export class Carry {
  /** The part's origin and its velocity, board frame. */
  readonly pos = new Vector3();
  readonly vel = new Vector3();
  readonly q = new Quaternion();
  /** Angular velocity of the last frame (handed to the physics on release). */
  readonly w = new Vector3();
  /**
   * Offset added to the band's target that fades out: a part picked up where the pointer's working plane does not
   * pass through it rises and comes under the pointer smoothly instead of leaping there.
   */
  readonly shift = new Vector3();
  private readonly prev = new Quaternion();
  private readonly swingQ = new Quaternion();

  start(origin: Vector3, q: Quaternion, vel?: Vector3): void {
    this.pos.copy(origin);
    this.q.copy(q);
    if (vel) this.vel.copy(vel);
    else this.vel.set(0, 0, 0);
    this.w.set(0, 0, 0);
    this.shift.set(0, 0, 0);
  }

  /** Spring the origin toward `target` (+ the fading shift) for dt s: x'' = ω²(x* − x) − 2ωx'. */
  follow(target: Vector3, dt: number, omega = BAND): void {
    this.shift.multiplyScalar(Math.exp(-4 * dt));
    const goal = tmp.copy(target).add(this.shift);
    const e = Math.exp(-omega * dt);
    // exact solution of the critically damped spring over dt (stable at any frame time)
    const x0 = d0.subVectors(this.pos, goal);
    const c = d1.copy(this.vel).addScaledVector(x0, omega);
    this.pos.copy(goal).add(x0.addScaledVector(c, dt).multiplyScalar(e));
    this.vel.addScaledVector(c, -omega * dt).multiplyScalar(e);
  }

  /**
   * Ease the orientation toward `rest` (rate 1/s), swung along the motion: the part leans `lean` rad per unit of
   * speed (at most `most`) as if it hung a little below the hand.
   */
  turn(rest: Quaternion, dt: number, rate: number, lean: number, most: number): void {
    this.prev.copy(this.q);
    axis.crossVectors(UP, d0.copy(this.vel).setY(0));
    const speed = axis.length();
    if (speed > 1e-4) this.swingQ.setFromAxisAngle(axis.divideScalar(speed), Math.min(lean * speed, most));
    else this.swingQ.identity();
    goalQ.multiplyQuaternions(this.swingQ, rest);
    this.q.slerp(goalQ, 1 - Math.exp(-rate * dt));
    angularVelocity(this.prev, this.q, dt, this.w);
  }
}
const tmp = new Vector3();
const d0 = new Vector3();
const d1 = new Vector3();
const axis = new Vector3();
const goalQ = new Quaternion();
const dq = new Quaternion();

/** ω that turns `from` into `to` in dt (board frame). */
export function angularVelocity(from: Quaternion, to: Quaternion, dt: number, out: Vector3): Vector3 {
  dq.copy(from).invert().premultiply(to);
  if (dq.w < 0) dq.set(-dq.x, -dq.y, -dq.z, -dq.w);
  const s = Math.sqrt(Math.max(1 - dq.w * dq.w, 0));
  const angle = 2 * Math.acos(Math.min(dq.w, 1));
  if (s < 1e-6 || dt <= 0) return out.set(0, 0, 0);
  return out.set(dq.x / s, dq.y / s, dq.z / s).multiplyScalar(angle / dt);
}

/** The same orientation turned so that its local axis `a` lies flat on the board (yaw and roll kept). */
export function laidFlat(q: Quaternion, a: Vector3, out: Quaternion): Quaternion {
  const now = tmp.copy(a).applyQuaternion(q);
  const flat = d0.copy(now).setY(0);
  if (flat.lengthSq() < 1e-6) flat.set(1, 0, 0);
  return out.setFromUnitVectors(now, flat.normalize()).multiply(q);
}

/** The orientation's yaw alone (its local y set upright). */
export function upright(q: Quaternion, out: Quaternion): Quaternion {
  const up = tmp.copy(UP).applyQuaternion(q);
  return out.setFromUnitVectors(up, UP).multiply(q);
}
