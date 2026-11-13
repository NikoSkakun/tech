/**
 * Shell of the shared cutaway house (`docs/volumes/<volume>/chapters/_shared-house.md` §1): two storeys, 10 × 8 m, the south
 * (+Z) facade and the roof as removable parts, a spine wall with the showcase rooms in front of it, stair,
 * balcony.
 * Units: metres; origin = centre of the footprint on the ground.
 */
import { col, type ColorLike } from '@/style';
import type { Builder } from '../core/builder';
import * as G from '../core/geo';
import { addChimney, addDoor, addRoof, addWindow, onWall } from '../buildings/parts';

/** Fixed dimensions of the shared house. */
export const HOUSE = {
  W: 10,
  D: 8,
  /** Wall thickness (outer) and partition thickness. */
  t: 0.3,
  p: 0.14,
  /** Floor levels: ground floor, first floor, eaves. */
  F0: 0.3,
  F1: 3.25,
  eaves: 5.85,
  /** Roof pitch of both slopes: 35° (the south slope carries the PV array). */
  pitch: (35 * Math.PI) / 180,
  /**
   * Partition lines. A spine wall at z = zS runs across the house: the three showcase rooms of each storey lie
   * in front of it (toward the cut), so everything worth seeing hangs on a wall that faces the viewer.
   */
  xA: -1.3,
  xB: 1.9,
  zS: 0,
} as const;

/** Wall along an axis with door openings: segments between the openings plus lintels above them. */
export function addPartition(
  b: Builder,
  axis: 'x' | 'z',
  pos: number,
  from: number,
  to: number,
  y0: number,
  h: number,
  openings: readonly (readonly [number, number])[],
  c: ColorLike,
  t: number = HOUSE.p,
): void {
  const cuts = [...openings].sort((p, q) => p[0] - q[0]);
  const piece = (a: number, e: number, y: number, hh: number): void => {
    if (e - a < 0.02) return;
    const len = e - a;
    const mid = (a + e) / 2;
    if (axis === 'x') b.box(t, hh, len, { r: 0.03, c, at: [pos, y, mid] });
    else b.box(len, hh, t, { r: 0.03, c, at: [mid, y, pos] });
  };
  let cursor = from;
  for (const [a, e] of cuts) {
    piece(cursor, a, y0, h);
    piece(a, e, y0 + 2.05, h - 2.05);
    cursor = e;
  }
  piece(cursor, to, y0, h);
}

/** Window that goes through an outer wall: glass visible (and lit) from both sides, frames on both faces. */
export function addThroughWindow(b: Builder, w = 1.3, h = 1.3): void {
  const t = HOUSE.t;
  b.box(w, h, t + 0.04, { r: 0, mid: true, slot: 'window', c: col('blue.dark').lerp(col('sky'), 0.4) });
  for (const s of [-1, 1]) {
    b.box(w + 0.2, h + 0.2, 0.06, { r: 0.03, mid: true, c: 'white', at: [0, 0, s * (t / 2 + 0.005)] });
    b.box(w, h, 0.07, { r: 0, mid: true, slot: 'window', c: col('blue.dark').lerp(col('sky'), 0.4), at: [0, 0, s * (t / 2 + 0.01)] });
    b.box(0.06, h, 0.03, { r: 0, mid: true, c: 'white', at: [0, 0, s * (t / 2 + 0.045)] });
    b.box(w + 0.36, 0.08, 0.2, { r: 0.03, mid: true, c: 'white', at: [0, -h / 2 - 0.12, s * (t / 2 + 0.06)] });
  }
}

export interface ShellOptions {
  wall?: ColorLike;
  roofColor?: ColorLike;
  trim?: ColorLike;
}

/** Builds the shell into `b` and returns the two removable parts for the caller to add equipment to. */
export function addHouseShell(b: Builder, o: ShellOptions = {}): { roof: Builder; front: Builder } {
  const { W, D, t, F0, F1, eaves, xA, xB, zS } = HOUSE;
  const wall = col(o.wall ?? 'yellow.light');
  const inner = col('white');
  const wallC = [wall.clone().multiplyScalar(0.86), wall] as const;
  const x0 = -W / 2 + t;
  const x1 = W / 2 - t;
  const z0 = -D / 2 + t;
  // plinth and ground slab; first-floor slab with the stair well behind the spine wall
  b.box(W + 0.3, F0 + 0.2, D + 0.3, { r: 0.08, slot: 'matte', c: col('steel').lerp(col('violet'), 0.15), at: [0, -0.2, 0] });
  const slab = col('mist').lerp(col('white'), 0.3);
  const sh = F1 - 3.0;
  b.box(W - 0.2, sh, D / 2 - zS, { r: 0.03, c: slab, at: [0, 3.0, (D / 2 + zS) / 2 - 0.05] });
  b.box(xA - x0 + t, sh, zS - z0 + t, { r: 0.03, c: slab, at: [(xA + x0 - t) / 2, 3.0, (zS + z0 - t) / 2] });
  b.box(x1 - xB + t, sh, zS - z0 + t, { r: 0.03, c: slab, at: [(xB + x1 + t) / 2, 3.0, (zS + z0 - t) / 2] });
  b.box(xB - xA, sh, 1.1, { r: 0.03, c: slab, at: [(xA + xB) / 2, 3.0, zS - 0.55] });
  // outer walls: back, left, right (the south facade is the `front` part), corner trims, inner lining
  b.box(W, eaves, t, { r: 0.06, c: wallC, at: [0, 0, -D / 2 + t / 2] });
  for (const s of [-1, 1]) b.box(t, eaves, D - t, { r: 0.06, c: wallC, at: [s * (W / 2 - t / 2), 0, t / 2] });
  for (const s of [-1, 1]) b.box(0.14, eaves, 0.14, { r: 0.04, c: o.trim ?? 'white', at: [s * (W / 2 - 0.02), 0, D / 2 - 0.05] });
  b.box(W - 2 * t, eaves - F0, 0.03, { r: 0, c: inner, at: [0, F0, z0 + 0.015] });
  for (const s of [-1, 1]) b.box(0.03, eaves - F0, D - t, { r: 0, c: inner, at: [s * (x1 - 0.015), F0, t / 2] });
  // spine wall and cross partitions on both storeys (door openings: [from, to] along the wall)
  for (const [y, h] of [[F0, 3.0 - F0], [F1, eaves - F1]] as const) {
    addPartition(b, 'z', zS, x0, x1, y, h, [[-3.9, -3.0], [3.7, 4.5]], inner);
    for (const x of [xA, xB]) {
      addPartition(b, 'x', x, zS, D / 2, y, h, [[2.3, 3.2]], inner);
      addPartition(b, 'x', x, z0, zS, y, h, [], inner);
    }
  }
  // stair in the back zone: straight flight along X
  const steps = 14;
  const rise = (F1 - F0) / steps;
  const wood = col('wireBrown').lerp(col('yellow.light'), 0.35);
  for (let i = 0; i < steps; i++) b.box(0.21, rise * (i + 1), 1.0, { r: 0.02, c: i % 2 ? wood : wood.clone().multiplyScalar(0.9), at: [xA + 0.3 + i * 0.2, F0, -2.2] });
  // balcony on the east wall (first floor) with a railing
  b.box(1.3, 0.16, 2.6, { r: 0.05, c: slab, at: [W / 2 + 0.65, F1 - 0.16, 2.0] });
  for (let i = 0; i <= 5; i++) b.cyl(0.03, 1.0, { seg: 5, slot: 'metal', c: 'slate', at: [W / 2 + 1.22, F1, 0.8 + i * 0.48], bevel: 0 });
  for (const z of [0.8, 3.2]) b.cyl(0.03, 1.0, { seg: 5, slot: 'metal', c: 'slate', at: [W / 2 + 0.65, F1, z], bevel: 0 });
  b.beam([W / 2 + 1.22, F1 + 1.02, 0.75], [W / 2 + 1.22, F1 + 1.02, 3.25], 0.07, { slot: 'metal', c: 'slate' });
  for (const z of [0.78, 3.22]) b.beam([W / 2, F1 + 1.02, z], [W / 2 + 1.25, F1 + 1.02, z], 0.07, { slot: 'metal', c: 'slate' });
  // through-windows in the back and side walls
  for (const y of [F0 + 1.5, F1 + 1.45]) {
    for (const x of [-3.2, 3.4]) b.frame({ at: [x, y, -D / 2 + t / 2] }, () => addThroughWindow(b));
    b.frame({ at: [-W / 2 + t / 2, y, 2.0], rot: [0, Math.PI / 2, 0] }, () => addThroughWindow(b, 1.1, 1.3));
  }
  b.frame({ at: [W / 2 - t / 2, F0 + 1.5, 2.0], rot: [0, Math.PI / 2, 0] }, () => addThroughWindow(b, 1.1, 1.3));
  b.frame({ at: [W / 2 - t / 2, F1 + 1.05, 2.0], rot: [0, Math.PI / 2, 0] }, () => addThroughWindow(b, 0.9, 2.05));
  // roof (part): 35° gable with gable walls and a chimney
  const roof = b.part('roof', { at: [0, eaves, 0] });
  const riseR = (D / 2) * Math.tan(HOUSE.pitch);
  addRoof(roof, 'gable', W, D, riseR, o.roofColor ?? 'coral', 0.5);
  for (const s of [-1, 1]) roof.add(G.extrude([[-D / 2, 0], [D / 2, 0], [0, riseR - 0.1]] as G.Pt[], t, { bevel: 0.03 }), { c: wall, at: [s * (W / 2 - t / 2), 0, 0], rot: [0, (s * Math.PI) / 2, 0] });
  roof.frame({ at: [-3.4, riseR * 0.45, -1.6] }, () => addChimney(roof, riseR * 0.5 + 0.9), 'chimney.');
  // south facade (part): door with porch, windows on both storeys
  const front = b.part('front', { at: [0, 0, D / 2 - t / 2] });
  front.box(W - 0.3, eaves, t, { r: 0.05, c: wallC, at: [0, 0, 0] });
  front.box(W - 0.2, 0.12, t + 0.06, { r: 0.03, c: o.trim ?? 'white', at: [0, 3.0, 0] });
  onWall(front, [0.3, F0, t / 2], 0, () => addDoor(front, { c: 'teal', steps: 2, canopy: o.roofColor ?? 'coral', glazed: true }));
  for (const [x, y] of [[-3.2, F0 + 1.5], [3.5, F0 + 1.5], [-3.2, F1 + 1.45], [0.3, F1 + 1.45], [3.5, F1 + 1.45]] as const) {
    onWall(front, [x, y, t / 2], 0, () => addWindow(front, { w: 1.4, h: 1.3, shutters: 'teal', flowers: y < 3 }));
  }
  return { roof, front };
}
