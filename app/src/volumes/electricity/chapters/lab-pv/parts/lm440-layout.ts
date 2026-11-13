/**
 * Geometry of the hero module «ЛМ-440» in metres, in the kit's module frame (`@/kit` `pvModule`): the module
 * lies in its XZ plane, glass toward +Y, long side along Z, origin at the centre of the glass. Half-cell
 * indices follow the simulation (`halfCellLocation`): index = row × 6 + column, row 0 at the far end (−Z),
 * rows 0…8 = top branches, columns 0–1 / 2–3 / 4–5 = the three bypass-diode sections.
 */
import { Vector3 } from 'three';
import { HALF_CELL_COLS, HALF_CELL_ROWS, HALF_CELLS } from '@electricity/sim/lab-pv';
import { PV_MODULE } from '@/kit';

export const M = (() => {
  const { length: L, width: W, thickness: T } = PV_MODULE;
  const frame = 0.035;
  const iw = W - 2 * frame;
  const il = L - 2 * frame;
  const cw = (iw - 0.03) / HALF_CELL_COLS;
  const half = (il - 0.05) / 2;
  const ch = half / (HALF_CELL_ROWS / 2);
  return { L, W, T, frame, iw, il, cw, half, ch, gap: 0.01 } as const;
})();

/** Heights of the laminate layers below the glass surface (y = 0), assembled. */
export const LAYER_Y = { glass: -0.002, eva1: -0.0055, cells: -0.008, eva2: -0.0105, back: -0.014 } as const;

/** How far every layer travels along Y when the module is fully exploded (metres). */
export const EXPLODE = { glass: 0.52, eva1: 0.34, cells: 0.16, eva2: -0.02, back: -0.2, frame: -0.4, jbox: -0.58 } as const;

export const SECTION_COLORS = ['teal', 'violet', 'sky'] as const;

export function columnX(col: number): number {
  return -M.iw / 2 + 0.015 + (col + 0.5) * M.cw;
}

export function rowZ(row: number): number {
  const h = HALF_CELL_ROWS / 2;
  return row < h ? -M.gap - (h - 0.5 - row) * M.ch : M.gap + (row - h + 0.5) * M.ch;
}

/** Centre of half-cell `index` in the module frame (on the cell layer). */
export function cellCentre(index: number, out = new Vector3()): Vector3 {
  return out.set(columnX(index % HALF_CELL_COLS), LAYER_Y.cells, rowZ(Math.floor(index / HALF_CELL_COLS)));
}

/** Half-cell under a point of the module plane (module frame, metres), or −1 outside the cell area. */
export function cellAt(x: number, z: number): number {
  const col = Math.floor((x + M.iw / 2 - 0.015) / M.cw);
  if (col < 0 || col >= HALF_CELL_COLS || Math.abs(z) < M.gap || Math.abs(z) > M.gap + M.half) return -1;
  const h = HALF_CELL_ROWS / 2;
  const row = z < 0 ? Math.floor(h - (-z - M.gap) / M.ch) : h + Math.floor((z - M.gap) / M.ch);
  return row < 0 || row >= HALF_CELL_ROWS ? -1 : row * HALF_CELL_COLS + col;
}

/**
 * Electron routes through the module, slightly above the cells. Sections are in series from the plus side
 * (+X) to the minus side (−X); inside a section two branches of 18 half-cells run from the centre line out
 * along one column and back along the other. Order: 6 branch paths (section × [top, bottom]), then the 3
 * bypass routes along the centre line (through the diode of each section).
 */
export function electronPaths(y = LAYER_Y.cells + 0.004): Vector3[][] {
  const paths: Vector3[][] = [];
  const diodes: Vector3[][] = [];
  for (let s = 0; s < 3; s++) {
    const xIn = columnX(s * 2 + 1);
    const xOut = columnX(s * 2);
    for (const dir of [-1, 1]) {
      const z0 = dir * (M.gap + 0.01);
      const z1 = dir * (M.gap + M.half - M.ch * 0.5);
      paths.push([new Vector3(xIn, y, z0), new Vector3(xIn, y, z1), new Vector3(xOut, y, z1), new Vector3(xOut, y, z0)]);
    }
    diodes.push([new Vector3(xIn + M.cw * 0.3, y + 0.03, 0), new Vector3(xOut - M.cw * 0.3, y + 0.03, 0)]);
  }
  return [...paths, ...diodes];
}

/** Position of the bypass-diode marker of a section (shown in front of the glass, on the centre line). */
export function diodeSpot(section: number, out = new Vector3()): Vector3 {
  return out.set((columnX(section * 2) + columnX(section * 2 + 1)) / 2, 0.035, 0);
}

export { HALF_CELLS };
