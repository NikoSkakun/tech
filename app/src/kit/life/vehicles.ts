/**
 * Tiny vehicles for scale and life: car, van, truck, tractor, boat, ship. Each is two meshes (body + head
 * lamps that switch on at night) and faces +Z; move them with `placeOnPath` from `life/motion` or the
 * `traffic` helper below. Chunky toy proportions. Units: metres.
 */
import type { Vector3 } from 'three';
import type { Rng } from '@/engine/api';
import { col, type ColorLike } from '@/style';
import { Builder, type KitModel, MatSet } from '../core/builder';
import { placeOnPath, samplePath } from './motion';

export type VehicleKind = 'car' | 'van' | 'truck' | 'tractor' | 'boat' | 'ship';

const glass = () => col('blue.dark').lerp(col('sky'), 0.3);
const tyre = () => col('ink').lerp(col('slate'), 0.2);

function wheels(b: Builder, spots: readonly (readonly [number, number])[], r: number, track: number): void {
  for (const [z, k] of spots) {
    for (const s of [-1, 1]) {
      b.cyl(r * k, 0.24 * k, { axis: 'x', seg: 18, slot: 'gloss', c: tyre(), at: [s * track - 0.12 * k, r * k, z], bevel: 0.05 });
      b.cyl(r * k * 0.5, 0.26 * k, { axis: 'x', seg: 8, slot: 'gloss', c: 'mist', at: [s * track - 0.13 * k, r * k, z], bevel: 0.02 });
    }
  }
}

function lamps(b: Builder, y: number, z: number, x: number): void {
  for (const s of [-1, 1]) {
    b.sphere(0.11, { seg: 8, slot: 'lamp', c: col('yellow').lerp(col('white'), 0.5), at: [s * x, y, z] });
    b.box(0.2, 0.1, 0.05, { r: 0, slot: 'gloss', c: 'red', at: [s * x, y, -z] });
  }
}

/** Adds one vehicle at the frame origin (ground level), facing +Z. */
export function addVehicle(b: Builder, kind: VehicleKind, color?: ColorLike): void {
  const c = col(color ?? (kind === 'ship' ? 'coral' : kind === 'tractor' ? 'green' : 'teal'));
  const cc = [c.clone().multiplyScalar(0.8), c] as const;
  if (kind === 'car') {
    b.box(1.8, 0.7, 4.2, { r: 0.28, seg: 2, slot: 'gloss', c: cc, at: [0, 0.32, 0] });
    b.box(1.6, 0.62, 2.2, { r: 0.26, seg: 2, slot: 'gloss', c: glass(), at: [0, 0.92, -0.25] });
    b.box(1.66, 0.14, 1.8, { r: 0.06, slot: 'gloss', c, at: [0, 1.46, -0.25] });
    wheels(b, [[1.3, 1], [-1.3, 1]], 0.36, 0.86);
    lamps(b, 0.72, 2.08, 0.6);
  } else if (kind === 'van') {
    b.box(2.0, 1.9, 5.0, { r: 0.3, seg: 2, slot: 'gloss', c: cc, at: [0, 0.35, 0] });
    b.box(1.9, 0.7, 0.2, { r: 0.08, slot: 'gloss', c: glass(), at: [0, 1.35, 2.42] });
    for (const s of [-1, 1]) b.box(0.1, 0.6, 1.1, { r: 0.04, slot: 'gloss', c: glass(), at: [s * 0.97, 1.4, 1.6] });
    b.box(1.5, 0.5, 0.06, { r: 0, slot: 'gloss', c: 'yellow', at: [0, 0.95, -2.5] });
    wheels(b, [[1.6, 1.1], [-1.5, 1.1]], 0.38, 0.96);
    lamps(b, 0.85, 2.48, 0.7);
  } else if (kind === 'truck') {
    b.box(2.3, 2.0, 2.2, { r: 0.3, seg: 2, slot: 'gloss', c: cc, at: [0, 0.6, 2.4] });
    b.box(2.1, 0.8, 0.2, { r: 0.08, slot: 'gloss', c: glass(), at: [0, 1.6, 3.42] });
    b.box(2.4, 2.4, 5.4, { r: 0.12, slot: 'gloss', c: ['mist', 'white'], at: [0, 0.95, -1.5] });
    b.box(2.2, 0.3, 7.6, { r: 0.08, slot: 'gloss', c: 'slate', at: [0, 0.6, -0.4] });
    wheels(b, [[2.5, 1.3], [-1.5, 1.3], [-2.9, 1.3]], 0.4, 1.06);
    lamps(b, 1.0, 3.5, 0.8);
  } else if (kind === 'tractor') {
    b.box(1.3, 0.9, 2.4, { r: 0.2, seg: 2, slot: 'gloss', c: cc, at: [0, 0.9, 0.9] });
    b.box(1.5, 1.5, 1.5, { r: 0.18, slot: 'gloss', c: glass(), at: [0, 1.2, -0.7] });
    b.box(1.6, 0.14, 1.7, { r: 0.06, slot: 'gloss', c, at: [0, 2.7, -0.7] });
    b.cyl(0.07, 1.0, { seg: 6, slot: 'gloss', c: 'slate', at: [0.45, 1.8, 1.5] });
    wheels(b, [[1.7, 1.0], [-0.8, 2.0]], 0.42, 0.9);
    lamps(b, 1.5, 2.1, 0.45);
  } else if (kind === 'boat') {
    b.box(2.2, 0.9, 6.0, { r: 0.4, seg: 2, slot: 'gloss', c: cc, at: [0, -0.3, 0] });
    b.box(1.9, 0.12, 5.4, { r: 0.05, slot: 'gloss', c: 'white', at: [0, 0.56, 0] });
    b.box(1.5, 1.1, 2.0, { r: 0.2, slot: 'gloss', c: 'white', at: [0, 0.6, -0.6] });
    b.box(1.54, 0.45, 1.6, { r: 0.08, slot: 'gloss', c: glass(), at: [0, 1.05, -0.6] });
    b.cyl(0.04, 1.6, { seg: 5, slot: 'gloss', c: 'slate', at: [0, 1.7, -0.6] });
    lamps(b, 0.75, 2.9, 0.5);
  } else {
    // bulk carrier / coaster: hull, deck hatches, bridge at the stern, funnel
    b.box(9, 4.5, 46, { r: 1.6, seg: 2, slot: 'gloss', c: cc, at: [0, -2.6, 0] });
    b.box(8.6, 0.5, 44, { r: 0.2, slot: 'gloss', c: 'slate', at: [0, 1.7, 0] });
    for (let i = 0; i < 4; i++) b.box(6.4, 1.0, 6.4, { r: 0.25, slot: 'gloss', c: ['orange.dark', 'orange'], at: [0, 2.1, 14 - i * 7.6] });
    b.box(8.0, 6.5, 6.5, { r: 0.4, slot: 'gloss', c: ['mist', 'white'], at: [0, 2.1, -18] });
    b.box(8.3, 1.3, 1.0, { r: 0.1, slot: 'gloss', c: glass(), at: [0, 6.6, -15.2] });
    b.cyl(1.2, 3.4, { seg: 14, slot: 'gloss', c: 'ink', at: [0, 8.5, -19.5] });
    b.ring(1.22, 0.3, { seg: 14, tubeSeg: 5, slot: 'gloss', c: 'yellow', at: [0, 10.6, -19.5], s: [1, 1.6, 1] });
    b.cyl(0.12, 6, { seg: 6, slot: 'gloss', c: 'slate', at: [0, 2.1, 20] });
    lamps(b, 7.9, 14.2, 3.2);
    b.anchor('funnel', 0, 12.2, -19.5);
  }
}

export function vehicle(kind: VehicleKind, color?: ColorLike): KitModel {
  const b = new Builder(kind);
  addVehicle(b, kind, color);
  return b.build();
}

export interface TrafficItem {
  kind: VehicleKind;
  /** Route (e.g. `road.paths.laneRight`). */
  path: readonly Vector3[];
  /** `loop` for closed circuits, `pingpong` (default) to drive there and back. */
  mode?: 'loop' | 'pingpong';
  /** m/s. Defaults: car 9, van 8, truck 6, tractor 3, boat 4, ship 2. */
  speed?: number;
  /** Starting distance along the path. */
  offset?: number;
  color?: ColorLike;
}

const SPEED: Record<VehicleKind, number> = { car: 9, van: 8, truck: 6, tractor: 3, boat: 4, ship: 2 };
const COLORS = ['coral', 'teal', 'yellow', 'sky', 'violet', 'orange', 'white'] as const;

/** Several vehicles driving along their paths; one shared material set (so `night` lights them all). */
export function traffic(items: readonly TrafficItem[], rng: Rng): KitModel {
  const mats = new MatSet();
  const root = new Builder('traffic', mats);
  const movers = items.map((it) => {
    const b = new Builder(it.kind, mats);
    addVehicle(b, it.kind, it.color ?? (it.kind === 'ship' ? undefined : rng.pick(COLORS)));
    const model = b.build();
    root.attach(model.group);
    const sampler = samplePath(it.path, it.mode ?? 'pingpong');
    return { model, sampler, speed: it.speed ?? SPEED[it.kind], offset: it.offset ?? rng.range(0, sampler.length), bob: it.kind === 'boat' || it.kind === 'ship' };
  });
  const out = root.build();
  out.update = (_dt, t) => {
    for (const m of movers) {
      placeOnPath(m.model.group, m.sampler, m.offset + t * m.speed);
      if (m.bob) m.model.group.rotation.z = Math.sin(t * 0.9 + m.offset) * 0.03;
    }
  };
  out.update(0, 0);
  return out;
}
