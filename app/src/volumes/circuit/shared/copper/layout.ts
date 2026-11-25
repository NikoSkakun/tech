/**
 * Geometry of «усередині міді» in the local units of the copper world (VISUAL §6).
 *
 * Frame of reference: the wire axis is X (the later drift and the counter frame are left / right), the plane of
 * atoms the reader looks at is XY at z = 0, the bulk of the metal recedes along −Z and the camera stands on +Z.
 * Copper is face-centred cubic: seen along a cube axis every atomic plane is a square grid of nearest neighbours
 * and the next plane sits behind the gaps of this one — rows in front, rows behind them, honestly.
 */
import { Vector3 } from 'three';

/** Radius of an atom as drawn (its inner 28 electrons: the ion core), units. */
export const ATOM_R = 1;
/** Distance between neighbours in a row: the gap is 0.6 of the diameter (real copper: 0.256 nm). */
export const PITCH = 3.2;
/** Distance between successive atomic planes along Z (FCC: pitch / √2). */
export const PLANE_GAP = PITCH / Math.SQRT2;
/** Radius of a free electron: a sixth of the atom. */
export const ELECTRON_R = ATOM_R / 6;
/** Where the outer electron of a lone atom keeps: outside the ion core, inside the gap to the neighbour. */
export const OUTER_R = 1.52;
/** Radius of the nucleus as drawn inside the opened atom — far too big, and said so («ядро збільшено»). */
export const NUCLEUS_R = 0.085;

/** Half-extent of the lattice in whole atoms: columns along X, rows along Y; planes behind the focal one. */
export const COLS = 7;
export const ROWS = 4;
export const PLANES = 4;
/** `wire/shared`: a «row» is the hero and two atoms on each side (5); a «piece» is three such rows (15). */
export const ROW_HALF = 2;
export const ROW_ATOMS = 2 * ROW_HALF + 1;
export const PIECE_ATOMS = 3 * ROW_ATOMS;
/** Top row of copper: above it lies the plastic sheath (`wire/plastic`). */
export const COPPER_TOP = (ROWS + 0.5) * PITCH;

export interface Site {
  /** Lattice position, units. */
  p: Vector3;
  /** Atomic plane: 0 is the focal plane, 1 … are the planes behind it. */
  plane: number;
  /** Grid indices in the plane (the atom at the origin is 0, 0 of plane 0). */
  i: number;
  j: number;
  /** Order in which atoms are added in `wire/shared`: 0 the hero, 1 its neighbour, then the row, the piece. */
  rank: number;
}

/** Sites of the visible crystal: plane 0 first (hero atom first), then the planes behind. */
export function latticeSites(): Site[] {
  const sites: Site[] = [];
  for (let k = 0; k < PLANES; k++) {
    // every second plane is shifted by half a pitch in both directions (ABAB stacking of FCC along a cube axis)
    const shift = k % 2 === 1 ? PITCH / 2 : 0;
    // the planes behind reach further out, so their edges never show at the sides of the frame
    const cols = COLS + Math.ceil(k * 1.5);
    const rows = ROWS + k;
    for (let j = -rows; j <= rows; j++)
      for (let i = -cols; i <= cols; i++) {
        const x = i * PITCH + shift;
        const y = j * PITCH + shift;
        if (y > COPPER_TOP - (k > 0 ? ATOM_R * 1.2 : 0)) continue;
        const ai = Math.abs(i);
        const aj = Math.abs(j);
        // hero → right neighbour → left → … a row of five → the rows above and below it (a piece of 15) →
        // the rest of the focal plane, inside out → the planes behind
        const rank =
          k > 0
            ? 1000 * k + Math.max(ai, aj)
            : ai <= ROW_HALF && aj <= 1
              ? aj * 100 + ai * 4 + (i > 0 ? 0 : 2) + (j > 0 ? 0 : 1)
              : 400 + Math.max(ai, aj) * 40 + aj;
        sites.push({ p: new Vector3(x, y, -k * PLANE_GAP), plane: k, i, j, rank });
      }
  }
  return sites.sort((a, b) => a.rank - b.rank);
}

/**
 * The copper depths (0 «жила» … 1 «ряди») over which the wire core turns into rows of atoms (core-shader.ts):
 * the dome closes around the reader, dots show in the metal, the metal becomes balls in the dark, the flat
 * picture opens. From `balls` on the core writes its depth behind its own surface (the flat balls lie just
 * behind the real front atoms), so nothing of the stand may still be drawn there (world/levels.ts STAND_GONE).
 */
export const CORE_STAGES = {
  dome: [0.02, 0.22],
  dots: [0.05, 0.4],
  balls: [0.26, 0.7],
  open: [0.72, 0.9],
} as const satisfies Record<string, readonly [number, number]>;

export const clamp01 = (v: number): number => Math.min(Math.max(v, 0), 1);
export const smooth = (a: number, b: number, v: number): number => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
