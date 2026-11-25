/**
 * Where everything of the micro world stands (docs/volumes/alkaline/VISUAL.md §4.3), in MICRO units: the zinc side
 * left (x < 2.9), the separator's fibres 3 … 4, the oxide's crumbs right (x > 4.4); +z toward the camera. Pure and
 * seeded, so every frame and every test sees the same world.
 */
import { seeded } from '@circuit/shared/stage/battery-grains';

export interface Blob {
  x: number;
  y: number;
  z: number;
  r: number;
}
export interface Fibre {
  x: number;
  y: number;
  z: number;
  tilt: number;
}

export const SEP = { from: 3.0, to: 4.0 } as const;
/** The grain whose edge the atoms floor looks at, and the point on its surface facing the lye. */
export const EDGE_GRAIN: Blob = { x: 1.2, y: 0.3, z: -0.2, r: 1.55 };
export const EDGE = { x: EDGE_GRAIN.x + EDGE_GRAIN.r, y: EDGE_GRAIN.y, z: EDGE_GRAIN.z } as const;

/** Packed zinc grains that touch each other (overlap allowed a little), the edge grain first. */
export function zincGrains(): Blob[] {
  const rnd = seeded(101);
  const out: Blob[] = [EDGE_GRAIN];
  for (let tries = 0; out.length < 34 && tries < 20000; tries++) {
    const r = 0.9 + rnd() * 0.75;
    const x = -8 + rnd() * (SEP.from - 0.15 - r + 8);
    const y = -5.2 + rnd() * 10.4;
    const z = -2.6 + rnd() * 2.4;
    if (out.some((g) => Math.hypot(g.x - x, g.y - y, g.z - z) < (g.r + r) * 0.9)) continue;
    out.push({ x, y, z, r });
  }
  return out;
}

/** Crumbs of manganese oxide right of the separator. */
export function oxideCrumbs(): Blob[] {
  const rnd = seeded(202);
  const out: Blob[] = [];
  for (let tries = 0; out.length < 26 && tries < 20000; tries++) {
    const r = 0.55 + rnd() * 0.6;
    const x = SEP.to + 0.35 + r + rnd() * 6.5;
    const y = -5.2 + rnd() * 10.4;
    const z = -2.4 + rnd() * 2.2;
    if (out.some((g) => Math.hypot(g.x - x, g.y - y, g.z - z) < (g.r + r) * 0.92)) continue;
    out.push({ x, y, z, r });
  }
  return out;
}

/** The separator's fibres: long thin strands, mostly upright, crossing. */
export function fibres(): Fibre[] {
  const rnd = seeded(303);
  return Array.from({ length: 30 }, () => ({
    x: SEP.from + 0.1 + rnd() * (SEP.to - SEP.from - 0.2),
    y: -4 + rnd() * 8,
    z: -3 + rnd() * 4.2,
    tilt: (rnd() - 0.5) * 0.9,
  }));
}

/** Atoms of the edge grain's surface: hexagonal layers whose front faces +x (the lye), three deep. */
export function edgeAtoms(spacing = 0.15): { x: number; y: number; z: number; layer: number }[] {
  const out: { x: number; y: number; z: number; layer: number }[] = [];
  const h = (spacing * Math.sqrt(3)) / 2;
  for (let layer = 0; layer < 3; layer++)
    for (let j = -6; j <= 6; j++)
      for (let i = -9; i <= 9; i++) {
        const y = EDGE.y + i * spacing + ((j + layer) % 2 ? spacing / 2 : 0);
        const z = EDGE.z + j * h;
        // a gently rounded front (the grain's surface), cut to an oval patch
        const d2 = ((y - EDGE.y) / 1.35) ** 2 + ((z - EDGE.z) / 0.95) ** 2;
        if (d2 > 1) continue;
        out.push({ x: EDGE.x - layer * spacing * 0.82 - d2 * 0.18, y, z, layer });
      }
  return out;
}
