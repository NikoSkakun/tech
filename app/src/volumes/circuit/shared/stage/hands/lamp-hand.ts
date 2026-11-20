/**
 * The lamp in the reader's hand (the owner, 2026-11-20). In the socket it is on its thread (right-hand,
 * `THREAD_PITCH` per turn, `TURNS` turns from seated to free — as it went in in the unfolding, F-lamp-screw): one
 * number `s` (turns out, 0 seated … `TURNS` free) gives its height and its turn. Dragged sideways it turns as far as
 * the thread lets it — counter-clockwise seen from above unscrews and rises; the other way screws in and stops when
 * seated. Dragged up it unscrews by itself (faster the harder the pull), dragged down it screws in by itself. After
 * the last turn it comes free and hangs on the rubber band (`Carry`) upright, swinging a little; let go it falls
 * (`solver.ts`) and rolls on its globe. Brought back over the socket the thread catches it at the angle it comes
 * in, and it screws itself home.
 */
import { Quaternion, Vector3 } from 'three';
import { THREAD_PITCH, type BulbDims } from '../bulb';
import { PLACE, type Stand } from '../stand';
import { Body } from './body';
import { Carry, type Cursor, upright } from './carry';
import { type LoosePart, clampCarry, lampSpec } from './parts';
import { Flight } from './seat';

/** Turns from seated to free (the thread catches 0.09 above home, rounded to whole pitches — F-lamp-screw). */
export const TURNS = 2;
/** Height of the lamp's bottom contact while carried: clear of the socket's rim (0.74). */
export const CARRY_Y = 1.0;
/** Over the socket within this (across the face) a carried lamp is caught by the thread… */
const CATCH = 0.34;
/** …once it has been this far away from it. */
const AWAY = 0.7;
/** A vertical drag within this (board units) is no pull; beyond it the lamp turns by itself at GAIN turns/s per unit. */
const DEAD = 0.12;
const GAIN = 12;
/** Fastest turn by itself, and the speed it screws home when caught or let go on the way in (turns/s). */
const RATE = 2.6;
const HOME_RATE = 2.4;
/** Turned out further than this (turns) the bottom contact is off the socket's: the lamp is dark. */
const CONTACT = 0.15;
const Y = new Vector3(0, 1, 0);
const TAU = Math.PI * 2;

type State = 'threaded' | 'held' | 'free' | 'catch';

export function lampHand(stand: Stand, dims: BulbDims, sound: (kind: 'free' | 'seat') => void): LoosePart {
  const group = stand.bulb.group;
  const home = PLACE.bulb;
  const body = new Body(lampSpec(dims));
  body.setPose(home, new Quaternion());
  const carry = new Carry();
  const flight = new Flight();
  let state: State = 'threaded';
  /** Turns out of the socket. */
  let s = 0;
  /** −1: screwing itself home; 0: still. */
  let auto = 0;
  /** The pointer holds it on its thread. */
  let twisting = false;
  let away = false;
  let dirty = false;
  /** The point pressed, in the lamp's own frame. */
  const grip = new Vector3();
  const offset = new Vector3();
  // the twist's reference: the pointer's height and sideways position at its start, the grip's radius and side
  let refY = 0;
  let lastSide = 0;
  let radius = 0.5;
  let facing = 1;
  const right = new Vector3();
  const p = new Vector3();
  const q = new Quaternion();
  const tmp = new Vector3();
  const tmp2 = new Vector3();
  const rest = new Quaternion();

  const threadPose = (): void => {
    p.copy(home).addScaledVector(Y, s * THREAD_PITCH);
    // + about the lamp's up axis is counter-clockwise seen from above: unscrewing
    q.setFromAxisAngle(Y, TAU * s);
    body.setPose(p, q);
  };
  const axisPoint = (y: number): Vector3 => tmp2.set(home.x, y, home.z);
  /** Start reading the pointer as a twist from the grip's point `at` (board). */
  const twistFrom = (at: Vector3, cursor: Cursor): void => {
    twisting = true;
    cursor.right(right);
    radius = Math.max(Math.hypot(at.x - home.x, at.z - home.z), 0.3);
    facing = (at.x - home.x) * cursor.forward(tmp).x + (at.z - home.z) * tmp.z < 0 ? 1 : -1;
    const hit = cursor.onUpright(axisPoint(at.y), tmp);
    refY = hit ? hit.y : at.y;
    lastSide = hit ? hit.dot(right) : 0;
  };
  const target = (cursor: Cursor, out: Vector3): Vector3 | null => {
    if (!cursor.onLevel(CARRY_Y + offset.y, out)) return null;
    out.sub(offset);
    out.y = CARRY_Y;
    return clampCarry(out, dims.globe);
  };
  const lift = (cursor: Cursor): void => {
    // free: it hangs on the band from where it came out, the band's target starting right there
    state = 'held';
    twisting = false;
    auto = 0;
    away = false;
    body.origin(p);
    carry.start(p, body.q);
    offset.copy(body.toBoard(grip, tmp)).sub(p);
    if (target(cursor, tmp)) carry.shift.set(p.x - tmp.x, 0, p.z - tmp.z);
    sound('free');
  };
  const catchIt = (seconds: number, arc: number): void => {
    // the thread takes it at the angle it comes in: the last height on the way down where its turn matches
    body.origin(p);
    upright(body.q, rest);
    const yaw = 2 * Math.atan2(rest.y, rest.w);
    const frac = (((TURNS - yaw / TAU) % 1) + 1) % 1;
    s = TURNS - frac;
    const to = tmp.copy(home).addScaledVector(Y, s * THREAD_PITCH);
    flight.start(p, body.q, to, q.setFromAxisAngle(Y, TAU * s), seconds, arc);
    body.dynamic = false;
    state = 'catch';
  };
  const near = (): number => Math.hypot(carry.pos.x - home.x, carry.pos.z - home.z);

  const part: LoosePart = {
    body,
    get inPlace() {
      return state === 'threaded' && s < CONTACT;
    },
    get idle() {
      return state === 'threaded' && s === 0 && !twisting && auto === 0 && !dirty;
    },
    get state() {
      return state === 'threaded' ? `threaded ${s.toFixed(2)}` : state;
    },
    grab(at, cursor) {
      grip.copy(at).sub(body.x).applyQuaternion(q.copy(body.q).invert()).add(body.spec.com);
      if (state === 'threaded') {
        auto = 0;
        twistFrom(at, cursor);
      } else if (state === 'free') {
        state = 'held';
        body.dynamic = false;
        body.origin(p);
        carry.start(p, body.q);
        offset.copy(at).sub(p);
        if (target(cursor, tmp)) carry.shift.set(p.x - tmp.x, 0, p.z - tmp.z);
        away = near() > AWAY;
      }
    },
    moved(cursor) {
      if (state !== 'threaded' || !twisting) return;
      const hit = cursor.onUpright(axisPoint(refY), tmp);
      if (!hit) return;
      const side = hit.dot(right);
      // the grip's arc: a sideways move of d turns the lamp d / (2πr) turns; to the right on its near side unscrews
      s = Math.min(Math.max(s + (facing * (side - lastSide)) / (TAU * radius), 0), TURNS);
      lastSide = side;
    },
    release() {
      if (state === 'threaded') twisting = false;
      else if (state === 'held') {
        if (near() < CATCH) catchIt(0.18, 0);
        else {
          state = 'free';
          body.dynamic = true;
          body.setPose(carry.pos, carry.q);
          body.v.copy(carry.vel);
          body.w.copy(carry.w);
          body.wake();
        }
      }
    },
    home(instant) {
      if (instant) {
        state = 'threaded';
        s = 0;
        auto = 0;
        twisting = false;
        body.dynamic = false;
        threadPose();
        dirty = true;
      } else if (state === 'threaded') {
        twisting = false;
        if (s > 0) auto = -1;
      } else if (state !== 'catch') {
        twisting = false;
        catchIt(0.55, 0.35);
      }
    },
    update(dt, _t, cursor) {
      if (state === 'held') {
        if (cursor.known && target(cursor, p)) {
          carry.follow(p, dt);
          carry.turn(upright(carry.q, rest), dt, 7, 0.08, 0.35);
        }
        body.setPose(carry.pos, carry.q);
        body.v.copy(carry.vel);
        if (near() > AWAY) away = true;
        if (away && near() < CATCH) catchIt(0.22, 0);
      }
      if (state === 'catch') {
        body.origin(p);
        q.copy(body.q);
        const landed = flight.step(dt, p, q);
        body.setPose(p, q);
        if (landed) {
          state = 'threaded';
          auto = -1;
          // a pointer still down holds it on the thread from here
          if (cursor.known) twistFrom(body.toBoard(grip, tmp), cursor);
        }
      }
      if (state === 'threaded') {
        let rate = 0;
        if (twisting && cursor.known) {
          const hit = cursor.onUpright(axisPoint(refY), tmp);
          const pull = hit ? hit.y - refY : 0;
          if (pull > DEAD) rate = Math.min((pull - DEAD) * GAIN, RATE);
          else if (pull < -DEAD) auto = -1;
          if (rate > 0) auto = 0;
        }
        if (auto < 0) rate = -HOME_RATE;
        const was = s;
        s = Math.min(Math.max(s + rate * dt, 0), TURNS);
        if (s === 0 && was > 0) {
          auto = 0;
          dirty = true;
          sound('seat');
        }
        threadPose();
        body.v.set(0, 0, 0);
        if (twisting && s >= TURNS) lift(cursor);
      }
      if (part.idle) return;
      dirty = false;
      body.origin(group.position);
      group.quaternion.copy(body.q);
    },
  };
  return part;
}
