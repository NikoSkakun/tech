/**
 * A short eased flight of a part's pose to a goal pose (drawn into its clamps, carried home when the step is left,
 * caught by the socket's thread): position along a low arc, orientation by slerp. Restartable from any pose.
 */
import { Quaternion, Vector3 } from 'three';

const smooth = (u: number): number => u * u * (3 - 2 * u);

export class Flight {
  private readonly p0 = new Vector3();
  private readonly q0 = new Quaternion();
  private readonly p1 = new Vector3();
  private readonly q1 = new Quaternion();
  private seconds = 0;
  private arc = 0;
  private u = 1;

  get flying(): boolean {
    return this.u < 1;
  }

  /** Fly from (p, q) to (to, toQ) in `seconds`, rising `arc` above the straight line at mid-way. */
  start(p: Vector3, q: Quaternion, to: Vector3, toQ: Quaternion, seconds: number, arc = 0): void {
    this.p0.copy(p);
    this.q0.copy(q);
    this.p1.copy(to);
    this.q1.copy(toQ);
    this.seconds = Math.max(seconds, 1e-3);
    this.arc = arc;
    this.u = 0;
  }

  /** Advance; writes the pose; true on the frame it lands. */
  step(dt: number, p: Vector3, q: Quaternion): boolean {
    if (this.u >= 1) return false;
    this.u = Math.min(this.u + dt / this.seconds, 1);
    const e = smooth(this.u);
    p.lerpVectors(this.p0, this.p1, e);
    p.y += this.arc * Math.sin(Math.PI * e);
    q.slerpQuaternions(this.q0, this.q1, e);
    return this.u >= 1;
  }
}
