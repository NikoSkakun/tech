/**
 * Parametric detached house: 1–2 floors, gable / hip / flat / shed roof, door with porch, windows with
 * shutters and flower boxes (a seeded share of them lit at night), chimney, gutters and downpipe, service
 * mast and meter box for the 0.4 kV connection. Front faces +Z, ridge along X. Units: metres.
 *
 * Anchors: `door`, `lamp` (porch lamp), `service` (overhead service entrance), `meter`, `chimney.smoke`, `roof`.
 */
import { Rng } from '@/engine/api';
import { col, type ColorLike } from '@/style';
import { Builder, type KitModel } from '../core/builder';
import * as G from '../core/geo';
import { addChimney, addDoor, addRoof, addWindow, gableGeometry, onWall, type RoofKind } from './parts';

export interface HouseOptions {
  width?: number;
  depth?: number;
  floors?: 1 | 2;
  roof?: RoofKind;
  wall?: ColorLike;
  roofColor?: ColorLike;
  door?: ColorLike;
  shutters?: ColorLike | false;
  chimney?: boolean;
  flowers?: boolean;
  /** Share of windows that light up at night, 0…1. Default 0.7. */
  lit?: number;
  /** Picks colours and details not given explicitly. */
  seed?: number;
}

const WALLS = ['white', 'yellow.light', 'sky.light', 'pink.light', 'mist', 'orange.light', 'lime.light'] as const;
const ROOFS = ['coral', 'red', 'violet', 'teal.dark', 'orange', 'blue'] as const;
const DOORS = ['teal', 'coral', 'yellow', 'blue', 'violet'] as const;

export function addHouse(b: Builder, o: HouseOptions = {}): void {
  const rng = new Rng((o.seed ?? 1) * 7919 + 13);
  const W = o.width ?? 8;
  const D = o.depth ?? 7;
  const floors = o.floors ?? 1;
  const kind = o.roof ?? 'gable';
  const wall = col(o.wall ?? rng.pick(WALLS));
  const roof = o.roofColor ?? rng.pick(ROOFS);
  const shutters = o.shutters ?? (rng.next() < 0.55 ? rng.pick(DOORS) : false);
  const floorH = 2.9;
  const H = floors * floorH + 0.25;
  const base = 0.45;
  const lit = o.lit ?? 0.7;
  // plinth, walls, floor band, corner trim
  b.box(W + 0.25, base + 0.1, D + 0.25, { r: 0.08, slot: 'matte', c: col('steel').lerp(col('violet'), 0.15), at: [0, -0.1, 0] });
  b.box(W, H, D, { r: 0.12, seg: 2, c: [wall.clone().multiplyScalar(0.84), wall], at: [0, base, 0] });
  if (floors === 2) b.box(W + 0.08, 0.14, D + 0.08, { r: 0.03, c: 'white', at: [0, base + floorH, 0] });
  const eaves = base + H;
  const rise = kind === 'flat' ? 0 : kind === 'hip' ? D * 0.36 : kind === 'shed' ? D * 0.28 : D * 0.44;
  b.frame({ at: [0, eaves, 0] }, () => addRoof(b, kind, W, D, rise, roof));
  for (const side of kind === 'gable' || kind === 'shed' ? [-1, 1] : []) {
    if (kind === 'shed') {
      // wedge under the single pitch (high side toward −Z)
      b.add(G.extrude([[-D / 2 + 0.05, 0], [D / 2 - 0.05, 0], [D / 2 - 0.05, rise - 0.1]], 0.3, { bevel: 0.03 }), { c: wall, at: [side * (W / 2 - 0.16), eaves - 0.02, 0], rot: [0, Math.PI / 2, 0] });
      continue;
    }
    b.add(gableGeometry(D - 0.1, rise - 0.12, 0.3), { c: wall, at: [side * (W / 2 - 0.16), eaves - 0.02, 0], rot: [0, (side * Math.PI) / 2, 0] });
    // round attic window in the gable
    onWall(b, [side * (W / 2 + 0.01), eaves + rise * 0.38, 0], (side * Math.PI) / 2, () => {
      b.cyl(0.42, 0.12, { axis: 'z', seg: 14, c: 'white', at: [0, 0, -0.04] });
      b.cyl(0.3, 0.05, { axis: 'z', seg: 14, slot: rng.next() < lit ? 'window' : 'gloss', c: col('blue.dark').lerp(col('sky'), 0.35), at: [0, 0, 0.06] });
    });
  }
  b.anchor('roof', 0, eaves + rise, 0);
  // front: door + windows; other walls: windows
  const cols = Math.max(2, Math.round(W / 2.7));
  const doorCol = cols > 2 ? 1 : 0;
  const colX = (i: number, n: number, span: number): number => ((i + 0.5) / n - 0.5) * (span - 0.9);
  const win = (flowers: boolean): void => addWindow(b, { lit: rng.next() < lit, shutters, flowers, bars: 2 });
  for (let f = 0; f < floors; f++) {
    const y = base + f * floorH + 1.6;
    for (let i = 0; i < cols; i++) {
      if (f === 0 && i === doorCol) {
        onWall(b, [colX(i, cols, W), base, D / 2], 0, () => addDoor(b, { c: o.door ?? rng.pick(DOORS), steps: 2, canopy: roof, glazed: rng.next() < 0.5 }));
        b.anchor('door', colX(i, cols, W), base + 1, D / 2 + 0.6);
        continue;
      }
      onWall(b, [colX(i, cols, W), y, D / 2], 0, () => win((o.flowers ?? true) && f === 0));
      onWall(b, [-colX(i, cols, W), y, -D / 2], Math.PI, () => win(false));
    }
    const sideCols = Math.max(1, Math.round(D / 3.4));
    for (let i = 0; i < sideCols; i++) {
      for (const side of [-1, 1]) onWall(b, [side * (W / 2), y, colX(i, sideCols, D)], (side * Math.PI) / 2, () => win(false));
    }
  }
  if ((o.chimney ?? true) && kind !== 'flat') {
    const cx = W * 0.24;
    const cz = -D * 0.18;
    const roofY = kind === 'hip' ? rise * 0.45 : rise * (1 - Math.abs(cz) / (D / 2));
    b.frame({ at: [cx, eaves + roofY - 0.4, cz] }, () => addChimney(b, rise * 0.55 + 1.0), 'chimney.');
  }
  // gutters with a downpipe, service mast, meter box, house number
  const gutter = col('white').lerp(col('mist'), 0.5);
  const drop = kind === 'flat' ? 0 : 0.45 * Math.tan(Math.atan2(rise, kind === 'shed' ? D : D / 2));
  if (kind === 'gable' || kind === 'hip') {
    for (const side of [-1, 1]) b.cyl(0.07, W + 0.8, { axis: 'x', seg: 6, slot: 'metal', c: gutter, at: [-W / 2 - 0.4, eaves - drop - 0.06, side * (D / 2 + 0.5)], bevel: 0 });
    b.rod([W / 2 + 0.25, eaves - drop - 0.1, D / 2 + 0.5], [W / 2 - 0.15, eaves - drop - 0.6, D / 2 + 0.1], 0.05, { slot: 'metal', c: gutter });
    b.rod([W / 2 - 0.15, eaves - drop - 0.6, D / 2 + 0.1], [W / 2 - 0.15, base + 0.1, D / 2 + 0.1], 0.05, { slot: 'metal', c: gutter });
  }
  b.cyl(0.05, 1.5, { seg: 6, slot: 'metal', c: 'slate', at: [-W / 2 + 0.5, eaves - 0.9, D / 2 + 0.08], bevel: 0 });
  b.sphere(0.09, { seg: 8, slot: 'gloss', c: 'white', at: [-W / 2 + 0.5, eaves + 0.62, D / 2 + 0.08] });
  b.anchor('service', -W / 2 + 0.5, eaves + 0.62, D / 2 + 0.08);
  b.box(0.42, 0.56, 0.16, { r: 0.04, slot: 'gloss', c: 'mist', at: [-W / 2 + 0.5, base + 1.2, D / 2 + 0.02] });
  b.box(0.2, 0.14, 0.04, { r: 0, slot: 'gloss', c: 'ink', at: [-W / 2 + 0.5, base + 1.5, D / 2 + 0.1] });
  b.anchor('meter', -W / 2 + 0.5, base + 1.5, D / 2 + 0.2);
}

export function house(o: HouseOptions = {}): KitModel {
  const b = new Builder('house');
  addHouse(b, o);
  return b.build();
}
