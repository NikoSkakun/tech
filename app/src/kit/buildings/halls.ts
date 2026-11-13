/**
 * Industrial buildings: factory hall (saw-tooth or gable roof, clerestory window bands, sliding gates, roof
 * vents), warehouse (ribbed walls, loading docks) and a control-room building. Front (gates) faces +Z, the long
 * axis runs along X. Units: metres.
 */
import { Rng } from '@/engine/api';
import { col, type ColorLike } from '@/style';
import { Builder, type KitModel } from '../core/builder';
import * as G from '../core/geo';
import { addDoor, addWindow, onWall } from './parts';

const glass = () => col('blue.dark').lerp(col('sky'), 0.3);

export interface HallOptions {
  length?: number;
  width?: number;
  height?: number;
  /** `sawtooth` north-light roof, `gable` shallow pitch, or `flat`. */
  roof?: 'sawtooth' | 'gable' | 'flat';
  color?: ColorLike;
  accent?: ColorLike;
  lit?: number;
  seed?: number;
}

/** Anchors: `gate`, `roof`, `ventN` (roof ventilators — steam / heat shimmer start here). */
export function addFactoryHall(b: Builder, o: HallOptions = {}): void {
  const rng = new Rng((o.seed ?? 1) * 6151 + 5);
  const L = o.length ?? 40;
  const W = o.width ?? 18;
  const H = o.height ?? 10;
  const kind = o.roof ?? 'sawtooth';
  const wall = col(o.color ?? col('mist').lerp(col('sky.light'), 0.25));
  const accent = col(o.accent ?? 'coral');
  const lit = o.lit ?? 0.6;
  b.box(L + 0.5, 1.2, W + 0.5, { r: 0.1, slot: 'matte', c: col('steel').lerp(col('violet'), 0.15), at: [0, -0.1, 0] });
  b.box(L, H, W, { r: 0.15, c: [wall.clone().multiplyScalar(0.84), wall], at: [0, 1, 0] });
  b.box(L + 0.06, 0.5, W + 0.06, { r: 0, c: accent, at: [0, 1 + H * 0.52, 0] });
  // pilasters and clerestory window band on the long sides
  const bays = Math.max(3, Math.round(L / 6));
  for (let i = 0; i <= bays; i++) {
    const x = (i / bays - 0.5) * (L - 0.5);
    for (const s of [-1, 1]) b.box(0.5, H + 0.2, 0.3, { r: 0.06, c: wall.clone().multiplyScalar(0.92), at: [x, 1, s * (W / 2 + 0.05)] });
  }
  for (let i = 0; i < bays; i++) {
    const x = ((i + 0.5) / bays - 0.5) * (L - 0.5);
    for (const s of [-1, 1]) {
      b.box(L / bays - 1.2, H * 0.22, 0.1, { r: 0, slot: rng.next() < lit ? 'window' : 'gloss', c: glass(), at: [x, 1 + H * 0.66, s * (W / 2 + 0.02)] });
      b.box(L / bays - 1.0, 0.1, 0.14, { r: 0, c: 'white', at: [x, 1 + H * 0.66 - 0.1, s * (W / 2 + 0.03)] });
    }
  }
  // sliding gate with a wicket door, on the front
  const gx = -L * 0.25;
  b.box(5.2, 5.6, 0.2, { r: 0.05, c: [accent.clone().multiplyScalar(0.8), accent], at: [gx, 1, W / 2 + 0.06] });
  for (let i = 0; i < 4; i++) b.box(0.08, 5.4, 0.06, { r: 0, c: accent.clone().multiplyScalar(0.7), at: [gx - 1.9 + i * 1.27, 1.1, W / 2 + 0.18] });
  b.box(6.2, 0.2, 0.3, { r: 0.04, slot: 'metal', c: 'slate', at: [gx + 0.4, 6.7, W / 2 + 0.1] });
  onWall(b, [gx + 4.6, 1, W / 2], 0, () => addDoor(b, { c: 'slate', steps: 0, lamp: true }));
  b.anchor('gate', gx, 1, W / 2 + 3);
  const top = 1 + H;
  if (kind === 'sawtooth') {
    const teeth = Math.max(3, Math.round(L / 8));
    const tw = L / teeth;
    const rise = tw * 0.42;
    for (let i = 0; i < teeth; i++) {
      const x0 = -L / 2 + i * tw;
      // one tooth: steep glazed face toward −X, long slope toward +X
      b.add(G.extrude([[0, 0], [tw, 0], [0.5, rise]] as G.Pt[], W - 0.2, { bevel: 0.08 }), { slot: 'matte', c: [wall.clone().multiplyScalar(0.72), wall.clone().multiplyScalar(0.9)], at: [x0, top - 0.02, 0] });
      b.box(0.08, rise * 0.62, W - 1.6, { r: 0, slot: rng.next() < lit ? 'window' : 'gloss', c: glass(), at: [x0 + 0.2, top + rise * 0.16, 0], rot: [0, 0, -0.42] });
    }
    b.anchor('roof', 0, top + rise, 0);
  } else if (kind === 'gable') {
    const rise = W * 0.14;
    b.add(G.extrude([[-W / 2 - 0.4, 0], [W / 2 + 0.4, 0], [0, rise]] as G.Pt[], L + 0.6, { bevel: 0.1 }), { slot: 'matte', c: [wall.clone().multiplyScalar(0.7), wall.clone().multiplyScalar(0.86)], at: [0, top - 0.02, 0], rot: [0, Math.PI / 2, 0] });
    b.box(L * 0.8, 0.7, 1.6, { r: 0.1, c: wall.clone().multiplyScalar(0.8), at: [0, top + rise - 0.2, 0] });
    b.anchor('roof', 0, top + rise + 0.5, 0);
  } else {
    b.box(L + 0.3, 0.5, W + 0.3, { r: 0.08, c: wall.clone().multiplyScalar(0.8), at: [0, top - 0.1, 0] });
    b.anchor('roof', 0, top + 0.4, 0);
  }
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * L * 0.3 + (kind === 'sawtooth' ? L / Math.max(3, Math.round(L / 8)) / 2 : 0);
    const y = top + (kind === 'gable' ? W * 0.14 + 0.45 : kind === 'sawtooth' ? 1.2 : 0.4);
    if (kind !== 'sawtooth') {
      b.cyl(0.6, 0.9, { seg: 12, slot: 'metal', c: 'steel.light', at: [x, y, 0] });
      b.dome(0.8, 0.45, { seg: 12, slot: 'metal', c: 'steel', at: [x, y + 0.9, 0] });
    }
    b.anchor(`vent${i + 1}`, x, y + 1.4, 0);
  }
}

export function factoryHall(o: HallOptions = {}): KitModel {
  const b = new Builder('factory-hall');
  addFactoryHall(b, o);
  return b.build();
}

/** Warehouse: ribbed metal box with a shallow curved roof and loading docks. Anchors: `dockN`, `roof`. */
export function addWarehouse(b: Builder, o: { length?: number; width?: number; height?: number; color?: ColorLike; docks?: number } = {}): void {
  const L = o.length ?? 30;
  const W = o.width ?? 16;
  const H = o.height ?? 7;
  const wall = col(o.color ?? col('sky.light').lerp(col('mist'), 0.4));
  b.box(L, H, W, { r: 0.12, c: [wall.clone().multiplyScalar(0.84), wall], at: [0, 0, 0] });
  const ribs = Math.round(L / 1.5);
  for (let i = 0; i <= ribs; i++) for (const s of [-1, 1]) b.box(0.18, H - 0.3, 0.1, { r: 0, c: wall.clone().multiplyScalar(0.9), at: [(i / ribs - 0.5) * (L - 0.6), 0.1, s * (W / 2 + 0.02)] });
  // barrel roof: a flattened half cylinder along X
  b.add(G.cyl(W / 2 + 0.3, L + 0.5, { seg: 24, bevel: 0.1 }), { slot: 'matte', c: [wall.clone().multiplyScalar(0.7), wall.clone().multiplyScalar(0.92)], at: [-L / 2 - 0.25, H - 0.05, 0], rot: [0, 0, -Math.PI / 2], s: [0.22, 1, 1] });
  const docks = o.docks ?? 3;
  for (let i = 0; i < docks; i++) {
    const x = ((i + 0.5) / docks - 0.5) * L * 0.7;
    b.box(3.4, 1.1, 2.2, { r: 0.06, slot: 'matte', c: 'steel.light', at: [x, 0, W / 2 + 1.1] });
    b.box(3.0, 3.4, 0.14, { r: 0.04, c: 'white', at: [x, 1.1, W / 2 + 0.04] });
    for (let k = 0; k < 6; k++) b.box(2.9, 0.05, 0.05, { r: 0, c: 'mist', at: [x, 1.4 + k * 0.5, W / 2 + 0.13] });
    b.box(3.4, 0.5, 0.3, { r: 0.05, c: 'yellow', at: [x, 4.6, W / 2 + 0.1] });
    b.anchor(`dock${i + 1}`, x, 1.1, W / 2 + 2.4);
  }
  b.anchor('roof', 0, H + W * 0.11, 0);
}

export function warehouse(o: Parameters<typeof addWarehouse>[1] = {}): KitModel {
  const b = new Builder('warehouse');
  addWarehouse(b, o);
  return b.build();
}

/** Control-room building: flat roof, panoramic window band, door, AC units, antenna mast. Anchors: `door`, `roof`, `window`. */
export function addControlRoom(b: Builder, o: { width?: number; depth?: number; color?: ColorLike } = {}): void {
  const W = o.width ?? 12;
  const D = o.depth ?? 7;
  const H = 3.6;
  const wall = col(o.color ?? 'white');
  b.box(W + 0.3, 0.5, D + 0.3, { r: 0.08, slot: 'matte', c: 'steel', at: [0, -0.1, 0] });
  b.box(W, H, D, { r: 0.14, seg: 2, c: [wall.clone().multiplyScalar(0.86), wall], at: [0, 0.4, 0] });
  b.box(W + 0.5, 0.3, D + 0.5, { r: 0.1, c: 'teal', at: [0, 0.4 + H - 0.05, 0] });
  b.box(W * 0.6, 1.4, 0.12, { r: 0.04, slot: 'window', c: glass(), at: [W * 0.12, 1.9, D / 2 + 0.02] });
  for (let i = 1; i < 4; i++) b.box(0.08, 1.4, 0.06, { r: 0, c: 'white', at: [W * 0.12 - W * 0.3 + (i * W * 0.6) / 4, 1.9, D / 2 + 0.08] });
  b.anchor('window', W * 0.12, 2.6, D / 2 + 0.2);
  onWall(b, [-W * 0.36, 0.4, D / 2], 0, () => addDoor(b, { c: 'teal', steps: 1, canopy: 'teal' }));
  b.anchor('door', -W * 0.36, 1.4, D / 2 + 1);
  for (const side of [-1, 1]) onWall(b, [side * (W / 2), 2.3, 0], (side * Math.PI) / 2, () => addWindow(b, { shutters: false, w: 1.6, h: 1.2 }));
  for (const x of [-2, 1]) {
    b.box(1.5, 0.9, 1.1, { r: 0.08, slot: 'metal', c: 'steel.light', at: [x, 0.4 + H + 0.25, -1] });
    b.cyl(0.36, 0.06, { seg: 10, slot: 'metal', c: 'slate', at: [x, 0.4 + H + 1.15, -1] });
  }
  b.cyl(0.05, 4.5, { seg: 6, slot: 'metal', c: 'slate', at: [W * 0.35, 0.4 + H + 0.2, -D * 0.2], bevel: 0 });
  b.dome(0.55, 0.3, { seg: 12, slot: 'gloss', c: 'white', at: [W * 0.35 - 0.9, 0.4 + H + 0.9, -D * 0.2], rot: [0.9, 0, 0] });
  b.sphere(0.12, { seg: 8, slot: 'glow', c: 'red', at: [W * 0.35, 0.4 + H + 4.8, -D * 0.2] });
  b.anchor('roof', 0, 0.4 + H + 0.3, 0);
}

export function controlRoom(o: Parameters<typeof addControlRoom>[1] = {}): KitModel {
  const b = new Builder('control-room');
  addControlRoom(b, o);
  return b.build();
}
