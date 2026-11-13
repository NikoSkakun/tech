/**
 * The four tower silhouettes: `barrel` (double-circuit 110–150 kV «бочка»), `single` (single-circuit 220 kV
 * with the phases in a triangle), `wineglass` (330–400 kV Y-shaped «чарка») and `portal` (500–750 kV guyed
 * portal with V-strings at 750 kV). All sizes derive from the spec: height, phase gap, string length.
 */
import { addLatticeArm, addLatticeBeam, addLatticeBody } from './lattice';
import type { TowerContext, TowerOptions, TowerSpec } from './towers';

/** Tapered body with stacked cross-arms and one shield peak: barrel (both sides) or single (alternating). */
function stack(ctx: TowerContext, o: TowerOptions, single: boolean): void {
  const { b, spec, style } = ctx;
  const k = spec.height / 32;
  const H = spec.height;
  const wb = H * 0.2 * (ctx.tension ? 1.25 : 1);
  const wt = 1.5 * k;
  const yTop = H - 2.6 * k;
  const half = (y: number): number => (wb + (wt - wb) * Math.pow(y / yTop, 0.8)) / 2;
  addLatticeBody(b, { ...style, from: [0, 0, 0], to: [0, yTop, 0], size0: [wb, wb], size1: [wt, wt], panels: 7 });
  addLatticeBody(b, { ...style, from: [0, yTop, 0], to: [0, H, 0], size0: [wt, wt], size1: [0.3 * k, 0.3 * k], panels: 1 });
  ctx.shield(0, H);
  const vertical = single ? spec.gap * 0.6 : spec.gap;
  const reach = single ? [0.62, 0.78, 0.62] : [0.72, 1.05, 0.8];
  const sides = single || (o.circuits ?? 2) === 1 ? [[-1], [1], [-1]] : [[-1, 1], [-1, 1], [-1, 1]];
  // phases are numbered per circuit top → bottom, so collect by side first
  const hang: [number, number][] = [];
  for (let level = 0; level < 3; level++) {
    const y = yTop - 0.6 * k - level * vertical;
    for (const side of sides[level]!) {
      const tip = side * (reach[level]! * spec.gap + 1.0 * k);
      addLatticeArm(b, { ...style, root: [side * half(y) * 0.9, y, 0], tip: [tip, y, 0], rootHeight: 1.7 * k, rootDepth: half(y) * 1.8 });
      hang.push([tip, y]);
    }
  }
  hang.sort((p, q) => Math.sign(p[0]) - Math.sign(q[0]) || q[1] - p[1]);
  for (const [x, y] of hang) ctx.phase(x, y);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) ctx.footing((sx * wb) / 2, (sz * wb) / 2);
  b.box(0.9 * k, 0.6 * k, 0.08, { r: 0.03, c: 'yellow', at: [0, 3 * k, wb * 0.42] });
}

function wineglass(ctx: TowerContext): void {
  const { b, spec, style } = ctx;
  const k = spec.height / 32;
  const H = spec.height;
  const string = spec.discs * 0.15 + 0.85;
  const beam = 1.5 * k;
  const yB = H - 2.6 * k;
  const yW = yB - string - 4.5 * k;
  const wb = H * 0.22 * (ctx.tension ? 1.25 : 1);
  const ww = 2.4 * k;
  const fork = spec.gap * 0.6;
  addLatticeBody(b, { ...style, from: [0, 0, 0], to: [0, yW, 0], size0: [wb, wb], size1: [ww, ww], panels: 6 });
  for (const side of [-1, 1]) {
    addLatticeBody(b, {
      ...style,
      from: [(side * ww) / 4, yW, 0],
      to: [side * fork, yB - beam / 2, 0],
      size0: [ww / 2, ww],
      size1: [1.2 * k, 1.4 * k],
      panels: 4,
      shrink: 1,
    });
    addLatticeBody(b, { ...style, from: [side * fork, yB + beam / 2, 0], to: [side * fork, H, 0], size0: [1.2 * k, 1.2 * k], size1: [0.3 * k, 0.3 * k], panels: 1 });
    ctx.shield(side * fork, H);
  }
  const end = spec.gap + 1.2 * k;
  addLatticeBeam(b, [-end, yB, 0], [end, yB, 0], beam, Math.round((2 * end) / (beam * 1.3)), style);
  for (const x of [-spec.gap, 0, spec.gap]) ctx.phase(x, yB - beam / 2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) ctx.footing((sx * wb) / 2, (sz * wb) / 2);
  b.box(0.9 * k, 0.6 * k, 0.08, { r: 0.03, c: 'yellow', at: [0, 3 * k, wb * 0.42] });
}

function portal(ctx: TowerContext): void {
  const { b, spec, style } = ctx;
  const k = spec.height / 34;
  const H = spec.height;
  const beam = 1.9 * k;
  const yB = H - 3.4 * k;
  const foot = spec.gap * 0.64;
  const head = spec.gap * 0.5;
  const end = spec.gap + 2.2 * k;
  addLatticeBeam(b, [-end, yB, 0], [end, yB, 0], beam, Math.round((2 * end) / (beam * 1.25)), style);
  for (const side of [-1, 1]) {
    // slender legs, narrow at the hinged foot, leaning in toward the beam
    addLatticeBody(b, {
      ...style,
      from: [side * foot, 0.4, 0],
      to: [side * head, yB - beam / 2, 0],
      size0: [0.9 * k, 0.9 * k],
      size1: [1.6 * k, 1.6 * k],
      panels: 9,
      shrink: 1,
    });
    ctx.footing(side * foot, 0, 2.2 * k);
    addLatticeBody(b, { ...style, from: [side * head, yB + beam / 2, 0], to: [side * head, H, 0], size0: [1.3 * k, 1.3 * k], size1: [0.3 * k, 0.3 * k], panels: 1 });
    ctx.shield(side * head, H);
    // guy wires: this tower type stands only because of them
    for (const sz of [-1, 1]) {
      const anchor: [number, number, number] = [side * (head + H * 0.28), 0, sz * H * 0.5];
      b.rod([side * head, yB, 0], anchor, 0.06 * k, { c: 'slate', slot: 'metal', seg: 5 });
      b.box(1.4 * k, 0.6, 1.4 * k, { r: 0.12, slot: 'matte', c: ['steel', 'mist'], at: [anchor[0], -0.3, anchor[2]] });
    }
  }
  const v = spec.discs >= 40 ? 2.4 : 0;
  for (const x of [-spec.gap, 0, spec.gap]) ctx.phase(x, yB - beam / 2, 0, ctx.tension ? 0 : v);
  b.box(0.9 * k, 0.6 * k, 0.08, { r: 0.03, c: 'yellow', at: [-foot, 3 * k, 0.6 * k] });
}

export const TOWER_SHAPES: Record<TowerSpec['style'], (ctx: TowerContext, o: TowerOptions) => void> = {
  barrel: (ctx, o) => stack(ctx, o, false),
  single: (ctx, o) => stack(ctx, o, true),
  wineglass,
  portal,
};
