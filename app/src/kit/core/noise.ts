/**
 * Deterministic noise and seeded scatter. Everything here is a pure function of its inputs (and of the `Rng`
 * passed in), so scenes build identically on every load and QA screenshots are reproducible.
 */
import type { Rng } from '@/engine/api';

function hash2(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in 0…1. */
export function noise2(x: number, y: number, seed = 0): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/** Fractal noise in 0…1 (2–4 octaves are plenty for low-frequency stylised forms). */
export function fbm(x: number, y: number, octaves = 3, seed = 0): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += noise2(x * f, y * f, seed + i * 17) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

export const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

export const clamp = (x: number, a: number, b: number): number => Math.min(Math.max(x, a), b);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export interface ScatterOptions {
  /** How many points to try to place. */
  count: number;
  rng: Rng;
  /** Disc `{ r, x?, z? }` or rectangle `{ x0, x1, z0, z1 }`. */
  area: { r: number; x?: number; z?: number } | { x0: number; x1: number; z0: number; z1: number };
  /** Minimum distance between points. */
  minDist?: number;
  /** Keep-out discs `[x, z, radius]` (buildings, roads, water…). */
  avoid?: readonly (readonly [number, number, number])[];
  /** Extra test (e.g. 'above water', 'inside the outline', 'noise mask > 0.5' for clumps). */
  accept?: (x: number, z: number) => boolean;
  maxTries?: number;
}

export interface ScatterPoint {
  x: number;
  z: number;
}

/** Seeded dart-throwing scatter with keep-out zones — tree and rock placement, building lots, flocks. */
export function scatter(o: ScatterOptions): ScatterPoint[] {
  const out: ScatterPoint[] = [];
  const min2 = (o.minDist ?? 0) ** 2;
  const tries = o.maxTries ?? o.count * 30;
  for (let i = 0; i < tries && out.length < o.count; i++) {
    let x: number;
    let z: number;
    if ('r' in o.area) {
      const a = o.rng.range(0, Math.PI * 2);
      const r = Math.sqrt(o.rng.next()) * o.area.r;
      x = (o.area.x ?? 0) + Math.cos(a) * r;
      z = (o.area.z ?? 0) + Math.sin(a) * r;
    } else {
      x = o.rng.range(o.area.x0, o.area.x1);
      z = o.rng.range(o.area.z0, o.area.z1);
    }
    if (o.accept && !o.accept(x, z)) continue;
    if (o.avoid?.some(([ax, az, ar]) => (x - ax) ** 2 + (z - az) ** 2 < ar * ar)) continue;
    if (min2 > 0 && out.some((p) => (x - p.x) ** 2 + (z - p.z) ** 2 < min2)) continue;
    out.push({ x, z });
  }
  return out;
}
