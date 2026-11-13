/**
 * Train: electric locomotive pulling instanced wagons (coal gondolas, tank cars or passenger coaches) along a
 * track path — e.g. `rails.paths.centre`. The wagons are instanced (three draw calls for any train length).
 * Units: metres (toy-short wagons: 11 m pitch).
 */
import { Euler, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { col, type ColorLike } from '@/style';
import { Builder, type KitModel } from '../core/builder';
import * as G from '../core/geo';
import { noise2 } from '../core/noise';
import { placeOnPath, samplePath } from './motion';

const glass = () => col('blue.dark').lerp(col('sky'), 0.3);
const dark = () => col('ink').lerp(col('slate'), 0.3);

function bogies(b: Builder, zs: readonly number[]): void {
  for (const z of zs) {
    b.box(2.2, 0.5, 2.6, { r: 0.1, slot: 'gloss', c: dark(), at: [0, 0.3, z] });
    for (const dz of [-0.75, 0.75]) for (const s of [-1, 1]) b.cyl(0.46, 0.16, { axis: 'x', seg: 12, slot: 'gloss', c: 'slate', at: [s * 0.76 - 0.08, 0.46, z + dz] });
  }
}

/** Electric locomotive facing +Z, on the rail head (y = 0). Anchor `pantograph`. */
export function addLocomotive(b: Builder, color: ColorLike = 'coral'): void {
  const c = col(color);
  bogies(b, [-3.6, 3.6]);
  b.box(3.0, 3.0, 12.4, { r: 0.5, seg: 2, slot: 'gloss', c: [c.clone().multiplyScalar(0.8), c], at: [0, 0.85, 0] });
  b.box(3.04, 0.35, 12.44, { r: 0.1, slot: 'gloss', c: 'yellow', at: [0, 1.5, 0] });
  for (const s of [-1, 1]) {
    b.box(2.5, 0.9, 0.3, { r: 0.1, slot: 'gloss', c: glass(), at: [0, 2.55, s * 6.05] });
    for (const x of [-0.9, 0.9]) b.sphere(0.2, { seg: 8, slot: 'lamp', c: col('yellow').lerp(col('white'), 0.5), at: [x, 1.25, s * 6.2] });
    for (const sx of [-1, 1]) b.box(0.1, 0.8, 1.4, { r: 0.04, slot: 'gloss', c: glass(), at: [sx * 1.5, 2.6, s * 4.8] });
  }
  for (let i = 0; i < 5; i++) for (const sx of [-1, 1]) b.box(0.08, 0.9, 0.9, { r: 0, slot: 'gloss', c: dark(), at: [sx * 1.5, 2.4, -2.4 + i * 1.2] });
  b.box(2.2, 0.3, 9, { r: 0.1, slot: 'gloss', c: 'slate', at: [0, 3.85, 0] });
  // pantograph: base frame, two arms meeting at the knee, contact strip
  b.beam([0, 4.15, -1.2], [0, 5.0, 0.3], 0.1, { slot: 'gloss', c: 'slate' });
  b.beam([0, 5.0, 0.3], [0, 5.75, -0.9], 0.1, { slot: 'gloss', c: 'slate' });
  b.box(1.8, 0.1, 0.25, { r: 0, slot: 'gloss', c: 'orange', at: [0, 5.75, -0.9] });
  b.anchor('pantograph', 0, 5.85, -0.9);
}

export type WagonKind = 'coal' | 'tank' | 'passenger';

function wagon(kind: WagonKind, color: ColorLike | undefined): Builder {
  const b = new Builder('wagon');
  bogies(b, [-3.2, 3.2]);
  if (kind === 'coal') {
    const c = col(color ?? 'teal.dark');
    b.box(2.9, 2.0, 9.6, { r: 0.12, slot: 'gloss', c: [c.clone().multiplyScalar(0.8), c], at: [0, 0.85, 0] });
    for (let i = 0; i < 7; i++) for (const s of [-1, 1]) b.box(0.1, 1.9, 0.16, { r: 0, slot: 'gloss', c: c.clone().multiplyScalar(0.72), at: [s * 1.46, 0.9, -4.2 + i * 1.4] });
    for (let i = 0; i < 9; i++) b.add(G.facet(0.95, 0), { slot: 'facet', c: i % 2 ? 'ink' : dark(), at: [(noise2(i, 2) - 0.5) * 1.2, 2.75 + noise2(i, 5) * 0.25, -3.8 + i * 0.95], s: [1.3, 0.6, 1] });
  } else if (kind === 'tank') {
    const c = col(color ?? 'mist');
    b.capsule(1.35, 9.6, { axis: 'z', seg: 18, slot: 'gloss', c: [c.clone().multiplyScalar(0.8), c], at: [0, 2.3, 0] });
    b.box(2.4, 0.3, 9.4, { r: 0.08, slot: 'gloss', c: dark(), at: [0, 0.8, 0] });
    b.cyl(0.4, 0.5, { seg: 10, slot: 'gloss', c: dark(), at: [0, 3.55, 0] });
    b.ring(1.36, 0.1, { axis: 'z', seg: 18, tubeSeg: 5, slot: 'gloss', c: 'violet', at: [0, 2.3, 0], s: [1, 1, 3] });
  } else {
    const c = col(color ?? 'sky');
    b.box(3.0, 2.9, 10.2, { r: 0.4, seg: 2, slot: 'gloss', c: [c.clone().multiplyScalar(0.82), c], at: [0, 0.85, 0] });
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) b.box(0.1, 0.9, 1.1, { r: 0.04, slot: 'window', c: glass(), at: [s * 1.5, 2.2, -3.9 + i * 1.56] });
    b.box(3.04, 0.2, 10.24, { r: 0.08, slot: 'gloss', c: 'white', at: [0, 1.6, 0] });
  }
  return b;
}

export interface TrainOptions {
  /** Track centre line on the rail head (e.g. `rails(...).paths.centre`). */
  path: readonly Vector3[];
  mode?: 'loop' | 'pingpong';
  wagons?: number;
  kind?: WagonKind;
  color?: ColorLike;
  wagonColor?: ColorLike;
  /** m/s. Default 7. */
  speed?: number;
  offset?: number;
}

export interface Train extends KitModel {
  speed: number;
}

/** Part: `loco`. Anchor: `pantograph` (on the locomotive). */
export function train(o: TrainOptions): Train {
  const count = o.wagons ?? 8;
  const pitch = 11;
  const root = new Builder('train');
  const loco = root.part('loco');
  addLocomotive(loco, o.color);
  const model = root.build() as Train;
  const w = wagon(o.kind ?? 'coal', o.wagonColor);
  const slots = (o.kind ?? 'coal') === 'coal' ? (['gloss', 'facet'] as const) : (o.kind === 'passenger' ? (['gloss', 'window'] as const) : (['gloss'] as const));
  const meshes = slots.map((slot) => {
    const im = new InstancedMesh(w.geometry(slot), model.mats.get(slot), count);
    im.castShadow = true;
    im.frustumCulled = false;
    model.group.add(im);
    return im;
  });
  const sampler = samplePath(o.path, o.mode ?? 'loop');
  const p = new Vector3();
  const t = new Vector3();
  const q = new Quaternion();
  const e = new Euler();
  const m = new Matrix4();
  const one = new Vector3(1, 1, 1);
  const offset = o.offset ?? 0;
  model.speed = o.speed ?? 7;
  let travelled = offset;
  model.update = (dt) => {
    travelled += model.speed * dt;
    placeOnPath(model.part('loco'), sampler, travelled);
    for (let i = 0; i < count; i++) {
      // in ping-pong mode the consist reverses: wagons keep trailing on the same track
      sampler.at(travelled - 12.2 - i * pitch, p, t);
      m.compose(p, q.setFromEuler(e.set(-Math.asin(Math.max(-1, Math.min(1, t.y))), Math.atan2(t.x, t.z), 0, 'YXZ')), one);
      for (const im of meshes) im.setMatrixAt(i, m);
    }
    for (const im of meshes) im.instanceMatrix.needsUpdate = true;
  };
  model.update(0, 0);
  return model;
}
