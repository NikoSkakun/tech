/**
 * Trees and bushes: many species and variants, each tree with its own size, rotation and tint, drawn as a
 * handful of instanced meshes (one per crown variant + one for all trunks) and swaying gently in `update()`.
 * Units: metres.
 */
import { type Color, Group, InstancedMesh, Matrix4, Quaternion, Vector3, Euler } from 'three';
import type { Rng } from '@/engine/api';
import { col, type ColorLike } from '@/style';
import { KitModel, MatSet } from '../core/builder';
import { triangleCount } from '../core/geo';
import { fbm, scatter } from '../core/noise';
import { crownShapes, trunkGeometry, type TreeKind } from './flora-shapes';

export type { TreeKind } from './flora-shapes';
export type Season = 'summer' | 'autumn' | 'blossom';

export interface TreeSpot {
  x: number;
  y: number;
  z: number;
  kind?: TreeKind;
  /** Size multiplier (default: random 0.8…1.25). */
  scale?: number;
  ry?: number;
  tint?: ColorLike;
}

export interface TreesOptions {
  rng: Rng;
  season?: Season;
  /** Species drawn for spots without a `kind` (repeat a name to weight it). */
  kinds?: readonly TreeKind[];
  /** Sway amplitude multiplier (0 = static). Default 1. */
  sway?: number;
}

const mix = (a: ColorLike, b: ColorLike, t: number): Color => col(a).lerp(col(b), t);

function tints(season: Season): { leaf: Color[]; needle: Color[]; birch: Color } {
  const needle = [mix('teal', 'green.dark', 0.5), mix('teal', 'blue.dark', 0.3), mix('green', 'teal.dark', 0.6)];
  if (season === 'autumn') {
    return {
      leaf: [col('amber'), col('orange'), mix('coral', 'orange', 0.5), col('yellow'), mix('green', 'yellow', 0.55)],
      needle,
      birch: col('yellow'),
    };
  }
  if (season === 'blossom') {
    return {
      leaf: [col('pink.light'), mix('pink', 'white', 0.55), col('white'), mix('green', 'lime', 0.4), col('pink')],
      needle,
      birch: mix('lime', 'green', 0.3),
    };
  }
  return {
    leaf: [col('green'), mix('green', 'teal', 0.45), mix('green', 'lime', 0.45), col('teal'), mix('green', 'green.dark', 0.45)],
    needle,
    birch: mix('lime', 'green', 0.45),
  };
}

const DEFAULT_KINDS: readonly TreeKind[] = ['round', 'round', 'oak', 'conifer', 'conifer', 'poplar', 'birch', 'bush'];

/** Instanced trees at the given spots. */
export function trees(spots: readonly TreeSpot[], o: TreesOptions): KitModel {
  const { rng } = o;
  const palette = tints(o.season ?? 'summer');
  const shapes = crownShapes(palette.birch);
  const mats = new MatSet();
  const material = mats.get('soft');
  const group = new Group();
  group.name = 'trees';

  interface Item {
    shape: number;
    base: Matrix4;
    pivot: number;
    phase: number;
    amp: number;
  }
  const items: Item[] = [];
  const perShape = shapes.map(() => [] as number[]);
  const trunks: { m: Matrix4; c: Color }[] = [];
  const m = new Matrix4();
  const q = new Quaternion();
  const e = new Euler();
  const brown = mix('wireBrown', 'ink', 0.42);
  const pineBark = mix('wireBrown', 'orange.dark', 0.3);
  const tintOf: Color[] = [];
  for (const spot of spots) {
    const kind = spot.kind ?? rng.pick(o.kinds ?? DEFAULT_KINDS);
    const variants = shapes.map((s, i) => (s.kind === kind ? i : -1)).filter((i) => i >= 0);
    const si = rng.pick(variants);
    const shape = shapes[si]!;
    const k = (spot.scale ?? rng.range(0.8, 1.25)) * (kind === 'bush' ? rng.range(0.9, 1.5) : 1);
    const stretch = rng.range(0.92, 1.12);
    q.setFromEuler(e.set(0, spot.ry ?? rng.range(0, Math.PI * 2), 0));
    const base = new Matrix4().compose(new Vector3(spot.x, spot.y - 0.05, spot.z), q, new Vector3(k, k * stretch, k));
    perShape[si]!.push(items.length);
    items.push({ shape: si, base, pivot: shape.trunk, phase: rng.range(0, 6.28), amp: (kind === 'bush' ? 0.4 : 1) * rng.range(0.7, 1.2) });
    let tint: Color;
    if (spot.tint !== undefined) tint = col(spot.tint);
    else if (!shape.tintable) tint = mix('white', 'mist', rng.range(0, 0.25));
    else tint = rng.pick(kind === 'conifer' || kind === 'pine' ? palette.needle : palette.leaf).clone();
    tintOf.push(tint.lerp(col('lime'), shape.tintable && kind !== 'conifer' ? rng.range(0, 0.12) : 0));
    if (shape.trunk > 0) {
      const g = shape.girth * k;
      trunks.push({
        m: new Matrix4().compose(new Vector3(spot.x, spot.y - 0.15, spot.z), q, new Vector3(g, (shape.trunk + 0.5) * k * stretch + 0.15, g)),
        c: (kind === 'pine' ? pineBark : brown).clone().multiplyScalar(rng.range(0.85, 1.1)),
      });
    }
  }

  let triangles = 0;
  const meshes = shapes.map((shape, si) => {
    const list = perShape[si]!;
    if (list.length === 0) return null;
    const im = new InstancedMesh(shape.geometry, material, list.length);
    im.name = `trees:${shape.kind}`;
    list.forEach((item, i) => {
      im.setMatrixAt(i, items[item]!.base);
      im.setColorAt(i, tintOf[item]!);
    });
    im.castShadow = true;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    triangles += triangleCount(shape.geometry) * list.length;
    group.add(im);
    return im;
  });
  if (trunks.length) {
    const tg = trunkGeometry();
    const im = new InstancedMesh(tg, material, trunks.length);
    im.name = 'trees:trunks';
    trunks.forEach((t, i) => {
      im.setMatrixAt(i, t.m);
      im.setColorAt(i, t.c);
    });
    im.castShadow = true;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    triangles += triangleCount(tg) * trunks.length;
    group.add(im);
  }

  const model = new KitModel(group, {}, {}, mats, triangles);
  const sway = o.sway ?? 1;
  if (sway > 0) {
    const up = new Matrix4();
    const down = new Matrix4();
    const rot = new Matrix4();
    // each crown leans around the top of its trunk: base · T(pivot) · R(sway) · T(−pivot)
    model.update = (_dt, t) => {
      meshes.forEach((im, si) => {
        if (!im) return;
        perShape[si]!.forEach((item, i) => {
          const it = items[item]!;
          const a = 0.022 * sway * it.amp;
          rot.makeRotationFromEuler(e.set(Math.sin(t * 0.9 + it.phase) * a, 0, Math.cos(t * 0.7 + it.phase * 1.3) * a));
          m.copy(it.base).multiply(up.makeTranslation(0, it.pivot, 0)).multiply(rot).multiply(down.makeTranslation(0, -it.pivot, 0));
          im.setMatrixAt(i, m);
        });
        im.instanceMatrix.needsUpdate = true;
      });
    };
  }
  return model;
}

/** Anything trees can stand on: an `island()` or a custom height function. */
export interface Ground {
  heightAt(x: number, z: number): number;
  inside?(x: number, z: number, margin?: number): boolean;
  dry?(x: number, z: number): boolean;
  radius: number;
}

export interface ForestOptions extends TreesOptions {
  count: number;
  ground: Ground;
  /** Keep-out discs `[x, z, radius]` (buildings, roads, sight lines). */
  avoid?: readonly (readonly [number, number, number])[];
  /** Minimum distance between trunks. Default 4.5 m. */
  minDist?: number;
  /** 0 = evenly spread … 1 = dense groves with open meadow between them. Default 0.5. */
  clump?: number;
  /** Distance kept from the rim. Default 5 m. */
  margin?: number;
}

/** Seeded scatter of trees over a ground: groves, clearings, nothing in the water or on build pads you list in `avoid`. */
export function forest(o: ForestOptions): KitModel {
  const { ground, rng } = o;
  const clump = o.clump ?? 0.5;
  const seed = rng.int(0, 9999);
  const spots: TreeSpot[] = [];
  const points = scatter({
    count: o.count,
    rng,
    area: { r: ground.radius },
    minDist: o.minDist ?? 4.5,
    avoid: o.avoid,
    accept: (x, z) =>
      (ground.inside?.(x, z, o.margin ?? 5) ?? true) &&
      (ground.dry?.(x, z) ?? true) &&
      fbm(x / (ground.radius * 0.28), z / (ground.radius * 0.28), 2, seed) > 0.5 - (1 - clump) * 0.5 + clump * 0.02,
  });
  for (const p of points) spots.push({ x: p.x, y: ground.heightAt(p.x, p.z), z: p.z });
  return trees(spots, o);
}
