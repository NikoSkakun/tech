/**
 * Tertiary detail helpers (STYLE_GUIDE §3: detail comes from layered simple shapes, not textures): rivet and
 * bolt rows, bolt circles on flanges, louvred vents, panel lines, hazard stripes. All cheap hard-edged
 * shapes merged into the builder. Positions are in the current frame.
 */
import type { ColorLike } from '@/style';
import type { Builder, Slot, V3 } from './builder';
import * as G from './geo';

/** Row of `n` rivets / bolt heads from `from` to `to`; `normal` = direction they stick out. */
export function addRivets(b: Builder, from: V3, to: V3, n: number, o: { r?: number; c?: ColorLike; normal?: V3; slot?: Slot } = {}): void {
  const r = o.r ?? 0.04;
  const nrm = o.normal ?? [0, 0, 1];
  const head = G.facet(r, 0);
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    b.add(head, {
      slot: o.slot ?? 'metal',
      c: o.c ?? 'slate',
      at: [from[0] + (to[0] - from[0]) * t + nrm[0] * r * 0.3, from[1] + (to[1] - from[1]) * t + nrm[1] * r * 0.3, from[2] + (to[2] - from[2]) * t + nrm[2] * r * 0.3],
      s: [1 - Math.abs(nrm[0]) * 0.5, 1 - Math.abs(nrm[1]) * 0.5, 1 - Math.abs(nrm[2]) * 0.5],
    });
  }
}

/** Circle of `n` bolts of radius `R` around the frame's Z axis (pipe and bushing flanges). */
export function addBoltCircle(b: Builder, R: number, n: number, o: { r?: number; c?: ColorLike; z?: number } = {}): void {
  const r = o.r ?? R * 0.08;
  const bolt = G.cyl(r, r * 1.2, { seg: 6, bevel: 0 });
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    b.add(bolt, { slot: 'metal', c: o.c ?? 'slate', at: [Math.cos(a) * R, Math.sin(a) * R, o.z ?? 0], rot: [Math.PI / 2, 0, 0] });
  }
}

/** Louvred vent on a wall: frame + tilted slats. Origin = centre of the vent on the wall surface, front +Z. */
export function addVent(b: Builder, w: number, h: number, o: { slats?: number; c?: ColorLike; frame?: ColorLike } = {}): void {
  const slats = o.slats ?? Math.max(3, Math.round(h / 0.12));
  const t = Math.min(w, h) * 0.08;
  b.box(w + 2 * t, h + 2 * t, t, { r: t * 0.3, mid: true, c: o.frame ?? 'mist', at: [0, 0, t / 2] });
  b.box(w, h, t * 0.4, { r: 0, mid: true, c: 'ink', at: [0, 0, t * 0.8] });
  for (let i = 0; i < slats; i++) {
    b.box(w, (h / slats) * 0.7, t * 0.3, { r: 0, mid: true, c: o.c ?? 'slate', at: [0, ((i + 0.5) / slats - 0.5) * h, t], rot: [0.6, 0, 0] });
  }
}

/** Thin recessed-looking line between two points on a surface (panel joints, door gaps). */
export function addPanelLine(b: Builder, from: V3, to: V3, o: { w?: number; c?: ColorLike } = {}): void {
  b.beam(from, to, o.w ?? 0.03, { c: o.c ?? 'slate', h: (o.w ?? 0.03) * 0.5 });
}

/** Black / yellow hazard stripe along X: `n` alternating tiles of the given size, lying on the frame's XZ plane. */
export function addHazardStripe(b: Builder, length: number, width: number, n = 10): void {
  const tiles: [number, number, number, number][] = [];
  const dark: [number, number, number, number][] = [];
  for (let i = 0; i < n; i++) (i % 2 ? dark : tiles).push([((i + 0.5) / n - 0.5) * length, 0, length / n, width]);
  b.add(G.quads(tiles, 0.01), { slot: 'matte', c: 'yellow' });
  b.add(G.quads(dark, 0.01), { slot: 'matte', c: 'ink' });
}
