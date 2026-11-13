/**
 * Equipotential lines of a scalar field on a plane: marching squares, then the segments are chained into
 * polylines (pure math, unit-tested). Draw them with `createEquipotentials()`.
 */
import { Vector3 } from 'three';
import { RibbonLines, type RibbonOptions } from '../core/ribbon';
import type { ScalarField } from './sources';

export interface ContourPlane {
  center: Vector3;
  /** Two perpendicular unit axes spanning the plane. Default X and Z (a horizontal slice). */
  u?: Vector3;
  v?: Vector3;
  /** Side length of the sampled square, units. */
  size: number;
  /** Cells per side. Default 64. */
  resolution?: number;
}

export interface Contour {
  level: number;
  points: Vector3[];
  closed: boolean;
}

/** Iso-lines of `field` at the given `levels` inside a square patch of a plane. */
export function contourLines(field: ScalarField, plane: ContourPlane, levels: readonly number[]): Contour[] {
  const n = plane.resolution ?? 64;
  const u = plane.u ?? new Vector3(1, 0, 0);
  const v = plane.v ?? new Vector3(0, 0, 1);
  const cell = plane.size / n;
  const at = (i: number, j: number): Vector3 =>
    plane.center.clone().addScaledVector(u, (i - n / 2) * cell).addScaledVector(v, (j - n / 2) * cell);
  const values = new Float64Array((n + 1) * (n + 1));
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) values[j * (n + 1) + i] = field(at(i, j));
  const val = (i: number, j: number): number => values[j * (n + 1) + i]!;
  const out: Contour[] = [];
  for (const level of levels) {
    // each crossing lives on a grid edge; key = edge id, so neighbouring cells share end points exactly
    const pts = new Map<string, Vector3>();
    const links = new Map<string, string[]>();
    const cross = (i0: number, j0: number, i1: number, j1: number): string => {
      const key = `${i0},${j0},${i1},${j1}`;
      if (!pts.has(key)) {
        const a = val(i0, j0);
        const b = val(i1, j1);
        pts.set(key, at(i0, j0).lerp(at(i1, j1), (level - a) / (b - a)));
      }
      return key;
    };
    const link = (a: string, b: string): void => {
      (links.get(a) ?? links.set(a, []).get(a)!).push(b);
      (links.get(b) ?? links.set(b, []).get(b)!).push(a);
    };
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const c = [val(i, j) > level, val(i + 1, j) > level, val(i + 1, j + 1) > level, val(i, j + 1) > level];
        const edges: string[] = [];
        if (c[0] !== c[1]) edges.push(cross(i, j, i + 1, j));
        if (c[1] !== c[2]) edges.push(cross(i + 1, j, i + 1, j + 1));
        if (c[3] !== c[2]) edges.push(cross(i, j + 1, i + 1, j + 1));
        if (c[0] !== c[3]) edges.push(cross(i, j, i, j + 1));
        if (edges.length === 2) link(edges[0]!, edges[1]!);
        else if (edges.length === 4) {
          // saddle: pair by the cell-centre value so lines never cross
          const centre = (val(i, j) + val(i + 1, j) + val(i + 1, j + 1) + val(i, j + 1)) / 4 > level;
          if (centre === c[0]) {
            link(edges[0]!, edges[1]!);
            link(edges[2]!, edges[3]!);
          } else {
            link(edges[0]!, edges[3]!);
            link(edges[1]!, edges[2]!);
          }
        }
      }
    }
    // chain: start at open ends first, then what is left are closed loops
    const used = new Set<string>();
    const walk = (start: string): Contour => {
      const points: Vector3[] = [];
      let prev = '';
      let cur: string | undefined = start;
      let closed = false;
      while (cur !== undefined && !used.has(cur)) {
        used.add(cur);
        points.push(pts.get(cur)!);
        const options: string[] = links.get(cur) ?? [];
        const next: string | undefined = options.find((k) => k !== prev && !used.has(k));
        if (next === undefined && options.includes(start) && points.length > 2) closed = true;
        prev = cur;
        cur = next;
      }
      return { level, points, closed };
    };
    for (const [key, l] of links) if (l.length === 1 && !used.has(key)) out.push(walk(key));
    for (const key of links.keys()) if (!used.has(key)) out.push(walk(key));
  }
  return out.filter((c) => c.points.length > 2);
}

export interface EquipotentialOptions extends Omit<RibbonOptions, 'capacity'> {
  capacity?: number;
}

/** Equipotential lines as thin glowing ribbons (no direction dashes: a potential has no direction). */
export function createEquipotentials(contours: readonly Contour[], o: EquipotentialOptions = {}): RibbonLines {
  const points = contours.reduce((s, c) => s + c.points.length + 1, 0);
  const lines = new RibbonLines({
    width: 0.02,
    intensity: 1.1,
    dashStrength: 0,
    color: 'pink',
    endFade: [0.02, 0.02],
    ...o,
    capacity: o.capacity ?? Math.ceil(points * 1.6) + 64,
  });
  lines.name = 'equipotentials';
  lines.setLines(contours.map((c) => ({ points: c.points, closed: c.closed })));
  return lines;
}
