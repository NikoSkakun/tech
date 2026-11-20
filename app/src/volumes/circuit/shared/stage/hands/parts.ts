/**
 * The two loose parts as rigid bodies (`body.ts`): their mass centres, inertia and collision shapes, read off the
 * models (`battery.ts`, `bulb.ts`) — and the limits they move within.
 */
import { Vector3 } from 'three';
import type { BulbDims } from '../bulb';
import { BATTERY, BOARD, LOOP, WIRE } from '../layout';
import type { Body, BodySpec } from './body';
import type { Cursor } from './carry';
import type { Wall } from './contacts';

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);

/** The AA can: a cylinder along its local x, origin at its centre (mass 1: I = ½R² about the axis). */
export function batterySpec(): BodySpec {
  const { radius: R, length: L } = BATTERY;
  return {
    com: new Vector3(),
    inertia: new Vector3(0.5 * R * R, (3 * R * R + L * L) / 12, (3 * R * R + L * L) / 12),
    shapes: [{ kind: 'cylinder', c: new Vector3(), axis: X, r: R, half: L / 2 + 0.03 }],
    capsules: [{ a: new Vector3(-L / 2 + R * 0.6, 0, 0), b: new Vector3(L / 2 - R * 0.6, 0, 0), r: R }],
    restitution: 0.22,
    friction: 0.6,
    roll: 2.2,
  };
}

/**
 * The lamp: origin at its bottom contact. The globe is a sphere; the base a short cylinder on a round contact
 * drop — so the lamp cannot stand on its base: let go upright, it topples onto its globe and rolls a little on it.
 * The mass sits low (brass base, thin glass).
 */
export function lampSpec(B: BulbDims): BodySpec {
  return {
    com: new Vector3(0, 0.55, 0),
    inertia: new Vector3(0.2, 0.12, 0.2),
    shapes: [
      { kind: 'sphere', c: new Vector3(0, B.globeY, 0), r: B.globe },
      { kind: 'cylinder', c: new Vector3(0, 0.22, 0), axis: Y, r: B.threadRadius, half: 0.14 },
      { kind: 'sphere', c: new Vector3(0, 0.075, 0), r: 0.075 },
    ],
    capsules: [
      { a: new Vector3(0, B.globeY, 0), b: new Vector3(0, B.globeY, 0), r: B.globe },
      { a: new Vector3(0, 0.1, 0), b: new Vector3(0, 0.3, 0), r: B.threadRadius },
    ],
    restitution: 0.3,
    friction: 0.45,
    roll: 1.6,
    topples: true,
  };
}

/**
 * Where a let-go part comes to rest: on the board inside the wire loop, clear of the wire's sheath and of the
 * clamps' and the switch's blocks along the near side (z ≤ 1.22). Soft walls: a part let go outside drifts in.
 */
export const REST = {
  x0: LOOP.left + WIRE.sheath + 0.07,
  x1: LOOP.right - WIRE.sheath - 0.07,
  z0: LOOP.far + WIRE.sheath + 0.07,
  z1: 1.22,
} as const;

/** The planes the solver keeps the parts in: the board's face and the four sides of `REST`. */
export function restWalls(): Wall[] {
  const side = (n: Vector3, o: number): Wall => ({ n, o, friction: 0, push: 2.2, fence: true });
  return [
    { n: new Vector3(0, 1, 0), o: 0, friction: 1, push: 4 },
    side(new Vector3(1, 0, 0), REST.x0),
    side(new Vector3(-1, 0, 0), -REST.x1),
    side(new Vector3(0, 0, 1), REST.z0),
    side(new Vector3(0, 0, -1), -REST.z1),
  ];
}

/**
 * Where the hand may carry a part's centre (the owner, 2026-11-20): across, not past the stand's edges (minus the
 * part's own half-width `half`); toward / away from the reader, not past the wire loop's near and far sides.
 */
export function clampCarry(p: Vector3, half: number): Vector3 {
  const w = BOARD.width / 2 - half;
  p.x = Math.min(Math.max(p.x, -w), w);
  p.z = Math.min(Math.max(p.z, LOOP.far), LOOP.near);
  return p;
}

/** What the hand module asks of a loose part (`battery-hand.ts`, `lamp-hand.ts`). */
export interface LoosePart {
  readonly body: Body;
  /** In its place, carrying current (the battery in its clamps, the lamp screwed home). */
  readonly inPlace: boolean;
  /** On its place and at rest: the stand's own pose (the unfolding) is in charge again. */
  readonly idle: boolean;
  /** The hand's state, for QA. */
  readonly state: string;
  /** Pointer pressed on the part and moved: take it (`at` = the point pressed, board frame). */
  grab(at: Vector3, cursor: Cursor): void;
  release(): void;
  /** The pointer moved (sideways turns of the lamp read the motion between events). */
  moved(cursor: Cursor): void;
  /** Back to its place: gliding (`instant` false) or at once. */
  home(instant: boolean): void;
  /** Hand logic for a frame (after the solver), then the model's pose. */
  update(dt: number, t: number, cursor: Cursor): void;
}
