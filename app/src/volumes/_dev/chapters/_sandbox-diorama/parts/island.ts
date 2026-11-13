/**
 * Floating island: smooth low-frequency terrain on top, layered colour bands and a sculpted, tapering
 * underside (STYLE_GUIDE §3). One continuous radial grid; colour bands come from `K.toon({ layers })`.
 */
import { BufferAttribute, BufferGeometry } from 'three';
import { col, type ColorLike } from '@/style';

export const ISLAND_RADIUS = 9;
export const POND = { x: -2.6, z: 1.6, radius: 2.5, level: 0.06 };
export const HILL = { x: 3.4, z: -2.6, radius: 3.6, height: 1.55 };

function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Smooth value noise in 0…1. */
export function noise2(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** Outline of the island: a wobbly circle, so the silhouette is organic but still reads as a disc. */
export function rimRadius(theta: number): number {
  return (
    ISLAND_RADIUS *
    (1 + 0.07 * Math.sin(theta * 3 + 0.6) + 0.045 * Math.sin(theta * 5 + 2.1) + 0.02 * Math.sin(theta * 9))
  );
}

/** Terrain height of the top surface at world (x, z). */
export function heightAt(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const theta = Math.atan2(z, x);
  const edge = r / rimRadius(theta);
  let h =
    0.35 + (noise2(x * 0.22 + 3.1, z * 0.22 + 1.7) - 0.5) * 0.7 + (noise2(x * 0.55, z * 0.55) - 0.5) * 0.18;
  // the hill that carries the wind turbine
  const dh = Math.hypot(x - HILL.x, z - HILL.z) / HILL.radius;
  h += HILL.height * Math.pow(Math.max(0, 1 - dh * dh), 2);
  // pond basin: flat bed slightly below the water level, soft bank
  const dp = Math.hypot(x - POND.x, z - POND.z) / POND.radius;
  const basin = 1 - smooth(0.78, 1.18, dp);
  h = h * (1 - basin) + (POND.level - 0.32) * basin;
  // the top rounds off toward the rim
  h -= Math.pow(smooth(0.72, 1.0, edge), 2) * 0.75;
  return h;
}

/** Colour bands of the island by world height: rock strata on the flank, three grass zones on top. */
export const ISLAND_LAYERS: readonly (readonly [number, ColorLike])[] = [
  [-99, 'bg.indigo'],
  [-6.6, 'bg.plum'],
  [-4.4, 'violet.dark'],
  [-2.3, col('coral.dark').lerp(col('wireBrown'), 0.35)],
  [-1.05, 'wireBrown'],
  [-0.3, col('green').lerp(col('teal'), 0.55)],
  [0.42, 'green'],
  [1.2, col('green').lerp(col('lime'), 0.6)],
];

/** Build the island geometry (positions + smooth normals; colour comes from `ISLAND_LAYERS`). */
export function createIslandGeometry(): BufferGeometry {
  const segments = 128;
  const topRings = 44;
  const sideRings = 40;
  const rows = topRings + sideRings + 1;
  const cols = segments + 1;
  const position = new Float32Array(rows * cols * 3);
  const depth = 8.4;

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const theta = (j / segments) * Math.PI * 2;
      const rim = rimRadius(theta);
      const cx = Math.cos(theta);
      const sz = Math.sin(theta);
      let x: number;
      let y: number;
      let z: number;
      if (i <= topRings) {
        // top surface: centre → rim (rings bunch up slightly toward the rim for a clean rounded edge)
        const u = i / topRings;
        const r = rim * Math.pow(u, 0.85);
        x = cx * r;
        z = sz * r;
        y = heightAt(x, z);
      } else {
        // flank and underside: rim → tip, with lobes and a few hanging rock bulges
        const v = (i - topRings) / sideRings;
        const lobes =
          1 + 0.16 * Math.sin(theta * 4 + v * 5.0) * v + 0.1 * (noise2(theta * 2.2, v * 3.0) - 0.5);
        const taper = Math.pow(1 - v, 0.62) * (1 - 0.18 * Math.sin(v * Math.PI));
        const r = rim * Math.max(taper * lobes, 0.0);
        const yRim = heightAt(cx * rim, sz * rim);
        const bulge = Math.sin(v * Math.PI * 3 + theta * 2) * 0.22 * v * (1 - v);
        x = cx * r;
        z = sz * r;
        y = yRim - Math.pow(v, 1.25) * depth + bulge - smooth(0, 0.08, v) * 0.25;
      }
      const k = (i * cols + j) * 3;
      position[k] = x;
      position[k + 1] = y;
      position[k + 2] = z;
    }
  }
  const index: number[] = [];
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * cols + j;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      index.push(a, b, c, b, d, c);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  // weld the seam normals (first and last column are the same vertices)
  const normal = geometry.getAttribute('normal') as BufferAttribute;
  for (let i = 0; i < rows; i++) {
    const a = i * cols;
    const b = a + segments;
    const nx = normal.getX(a) + normal.getX(b);
    const ny = normal.getY(a) + normal.getY(b);
    const nz = normal.getZ(a) + normal.getZ(b);
    const len = Math.hypot(nx, ny, nz) || 1;
    normal.setXYZ(a, nx / len, ny / len, nz / len);
    normal.setXYZ(b, nx / len, ny / len, nz / len);
  }
  return geometry;
}
