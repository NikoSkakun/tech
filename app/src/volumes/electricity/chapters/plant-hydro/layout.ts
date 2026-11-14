/**
 * World layout of the hydro chapter. World units are **metres of a toy diorama** (kit convention); the
 * environment is told so with `env.setScale(…, { adaptFrom: LOOK_SCALE.diorama })`.
 *
 * Axes: +X east, +Z south, Y up. The river runs west → east: the reservoir fills the western valley, the
 * concrete gravity dam stands across the valley at x ≈ 0, the powerhouse sits at its toe, the tailwater river
 * runs east into a sea bay. The pumped-storage bowl sits on the northern mountain shoulder; its station is on
 * the north bank of the tailwater. Nothing is to real scale (the chapter carries «не в масштабі»).
 *
 * The cutaway rigs of steps 3–6 and 8 stand on the «stand» south of the island (a floating studio plinth in
 * the sky, seen with the valley behind it): only one of them is shown at a time.
 */

/** Main island: an ellipse stretched along the river; the sea fills everything below `seaLevel`. */
export const ISLAND = { semiX: 300, semiZ: 196, seaLevel: 2, coastX: 214 } as const;

/** Gravity dam across the valley (crest axis along Z). Heights are world y. */
export const DAM = {
  /** Upstream face x and downstream toe x (gravity profile: thin crest, wide base). */
  faceX: -6,
  crestX: 4,
  toeX: 40,
  crestY: 56,
  baseY: 4,
  /** Crest from z0 to z1 (the valley walls take over beyond). */
  z0: -90,
  z1: 86,
} as const;

/** Reservoir surface: normal retention level (НПР) and the dead level the step-1 slider can draw it down to. */
export const RESERVOIR = {
  /** Centre and semi-axes of the water ellipse (it ends inside the dam body). */
  cx: -119,
  cz: -4,
  ax: 113,
  az: 132,
  npr: 52,
  dead: 30,
} as const;

/** Spillway bays in the dam (z range), 4 radial gates; chute down the downstream face to a stilling basin. */
export const SPILLWAY = { z0: -62, z1: -26, gates: 4, basinX: [44, 80] as [number, number] } as const;

/** Powerhouse at the toe of the dam: 4 vertical units in a row along Z. */
export const POWERHOUSE = {
  x0: 40,
  x1: 66,
  z0: -14,
  z1: 50,
  floorY: 6,
  height: 17,
  units: [-2, 14, 30, 46] as const,
} as const;

/** Switchyard (ВРП) on the south bank and the line leaving east. */
export const SWITCHYARD = { x: 112, z: 92, y: 9 } as const;
export const LINE_TOWERS: readonly [number, number][] = [
  [150, 112],
  [188, 128],
] as const;

/** Fish ladder: zig-zag pools on the south bank from the tailwater up to the reservoir. */
export const FISH_LADDER = { x0: 74, x1: -4, z: 66, width: 6 } as const;

/** Pumped-storage plant: upper bowl on the northern mountain, station on the north bank of the tailwater. */
export const PSH = {
  bowl: { x: 128, z: -132, y: 132, r: 30 },
  station: { x: 136, z: -26, y: 6 },
} as const;

/** Small town by the bay (step 8 lights). */
export const TOWN = { x: 196, z: 96, size: 54 } as const;

/** The floating studio stand south of the island: centre of its top surface. */
export const STAND = { x: 30, y: 70, z: 300, r: 60 } as const;

/** River centre line (z as a function of x) — gentle bend below the dam. */
export function riverZ(x: number): number {
  return x < 40 ? 4 : 4 + 18 * Math.sin(((x - 40) / 180) * Math.PI) * Math.min(1, (x - 40) / 60);
}
