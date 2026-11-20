/**
 * A rigid part of the stand that the reader can pick up (the battery, the lamp): its pose in the BOARD FRAME, its
 * velocities and the shapes it touches the board and the other part with. Whether it is simulated (`dynamic`) or
 * carried (held by the hand, seated in its clamps) is the hand's business; the solver (`solver.ts`) only moves
 * dynamic, awake bodies and treats the others as moving walls.
 *
 * Units: board units (1 ≈ 26 mm), seconds, mass 1 per body (only the ratio of the two matters).
 */
import { Matrix3, Matrix4, Quaternion, Vector3 } from 'three';

/** A flat-ended cylinder (the battery's can, the lamp's thread) or a sphere (the glass, the contact drop). */
export type Shape =
  | { kind: 'sphere'; c: Vector3; r: number }
  | { kind: 'cylinder'; c: Vector3; axis: Vector3; r: number; half: number };

/** A capsule (segment a…b swept by r; a = b: a sphere) — what the two parts collide with each other as. */
export interface Capsule {
  a: Vector3;
  b: Vector3;
  r: number;
}

export interface BodySpec {
  /** Centre of mass in the part's own frame (the frame of its group). */
  com: Vector3;
  /** Principal moments of inertia about the centre of mass along the part's own axes (mass 1). */
  inertia: Vector3;
  /** Shapes against the board and the limits (planes). */
  shapes: Shape[];
  /** Shapes against the other part. */
  capsules: Capsule[];
  /** Bounce on a hard landing (0 dead … 1 elastic). */
  restitution: number;
  friction: number;
  /** Rolling resistance (1/s): how fast spin and drift die away while it lies on the board. */
  roll: number;
  /**
   * It cannot stand on the end of its local y axis (the lamp on its round contact): it never sleeps standing, and
   * left balanced it is nudged over (a real bulb never stays upright on its base).
   */
  topples?: boolean;
}

export class Body {
  /** Centre of mass, board frame. */
  readonly x = new Vector3();
  readonly q = new Quaternion();
  /** Velocity of the centre of mass and angular velocity, board frame. */
  readonly v = new Vector3();
  readonly w = new Vector3();
  /** Simulated by the solver; otherwise a moving wall whose velocity is `v` (set by the hand). */
  dynamic = false;
  /** In the reader's hand (or flying to its place): the two parts do not touch, `limits.keepApart` steers it. */
  carried = false;
  asleep = false;
  /** Seconds it has been nearly still (for sleeping). */
  still = 0;
  /** Touching anything this step (the board, a limit, the other part). */
  touching = false;
  /** Inverse inertia in the board frame, refreshed by `refresh()`. */
  readonly invI = new Matrix3();
  private readonly invLocal: Matrix3;
  private readonly rot = new Matrix3();
  private readonly tmp = new Matrix3();

  constructor(readonly spec: BodySpec) {
    const i = spec.inertia;
    this.invLocal = new Matrix3().set(1 / i.x, 0, 0, 0, 1 / i.y, 0, 0, 0, 1 / i.z);
  }

  /** Pose of the part's own origin (its group's position) and orientation. */
  setPose(origin: Vector3, q: Quaternion): void {
    this.q.copy(q);
    this.x.copy(this.spec.com).applyQuaternion(q).add(origin);
  }

  origin(out: Vector3): Vector3 {
    return out.copy(this.spec.com).applyQuaternion(this.q).negate().add(this.x);
  }

  /** A point of the part's own frame in the board frame. */
  toBoard(local: Vector3, out: Vector3): Vector3 {
    return out.copy(local).sub(this.spec.com).applyQuaternion(this.q).add(this.x);
  }

  wake(): void {
    this.asleep = false;
    this.still = 0;
  }

  /** Inverse inertia in the board frame: R · I⁻¹ · Rᵀ. */
  refresh(): void {
    const e = this.rot.setFromMatrix4(m4.makeRotationFromQuaternion(this.q));
    this.tmp.copy(e).multiply(this.invLocal);
    this.invI.copy(this.tmp).multiply(e.transpose());
  }

  /** Velocity of a board point attached to the body. */
  pointVelocity(p: Vector3, out: Vector3): Vector3 {
    return out.subVectors(p, this.x).crossVectors(this.w, out).add(this.v);
  }

  /** Integrate the pose over h seconds with the current velocities. */
  integrate(h: number): void {
    this.x.addScaledVector(this.v, h);
    const w = this.w;
    // q̇ = ½ ω q (ω as a pure quaternion, board frame)
    dq.set(w.x * h * 0.5, w.y * h * 0.5, w.z * h * 0.5, 0).multiply(this.q);
    this.q.set(this.q.x + dq.x, this.q.y + dq.y, this.q.z + dq.z, this.q.w + dq.w).normalize();
  }
}

const m4 = new Matrix4();
const dq = new Quaternion();
