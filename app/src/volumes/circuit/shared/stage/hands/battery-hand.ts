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
import { keepApart, keepInside } from './limits';
import { type LoosePart, batterySpec } from './parts';
import { Flight } from './seat';

/** How far (board units) the pointer must pull from the point pressed before the battery leaves its clamps. */
export const POP = 0.8;
/** Height of the battery's centre while carried: its underside clears the clamps' collars (top at ≈ 0.87). */
export const CARRY_Y = 1.3;
/** Within this (board, across the face) of its place a carried battery is drawn in… */
export const SNAP = 0.5;
/** …once it has been this far away (else it would snap back the moment it pops out). */
const AWAY = 0.9;
/** Let go within this of its place, it goes in too (it was being put back). */
const DROP_IN = 0.9;
/**
 * Coming near its place it is drawn in and comes down by itself (the owner, 2026-11-20: never hovering over the
 * clamps): from `NEAR[1]` (pointer's distance) its place pulls it — across to the clamps, turned to lie as it sits —
 * fully at `NEAR[0]`; it comes down as it lines up (|Δx| under `LINED[1]`), so it never comes down onto a leaf.
 */
const NEAR = [0.45, 1.5] as const;
const LINED = [0.1, 0.5] as const;
const LOW = 0.1;
/** Near its place the side walls let go (its place is outside them): from `OPEN[1]` in to `OPEN[0]`. */
const OPEN = [0.6, 1.2] as const;
/** The spring at the minus clamp stretches this much when the battery is out. */
const SPRING_FREE = 0.07;
const X = new Vector3(1, 0, 0);
const Z = new Vector3(0, 0, 1);
const IDENTITY = new Quaternion();
const smoothstep = (a: number, b: number, x: number): number => {
  const u = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return u * u * (3 - 2 * u);
};

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
  /** How much its place draws the carried battery now (0 … 1). */
  let drawn = 0;
  /**
   * How far it has been from its place since taken, as 0 … 1 (it grows only): just out of the clamps it is not
   * drawn back in, it must have left first — the pull is armed smoothly as it goes away, never switched on.
   */
  let armed = 0;
  const arm = (): void => {
    const d = Math.hypot(carry.pos.x - PLACE.battery.x, carry.pos.z - PLACE.battery.z);
    armed = Math.max(armed, smoothstep(NEAR[0], NEAR[1], d));
  };

  const seatAt = new Vector3();
  const target = (cursor: Cursor, out: Vector3, other: Body | null): Vector3 | null => {
    if (!cursor.onLevel(CARRY_Y + offset.y, out)) return null;
    out.sub(offset);
    out.y = CARRY_Y;
    // how near its place the pointer is, read where the place is: on the clamps' level (pointing at the clamps on
    // the screen is «there», though the carried battery is higher)
    const seat = cursor.onLevel(PLACE.battery.y + offset.y, seatAt);
    const home = seat
      ? Math.hypot(seat.x - offset.x - PLACE.battery.x, seat.z - offset.z - PLACE.battery.z)
      : Infinity;
    keepInside(body, carry.q, out, 1 - smoothstep(OPEN[0], OPEN[1], home));
    // its place draws it in as it comes near: across to the clamps, lined up, and down — never hovering over them
    drawn = (1 - smoothstep(NEAR[0], NEAR[1], home)) * armed;
    out.x += (PLACE.battery.x - out.x) * drawn;
    out.z += (PLACE.battery.z - out.z) * drawn;
    const lined = 1 - smoothstep(LINED[0], LINED[1], Math.abs(out.x - PLACE.battery.x));
    out.y = CARRY_Y + (PLACE.battery.y + LOW - CARRY_Y) * drawn * lined;
    if (other) keepApart(body, carry.q, out, other);
    return out;
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
      armed = 0;
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
        armed = 0;
        arm();
        offset.copy(at).sub(p);
        // it rises straight up first and comes under the pointer as the shift fades
        if (target(cursor, tmp, null)) carry.shift.set(p.x - tmp.x, 0, p.z - tmp.z);
        away = Math.hypot(p.x - PLACE.battery.x, p.z - PLACE.battery.z) > AWAY;
      }
    },
    moved() {},
    release() {
      if (state === 'strain') fly(0.12, 0, shown.lift > 0.05);
      else if (state === 'held') {
        if (Math.hypot(carry.pos.x - PLACE.battery.x, carry.pos.z - PLACE.battery.z) < DROP_IN) fly(0.25, 0.06, true);
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
    update(dt, t, cursor, other) {
      if (state === 'strain') strainPose(dt, t, cursor);
      if (state === 'held') {
        if (cursor.known && target(cursor, p, other)) {
          // the band lags its target: the part itself keeps out of the other's field too, on its way (substeps)
          for (let k = 0; k < 4; k++) {
            carry.follow(p, dt / 4);
            keepApart(body, carry.q, carry.pos, other);
          }
          carry.turn(laidFlat(carry.q, X, rest).slerp(IDENTITY, drawn), dt, 10, 0.05, 0.22);
        }
        body.setPose(carry.pos, carry.q);
        body.v.copy(carry.vel);
        arm();
        const d = Math.hypot(carry.pos.x - PLACE.battery.x, carry.pos.z - PLACE.battery.z);
        if (d > AWAY) away = true;
        // in only once it has come down to the clamps (it never drops in from above)
        if (away && d < SNAP && carry.pos.y < PLACE.battery.y + LOW + 0.12) fly(0.2, 0.06, true);
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
      body.carried = state === 'held' || state === 'seat';
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
