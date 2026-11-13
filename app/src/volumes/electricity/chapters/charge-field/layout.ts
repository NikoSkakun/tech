/**
 * Every position and size of the chapter in one place. The scene is built at `M` scene units per metre: the
 * "field table" of the document (⌀ 40 cm) is a disc of radius 6 around the origin, its glass top is y = 0.
 * Simulation coordinates (x, z in metres on the table plane) map to scene (x·M, y, z·M).
 */
import { Vector3 } from 'three';

/** Scene units per metre of the table-top experiments (steps 1–5). */
export const M = 30;
export const toScene = (metres: number): number => metres * M;
export const toMetres = (units: number): number => units / M;

export const TABLE = {
  /** Outer radius of the glass disc (0,2 m). */
  radius: 6,
  /** Charges stay inside this radius (sim: 0,18 m). */
  play: 5.4,
  thickness: 0.16,
} as const;

/** Centre height of the charges that hover over the glass, and of the flat field lines. */
export const CHARGE_Y = 0.45;
/** Radius of a 1 nC charge ball; others scale with ∛|q| inside 0,6…1,4 (document, `Charge`). */
export const CHARGE_R = 0.3;

/** Step 1: the two sample cubes. */
export const CUBES = { x: 2.5, y: 1.75, size: 1.9, rulerZ: 3.6, rulerY: 0.5 } as const;

/** Step 2: balls hover on the X axis; the log tower of the gravity comparison stands behind them. */
export const COULOMB = {
  /** Hover height of the ball centres: room under the biggest ball for the lower force arrow. */
  y: 1.5,
  /** Radius of a 20 nC ball (drawn sizes are symbolic — chip). */
  ball: 0.55,
  arrowL0: 0.85,
  /** Attraction: the two arrows run one above, one below the pair — this far from the ball surface. */
  arrowGap: 0.3,
  tower: new Vector3(-3.6, 0, -1.2),
  floor: 0.2,
} as const;

/** Steps 3–4: the tray with spare charges, clamped to the left of the rim and turned along it. */
export const TRAY = { x: -6.75, z: 1.9, turn: 1.85, pitch: 0.82 } as const;

/** Step 4: landscape height H = 6 cm (sim `POTENTIAL.heightScaleM`). */
export const LANDSCAPE = { size: 12, y: 0.05 } as const;

/** Step 5: uniform field between the two electrode bars at x = ∓`plates`. */
export const CONDUCTOR = { y: 1.35, radius: 1.15, plates: 5.2, halfWidth: 3.4 } as const;

/** Step 6: the balloon set stands on the table; the storm diorama floats behind and to the right of it. */
export const STATIC = {
  /** Scene units per metre of the balloon set (balloon R = 0,12 m → 1,1 units). */
  scale: 1.1 / 0.12,
  figureX: -2.6,
  wallX: 3.9,
  balloonHome: new Vector3(0.4, 2.9, 0.4),
  storm: new Vector3(26, -2, -16),
} as const;

/** Step 7: plates one above the other at the table centre. */
export const CAPACITOR = {
  y: 1.2,
  unitsPerMetre: 36,
  /**
   * The props stand beside the plates and move out with them: distances (scene units) from the plate edge at
   * ±x, counted from a half side of at least `propsFrom`; z on the table.
   */
  propsFrom: 1.8,
  /** Plate side (scene units) from which the wide shot takes over. */
  wideFrom: 4.7,
  pump: { x: 1.45, z: -0.7 },
  supercap: { x: 1.2, z: 1.3 },
  lamp: { x: 1.15, z: -0.4 },
} as const;

/** Step 8: bench with the supercapacitor, the switch and the lamp; the look inside the wire floats above it. */
export const BRIDGE = {
  cap: new Vector3(-3, 0, 0.4),
  lamp: new Vector3(3.1, 0, 0.2),
  key: new Vector3(0, 0, 2.3),
  inside: new Vector3(0, 5.6, -1.2),
} as const;
