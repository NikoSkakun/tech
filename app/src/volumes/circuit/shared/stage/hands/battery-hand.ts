/**
 * The battery in the reader's hand (the owner, 2026-11-20): pulled, it first strains in its clamps — a small give
 * that grows harder (it lifts, slides a little toward the pull, the end that is pulled rises, and near the end it
 * trembles) — and past `POP` it jumps out to the pointer. Then it follows the pointer on the rubber band (`Carry`)
 * at a height that clears the clamps. Let go, it falls on the board (`solver.ts`) inside the loop; brought back over
 * its clamps it is drawn in and clicks into place — always «+» to the plus clamp: if it comes the other way round
 * it turns over as it goes in (an adult beginner's volume: no polarity lesson here, the clamps just guide it).
 */
import { Quaternion, Vector3 } from 'three';
import { BATTERY } from '../layout';
import { PLACE, type Stand } from '../stand';
import { Body } from './body';
import { Carry, type Cursor, laidFlat } from './carry';
import { type LoosePart, batterySpec, clampCarry } from './parts';
import { Flight } from './seat';

/** How far (board units) the pointer must pull from the point pressed before the battery leaves its clamps. */
export const POP = 0.8;
/** Height of the battery's centre while carried: its underside clears the clamps' collars (top at ≈ 0.87). */
export const CARRY_Y = 1.3;
/** Within this (board, across the face) of its place a carried battery is drawn in… */
export const SNAP = 0.5;
/** …once it has been this far away (else it would snap back the moment it pops out). */
const AWAY = 0.9;
/** The spring at the minus clamp stretches this much when the battery is out. */
const SPRING_FREE = 0.07;
const X = new Vector3(1, 0, 0);
const Z = new Vector3(0, 0, 1);
const IDENTITY = new Quaternion();

type State = 'home' | 'strain' | 'held' | 'free' | 'seat';

export function batteryHand(stand: Stand, sound: (kind: 'pop' | 'seat') => void): LoosePart {
  const group = stand.battery.group;
  const body = new Body(batterySpec());
  body.setPose(PLACE.battery, IDENTITY);
  const carry = new Carry();
  const flight = new Flight();
  let state: State = 'home';
  let away = false;
  /** Whether the flight under way ends with a click (drawn into the clamps by the hand). */
  let clicks = false;
  /** The pose must be written once more (it has just landed home). */
  let dirty = false;
  const pressed = new Vector3();
  const offset = new Vector3();
  const shown = { lift: 0, slide: 0, push: 0, tilt: 0 };
  let spring: number = PLACE.springLength;
  const p = new Vector3();
  const q = new Quaternion();
  const tmp = new Vector3();
  const rest = new Quaternion();

  const target = (cursor: Cursor, out: Vector3): Vector3 | null => {
    if (!cursor.onLevel(CARRY_Y + offset.y, out)) return null;
    out.sub(offset);
    out.y = CARRY_Y;
    const along = Math.abs(tmp.copy(X).applyQuaternion(carry.q).x);
    return clampCarry(out, along * (BATTERY.length / 2) + BATTERY.radius);
  };
  const fly = (seconds: number, arc: number, click: boolean): void => {
    body.dynamic = false;
    body.origin(p);
    flight.start(p, body.q, PLACE.battery, IDENTITY, seconds, arc);
    state = 'seat';
    clicks = click;
  };
  const strainPose = (dt: number, t: number, cursor: Cursor): void => {
    const at = cursor.known ? cursor.onLevel(pressed.y, tmp) : null;
    const dx = at ? at.x - pressed.x : 0;
    const dz = at ? at.z - pressed.z : 0;
    const pull = Math.hypot(dx, dz);
    if (pull > POP) {
      // out: the band takes it from where it strained, straight to the pointer — that leap is the «pop»
      state = 'held';
      away = false;
      body.origin(p);
      carry.start(p, body.q);
      offset.copy(pressed).sub(PLACE.battery);
      sound('pop');
      return;
    }
    // the give grows ever harder: 1 − e^(−pull/0.35) of a small travel
    const k = 1 - Math.exp(-pull / 0.35);
    const side = Math.min(Math.max((pressed.x - BATTERY.x) / 0.5, -1), 1);
    const ease = 1 - Math.exp(-30 * dt);
    shown.lift += (0.2 * k - shown.lift) * ease;
    shown.slide += (0.08 * Math.tanh(dx / 0.4) - shown.slide) * ease;
    shown.push += (0.06 * Math.tanh(dz / 0.4) - shown.push) * ease;
    shown.tilt += (0.2 * k * side - shown.tilt) * ease;
    // near the threshold the clamps' grip trembles
    const tremble = 0.007 * k ** 3 * Math.sin(t * 74);
    p.copy(PLACE.battery).add(tmp.set(shown.slide, shown.lift + tremble, shown.push));
    q.setFromAxisAngle(Z, shown.tilt);
    body.setPose(p, q);
  };

  const part: LoosePart = {
    body,
    get inPlace() {
      return state === 'home' || state === 'strain';
    },
    get idle() {
      return state === 'home' && !dirty;
    },
    get state() {
      return state;
    },
    grab(at, cursor) {
      if (state === 'home') {
        state = 'strain';
        pressed.copy(at);
        shown.lift = shown.slide = shown.push = shown.tilt = 0;
      } else if (state === 'free') {
        state = 'held';
        body.dynamic = false;
        body.origin(p);
        carry.start(p, body.q);
        offset.copy(at).sub(p);
        // it rises straight up first and comes under the pointer as the shift fades
        if (target(cursor, tmp)) carry.shift.set(p.x - tmp.x, 0, p.z - tmp.z);
        away = Math.hypot(p.x - PLACE.battery.x, p.z - PLACE.battery.z) > AWAY;
      }
    },
    moved() {},
    release() {
      if (state === 'strain') fly(0.12, 0, shown.lift > 0.05);
      else if (state === 'held') {
        if (Math.hypot(carry.pos.x - PLACE.battery.x, carry.pos.z - PLACE.battery.z) < SNAP) fly(0.2, 0.06, true);
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
        state = 'home';
        body.dynamic = false;
        body.setPose(PLACE.battery, IDENTITY);
        dirty = true;
      } else if (state !== 'home' && state !== 'seat') fly(state === 'strain' ? 0.15 : 0.6, 0.4, false);
    },
    update(dt, t, cursor) {
      if (state === 'strain') strainPose(dt, t, cursor);
      if (state === 'held') {
        if (cursor.known && target(cursor, p)) {
          carry.follow(p, dt);
          carry.turn(laidFlat(carry.q, X, rest), dt, 10, 0.05, 0.22);
        }
        body.setPose(carry.pos, carry.q);
        body.v.copy(carry.vel);
        const d = Math.hypot(carry.pos.x - PLACE.battery.x, carry.pos.z - PLACE.battery.z);
        if (d > AWAY) away = true;
        if (away && d < SNAP) fly(0.2, 0.06, true);
      }
      if (state === 'seat') {
        body.origin(p);
        q.copy(body.q);
        if (flight.step(dt, p, q)) {
          state = 'home';
          dirty = true;
          if (clicks) sound('seat');
        }
        body.setPose(p, q);
        body.v.set(0, 0, 0);
      }
      if (state === 'home' && !dirty) return;
      dirty = false;
      body.origin(group.position);
      group.quaternion.copy(body.q);
      // the minus clamp's spring: pressed by a slide toward it, stretched out when the battery is gone
      const goal =
        state === 'home'
          ? PLACE.springLength
          : state === 'strain'
            ? PLACE.springLength + Math.min(shown.slide, SPRING_FREE)
            : PLACE.springLength + SPRING_FREE;
      spring = state === 'home' ? goal : spring + (goal - spring) * (1 - Math.exp(-18 * dt));
      stand.spring.group.scale.x = spring / stand.spring.length;
    },
  };
  return part;
}
