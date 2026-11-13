/**
 * Islands and tabletop bases (STYLE_GUIDE §3: smooth low-frequency terrain, layered colour bands, sculpted
 * underside). One builder covers the floating island, the "slab" tabletop and the sea-level tray:
 *
 *  - the top is a smooth height field (relief + hills + flattened build pads + carved lakes / rivers);
 *  - colours are crisp bands cut along iso-lines (see `core/bands`): shore sand, meadow patches, gravel pads,
 *    dirt paths, optional rock / snow lines — never airbrushed;
 *  - water bodies reuse the terrain grid, and encode "how close is the shore" in their UVs so that `K.water`
 *    draws the depth gradient and the animated foam rings along the *real* shoreline of any shape;
 *  - the flank shows strata (and, for sea-level trays, a cut through the water).
 *
 * Units: metres. Origin: centre of the island, y = 0 is the nominal ground level.
 */
import {
  BufferGeometry,
  type Color,
  Float32BufferAttribute,
  Mesh,
  type Object3D,
  type BufferAttribute,
} from 'three';
import { K, col, type ColorLike } from '@/style';
import { splitBands, type Bands } from '../core/bands';
import { Builder, type KitModel } from '../core/builder';
import * as G from '../core/geo';
import { clamp, fbm, noise2, smoothstep } from '../core/noise';

const TAU = Math.PI * 2;
const mix = (a: ColorLike, b: ColorLike, t: number): Color => col(a).lerp(col(b), t);

export type Biome = 'meadow' | 'steppe' | 'desert' | 'snow' | 'rock' | 'industrial';

export type TerrainFeature =
  /** Smooth bump (negative `h` = hollow). */
  | { type: 'hill'; x: number; z: number; r: number; h: number }
  /** Lake: carved basin + water surface. `level` defaults to slightly below the surrounding ground. */
  | { type: 'lake'; x: number; z: number; r: number; depth?: number; level?: number; squash?: number; rot?: number }
  /** River / canal carved along a polyline of [x, z] points (keep it level: one water level per river). */
  | { type: 'river'; path: readonly G.Pt[]; width: number; depth?: number; level?: number }
  /**
   * Flattened build pad (disc with `r`, or rounded rectangle with `w` × `d`, rotated by `rot`).
   * With `color` it is also painted as a crisp ground patch (gravel yard, concrete apron, asphalt lot).
   */
  | {
      type: 'pad';
      x: number;
      z: number;
      r?: number;
      w?: number;
      d?: number;
      rot?: number;
      y?: number;
      color?: ColorLike;
      corner?: number;
      blend?: number;
    }
  /** Painted track following the terrain (dirt path, sand road). For asphalt with markings use `road()`. */
  | { type: 'path'; path: readonly G.Pt[]; width: number; color?: ColorLike };

export interface IslandOptions {
  /** Mean radius in metres. Default 60. */
  radius?: number;
  /** Outline irregularity 0 (perfect circle) … 1. Default 0.7. */
  wobble?: number;
  /** Custom outline: radius multiplier as a function of the polar angle (overrides `wobble`). */
  outline?: (theta: number) => number;
  seed?: number;
  /** Amplitude of the gentle undulation in metres. Default 2.5 % of the radius. */
  relief?: number;
  features?: readonly TerrainFeature[];
  /** Extra height added everywhere (custom landforms). */
  height?: (x: number, z: number) => number;
  biome?: Biome;
  /** Altitudes (above ground level) where rock and snow bands start — for mountains. */
  altitude?: { rock?: number; snow?: number };
  /** Sea level: a water surface over the whole outline at this height (terrain below it is submerged). */
  sea?: number;
  /** `floating` (tapering rock, default), `slab` (tabletop / game-board base) or `none` (top only). */
  underside?: 'floating' | 'slab' | 'none';
  /** Thickness of the underside. Default 0.9 × radius (floating) or 0.16 × radius (slab). */
  depth?: number;
  /** Glowing crystals in the rock of a floating island. Default true. */
  crystals?: boolean;
  /** World-space size of the water glint pattern. Default radius / 9. */
  waterScale?: number;
  /** Lake / sea pattern follows `env.setScale(…, { adaptFrom })` (`K.water({ followLook })`, M3). */
  waterFollowLook?: boolean;
  /** Mesh density multiplier (1 = 160 × 56 top grid). */
  detail?: number;
}

export interface Island extends KitModel {
  readonly radius: number;
  /** Ground height at (x, z). */
  heightAt(x: number, z: number): number;
  /** Outline radius at polar angle `theta`. */
  rimAt(theta: number): number;
  /** Is (x, z) on the island, at least `margin` metres from the rim? */
  inside(x: number, z: number, margin?: number): boolean;
  /** Is (x, z) dry land (not under a lake, river or the sea)? */
  dry(x: number, z: number): boolean;
  /** Put an object on the ground at (x, z), optionally rotated around Y and lifted by `lift`. Returns the object. */
  place<T extends Object3D>(object: T, x: number, z: number, ry?: number, lift?: number): T;
}

function distPolyline(x: number, z: number, pts: readonly G.Pt[]): number {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1]!;
    const [bx, bz] = pts[i]!;
    const dx = bx - ax;
    const dz = bz - az;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1), 0, 1);
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

type Pad = Extract<TerrainFeature, { type: 'pad' }>;

/** Signed distance to a pad's outline (negative inside). */
function padDistance(p: Pad, x: number, z: number): number {
  const dx = x - p.x;
  const dz = z - p.z;
  if (p.w === undefined || p.d === undefined) return Math.hypot(dx, dz) - (p.r ?? 5);
  const c = Math.cos(p.rot ?? 0);
  const s = Math.sin(p.rot ?? 0);
  const lx = Math.abs(dx * c - dz * s);
  const lz = Math.abs(dx * s + dz * c);
  const corner = Math.min(p.corner ?? 2, p.w / 2, p.d / 2);
  const qx = lx - (p.w / 2 - corner);
  const qz = lz - (p.d / 2 - corner);
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - corner;
}

interface Palette {
  /** Three ground tones: dark patches, base, light patches. */
  ground: [Color, Color, Color];
  sand: Color;
  rock: [Color, Color];
  snow: Color;
  lip: Color;
}

function palette(biome: Biome): Palette {
  const rock: [Color, Color] = [mix('steel', 'violet.dark', 0.35), mix('mist', 'steel', 0.45)];
  switch (biome) {
    case 'steppe':
      return {
        ground: [mix('lime', 'green', 0.55), mix('lime', 'yellow', 0.3), mix('yellow.light', 'lime', 0.35)],
        sand: mix('yellow.light', 'orange.light', 0.25),
        rock,
        snow: col('white'),
        lip: mix('lime', 'green', 0.7),
      };
    case 'desert':
      return {
        ground: [mix('amber.light', 'orange', 0.3), mix('yellow.light', 'amber.light', 0.5), col('yellow.light')],
        sand: mix('yellow.light', 'white', 0.3),
        rock: [mix('orange.dark', 'coral.dark', 0.4), mix('orange', 'amber.light', 0.5)],
        snow: col('white'),
        lip: mix('amber.light', 'orange', 0.45),
      };
    case 'snow':
      return {
        ground: [mix('sky.light', 'mist', 0.5), col('white'), mix('white', 'sky.light', 0.25)],
        sand: mix('mist', 'sky.light', 0.5),
        rock,
        snow: col('white'),
        lip: mix('sky.light', 'mist', 0.4),
      };
    case 'rock':
      return {
        ground: [mix('slate', 'violet.dark', 0.3), mix('steel', 'violet', 0.18), mix('mist', 'steel', 0.5)],
        sand: mix('mist', 'yellow.light', 0.4),
        rock,
        snow: col('white'),
        lip: mix('slate', 'violet.dark', 0.4),
      };
    case 'industrial':
      return {
        ground: [mix('steel.light', 'violet.light', 0.25), mix('mist', 'steel.light', 0.35), mix('mist', 'white', 0.4)],
        sand: mix('yellow.light', 'mist', 0.35),
        rock,
        snow: col('white'),
        lip: mix('steel', 'violet', 0.25),
      };
    case 'meadow':
    default:
      return {
        ground: [mix('green', 'teal', 0.42), col('green'), mix('green', 'lime', 0.55)],
        sand: mix('yellow.light', 'amber.light', 0.2),
        rock,
        snow: col('white'),
        lip: mix('green', 'teal', 0.6),
      };
  }
}

/** Colours of the named ground patches a pad / path can be painted with. */
export const GROUND = {
  gravel: (): Color => mix('mist', 'steel.light', 0.45),
  concrete: (): Color => mix('mist', 'white', 0.35),
  asphalt: (): Color => mix('slate', 'steel', 0.3),
  dirt: (): Color => mix('wireBrown', 'yellow.light', 0.45),
  sand: (): Color => mix('yellow.light', 'amber.light', 0.2),
  coal: (): Color => mix('ink', 'slate', 0.35),
} as const;

/** Build an island / tabletop base. See the file header for the model. */
export function island(options: IslandOptions = {}): Island {
  const radius = options.radius ?? 60;
  const seed = options.seed ?? 1;
  const wobble = options.wobble ?? 0.7;
  const relief = options.relief ?? radius * 0.025;
  const features = options.features ?? [];
  const underside = options.underside ?? 'floating';
  const depth = options.depth ?? radius * (underside === 'slab' ? 0.16 : 0.9);
  const sea = options.sea;
  const pal = palette(options.biome ?? 'meadow');
  const detail = options.detail ?? 1;
  const ph = [noise2(seed, 1.3) * TAU, noise2(seed, 7.7) * TAU, noise2(seed, 13.1) * TAU];

  const rimAt = (theta: number): number =>
    radius *
    (options.outline
      ? options.outline(theta)
      : 1 +
        wobble *
          (0.07 * Math.sin(theta * 3 + ph[0]!) + 0.045 * Math.sin(theta * 5 + ph[1]!) + 0.02 * Math.sin(theta * 9 + ph[2]!)));

  /* ------------------------------------------------------------------------------- height function */
  const hills = features.filter((f) => f.type === 'hill');
  const lakes = features.filter((f) => f.type === 'lake');
  const rivers = features.filter((f) => f.type === 'river');
  const pads = features.filter((f) => f.type === 'pad');
  const paths = features.filter((f) => f.type === 'path');
  const lambda = radius * 0.42;

  const rawHeight = (x: number, z: number): number => {
    let h = (fbm(x / lambda + 3.1, z / lambda + 1.7, 2, seed) - 0.5) * 2 * relief;
    for (const f of hills) {
      const d = Math.hypot(x - f.x, z - f.z) / f.r;
      h += f.h * Math.pow(Math.max(0, 1 - d * d), 2);
    }
    if (options.height) h += options.height(x, z);
    return h;
  };
  const padY = pads.map((p) => p.y ?? rawHeight(p.x, p.z));
  const withPads = (x: number, z: number): number => {
    let h = rawHeight(x, z);
    pads.forEach((p, i) => {
      const w = 1 - smoothstep(0, p.blend ?? Math.max(3, (p.r ?? Math.min(p.w ?? 10, p.d ?? 10) / 2) * 0.5), padDistance(p, x, z));
      h += (padY[i]! - h) * w;
    });
    return h;
  };
  // Water bodies: level, bed depth, and a "how deep inside the basin" weight (0 outside … 1 on the bed).
  interface Body {
    level: number;
    depth: number;
    weight: (x: number, z: number) => number;
  }
  const bodies: Body[] = [];
  for (const f of lakes) {
    const c = Math.cos(f.rot ?? 0);
    const s = Math.sin(f.rot ?? 0);
    const squash = f.squash ?? 1;
    const dist = (x: number, z: number): number => {
      const dx = x - f.x;
      const dz = z - f.z;
      return Math.hypot(dx * c - dz * s, (dx * s + dz * c) / squash) / f.r;
    };
    bodies.push({
      level: f.level ?? withPads(f.x, f.z) - 0.35,
      depth: f.depth ?? Math.max(1.2, f.r * 0.12),
      weight: (x, z) => 1 - smoothstep(0.7, 1.12, dist(x, z)),
    });
  }
  for (const f of rivers) {
    const start = f.path[0]!;
    bodies.push({
      level: f.level ?? withPads(start[0], start[1]) - 0.4,
      depth: f.depth ?? Math.max(1, f.width * 0.18),
      weight: (x, z) => 1 - smoothstep(f.width * 0.32, f.width * 0.62, distPolyline(x, z, f.path)),
    });
  }
  const heightAt = (x: number, z: number): number => {
    let h = withPads(x, z);
    for (const b of bodies) h += (b.level - b.depth - h) * b.weight(x, z);
    // the top rounds off toward the rim
    const edge = Math.hypot(x, z) / rimAt(Math.atan2(z, x));
    h -= Math.pow(smoothstep(underside === 'slab' ? 0.9 : 0.78, 1.0, edge), 2) * (underside === 'slab' ? 0.5 : radius * 0.035);
    return h;
  };
  /** Height above the water body that governs (x, z); large when there is none nearby. */
  const aboveWater = (x: number, z: number, h: number): number => {
    let best = sea !== undefined ? h - sea : 99;
    for (const b of bodies) if (b.weight(x, z) > 0.001) best = Math.min(best, h - b.level);
    return best;
  };

  /* ------------------------------------------------------------------------------------- top grid */
  const segments = Math.round(160 * detail);
  const topRings = Math.round(56 * detail);
  const cols = segments + 1;
  const topCount = (topRings + 1) * cols;
  const tp = new Float32Array(topCount * 3);
  const fShore = new Float32Array(topCount);
  const fNoise = new Float32Array(topCount);
  const fAlt = new Float32Array(topCount);
  const fPads = pads.filter((p) => p.color !== undefined).map(() => new Float32Array(topCount));
  const fPaths = paths.map(() => new Float32Array(topCount));
  const coloured = pads.filter((p) => p.color !== undefined);
  for (let i = 0; i <= topRings; i++) {
    const u = Math.pow(i / topRings, 0.88);
    for (let j = 0; j < cols; j++) {
      const theta = (j / segments) * TAU;
      const r = rimAt(theta) * u;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      const h = heightAt(x, z);
      const k = i * cols + j;
      tp[k * 3] = x;
      tp[k * 3 + 1] = h;
      tp[k * 3 + 2] = z;
      fShore[k] = aboveWater(x, z, h);
      fNoise[k] = fbm(x / (radius * 0.3) + 9, z / (radius * 0.3) + 4, 2, seed + 5);
      fAlt[k] = h;
      coloured.forEach((p, n) => (fPads[n]![k] = padDistance(p, x, z)));
      paths.forEach((p, n) => (fPaths[n]![k] = distPolyline(x, z, p.path)));
    }
  }
  const gridIndex = (rings: number): number[] => {
    const index: number[] = [];
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < segments; j++) {
        const a = i * cols + j;
        const b = a + 1;
        const c = a + cols;
        const d = c + 1;
        if (i > 0) index.push(a, b, c);
        index.push(b, d, c);
      }
    }
    return index;
  };
  const smoothNormals = (position: Float32Array, index: number[], rows: number): BufferAttribute => {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(position, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    const normal = g.getAttribute('normal') as BufferAttribute;
    for (let i = 0; i < rows; i++) {
      // weld the angular seam (first and last column are the same points)
      const a = i * cols;
      const b = a + segments;
      const nx = normal.getX(a) + normal.getX(b);
      const ny = normal.getY(a) + normal.getY(b);
      const nz = normal.getZ(a) + normal.getZ(b);
      const len = Math.hypot(nx, ny, nz) || 1;
      normal.setXYZ(a, nx / len, ny / len, nz / len);
      normal.setXYZ(b, nx / len, ny / len, nz / len);
    }
    return normal;
  };
  const topIndex = gridIndex(topRings);
  const topNormal = smoothNormals(tp, topIndex, topRings + 1);
  for (let j = 0; j < cols; j++) topNormal.setXYZ(j, 0, 1, 0); // the pole

  // band tree of the top: pads → paths → shore → altitude → meadow patches
  const fields: Float32Array[] = [fShore, fNoise, fAlt, ...fPads, ...fPaths];
  let tree: Bands = {
    field: 1,
    stops: [
      [0.4, pal.ground[0]],
      [0.6, pal.ground[1]],
    ],
    rest: pal.ground[2],
  };
  if (options.altitude) {
    const stops: [number, Color | Bands][] = [];
    if (options.altitude.rock !== undefined) stops.push([options.altitude.rock, tree]);
    const snowLine = options.altitude.snow;
    tree = {
      field: 2,
      stops: snowLine !== undefined ? [...stops, [snowLine, stops.length ? pal.rock[0] : tree]] : stops,
      rest: snowLine !== undefined ? pal.snow : pal.rock[0],
    };
  }
  tree = {
    field: 0,
    stops: [
      [-0.3, mix(pal.sand, 'teal', 0.35)],
      [0.55, pal.sand],
    ],
    rest: tree,
  };
  paths.forEach((p, n) => {
    tree = { field: 3 + fPads.length + n, stops: [[p.width / 2, col(p.color ?? GROUND.dirt())]], rest: tree };
  });
  coloured.forEach((p, n) => {
    tree = { field: 3 + n, stops: [[0, col(p.color!)]], rest: tree };
  });

  const b = new Builder('island');
  b.add(splitBands({ position: tp, normal: topNormal.array, fields, index: topIndex }, tree), { slot: 'matte' });

  /* ---------------------------------------------------------------------------------------- water */
  const waterScale = options.waterScale ?? radius / 9;
  const addWater = (level: number, fade: number, covers: (k: number) => boolean): void => {
    const used = new Map<number, number>();
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const vertex = (k: number): number => {
      let v = used.get(k);
      if (v === undefined) {
        v = pos.length / 3;
        used.set(k, v);
        // K.water expects a surface in the XY plane (rotated to horizontal below)
        pos.push(tp[k * 3]!, -tp[k * 3 + 2]!, 0);
        // "shore proximity" 1 at the waterline → 0 in deep water, read by the shader as radial distance
        uv.push(0.5 + 0.5 * clamp(1 - (level - tp[k * 3 + 1]!) / fade, 0, 1), 0.5);
      }
      return v;
    };
    for (let i = 0; i < topIndex.length; i += 3) {
      const a = topIndex[i]!;
      const c = topIndex[i + 1]!;
      const d = topIndex[i + 2]!;
      if (!(covers(a) || covers(c) || covers(d))) continue;
      idx.push(vertex(a), vertex(c), vertex(d));
    }
    if (idx.length === 0) return;
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new Mesh(
      g,
      K.water({ shallow: 'sky', deep: 'blue', shape: 'disc', scale: waterScale, glints: 0.6, waveHeight: 0.04, followLook: options.waterFollowLook }),
    );
    mesh.name = 'island:water';
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = level;
    mesh.receiveShadow = true;
    b.attach(mesh);
  };
  for (const body of bodies) {
    addWater(body.level, body.depth * 0.9, (k) => {
      const x = tp[k * 3]!;
      const z = tp[k * 3 + 2]!;
      return body.weight(x, z) > 0.001 && tp[k * 3 + 1]! < body.level;
    });
  }
  if (sea !== undefined) addWater(sea, Math.max(1.5, radius * 0.04), (k) => tp[k * 3 + 1]! < sea);

  /* ------------------------------------------------------------------------------ flank / underside */
  if (underside !== 'none') {
    const sideRings = Math.round((underside === 'slab' ? 14 : 34) * detail);
    const sideCount = (sideRings + 1) * cols;
    const sp = new Float32Array(sideCount * 3);
    const gWater = new Float32Array(sideCount); // > 0 between the sea surface and the sea bed
    const gSurf = new Float32Array(sideCount); // depth below the sea surface
    const gStrata = new Float32Array(sideCount);
    for (let i = 0; i <= sideRings; i++) {
      const v = i / sideRings;
      for (let j = 0; j < cols; j++) {
        const theta = (j / segments) * TAU;
        const rim = rimAt(theta);
        const cx = Math.cos(theta);
        const sz = Math.sin(theta);
        const bed = heightAt(cx * rim, sz * rim);
        const top = sea !== undefined ? Math.max(bed, sea) : bed;
        let r: number;
        let y: number;
        if (underside === 'slab') {
          // straight wall with a rounded bottom edge and a flat bottom
          const round = smoothstep(0.82, 1, v);
          r = rim * Math.max(1 - 0.02 * v - 0.98 * Math.pow(round, 2.2), 0);
          y = top - Math.min(v / 0.86, 1) * depth;
        } else {
          const lobes =
            1 + 0.15 * Math.sin(theta * 4 + v * 5 + ph[0]!) * v + 0.1 * (noise2(theta * 2.2, v * 3, seed) - 0.5);
          const taper = Math.pow(1 - v, 0.6) * (1 - 0.2 * Math.sin(v * Math.PI));
          const lip = 1 + 0.012 * Math.sin(Math.PI * clamp(v / 0.07, 0, 1));
          r = rim * Math.max(taper * lobes, 0) * lip;
          const bulge = Math.sin(v * Math.PI * 3 + theta * 2) * 0.026 * depth * v * (1 - v);
          y = top - Math.pow(v, 1.22) * depth + bulge - smoothstep(0, 0.08, v) * 0.03 * depth;
        }
        const k = i * cols + j;
        sp[k * 3] = cx * r;
        sp[k * 3 + 1] = y;
        sp[k * 3 + 2] = sz * r;
        gWater[k] = sea !== undefined ? y - bed : -1;
        gSurf[k] = sea !== undefined ? sea - y : 0;
        gStrata[k] = (bed - y) / depth + (noise2(theta * 3, 0.5, seed + 3) - 0.5) * 0.05 + (noise2(theta * 9, 2.5, seed) - 0.5) * 0.015;
      }
    }
    const sideIndex: number[] = [];
    for (let i = 0; i < sideRings; i++) {
      for (let j = 0; j < segments; j++) {
        const a = i * cols + j;
        const c = a + cols;
        sideIndex.push(a, a + 1, c);
        if (i < sideRings - 1) sideIndex.push(a + 1, c + 1, c);
      }
    }
    const sideNormal = smoothNormals(sp, sideIndex, sideRings + 1);
    const k = underside === 'slab' ? 1 / 0.86 : 1; // strata positions relative to the wall height
    const strata: Bands = {
      field: 2,
      stops: [
        [0.035 * k, pal.lip],
        [0.15 * k, mix('wireBrown', 'coral.dark', 0.15)],
        [0.3 * k, mix('coral.dark', 'wireBrown', 0.35)],
        [0.52 * k, col('violet.dark')],
        [0.74 * k, col('bg.plum')],
      ],
      rest: col('bg.indigo'),
    };
    const flank: Bands = {
      field: 0,
      stops: [[0.001, strata]],
      rest: {
        field: 1,
        stops: [[Math.max(0.5, radius * 0.008), mix('sky', 'white', 0.45)]],
        rest: { field: 1, stops: [[depth * 0.2, mix('sky', 'blue', 0.45)]], rest: mix('blue', 'blue.dark', 0.4) },
      },
    };
    b.add(
      splitBands({ position: sp, normal: sideNormal.array, fields: [gWater, gSurf, gStrata], index: sideIndex }, flank),
      { slot: 'matte' },
    );

    if (underside === 'floating') {
      // chunky hanging rocks: faceted on purpose (STYLE_GUIDE §3 allows flat facets for rocks)
      const rockColors = ['violet.dark', 'bg.plum', 'bg.violet'] as const;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU + noise2(i, seed) * 0.8;
        const v = 0.3 + noise2(i * 3.1, seed + 2) * 0.5;
        const rr = rimAt(a) * Math.pow(1 - v, 0.6) * 0.82;
        const size = radius * (0.05 + noise2(i * 1.7, seed + 9) * 0.07);
        b.add(G.facet(size, 0), {
          slot: 'facet',
          c: rockColors[i % 3]!,
          at: [Math.cos(a) * rr, -Math.pow(v, 1.22) * depth - size * 0.4, Math.sin(a) * rr],
          rot: [i, i * 2.3, i * 0.7],
          s: [1, 1.5 + noise2(i, 4.4) * 0.8, 1],
        });
      }
      if (options.crystals ?? true) {
        const geo = G.facet(1, 0);
        const merged: BufferGeometry[] = [];
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * TAU + noise2(i * 5.3, seed + 20) * 0.9;
          const v = 0.22 + noise2(i * 2.9, seed + 21) * 0.5;
          const rr = rimAt(a) * Math.pow(1 - v, 0.6) * 0.9;
          const size = radius * (0.014 + noise2(i * 7.7, seed + 22) * 0.02);
          const g = geo.clone();
          g.scale(size, size * 3, size);
          g.rotateZ(Math.cos(a) * 0.9);
          g.rotateX(-Math.sin(a) * 0.9);
          g.translate(Math.cos(a) * rr, -Math.pow(v, 1.22) * depth - size, Math.sin(a) * rr);
          merged.push(g);
        }
        const crystals = new Mesh(
          G.mergeGeometries(merged),
          K.toon({ color: 'violet.dark', emissive: 'violet', emissiveIntensity: 0.55, flatShading: true, fog: false }),
        );
        crystals.name = 'island:crystals';
        b.attach(crystals);
      }
    }
  }

  const model = b.build();
  const inside = (x: number, z: number, margin = 0): boolean =>
    Math.hypot(x, z) < rimAt(Math.atan2(z, x)) - margin;
  return Object.assign(model, {
    radius,
    heightAt,
    rimAt,
    inside,
    dry: (x: number, z: number): boolean => aboveWater(x, z, heightAt(x, z)) > 0.4,
    place<T extends Object3D>(object: T, x: number, z: number, ry = 0, lift = 0): T {
      object.position.set(x, heightAt(x, z) + lift, z);
      object.rotation.y = ry;
      model.group.add(object);
      return object;
    },
  });
}
