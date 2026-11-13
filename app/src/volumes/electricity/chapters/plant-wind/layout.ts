/**
 * World layout of the wind chapter. World units are **metres of a toy diorama** (kit convention); the
 * environment is told so with `env.setScale(…, { adaptFrom: LOOK_SCALE.diorama })`.
 *
 * Axes: +X east, +Z south, Y up. The prevailing wind comes from the west (270°) and blows toward +X, so with
 * the camera in the south it streams left → right through the frame (document, «Наскрізна візуальна ідея»).
 *
 * Nothing here is to real scale (the chapter carries the «не в масштабі» chip): the hero turbine stands for a
 * 6 MW machine with D = 170 m; the farm of step 8 is laid out at 8 toy metres per rotor diameter (5 D inside a
 * row, 3…12 D between rows) and its turbines are drawn twice that size, like symbols on a map.
 */

/** Main island: an ellipse stretched along the wind. */
export const ISLAND = { semiX: 232, semiZ: 142, seaLevel: -1.4, coastX: 176 } as const;

/** Hero turbine («6 MW, D = 170 m»), toy size in metres. */
export const HERO = {
  x: -150,
  z: 74,
  hill: 9,
  hubHeight: 58,
  rotorDiameter: 60,
  /** Metres of the real machine per toy metre (170 m rotor drawn as 60 m). */
  realPerToy: 170 / 60,
} as const;

/** Onshore farm of step 8: 4 rows × 4 turbines, rows perpendicular to the 270° wind. */
export const FARM = {
  /** Centre of the layout; rows spread symmetrically around `x` when the spacing changes. */
  x: 12,
  z: -34,
  y: 3.2,
  /** Rotor diameter that sets the *layout* scale: 1 D on the ground = 8 toy metres. */
  layoutD: 8,
  /** Drawn turbines are twice the layout scale so that they read from above (chip «збільшено ×2»). */
  enlarged: 2,
  rotorDiameter: 16,
  hubHeight: 15,
  rows: 4,
  perRow: 4,
  inRowSpacingD: 5,
  /** Real metres (D = 170 m model turbine of the simulation) per toy metre of the layout. */
  realPerToy: 170 / 8,
} as const;

/** Farm substation 33/150 kV and the first spans of the line. */
export const SUBSTATION = { x: 118, z: 64, y: 3.2, ry: Math.PI / 2 } as const;
export const LINE_TOWERS: readonly (readonly [number, number])[] = [
  [150, 96],
  [96, 118],
];

/** Offshore block: a floating slab of sea east of the island. */
export const SEA = {
  x: 392,
  z: -8,
  sizeX: 236,
  sizeZ: 176,
  level: -1.4,
  /** Sea-bed depth below the surface at the shallow (west) and deep (east) ends, toy metres. */
  depthShallow: 13,
  depthDeep: 46,
  rotorDiameter: 16,
  hubHeight: 15,
} as const;

/** Wind: document defaults and the mapping from real speed to the toy world. */
export const WIND = {
  /** Default free-stream speed of the diorama, m/s. */
  speed: 8,
  fromDeg: 270,
  /** Toy metres per second of streak travel per m/s of wind: slow enough to read, fast enough to feel. */
  streakSpeed: 2.2,
} as const;

/** Compass direction the wind comes from (degrees) → unit vector of the flow in world XZ. */
export function flowDir(fromDeg: number): { x: number; z: number } {
  const th = (fromDeg * Math.PI) / 180;
  // from 270° (west) → toward +X; from 0° (north, −Z) → toward +Z
  return { x: -Math.sin(th), z: Math.cos(th) };
}

/** Yaw (rotation about Y) that turns a kit turbine (which faces +Z) into a wind from `fromDeg`. */
export function yawInto(fromDeg: number): number {
  const f = flowDir(fromDeg);
  return Math.atan2(-f.x, -f.z);
}
