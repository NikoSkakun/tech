/**
 * A small impulse solver for the loose parts of the stand: gravity, the board, what is fixed on it (`obstacles`), the
 * soft side walls (`limits.brakeAtWalls`: braked to a stop, never crossed) and the parts against each other.
 * Sequential impulses with accumulated normal clamping, Coulomb friction, a little bounce on hard landings,
 * rolling resistance while lying, sleep once still. Fixed substeps (`H`): the same motion at any frame rate.
 *
 * Gravity is along the BOARD's −y, not the world's: the board is tilted 15° toward the reader only for the view, and
 * a part let go must stay where the reader dropped it (on the real slope a cylinder would roll to the near edge).
 */
import { Vector3 } from 'three';
import type { Body } from './body';
import { type Contact, SLOP, type Wall, contacts, pairContacts, resetContacts, wallContacts } from './contacts';
import { brakeAtWalls, slideBack } from './limits';

/** Substep, s. */
export const H = 1 / 240;
/** Gravity, board units/s² (stylised: a fall from the carrying height reads at a glance, ≈ 0.3 s). */
export const GRAVITY = 30;
const ITERATIONS = 10;
/** Share of a penetration corrected per substep (as a velocity, capped by the wall's `push`). */
const BETA = 0.25;
/** Restitution only above this approach speed (resting contacts do not jitter). */
const BOUNCE_MIN = 0.8;
/** Still below these speeds for `SLEEP_T` s: the part sleeps until something moves it. */
const SLEEP_V = 0.05;
const SLEEP_W = 0.15;
const SLEEP_T = 0.3;
/** A part that `topples` counts as standing while its up axis is within ≈ 40° of the board's normal. */
const STANDING = 0.75;
/** Angular acceleration (rad/s²) that tips a balanced part over. */
const NUDGE = 3;
const up = new Vector3();
const tilt = new Vector3();
/** The steady part of the rolling resistance, rad/s². */
const ROLL_BRAKE = 2.5;
/** Longest frame simulated (a stalled tab must not throw the parts). */
const MAX_DT = 1 / 20;

export interface Solver {
  step(dt: number): void;
}

const live = (b: Body | null): boolean => !!b && b.dynamic && !b.asleep;
/** The body if the solver moves it, else null (a wall, a carried or a sleeping part). */
const moving = (b: Body | null): Body | null => (b && live(b) ? b : null);
const ra = new Vector3();
const rb = new Vector3();
const va = new Vector3();
const vb = new Vector3();
const t = new Vector3();
const j = new Vector3();
const tmp = new Vector3();
const old = new Vector3();

/** Effective inverse mass of the contact along a direction d. */
function k(c: Contact, d: Vector3): number {
  let s = 0;
  const a = moving(c.a);
  const b = moving(c.b);
  if (a) s += 1 + tmp.crossVectors(ra, d).applyMatrix3(a.invI).cross(ra).dot(d);
  if (b) s += 1 + tmp.crossVectors(rb, d).applyMatrix3(b.invI).cross(rb).dot(d);
  return s;
}
function relative(c: Contact, out: Vector3): Vector3 {
  c.a.pointVelocity(c.p, out);
  if (c.b) out.sub(c.b.pointVelocity(c.p, vb));
  return out;
}
function apply(c: Contact, impulse: Vector3): void {
  const a = moving(c.a);
  const b = moving(c.b);
  if (a) {
    a.v.add(impulse);
    a.w.add(tmp.crossVectors(ra, impulse).applyMatrix3(a.invI));
  }
  if (b) {
    b.v.sub(impulse);
    b.w.sub(tmp.crossVectors(rb, impulse).applyMatrix3(b.invI));
  }
}

export function createSolver(bodies: readonly Body[], walls: readonly Wall[]): Solver {
  let acc = 0;
  const substep = (h: number): void => {
    resetContacts();
    for (const b of bodies) {
      if (!live(b)) continue;
      b.v.y -= GRAVITY * h;
      brakeAtWalls(b);
      b.touching = false;
      for (const s of b.spec.shapes) for (const w of walls) wallContacts(b, s, w);
    }
    for (let i = 0; i < bodies.length; i++)
      for (let m = i + 1; m < bodies.length; m++) {
        const a = bodies[i]!;
        const b = bodies[m]!;
        // a part in the hand never touches the other one: the soft field around it steers it instead
        if (a.carried || b.carried) continue;
        if (live(a)) pairContacts(a, b);
        else if (live(b)) pairContacts(b, a);
        else if (a.dynamic && b.dynamic) continue;
        // a carried part wakes a sleeping one it runs into
        else if (a.dynamic || b.dynamic) {
          const [sleeper, mover] = a.dynamic ? [a, b] : [b, a];
          if (mover.v.lengthSq() > 0.01) pairContacts(sleeper, mover);
        }
      }
    const list = contacts();
    for (const c of list) {
      for (const b of [c.a, c.b]) if (b?.dynamic && b.asleep) b.wake();
    }
    for (const b of bodies) b.refresh();
    for (const c of list) {
      c.a.touching = true;
      if (c.b) c.b.touching = true;
      const vn = relative(c, va).dot(c.n);
      c.bounce = vn < -BOUNCE_MIN ? -c.restitution * vn : 0;
    }
    for (let it = 0; it < ITERATIONS; it++)
      for (const c of list) {
        ra.subVectors(c.p, c.a.x);
        if (c.b) rb.subVectors(c.p, c.b.x);
        const vn = relative(c, va).dot(c.n);
        const bias = Math.min((BETA * Math.max(c.depth - SLOP, 0)) / h, c.push);
        const kn = k(c, c.n);
        if (kn < 1e-9) continue;
        const before = c.jn;
        c.jn = Math.max(before + (Math.max(c.bounce, bias) - vn) / kn, 0);
        apply(c, j.copy(c.n).multiplyScalar(c.jn - before));
        // friction against the sliding direction; the accumulated friction stays within μ·(normal impulse)
        relative(c, va);
        t.copy(va).addScaledVector(c.n, -va.dot(c.n));
        const slide = t.length();
        if (slide < 1e-7) continue;
        t.divideScalar(slide);
        const kt = k(c, t);
        if (kt < 1e-9) continue;
        old.copy(c.jt);
        c.jt.addScaledVector(t, -slide / kt);
        const most = c.friction * c.jn;
        if (c.jt.length() > most) c.jt.setLength(most);
        apply(c, j.subVectors(c.jt, old));
      }
    for (const b of bodies) {
      if (!live(b)) continue;
      if (b.touching) {
        // rolling resistance: lying parts lose their spin and drift and come to rest — a steady brake (which ends
        // the roll) on top of a proportional one (which calms a fast spin): no endless creep at the end
        const spin = b.w.length();
        if (spin > 1e-9) b.w.multiplyScalar((Math.max(spin - ROLL_BRAKE * h, 0) * Math.exp(-b.spec.roll * h)) / spin);
        b.v.multiplyScalar(Math.exp(-0.25 * b.spec.roll * h));
      }
      // braked once more after the contacts: a rolling part's friction must not carry it on at the wall
      brakeAtWalls(b);
      b.integrate(h);
      slideBack(b, h);
      let still = b.touching && b.v.length() < SLEEP_V && b.w.length() < SLEEP_W;
      if (still && b.spec.topples) {
        up.set(0, 1, 0).applyQuaternion(b.q);
        if (up.y > STANDING) {
          still = false;
          // balanced on its contact: the slightest tilt grows by itself; give it one where there is none
          tilt.set(up.z, 0, -up.x);
          if (tilt.lengthSq() < 1e-6) tilt.set(1, 0, 0);
          b.w.addScaledVector(tilt.normalize(), NUDGE * h);
        }
      }
      b.still = still ? b.still + h : 0;
      if (b.still > SLEEP_T) {
        b.asleep = true;
        b.v.set(0, 0, 0);
        b.w.set(0, 0, 0);
      }
    }
  };
  return {
    step(dt) {
      acc = Math.min(acc + Math.min(dt, MAX_DT), MAX_DT);
      while (acc >= H) {
        substep(H);
        acc -= H;
      }
    },
  };
}
