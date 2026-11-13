/**
 * Access steelwork: railings, ladders (with safety cage), stairs, catwalks, and the spiral stair that wraps a
 * tank or a stack. The tertiary detail that makes industrial models read as real plant. Units: metres.
 */
import { col, type ColorLike } from '@/style';
import type { Builder, V3 } from '../core/builder';

const safety = () => col('yellow').lerp(col('amber'), 0.3);
const steel = () => col('slate').lerp(col('steel'), 0.35);

/** Straight railing between two points: posts, top rail, knee rail. */
export function addRailing(b: Builder, from: V3, to: V3, o: { h?: number; c?: ColorLike; spacing?: number } = {}): void {
  const h = o.h ?? 1.1;
  const c = col(o.c ?? safety());
  const len = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const n = Math.max(1, Math.round(len / (o.spacing ?? 1.6)));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p: V3 = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t];
    b.beam(p, [p[0], p[1] + h, p[2]], 0.06, { slot: 'metal', c });
  }
  for (const k of [1, 0.5]) b.beam([from[0], from[1] + h * k, from[2]], [to[0], to[1] + h * k, to[2]], 0.055, { slot: 'metal', c });
}

/** Ring railing around a circle of radius `r` at height `y` (tank roofs, stack platforms). */
export function addRingRailing(b: Builder, r: number, y: number, o: { h?: number; c?: ColorLike; posts?: number } = {}): void {
  const h = o.h ?? 1.1;
  const c = col(o.c ?? safety());
  const posts = o.posts ?? Math.max(8, Math.round((r * 6.283) / 1.6));
  for (let i = 0; i < posts; i++) {
    const a = (i / posts) * Math.PI * 2;
    b.beam([Math.cos(a) * r, y, Math.sin(a) * r], [Math.cos(a) * r, y + h, Math.sin(a) * r], 0.06, { slot: 'metal', c });
  }
  for (const k of [1, 0.5]) b.ring(r, 0.03, { seg: Math.max(16, posts * 2), tubeSeg: 4, slot: 'metal', c, at: [0, y + h * k, 0] });
}

/** Vertical ladder of height `h` standing on the frame origin, rungs toward +Z of the wall; `cage` adds hoops above 2.5 m. */
export function addLadder(b: Builder, h: number, o: { cage?: boolean; c?: ColorLike } = {}): void {
  const c = col(o.c ?? steel());
  for (const s of [-1, 1]) b.beam([s * 0.24, 0, 0.18], [s * 0.24, h + 1.0, 0.18], 0.05, { slot: 'metal', c });
  for (let y = 0.3; y < h; y += 0.32) b.beam([-0.24, y, 0.18], [0.24, y, 0.18], 0.035, { slot: 'metal', c });
  for (let y = 1.5; y < h; y += 3) b.beam([0, y, 0], [0, y, 0.18], 0.04, { slot: 'metal', c });
  if (o.cage ?? h > 4) {
    for (let y = 2.5; y <= h + 0.8; y += 0.9) b.ring(0.38, 0.02, { seg: 12, tubeSeg: 3, slot: 'metal', c: safety(), at: [0, y, 0.5] });
    for (let i = 0; i < 5; i++) {
      const a = -0.5 + (i / 4) * 4.14;
      b.beam([Math.sin(a) * 0.38, 2.5, 0.5 + Math.cos(a) * 0.38], [Math.sin(a) * 0.38, h + 0.8, 0.5 + Math.cos(a) * 0.38], 0.025, { slot: 'metal', c: safety() });
    }
  }
}

/** Straight stair flight rising `rise` over `run` along +Z from the frame origin, `width` wide, with railings. */
export function addStairs(b: Builder, rise: number, run: number, width = 1.0, o: { c?: ColorLike } = {}): void {
  const c = col(o.c ?? steel());
  const n = Math.max(2, Math.round(rise / 0.2));
  for (const s of [-1, 1]) b.beam([(s * width) / 2, 0, 0], [(s * width) / 2, rise, run], 0.09, { h: 0.2, slot: 'metal', c });
  for (let i = 1; i <= n; i++) b.box(width, 0.04, (run / n) * 0.95, { r: 0, slot: 'metal', c: 'steel.light', at: [0, (i / n) * rise - 0.04, ((i - 0.5) / n) * run] });
  for (const s of [-1, 1]) addRailing(b, [(s * width) / 2, 0, 0], [(s * width) / 2, rise, run], { spacing: 1.4 });
}

/** Grating walkway between two points at the same height, with railings on both sides. */
export function addCatwalk(b: Builder, from: V3, to: V3, width = 1.0, o: { supports?: number } = {}): void {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const len = Math.hypot(dx, dz) || 1;
  const nx = -dz / len;
  const nz = dx / len;
  b.beam([from[0], from[1] - 0.06, from[2]], [to[0], to[1] - 0.06, to[2]], width, { h: 0.08, slot: 'metal', c: 'steel.light' });
  for (const s of [-1, 1]) {
    const off: V3 = [(s * nx * width) / 2, 0, (s * nz * width) / 2];
    b.beam([from[0] + off[0], from[1] - 0.14, from[2] + off[2]], [to[0] + off[0], to[1] - 0.14, to[2] + off[2]], 0.08, { h: 0.2, slot: 'metal', c: steel() });
    addRailing(b, [from[0] + off[0], from[1], from[2] + off[2]], [to[0] + off[0], to[1], to[2] + off[2]]);
  }
  const supports = o.supports ?? 0;
  for (let i = 0; i < supports; i++) {
    const t = (i + 0.5) / supports;
    b.beam([from[0] + dx * t, 0, from[2] + dz * t], [from[0] + dx * t, from[1] - 0.14, from[2] + dz * t], 0.16, { slot: 'metal', c: steel() });
  }
}

/** Spiral stair around a vertical cylinder of radius `r` from the ground to height `h` (tanks, stacks). */
export function addSpiralStair(b: Builder, r: number, h: number, o: { turns?: number; start?: number; width?: number } = {}): void {
  const width = o.width ?? 0.9;
  const turns = o.turns ?? Math.max(0.35, h / (r * 6.283 * 0.75));
  const n = Math.round(h / 0.22);
  const c = steel();
  let prev: V3 | null = null;
  for (let i = 0; i <= n; i++) {
    const a = (o.start ?? 0) + (i / n) * turns * Math.PI * 2;
    const y = (i / n) * h;
    b.box(width, 0.04, 0.3, { r: 0, slot: 'metal', c: 'steel.light', at: [Math.cos(a) * (r + width / 2), y, Math.sin(a) * (r + width / 2)], rot: [0, -a, 0] });
    const outer: V3 = [Math.cos(a) * (r + width), y + 1.0, Math.sin(a) * (r + width)];
    if (i % 3 === 0) b.beam([outer[0], y, outer[2]], outer, 0.045, { slot: 'metal', c: safety() });
    if (prev && i % 3 === 0) b.beam(prev, outer, 0.05, { slot: 'metal', c: safety() });
    if (i % 3 === 0) prev = outer;
    if (i % 6 === 0) b.beam([Math.cos(a) * r, y - 0.1, Math.sin(a) * r], [Math.cos(a) * (r + width), y - 0.1, Math.sin(a) * (r + width)], 0.07, { slot: 'metal', c });
  }
}
