/**
 * The permanent places of the stand (VISUAL.md §2). Everything on the board is given in the BOARD FRAME:
 * origin at the centre of the board's face, +x to the reader's right, +y out of the face, +z toward the reader.
 * The board frame is tilted 15° toward the reader (`BOARD.tilt`), so "up" on the board is not world up.
 *
 * Scale: toy scale, 1 unit ≈ 26 mm — the AA battery (real 50 mm) is 1.9 units long.
 * Near side, left → right: minus clamp · battery · plus clamp · 0.32 of free wire (the magnifier's spot) · switch.
 * The loop is kept as narrow as the near side allows (4.82) and as deep as the board allows (3.45), so that in the
 * main shot its visible height is at least half its width (VISUAL.md §9).
 */
export const BOARD = {
  /** Face size (3 : 2) and slab thickness. */
  width: 6.6,
  depth: 4.4,
  thickness: 0.62,
  corner: 0.34,
  /** Tilt of the face toward the reader, radians (15°). */
  tilt: (15 * Math.PI) / 180,
  /** Height of the front feet: the gap between the table and the slab's front bottom edge. */
  feet: 0.16,
} as const;

/** The loop: a rounded rectangle of wire. Near side = battery and switch, far right corner = lamp. */
export const LOOP = {
  left: -2.41,
  right: 2.41,
  far: -1.85,
  near: 1.6,
  /** Corner radius of the wire path (≥ 3 wire thicknesses). */
  corner: 0.41,
  /** Height of the wire axis above the face: the wire rests on staples, one wire thickness above the board. */
  y: 0.2,
} as const;

export const WIRE = {
  /** Outer radius of the translucent sheath and of the copper core inside it. */
  sheath: 0.068,
  core: 0.036,
} as const;

/** AA battery in its cradle on the near side, left of the centre, «+» to the right. */
export const BATTERY = {
  length: 1.9,
  radius: 0.275,
  /** Centre of the can (board frame). */
  x: -0.53,
  z: LOOP.near,
  y: 0.5,
  /** x of the screw terminals of the minus / plus clamps (where the wires end). */
  minusX: -2.0,
  plusX: 0.8,
} as const;

/** Slide switch on the near side, right of the battery. */
export const SWITCH = {
  x: 1.56,
  z: LOOP.near,
  /** Width of the insulating block and the air gap between its two contacts. */
  width: 0.88,
  gap: 0.2,
  /** x of its two screw terminals. */
  inX: 1.12,
  outX: 2.0,
} as const;

/** The second, empty switch seat on the far side, closed by a short jumper (`flow/loop`). */
export const SEAT = { x: -0.6, z: LOOP.far, width: 0.7 } as const;

/** Lamp on its post in the far right corner — the highest point of the stand. */
export const LAMP = {
  x: LOOP.right,
  z: LOOP.far,
  /** Height of the socket's top (where the thread disappears) and of the filament above the face. */
  socketY: 0.74,
  filamentY: 1.65,
  /** Radius of the glass globe — a big globe on a small base: the lamp is the hero (≥ 16 % of the frame height). */
  glass: 0.66,
  /** Distance of its two screw terminals from the post's axis. */
  term: 0.31,
} as const;

/** The magnifier's permanent places: its holder (near left corner) and the spot on the near wire. */
export const LENS = {
  /** Centre of the ring at rest: flat in the near left corner, inside the board and clear of the loop. */
  holder: { x: -2.81, z: 1.68 },
  /** Centre of the stretch of near wire between the plus clamp and the switch — the door to the lower floors. */
  wireSpot: { x: 0.96, z: LOOP.near },
  /** Outer radius of the ring (the largest that lies flat in the corner without covering the wire). */
  radius: 0.45,
} as const;

/** The engraved ruler along the near wire: 10 cm at the battery's scale (battery = 5 cm). */
export const RULER = { x0: -1.9, x1: 1.9, z: 1.96, cm: 10 } as const;

/**
 * The shelf behind the rear edge, level in the WORLD (not tilted with the face), below the rear edge. The
 * flashlight's housing no longer rests on it — it leaves the picture in the unfolding (owner 2026-11-19); the
 * empty shelf stays, as a part of the finished stand every chapter shows.
 */
export const SHELF_WORLD = { y: 0.92, z: -3.02, depth: 1.56, width: 6.3 } as const;

/** The five staples that carry the wire one wire thickness above the face: [x, z, along] (along = wire direction). */
export const STAPLES: readonly (readonly [number, number, 'x' | 'z'])[] = [
  [LOOP.left, 0.72, 'z'],
  [LOOP.left, -0.95, 'z'],
  [-1.7, LOOP.far, 'x'],
  [1.05, LOOP.far, 'x'],
  [LOOP.right, -0.1, 'z'],
];
