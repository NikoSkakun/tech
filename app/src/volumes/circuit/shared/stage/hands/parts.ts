/**
 * The two loose parts as rigid bodies (`body.ts`): their mass centres, inertia and collision shapes, read off the
 * models (`battery.ts`, `bulb.ts`) — and the limits they move within.
 */
import { Vector3 } from 'three';
import type { BulbDims } from '../bulb';
import { BATTERY, BOARD, LAMP, LOOP, WIRE } from '../layout';
import { Body, type BodySpec, type Capsule } from './body';
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
 * Where a part may be, carried or let go (the owner, 2026-11-20): across, the stand's own edges; toward / away from
 * the reader, inside the far wire and short of the blocks of the clamps and the switch on the near side (z ≤ 1.22).
 * Its whole outline stays inside — the sides are soft, «anti-magnetic» walls (`limits.ts`), never crossed.
 */
export const REGION = {
  x0: -BOARD.width / 2 + 0.06,
  x1: BOARD.width / 2 - 0.06,
  z0: LOOP.far + WIRE.sheath + 0.07,
  z1: 1.22,
} as const;

/** The four sides of `REGION` as inward planes n·p ≥ o. */
export const SIDES: readonly { n: Vector3; o: number }[] = [
  { n: new Vector3(1, 0, 0), o: REGION.x0 },
  { n: new Vector3(-1, 0, 0), o: -REGION.x1 },
  { n: new Vector3(0, 0, 1), o: REGION.z0 },
  { n: new Vector3(0, 0, -1), o: -REGION.z1 },
];

/** The board's face, the one hard wall. */
export function floor(): Wall[] {
  return [{ n: new Vector3(0, 1, 0), o: 0, friction: 1, push: 4 }];
}

/**
 * What is fixed on the board inside `REGION` that a part can land on: the two side wires on their staples (a part
 * let go across one lies over it) and the lamp's post in the far right corner. A body that never moves.
 */
export function obstacles(): Body {
  const wire = (x: number): Capsule => ({
    a: new Vector3(x, LOOP.y, LOOP.far),
    b: new Vector3(x, LOOP.y, LOOP.near),
    r: 0.1,
  });
  const post: Capsule = { a: new Vector3(LAMP.x, 0.1, LAMP.z), b: new Vector3(LAMP.x, LAMP.socketY - 0.15, LAMP.z), r: 0.3 };
  const body = new Body({
    com: new Vector3(),
    inertia: new Vector3(1, 1, 1),
    shapes: [],
    capsules: [wire(LOOP.left), wire(LOOP.right), post],
    restitution: 0.2,
    friction: 0.6,
    roll: 0,
  });
  body.refresh();
  return body;
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
  /** Hand logic for a frame (after the solver), then the model's pose. `other`: the other loose part. */
  update(dt: number, t: number, cursor: Cursor, other: Body): void;
}
