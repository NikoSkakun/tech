/**
 * One number for "how deep the reader is" in the composed world (VISUAL §3), and what every part of the two
 * world libraries shows at that depth. Pure functions: the scene, the tests and the flight planner share them.
 *
 * `deep` 0 = the stand (the table floor) · 1 = «жила дроту» (the hand-over pose, W1 `HANDOVER` = copper
 * shot `core`) · 2 = «ряди» (copper depth 1) · 3 = «один атом» (copper depth 2). The volume's map axis counts
 * the other way (stand 3 … one atom 0), so `floor = 3 − deep`.
 */
import { CORE_STAGES } from '@circuit/shared/copper/layout';

export type FloorId = 'stand' | 'part' | 'rows' | 'atom';

/** `deep` of each floor (the stops of a flight). */
export const DEEP: Readonly<Record<FloorId, number>> = { stand: 0, part: 1, rows: 2, atom: 3 };

/** Seconds of one leg of a flight (VISUAL §3: through the ring 1.6 – 2.2 s; never a cut). */
export const LEG = {
  /** the lens leaves its holder and lies over the wire; the camera comes to the shot `lens` */
  lens: 1.4,
  /** through the ring to the hand-over pose (`deep` 0 → 1) */
  ring: 2.1,
  /** one floor further down or up (`deep` 1 → 2, 2 → 3) */
  floor: 2.2,
} as const;

/** One ease for the camera and for `deep`, so that both are at the same fraction of a leg at every frame. */
export const FLIGHT_EASE = 'sine.inOut' as const;

/** Where the dissolve between the stand and the copper world happens (on the last stretch of the ring leg). */
const DISSOLVE: readonly [number, number] = [0.8, 1];
/**
 * The stand is drawn until the copper world's own dome has closed around the reader (`CORE_STAGES.dome`), and
 * not a frame longer: from `CORE_STAGES.balls` on the copper core writes its depth behind its own surface, and the
 * stand's wire core — still lying where the copper core grew from — came through it as a flat orange band across
 * the rows (the owner's screenshot of 2026-11-25, F-lens-wire). Halfway between the two.
 */
export const STAND_GONE = 1 + (CORE_STAGES.dome[1] + CORE_STAGES.balls[0]) / 2;

const clamp01 = (v: number): number => Math.min(Math.max(v, 0), 1);
const smooth = (a: number, b: number, v: number): number => {
  const k = clamp01((v - a) / (b - a));
  return k * k * (3 - 2 * k);
};

export interface WorldMix {
  /** `CircuitStage.dive` (rim arcs, sheath under the lens dissolving). */
  standDive: number;
  /** Draw the stand at all. */
  standShown: boolean;
  /** Draw the copper world at all. */
  copperShown: boolean;
  /** 0…1 dithered fade of the copper core over the stand's own core (the dissolve). */
  copperIn: number;
  /** `Copper.depth` 0…2. */
  copperDepth: number;
  /** Below the stand: the copper world owns the environment and the post stack. */
  below: boolean;
}

export function mixAt(deep: number): WorldMix {
  const copperIn = smooth(DISSOLVE[0], DISSOLVE[1], deep);
  return {
    standDive: clamp01(deep),
    standShown: deep < STAND_GONE,
    copperShown: copperIn > 0.002,
    copperIn,
    copperDepth: Math.min(Math.max(deep - 1, 0), 2),
    below: deep > 0.98,
  };
}

/** The volume axis floor value (stand 3 … one atom 0) for a `deep`. */
export const floorValue = (deep: number): number => 3 - Math.min(Math.max(deep, 0), 3);

/** The floor the reader is on (nearest stop). */
export function floorAt(deep: number): FloorId {
  const d = Math.round(Math.min(Math.max(deep, 0), 3));
  return (['stand', 'part', 'rows', 'atom'] as const)[d]!;
}

/** A flight from one `deep` to another as legs between stops; each leg is one camera move. */
export interface Leg {
  to: number;
  duration: number;
}
export function legsBetween(from: number, to: number): Leg[] {
  const legs: Leg[] = [];
  if (Math.abs(to - from) < 1e-3) return legs;
  const dir = Math.sign(to - from);
  let at = from;
  while (Math.abs(to - at) > 1e-3) {
    // the next stop in the direction of travel (a flight started between stops ends its leg at the stop)
    const next = dir > 0 ? Math.min(Math.floor(at + 1e-3) + 1, to) : Math.max(Math.ceil(at - 1e-3) - 1, to);
    const span = Math.abs(next - at);
    const full = Math.min(at, next) < 1 ? LEG.ring : LEG.floor;
    legs.push({ to: next, duration: Math.max(0.6, full * Math.sqrt(span)) });
    at = next;
  }
  return legs;
}
