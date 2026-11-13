/**
 * Photovoltaic module and mounts. The module is the labs' shared «ЛМ-440»: 1.722 × 1.134 m, 108 half-cut
 * cells (6 × 18, split into two halves), aluminium frame, three split junction boxes with MC4 leads.
 * The module lies in its own XZ plane, glass toward +Y, long side along Z, origin at the centre of the glass.
 * Units: metres.
 */
import { col } from '@/style';
import { Builder, type KitModel, type V3 } from '../core/builder';
import * as G from '../core/geo';

export const PV_MODULE = { length: 1.722, width: 1.134, thickness: 0.03, cells: 108, cols: 6, rows: 18 } as const;

export interface PvModuleOptions {
  /** `hero`: every half-cell, busbars, junction boxes (≈ 700 triangles). `mid` (default): glass with cell-gap lines (≈ 150). */
  detail?: 'hero' | 'mid';
}

/** Anchors (`hero`): `plus`, `minus` (MC4 connectors), `jbox`; always `centre`. */
export function addPvModule(b: Builder, o: PvModuleOptions = {}): void {
  const { length: L, width: W, thickness: T, cols, rows } = PV_MODULE;
  const frame = col('mist').lerp(col('steel'), 0.3);
  const cell = col('bg.indigo').lerp(col('blue'), 0.28);
  const f = 0.035;
  // frame: four bars around the laminate
  for (const s of [-1, 1]) {
    b.box(f, T, L, { r: 0.008, slot: 'metal', c: frame, at: [s * (W / 2 - f / 2), -T, 0] });
    b.box(W - 2 * f, T, f, { r: 0.008, slot: 'metal', c: frame, at: [0, -T, s * (L / 2 - f / 2)] });
  }
  const iw = W - 2 * f;
  const il = L - 2 * f;
  b.box(iw, T * 0.5, il, { r: 0, slot: 'matte', c: 'white', at: [0, -T * 0.75, 0] });
  if (o.detail === 'hero') {
    const cw = (iw - 0.03) / cols;
    const half = (il - 0.05) / 2;
    const ch = half / (rows / 2);
    const cells: [number, number, number, number][] = [];
    const bars: [number, number, number, number][] = [];
    for (let i = 0; i < cols; i++) {
      const x = -iw / 2 + 0.015 + (i + 0.5) * cw;
      for (let j = 0; j < rows; j++) {
        const z = (j < rows / 2 ? -0.01 - (j + 0.5) * ch : 0.01 + (j - rows / 2 + 0.5) * ch);
        cells.push([x, z, cw - 0.006, ch - 0.004]);
      }
      // three busbars per cell column, running the length of each half
      for (const k of [-1, 0, 1]) for (const s of [-1, 1]) bars.push([x + k * cw * 0.3, s * (0.01 + half / 2), 0.004, half - 0.004]);
    }
    b.add(G.quads(cells, -T * 0.24), { slot: 'gloss', c: cell });
    b.add(G.quads(bars, -T * 0.22), { slot: 'gloss', c: 'mist' });
    for (const x of [-0.3, 0, 0.3]) b.box(0.09, 0.02, 0.05, { r: 0.006, slot: 'gloss', c: 'ink', at: [x, -T - 0.02, 0] });
    for (const [s, name] of [[-1, 'minus'], [1, 'plus']] as const) {
      b.rod([s * 0.3, -T - 0.012, 0], [s * 0.3, -T - 0.012, 0.42], 0.006, { slot: 'gloss', c: 'ink', seg: 5 });
      b.cyl(0.011, 0.05, { axis: 'z', seg: 6, slot: 'gloss', c: s > 0 ? 'coral' : 'blue', at: [s * 0.3, -T - 0.012, 0.42] });
      b.anchor(name, s * 0.3, -T - 0.012, 0.47);
    }
    b.anchor('jbox', 0, -T - 0.02, 0);
  } else {
    b.add(G.quads([[0, 0, iw - 0.02, il - 0.02]], -T * 0.24), { slot: 'gloss', c: cell });
    const lines: [number, number, number, number][] = [[0, 0, iw - 0.02, 0.022]];
    for (let i = 1; i < cols; i++) lines.push([-iw / 2 + (i * iw) / cols, 0, 0.008, il - 0.02]);
    for (const s of [-1, 1]) for (let j = 1; j < 3; j++) lines.push([0, (s * j * il) / 6, iw - 0.02, 0.006]);
    b.add(G.quads(lines, -T * 0.22), { slot: 'gloss', c: col('blue').lerp(col('sky.light'), 0.4) });
  }
  b.anchor('centre', 0, 0, 0);
}

export function pvModule(o: PvModuleOptions = { detail: 'hero' }): KitModel {
  const b = new Builder('pv-module');
  addPvModule(b, o);
  return b.build();
}

export interface PvTableOptions extends PvModuleOptions {
  /** Modules across (along the table) and up the slope. Default 6 × 2. */
  cols?: number;
  rows?: number;
  /** Tilt from horizontal, radians. Default 30°. */
  tilt?: number;
  /** Height of the lower edge above the ground. Default 0.7 m. */
  clearance?: number;
  /** `rack` = posts and rails (ground mount); `roof` = rails only, laid parallel to a roof (tilt 0 in the roof's frame). */
  mount?: 'rack' | 'roof';
  /** Modules in portrait (long side up the slope, default) or landscape. */
  portrait?: boolean;
}

/**
 * A table of modules facing local +Z (downhill side toward +Z). Origin: ground under the centre of the table
 * (`rack`) or the roof surface under the centre (`roof`). Anchors: `centre`, `plus`, `minus` (string ends), `top`.
 * Returns the table size [along X, up the slope].
 */
export function addPvTable(b: Builder, o: PvTableOptions = {}): [number, number] {
  const cols = o.cols ?? 6;
  const rows = o.rows ?? 2;
  const roof = o.mount === 'roof';
  const tilt = roof ? 0 : (o.tilt ?? Math.PI / 6);
  const portrait = o.portrait ?? true;
  const mw = (portrait ? PV_MODULE.width : PV_MODULE.length) + 0.02;
  const ml = (portrait ? PV_MODULE.length : PV_MODULE.width) + 0.02;
  const w = cols * mw;
  const l = rows * ml;
  const lift = roof ? 0.12 : (o.clearance ?? 0.7) + (Math.sin(tilt) * l) / 2;
  const alu = col('mist').lerp(col('steel'), 0.35);
  b.frame({ at: [0, lift, 0], rot: [tilt, 0, 0] }, () => {
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const at: V3 = [(i + 0.5) * mw - w / 2, 0, (j + 0.5) * ml - l / 2];
        b.frame({ at, rot: [0, portrait ? 0 : Math.PI / 2, 0] }, () => addPvModule(b, o), `m${j * cols + i + 1}.`);
      }
    }
    // two rails under every module row
    for (let j = 0; j < rows; j++) for (const k of [-0.28, 0.28]) b.box(w + 0.1, 0.05, 0.05, { r: 0, slot: 'metal', c: alu, at: [0, -0.09, (j + 0.5 + k) * ml - l / 2] });
    b.anchor('centre', 0, 0, 0);
    b.anchor('top', 0, 0, -l / 2);
    b.anchor('plus', -w / 2, -0.05, l / 2);
    b.anchor('minus', w / 2, -0.05, l / 2);
  });
  if (!roof) {
    const posts = Math.max(2, Math.round(w / 2.8) + 1);
    for (let i = 0; i < posts; i++) {
      const x = (i / (posts - 1) - 0.5) * (w - 0.6);
      for (const s of [-1, 1]) {
        const z = s * Math.cos(tilt) * l * 0.3;
        const y = lift - s * Math.sin(tilt) * l * 0.3 - 0.12;
        b.box(0.09, y + 0.3, 0.09, { r: 0.02, slot: 'metal', c: alu, at: [x, -0.3, z] });
      }
      b.beam([x, lift + Math.sin(tilt) * l * 0.42 - 0.14, -Math.cos(tilt) * l * 0.42], [x, lift - Math.sin(tilt) * l * 0.42 - 0.14, Math.cos(tilt) * l * 0.42], 0.07, { slot: 'metal', c: alu });
      b.beam([x, 0.1, -Math.cos(tilt) * l * 0.3], [x, lift - Math.sin(tilt) * l * 0.3 - 0.2, Math.cos(tilt) * l * 0.3], 0.05, { slot: 'metal', c: alu });
    }
  }
  return [w, l];
}

export function pvTable(o: PvTableOptions = {}): KitModel {
  const b = new Builder('pv-table');
  addPvTable(b, o);
  return b.build();
}
