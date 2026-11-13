/**
 * Soft, rounded furniture for the cutaway house (STYLE_GUIDE §3). Every piece stands on the origin of the
 * current frame and faces +Z; sizes in metres. Electrical devices add an anchor with their name so chapters
 * can attach labels, plugs and energy flows.
 */
import { col, type ColorLike } from '@/style';
import type { Builder } from '../core/builder';

const wood = () => col('wireBrown').lerp(col('yellow.light'), 0.35);

export function addSofa(b: Builder, c: ColorLike = 'teal', w = 2.1): void {
  const cc = col(c);
  b.box(w, 0.4, 0.9, { r: 0.14, seg: 2, c: [cc.clone().multiplyScalar(0.8), cc], at: [0, 0.08, 0] });
  b.box(w, 0.6, 0.28, { r: 0.13, seg: 2, c: cc, at: [0, 0.4, -0.32] });
  for (const s of [-1, 1]) b.box(0.26, 0.5, 0.9, { r: 0.12, seg: 2, c: cc.clone().multiplyScalar(0.92), at: [s * (w / 2 - 0.1), 0.18, 0] });
  for (const s of [-1, 1]) b.box(0.5, 0.36, 0.14, { r: 0.07, c: 'yellow', at: [s * w * 0.22, 0.52, -0.12], rot: [-0.25, 0, s * 0.15] });
}

export function addTable(b: Builder, w = 1.4, d = 0.85, h = 0.74, c?: ColorLike): void {
  const cc = col(c ?? wood());
  b.box(w, 0.07, d, { r: 0.03, c: cc, at: [0, h - 0.07, 0] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(0.04, h - 0.07, { seg: 6, c: cc.clone().multiplyScalar(0.78), at: [sx * (w / 2 - 0.1), 0, sz * (d / 2 - 0.1)], bevel: 0 });
}

export function addChair(b: Builder, c: ColorLike = 'coral'): void {
  const cc = col(c);
  b.box(0.44, 0.07, 0.44, { r: 0.03, c: cc, at: [0, 0.44, 0] });
  b.box(0.44, 0.5, 0.07, { r: 0.03, c: cc, at: [0, 0.5, -0.19] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(0.025, 0.44, { seg: 5, c: 'slate', at: [sx * 0.17, 0, sz * 0.17], bevel: 0 });
}

export function addBed(b: Builder, c: ColorLike = 'violet', w = 1.6): void {
  const cc = col(c);
  b.box(w + 0.1, 0.3, 2.1, { r: 0.06, c: wood(), at: [0, 0.05, 0] });
  b.box(w, 0.22, 2.0, { r: 0.09, seg: 2, c: 'white', at: [0, 0.33, 0] });
  b.box(w + 0.02, 0.12, 1.25, { r: 0.06, seg: 2, c: [cc.clone().multiplyScalar(0.85), cc], at: [0, 0.48, 0.38] });
  b.box(w + 0.1, 0.95, 0.1, { r: 0.05, c: wood(), at: [0, 0.05, -1.05] });
  for (const s of w > 1.2 ? [-1, 1] : [0]) b.box(0.55, 0.14, 0.36, { r: 0.07, seg: 2, c: 'white', at: [s * w * 0.24, 0.53, -0.72] });
}

export function addWardrobe(b: Builder, w = 1.4, h = 2.1, c?: ColorLike): void {
  const cc = col(c ?? wood());
  b.box(w, h, 0.58, { r: 0.04, c: [cc.clone().multiplyScalar(0.84), cc] });
  b.box(0.02, h - 0.2, 0.02, { r: 0, c: cc.clone().multiplyScalar(0.7), at: [0, 0.1, 0.29] });
  for (const s of [-1, 1]) b.cyl(0.02, 0.2, { seg: 5, slot: 'metal', c: 'mist', at: [s * 0.07, h * 0.48, 0.31], bevel: 0 });
}

export function addShelf(b: Builder, w = 1.0, h = 1.6): void {
  const c = wood();
  b.box(w, h, 0.3, { r: 0.03, c: c.clone().multiplyScalar(0.8), at: [0, 0, -0.01] });
  const tones = ['coral', 'teal', 'yellow', 'violet', 'sky', 'pink'] as const;
  for (let r = 0; r < 4; r++) {
    b.box(w - 0.08, 0.03, 0.3, { r: 0, c, at: [0, 0.1 + r * (h / 4.2), 0.03] });
    for (let i = 0; i < 6; i++) b.box(0.06, 0.2 + ((i * 7 + r * 3) % 4) * 0.025, 0.2, { r: 0.01, c: tones[(i + r * 2) % 6]!, at: [-w / 2 + 0.12 + i * 0.075 + (r % 2) * 0.2, 0.13 + r * (h / 4.2), 0.06] });
  }
}

/** Night glow of screens (TV, monitors, laptop): cool light, unlike the warm window panes. */
const SCREEN_GLOW = col('sky').lerp(col('white'), 0.25);
/** TV on a low stand (anchor `tv`); the screen is a `window` pane, so it glows at night. */
export function addTv(b: Builder): void {
  b.box(1.5, 0.42, 0.42, { r: 0.05, c: wood(), at: [0, 0, 0] });
  b.box(1.25, 0.72, 0.05, { r: 0.02, slot: 'gloss', c: 'ink', at: [0, 0.52, 0] });
  b.box(1.17, 0.64, 0.02, { r: 0, slot: 'window', c: col('blue.dark').lerp(col('sky'), 0.2), glow: SCREEN_GLOW, at: [0, 0.56, 0.03] });
  b.box(0.3, 0.1, 0.2, { r: 0.02, slot: 'gloss', c: 'ink', at: [0, 0.42, 0] });
  b.anchor('tv', 0, 0.9, 0.1);
}

/** Desk with a laptop and a monitor (anchor `laptop`). */
export function addDesk(b: Builder): void {
  addTable(b, 1.3, 0.65, 0.74);
  b.box(0.34, 0.02, 0.24, { r: 0.008, slot: 'gloss', c: 'mist', at: [-0.3, 0.74, 0.08] });
  b.box(0.34, 0.22, 0.015, { r: 0.008, slot: 'window', c: col('blue.dark').lerp(col('sky'), 0.3), glow: SCREEN_GLOW, at: [-0.3, 0.75, -0.05], rot: [-0.25, 0, 0] });
  b.box(0.55, 0.34, 0.03, { r: 0.015, slot: 'window', c: col('blue.dark').lerp(col('sky'), 0.3), glow: SCREEN_GLOW, at: [0.25, 0.86, -0.18] });
  b.cyl(0.03, 0.14, { seg: 6, slot: 'gloss', c: 'ink', at: [0.25, 0.74, -0.2] });
  b.anchor('laptop', -0.3, 0.9, 0.05);
}

/** Floor lamp (`lamp` slot; anchor `lamp`). */
export function addFloorLamp(b: Builder, c: ColorLike = 'yellow'): void {
  b.cyl(0.16, 0.04, { seg: 12, slot: 'metal', c: 'slate' });
  b.cyl(0.02, 1.4, { seg: 6, slot: 'metal', c: 'slate', at: [0, 0.04, 0], bevel: 0 });
  b.cyl(0.24, 0.3, { rTop: 0.14, seg: 14, slot: 'lamp', c: col(c).lerp(col('white'), 0.4), at: [0, 1.38, 0], bevel: 0.02 });
  b.anchor('lamp', 0, 1.5, 0);
}

/** Ceiling lamp hanging from the frame origin (put the frame on the ceiling). */
export function addCeilingLamp(b: Builder): void {
  b.cyl(0.012, 0.3, { seg: 4, slot: 'metal', c: 'slate', at: [0, -0.3, 0], bevel: 0 });
  b.cyl(0.2, 0.16, { rTop: 0.07, seg: 14, c: 'white', at: [0, -0.46, 0], bevel: 0.02 });
  b.sphere(0.09, { seg: 10, slot: 'lamp', c: col('yellow').lerp(col('white'), 0.45), at: [0, -0.48, 0] });
  b.anchor('lamp', 0, -0.5, 0);
}

export function addPlant(b: Builder, h = 1.0): void {
  b.cyl(0.17, 0.3, { rTop: 0.21, seg: 10, c: col('coral.dark').lerp(col('wireBrown'), 0.4) });
  for (let i = 0; i < 5; i++) {
    const a = i * 1.26;
    b.sphere(0.16 + (i % 2) * 0.05, { seg: 8, slot: 'soft', c: i % 2 ? 'green' : col('green').lerp(col('teal'), 0.4), at: [Math.cos(a) * 0.14, 0.42 + (i / 5) * (h - 0.5), Math.sin(a) * 0.14], s: [1, 1.3, 1] });
  }
}

export function addRug(b: Builder, w = 2.4, d = 1.6, c: ColorLike = 'coral'): void {
  const cc = col(c);
  b.box(w, 0.03, d, { r: 0.012, slot: 'matte', c: cc });
  b.box(w - 0.3, 0.035, d - 0.3, { r: 0.012, slot: 'matte', c: cc.clone().lerp(col('white'), 0.45) });
}
