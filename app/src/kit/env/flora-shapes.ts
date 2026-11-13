/**
 * Crown and trunk shapes of the kit's trees (STYLE_GUIDE §3: rounded blobs / cones on short trunks).
 * Units: metres, origin on the ground. Crowns are luminance-coded (grey gradient, darker underneath) so that
 * one instance tint gives each tree its own green / autumn colour; species with fixed colours bake them in.
 */
import type { BufferGeometry, Color } from 'three';
import { col } from '@/style';
import { Builder, type Tint } from '../core/builder';
import type { Pt } from '../core/geo';

export type TreeKind = 'round' | 'oak' | 'conifer' | 'poplar' | 'birch' | 'pine' | 'fruit' | 'bush';

export interface CrownShape {
  kind: TreeKind;
  geometry: BufferGeometry;
  /** Height of the bare trunk below the crown (0 = no trunk, e.g. bushes; birch brings its own). */
  trunk: number;
  /** Trunk radius at the ground. */
  girth: number;
  /** Does the instance tint colour the crown (false = colours are baked, tint stays near white)? */
  tintable: boolean;
}

/** Grey level of the crown gradient at height `y`: `lo` underneath → 1 on top (multiplied by the instance tint). */
function level(y: number, y0: number, y1: number, lo = 0.66): number {
  const t = Math.min(Math.max((y - y0) / (y1 - y0), 0), 1);
  return lo + (1 - lo) * t * t * (3 - 2 * t);
}

function shade(y0: number, y1: number, lo = 0.66): Tint {
  return (p, _n, out) => {
    out.setScalar(level(p.y, y0, y1, lo));
  };
}

type Blob = readonly [x: number, y: number, z: number, r: number, squash?: number];

function blobs(kind: TreeKind, trunk: number, girth: number, list: readonly Blob[], tintable = true): CrownShape {
  const b = new Builder('crown');
  const y0 = Math.min(...list.map((l) => l[1] - l[3] * (l[4] ?? 0.9)));
  const y1 = Math.max(...list.map((l) => l[1] + l[3] * (l[4] ?? 0.9)));
  list.forEach(([x, y, z, r, squash = 0.9], i) => {
    // the colour function sees the blob's own space → shift it to the crown's range (never mutate `p`)
    const c: Tint = (p, _n, out) => {
      out.setScalar(level(p.y * squash + y, y0, y1));
    };
    b.sphere(r, { seg: i === 0 ? 14 : 11, slot: 'soft', c, at: [x, y, z], s: [1, squash, 1] });
  });
  return { kind, geometry: b.geometry('soft'), trunk, girth, tintable };
}

/** Stacked skirts of a spruce / fir: each tier is a rounded cone, darker under its rim. */
function tiers(trunk: number, girth: number, height: number, radius: number, count: number): CrownShape {
  const b = new Builder('crown');
  const step = (height - trunk) / (count + 0.6);
  for (let i = 0; i < count; i++) {
    const k = 1 - i / (count + 0.35);
    const r = radius * k;
    const h = step * 1.75;
    const profile: Pt[] = [
      [0, 0],
      [r * 0.72, 0],
      [r * 0.98, h * 0.07],
      [r, h * 0.16],
      [r * 0.78, h * 0.42],
      [r * 0.3, h * 0.86],
      [r * 0.1, h * 0.98],
      [0, h],
    ];
    b.lathe(profile, { seg: 12, slot: 'soft', at: [0, trunk + i * step, 0], c: shade(0, h * 0.5, 0.6), crease: 70 });
  }
  return { kind: 'conifer', geometry: b.geometry('soft'), trunk, girth, tintable: true };
}

function poplar(): CrownShape {
  const b = new Builder('crown');
  const profile: Pt[] = [
    [0, 0],
    [0.9, 0.5],
    [1.45, 2.2],
    [1.5, 4.2],
    [1.15, 7.4],
    [0.55, 10.2],
    [0.16, 11.6],
    [0, 11.9],
  ];
  b.lathe(profile, { seg: 12, slot: 'soft', at: [0, 1.6, 0], c: shade(0, 9), crease: 80 });
  b.sphere(0.95, { seg: 10, slot: 'soft', at: [0.75, 4.6, 0.3], s: [1, 1.9, 1], c: shade(-2, 2) });
  return { kind: 'poplar', geometry: b.geometry('soft'), trunk: 2, girth: 0.34, tintable: true };
}

function birch(leaf: Color): CrownShape {
  const b = new Builder('crown');
  // the white trunk with dark marks is baked into the crown mesh, so a birch is not tinted per instance
  b.cyl(0.2, 6.6, { rTop: 0.1, seg: 8, slot: 'soft', c: 'white', bevel: 0 });
  const mark = col('ink').lerp(col('slate'), 0.4);
  for (const [y, a] of [
    [0.7, 0.3],
    [1.9, 2.1],
    [2.8, 4.0],
    [3.9, 1.0],
    [4.8, 3.2],
  ] as const) {
    b.box(0.2, 0.11, 0.07, { r: 0, slot: 'soft', c: mark, at: [Math.sin(a) * 0.16, y, Math.cos(a) * 0.16], rot: [0, a, 0] });
  }
  for (const [x, y, z, r] of [
    [0, 7.6, 0, 1.7],
    [1.1, 6.5, 0.3, 1.25],
    [-0.9, 6.3, -0.5, 1.3],
    [0.2, 5.6, 1.0, 1.05],
    [-0.2, 9.0, -0.1, 1.1],
  ] as const) {
    b.sphere(r, { seg: 11, slot: 'soft', at: [x, y, z], s: [1, 0.86, 1], c: (p, _n, out) => out.copy(leaf).multiplyScalar(level(p.y, -r * 4, r, 0.7)) });
  }
  return { kind: 'birch', geometry: b.geometry('soft'), trunk: 0, girth: 0, tintable: false };
}

function fruit(): CrownShape {
  const base = blobs('fruit', 2.2, 0.3, [
    [0, 4.3, 0, 2.3, 0.85],
    [1.5, 3.7, 0.5, 1.5],
    [-1.3, 3.9, -0.6, 1.6],
  ]);
  const b = new Builder('crown');
  const green = col('green');
  b.add(base.geometry, { slot: 'soft', c: (p, _n, out) => out.copy(green).multiplyScalar(0.7 + 0.3 * Math.min(Math.max((p.y - 2) / 4.5, 0), 1)) });
  for (let i = 0; i < 16; i++) {
    const a = i * 2.4;
    const el = 0.15 + ((i * 0.37) % 1) * 1.1;
    const r = 2.25 * (i % 3 === 0 ? 1.05 : 0.98);
    b.sphere(0.2, { seg: 6, slot: 'soft', c: i % 4 === 0 ? 'yellow' : 'coral', at: [Math.cos(a) * Math.cos(el) * r, 4.3 + Math.sin(el) * r * 0.85, Math.sin(a) * Math.cos(el) * r] });
  }
  return { kind: 'fruit', geometry: b.geometry('soft'), trunk: 2.2, girth: 0.3, tintable: false };
}

/** Tapered trunk with a root flare, 1 m tall and 1 m "girth" — instanced with per-tree scale. */
export function trunkGeometry(): BufferGeometry {
  const b = new Builder('trunk');
  const profile: Pt[] = [
    [0, 0],
    [1.25, 0],
    [1.0, 0.1],
    [0.82, 0.35],
    [0.66, 1.0],
    [0, 1.0],
  ];
  b.lathe(profile, { seg: 8, slot: 'soft', c: (p, _n, out) => out.setScalar(0.78 + 0.22 * p.y), crease: 75 });
  return b.geometry('soft');
}

/** All crown variants, built once per `trees()` call (a few hundred triangles each). */
export function crownShapes(birchLeaf: Color = col('lime').lerp(col('green'), 0.45)): CrownShape[] {
  return [
    blobs('round', 3.0, 0.36, [
      [0, 5.4, 0, 2.3],
      [1.6, 4.6, 0.5, 1.6],
      [-0.7, 6.9, -0.4, 1.5],
    ]),
    blobs('round', 2.6, 0.34, [
      [0, 4.8, 0, 2.0, 1.05],
      [-1.4, 4.2, 0.6, 1.45],
      [1.2, 4.0, -0.7, 1.35],
      [0.3, 6.5, 0.2, 1.3],
    ]),
    blobs('oak', 3.2, 0.52, [
      [0, 6.0, 0, 3.0, 0.78],
      [2.3, 5.2, 0.8, 2.0, 0.8],
      [-2.2, 5.4, -0.6, 2.1, 0.8],
      [0.4, 5.3, 2.1, 1.8, 0.8],
      [-0.3, 7.6, -0.3, 1.9, 0.8],
    ]),
    tiers(1.3, 0.3, 10.5, 2.5, 3),
    tiers(1.6, 0.28, 13.5, 2.2, 4),
    poplar(),
    birch(birchLeaf),
    blobs('pine', 7.2, 0.3, [
      [0, 8.6, 0, 2.5, 0.5],
      [1.5, 8.0, 0.6, 1.6, 0.5],
      [-1.2, 9.3, -0.5, 1.5, 0.5],
    ]),
    fruit(),
    blobs('bush', 0, 0, [
      [0, 0.75, 0, 1.0, 0.8],
      [0.85, 0.55, 0.3, 0.7, 0.8],
    ]),
    blobs('bush', 0, 0, [
      [0, 0.6, 0, 0.8, 0.8],
      [-0.7, 0.5, 0.35, 0.62, 0.8],
      [0.5, 0.45, -0.5, 0.55, 0.8],
    ]),
  ];
}
