/**
 * Facade and roof elements shared by all buildings — the secondary and tertiary detail levels (STYLE_GUIDE §3):
 * windows with frames, sills, shutters and flower boxes; doors with steps, canopy and lamp; gable / hip roofs
 * with real thickness and overhang; chimneys. Units: metres.
 *
 * Wall-mounted elements are built in a frame whose origin lies on the wall surface, +Z pointing out of the
 * wall (use `onWall`).
 */
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { col, type ColorLike } from '@/style';
import type { Builder, V3 } from '../core/builder';
import * as G from '../core/geo';

/** Run `fn` in a frame on a wall: `at` on the wall surface, `ry` = direction the wall faces (0 = +Z). */
export function onWall(b: Builder, at: V3, ry: number, fn: () => void, prefix = ''): void {
  b.frame({ at, rot: [0, ry, 0] }, fn, prefix);
}

export interface WindowOptions {
  w?: number;
  h?: number;
  /** Lit windows glow at night (`window` slot); unlit ones stay dark glass. Default true. */
  lit?: boolean;
  frame?: ColorLike;
  /** Shutter colour, or false for none. */
  shutters?: ColorLike | false;
  sill?: boolean;
  /** Flower box under the window. */
  flowers?: boolean;
  /** Glazing bars: 0 none, 1 one vertical, 2 cross. Default 2. */
  bars?: 0 | 1 | 2;
  glass?: ColorLike;
}

/** Window centred on the frame origin (see `onWall`). */
export function addWindow(b: Builder, o: WindowOptions = {}): void {
  const w = o.w ?? 1.1;
  const h = o.h ?? 1.3;
  const frame = col(o.frame ?? 'white');
  const t = 0.11;
  b.box(w + 2 * t, h + 2 * t, 0.14, { r: 0.04, mid: true, c: frame, at: [0, 0, 0.03] });
  b.box(w, h, 0.06, { r: 0, mid: true, slot: (o.lit ?? true) ? 'window' : 'gloss', c: o.glass ?? col('blue.dark').lerp(col('sky'), 0.35), at: [0, 0, 0.09] });
  const bars = o.bars ?? 2;
  if (bars >= 1) b.box(0.06, h, 0.05, { r: 0, mid: true, c: frame, at: [0, 0, 0.12] });
  if (bars >= 2) b.box(w, 0.06, 0.05, { r: 0, mid: true, c: frame, at: [0, h * 0.12, 0.12] });
  if (o.sill ?? true) b.box(w + 0.4, 0.09, 0.26, { r: 0.03, mid: true, c: frame, at: [0, -h / 2 - t - 0.02, 0.12] });
  if (o.shutters) {
    const c = col(o.shutters);
    for (const side of [-1, 1]) {
      b.box(w * 0.46, h + 0.1, 0.07, { r: 0.025, mid: true, c: [c.clone().multiplyScalar(0.82), c], at: [side * (w / 2 + t + w * 0.25), 0, 0.045] });
      for (let i = 0; i < 4; i++) b.box(w * 0.34, 0.05, 0.03, { r: 0, mid: true, c: c.clone().multiplyScalar(0.75), at: [side * (w / 2 + t + w * 0.25), (i - 1.5) * h * 0.2, 0.09] });
    }
  }
  if (o.flowers) {
    b.box(w + 0.2, 0.22, 0.3, { r: 0.05, mid: true, c: col('wireBrown').lerp(col('coral'), 0.3), at: [0, -h / 2 - 0.3, 0.26] });
    for (let i = 0; i < 5; i++) {
      const x = ((i + 0.5) / 5 - 0.5) * w;
      b.sphere(0.13, { seg: 6, slot: 'soft', c: 'green', at: [x, -h / 2 - 0.16, 0.26] });
      b.sphere(0.075, { seg: 5, slot: 'soft', c: i % 2 ? 'coral' : 'pink', at: [x + 0.03, -h / 2 - 0.06, 0.32] });
    }
  }
}

export interface DoorOptions {
  w?: number;
  h?: number;
  c?: ColorLike;
  frame?: ColorLike;
  /** Number of steps in front (0 = flush). Default 1. */
  steps?: number;
  /** Small pitched canopy above the door. */
  canopy?: ColorLike | false;
  /** Porch lamp beside the door (`lamp` slot + `lamp` anchor). Default true. */
  lamp?: boolean;
  /** Glazed upper panel (glows at night). */
  glazed?: boolean;
}

/** Door standing on the frame origin (bottom centre of the door on the wall surface). */
export function addDoor(b: Builder, o: DoorOptions = {}): void {
  const w = o.w ?? 1.0;
  const h = o.h ?? 2.1;
  const c = col(o.c ?? 'teal');
  const frame = col(o.frame ?? 'white');
  b.box(w + 0.24, h + 0.12, 0.14, { r: 0.04, c: frame, at: [0, 0, 0.03] });
  b.box(w, h, 0.1, { r: 0.04, c: [c.clone().multiplyScalar(0.8), c], at: [0, 0, 0.08] });
  b.box(w * 0.62, h * 0.3, 0.04, { r: 0.03, c: c.clone().multiplyScalar(0.84), at: [0, h * 0.1, 0.13] });
  if (o.glazed) b.box(w * 0.62, h * 0.36, 0.04, { r: 0.03, slot: 'window', c: col('blue.dark').lerp(col('sky'), 0.35), at: [0, h * 0.52, 0.13] });
  else b.box(w * 0.62, h * 0.36, 0.04, { r: 0.03, c: c.clone().multiplyScalar(0.84), at: [0, h * 0.52, 0.13] });
  b.sphere(0.055, { seg: 8, slot: 'metal', c: 'yellow', at: [w * 0.36, h * 0.47, 0.17] });
  const steps = o.steps ?? 1;
  for (let i = 0; i < steps; i++) b.box(w + 0.7, 0.18, 0.36 + (steps - 1 - i) * 0.34, { r: 0.04, slot: 'matte', c: col('mist').lerp(col('steel.light'), 0.3), at: [0, -0.18 * (steps - i), 0.2 + (steps - 1 - i) * 0.17] });
  if (o.canopy) {
    const cc = col(o.canopy);
    for (const side of [-1, 1]) b.box(w * 0.62 + 0.2, 0.08, 0.8, { r: 0.03, c: cc, at: [side * (w * 0.28 + 0.05), h + 0.34, 0.36], rot: [0, 0, -side * 0.5] });
    for (const side of [-1, 1]) b.beam([side * (w / 2 + 0.2), h - 0.2, 0.05], [side * (w / 2 + 0.2), h + 0.22, 0.7], 0.06, { c: frame });
  }
  if (o.lamp ?? true) {
    b.box(0.08, 0.1, 0.16, { r: 0.02, slot: 'metal', c: 'slate', at: [-w / 2 - 0.4, h * 0.82, 0.08] });
    b.sphere(0.1, { seg: 8, slot: 'lamp', c: col('yellow').lerp(col('white'), 0.3), at: [-w / 2 - 0.4, h * 0.8, 0.22] });
    b.anchor('lamp', -w / 2 - 0.4, h * 0.8, 0.3);
  }
}

/** Chimney standing on the frame origin: brick shaft, cap, optional pot. Anchor `smoke` at the top. */
export function addChimney(b: Builder, h: number, o: { w?: number; c?: ColorLike; cap?: ColorLike } = {}): void {
  const w = o.w ?? 0.6;
  const c = col(o.c ?? col('coral.dark').lerp(col('wireBrown'), 0.4));
  b.box(w, h, w, { r: 0.05, c: [c.clone().multiplyScalar(0.8), c] });
  b.box(w + 0.16, 0.14, w + 0.16, { r: 0.04, c: o.cap ?? 'mist', at: [0, h - 0.04, 0] });
  b.cyl(w * 0.24, 0.3, { seg: 8, c: 'slate', at: [0, h + 0.08, 0] });
  b.anchor('smoke', 0, h + 0.4, 0);
}

/** Flat-faced pyramid / hip roof geometry: base w × d at y = 0, ridge of length `ridge` along X at y = rise. */
export function hipRoofGeometry(w: number, d: number, rise: number, ridge: number): BufferGeometry {
  const a = [-w / 2, 0, d / 2], bb = [w / 2, 0, d / 2], c = [w / 2, 0, -d / 2], e = [-w / 2, 0, -d / 2];
  const r0 = [-ridge / 2, rise, 0], r1 = [ridge / 2, rise, 0];
  const faces = [[a, bb, r1, r0], [bb, c, r1], [c, e, r0, r1], [e, a, r0], [a, e, c, bb]];
  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  for (const f of faces) {
    const base = pos.length / 3;
    const [p, q, s] = f as [number[], number[], number[]];
    const ux = q[0]! - p[0]!, uy = q[1]! - p[1]!, uz = q[2]! - p[2]!;
    const vx = s[0]! - p[0]!, vy = s[1]! - p[1]!, vz = s[2]! - p[2]!;
    const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    const len = Math.hypot(n[0]!, n[1]!, n[2]!) || 1;
    for (const v of f) {
      pos.push(v[0]!, v[1]!, v[2]!);
      nor.push(n[0]! / len, n[1]! / len, n[2]! / len);
    }
    for (let i = 1; i < f.length - 1; i++) idx.push(base, base + i, base + i + 1);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.setIndex(idx);
  return g;
}

export type RoofKind = 'gable' | 'hip' | 'flat' | 'shed';

/**
 * Roof over a w × d plan whose eaves line is at the frame origin height. Ridge along X.
 * `gable`: two thick slabs with overhang and a ridge cap (gable walls are added by the caller);
 * `hip`: four faces with hip ridges; `flat`: slab with parapet; `shed`: single pitch rising toward −Z.
 */
export function addRoof(b: Builder, kind: RoofKind, w: number, d: number, rise: number, c: ColorLike, overhang = 0.45): void {
  const cc = col(c);
  const dark = cc.clone().multiplyScalar(0.8);
  if (kind === 'flat') {
    b.box(w + 0.3, 0.3, d + 0.3, { r: 0.06, slot: 'matte', c: 'steel', at: [0, 0, 0] });
    b.box(w + 0.5, 0.2, d + 0.5, { r: 0.07, c: cc, at: [0, 0.26, 0] });
    b.box(w - 0.3, 0.08, d - 0.3, { r: 0, slot: 'matte', c: col('slate').lerp(col('steel'), 0.4), at: [0, 0.3, 0] });
    return;
  }
  if (kind === 'hip') {
    b.box(w + overhang * 2, 0.16, d + overhang * 2, { r: 0.06, c: 'white', at: [0, -0.08, 0] });
    b.add(hipRoofGeometry(w + overhang * 2 - 0.1, d + overhang * 2 - 0.1, rise, Math.max(w - d, 0) * 0.9 + 0.3), { slot: 'matte', c: [dark, cc], at: [0, 0.08, 0] });
    b.capsule(0.11, Math.max(w - d, 0) * 0.9 + 0.5, { axis: 'x', seg: 8, c: dark, at: [0, rise + 0.08, 0] });
    return;
  }
  const half = d / 2 + overhang;
  const slabs = kind === 'shed' ? [1] : [-1, 1];
  for (const side of slabs) {
    const run = kind === 'shed' ? d + 2 * overhang : half;
    const pitch = Math.atan2(rise, kind === 'shed' ? d : d / 2);
    const len = run / Math.cos(pitch);
    const zc = kind === 'shed' ? 0 : (side * half) / 2;
    b.box(w + 2 * overhang, 0.2, len + 0.1, { r: 0.07, mid: true, slot: 'matte', c: [dark, cc], at: [0, rise / 2 + 0.02 - (kind === 'shed' ? 0 : (overhang * Math.tan(pitch)) / 2), zc], rot: [side * pitch, 0, 0] });
    b.box(w + 2 * overhang + 0.06, 0.24, 0.12, { r: 0.04, mid: true, c: 'white', at: [0, kind === 'shed' ? -overhang * Math.tan(pitch) : -overhang * Math.tan(pitch) + 0.03, side * half * (kind === 'shed' ? 1 : 1)] });
  }
  if (kind === 'gable') b.capsule(0.13, w + 2 * overhang + 0.1, { axis: 'x', seg: 8, c: dark, at: [0, rise + 0.1, 0] });
}

/** Triangular gable wall (ridge along X → gables face ±X): add it in a frame on the side wall, base at the eaves. */
export function gableGeometry(d: number, rise: number, thickness = 0.3): BufferGeometry {
  return G.extrude([[-d / 2, 0], [d / 2, 0], [0, rise]] as G.Pt[], thickness, { bevel: 0.03 });
}
