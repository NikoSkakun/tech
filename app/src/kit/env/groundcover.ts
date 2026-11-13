/**
 * Small ground dressing, instanced: grass tufts, meadow flowers (poppies, cornflowers, daisies), reeds, rocks
 * and boulders. One call = 2–3 draw calls whatever the count. Units: metres.
 */
import { type Color, Euler, Group, InstancedMesh, Matrix4, Quaternion, Vector3, type BufferGeometry } from 'three';
import type { Rng } from '@/engine/api';
import { col, type ColorLike } from '@/style';
import { Builder, KitModel, MatSet, type Slot } from '../core/builder';
import * as G from '../core/geo';
import { noise2, scatter, type ScatterPoint } from '../core/noise';
import type { Ground } from './flora';

export type CoverKind = 'grass' | 'flowers' | 'reeds' | 'rocks' | 'boulders';

export interface CoverOptions {
  kind: CoverKind;
  ground: Ground;
  rng: Rng;
  /** Scatter this many… */
  count?: number;
  /** …inside this disc (default: the whole ground)… */
  area?: { x: number; z: number; r: number };
  avoid?: readonly (readonly [number, number, number])[];
  minDist?: number;
  /** …or place exactly here (reeds along a shore, boulders by a road). */
  spots?: readonly ScatterPoint[];
  /** Allow spots in the water (reeds, rocks in a river). Default false. */
  wet?: boolean;
  /** Size multiplier. Default 1. */
  scale?: number;
}

const mix = (a: ColorLike, b: ColorLike, t: number): Color => col(a).lerp(col(b), t);

function variants(kind: CoverKind): { geos: BufferGeometry[]; slot: Slot; tints: Color[] } {
  const geos: BufferGeometry[] = [];
  if (kind === 'grass') {
    for (let v = 0; v < 2; v++) {
      const b = new Builder('tuft');
      const n = 5 + v * 2;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.283 + v;
        const lean = 0.25 + ((i * 0.37) % 1) * 0.45;
        const h = 0.55 + ((i * 0.61) % 1) * 0.5;
        b.cone(0.07, h, { seg: 3, tip: 0.012, slot: 'soft', at: [Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08], rot: [Math.sin(a) * lean, 0, -Math.cos(a) * lean], c: (p, _n, out) => out.setScalar(0.62 + 0.38 * (p.y / h)) });
      }
      geos.push(b.geometry('soft'));
    }
    return { geos, slot: 'soft', tints: [mix('lime', 'green', 0.35), col('lime'), mix('green', 'teal', 0.25), mix('lime', 'yellow', 0.3)] };
  }
  if (kind === 'flowers') {
    const heads: [ColorLike, ColorLike][] = [
      ['coral', 'ink'],
      ['blue', 'sky.light'],
      ['white', 'yellow'],
      ['yellow', 'orange'],
    ];
    for (const [petal, centre] of heads) {
      const b = new Builder('flowers');
      for (let i = 0; i < 3; i++) {
        const a = i * 2.2 + 0.4;
        const h = 0.45 + i * 0.14;
        const x = Math.cos(a) * 0.16;
        const z = Math.sin(a) * 0.16;
        b.cyl(0.018, h, { seg: 3, bevel: 0, slot: 'soft', c: mix('green', 'teal', 0.3), at: [x, 0, z] });
        b.sphere(0.11, { seg: 6, slot: 'soft', c: petal, at: [x, h, z], s: [1, 0.55, 1] });
        b.sphere(0.05, { seg: 5, slot: 'soft', c: centre, at: [x, h + 0.045, z] });
      }
      geos.push(b.geometry('soft'));
    }
    return { geos, slot: 'soft', tints: [col('white')] };
  }
  if (kind === 'reeds') {
    const b = new Builder('reeds');
    for (let i = 0; i < 5; i++) {
      const a = i * 1.9;
      const h = 1.5 + ((i * 0.43) % 1) * 0.9;
      const x = Math.cos(a) * 0.22;
      const z = Math.sin(a) * 0.22;
      const lean: [number, number, number] = [Math.sin(a) * 0.08, 0, -Math.cos(a) * 0.08];
      b.cyl(0.022, h, { seg: 4, bevel: 0, slot: 'soft', c: mix('green', 'lime', 0.3), at: [x, 0, z], rot: lean });
      if (i % 2 === 0) b.capsule(0.06, 0.36, { seg: 6, slot: 'soft', c: mix('wireBrown', 'ink', 0.35), at: [x - lean[2] * h, h * 0.97, z + lean[0] * h] });
    }
    return { geos: [b.geometry('soft')], slot: 'soft', tints: [col('white'), mix('white', 'lime', 0.3)] };
  }
  // rocks / boulders: faceted lumps (flat facets are intentional here), three silhouettes
  for (let v = 0; v < 3; v++) {
    const g = G.facet(1, kind === 'boulders' ? 1 : 0);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const k = 0.78 + 0.44 * noise2(p.getX(i) * 1.7 + v * 9, p.getY(i) * 1.7 + p.getZ(i) * 2.3, 40 + v);
      p.setXYZ(i, p.getX(i) * k, (p.getY(i) * k + 0.55) * (0.62 + v * 0.12), p.getZ(i) * k * (0.8 + v * 0.1));
    }
    g.computeVertexNormals();
    const b = new Builder('rock');
    b.add(g, { slot: 'facet', c: (q, _n, out) => out.setScalar(0.72 + 0.28 * Math.min(Math.max(q.y, 0), 1)) });
    geos.push(b.geometry('facet'));
  }
  return { geos, slot: 'facet', tints: [mix('steel', 'violet.light', 0.25), mix('mist', 'steel', 0.5), mix('slate', 'steel', 0.6)] };
}

const BASE_SIZE: Record<CoverKind, readonly [number, number]> = {
  grass: [0.8, 1.5],
  flowers: [0.9, 1.4],
  reeds: [0.8, 1.3],
  rocks: [0.3, 0.9],
  boulders: [1.2, 2.8],
};

/** Scatter (or place) ground cover of one kind. */
export function groundCover(o: CoverOptions): KitModel {
  const { ground, rng } = o;
  const points =
    o.spots ??
    scatter({
      count: o.count ?? 60,
      rng,
      area: o.area ?? { r: ground.radius },
      minDist: o.minDist ?? 0.8,
      avoid: o.avoid,
      accept: (x, z) => (ground.inside?.(x, z, 2) ?? true) && (o.wet || (ground.dry?.(x, z) ?? true)),
    });
  const { geos, slot, tints } = variants(o.kind);
  const mats = new MatSet();
  const group = new Group();
  group.name = o.kind;
  const buckets = geos.map(() => [] as { m: Matrix4; c: Color }[]);
  const q = new Quaternion();
  const e = new Euler();
  const [s0, s1] = BASE_SIZE[o.kind];
  for (const p of points) {
    const s = rng.range(s0, s1) * (o.scale ?? 1);
    q.setFromEuler(e.set(0, rng.range(0, 6.283), 0));
    const sink = slot === 'facet' ? 0.25 * s : 0.03;
    buckets[rng.int(0, geos.length - 1)]!.push({
      m: new Matrix4().compose(new Vector3(p.x, ground.heightAt(p.x, p.z) - sink, p.z), q, new Vector3(s, s * rng.range(0.85, 1.15), s)),
      c: rng.pick(tints).clone().multiplyScalar(rng.range(0.92, 1.05)),
    });
  }
  let triangles = 0;
  buckets.forEach((bucket, i) => {
    if (bucket.length === 0) return;
    const im = new InstancedMesh(geos[i]!, mats.get(slot), bucket.length);
    im.name = `${o.kind}:${i}`;
    bucket.forEach((it, k) => {
      im.setMatrixAt(k, it.m);
      im.setColorAt(k, it.c);
    });
    im.castShadow = o.kind !== 'grass' && o.kind !== 'flowers';
    im.receiveShadow = true;
    im.computeBoundingSphere();
    triangles += G.triangleCount(geos[i]!) * bucket.length;
    group.add(im);
  });
  return new KitModel(group, {}, {}, mats, triangles);
}
