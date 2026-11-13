/**
 * The workbench of the «studio-workshop»: a dark floating slab lit from below by a violet strip, with an
 * anti-static mat, a ruler along the front edge, chunky feet and a cable tray at the back. Origin = centre of
 * the top surface (y = 0 is the surface the sets stand on).
 */
import type { ChapterContext } from '@/engine/api';
import { Builder, addPanelLine, type KitModel } from '@/kit';
import { col, type KGlowMaterial } from '@/style';
import { BENCH_D, BENCH_W } from '../world';

export interface Bench {
  model: KitModel;
  /** The under-glow strip (its intensity breathes in `update`). */
  glow: KGlowMaterial;
  update(t: number): void;
}

export function createBench(ctx: ChapterContext): Bench {
  const W = BENCH_W;
  const D = BENCH_D;
  const T = 0.3; // slab thickness
  const b = new Builder('bench');
  const top = col('bg.indigo').lerp(col('slate'), 0.3);
  // slab + inset mat
  b.box(W, T, D, { r: 0.12, seg: 3, c: ['bg.indigo', 'slate'], at: [0, -T, 0] });
  b.box(W - 0.5, 0.02, D - 0.5, { r: 0.01, slot: 'matte', c: top, at: [0, -0.008, 0] });
  // mat grid: faint lines every 1.4 units (reads as a cutting mat, gives the eye a scale)
  const line = col('slate').lerp(col('violet'), 0.25);
  for (let x = -W / 2 + 1.2; x < W / 2 - 0.6; x += 1.4)
    addPanelLine(b, [x, 0.014, -D / 2 + 0.45], [x, 0.014, D / 2 - 0.45], { w: 0.015, c: line });
  for (let z = -D / 2 + 1.2; z < D / 2 - 0.6; z += 1.4)
    addPanelLine(b, [-W / 2 + 0.45, 0.014, z], [W / 2 - 0.45, 0.014, z], { w: 0.015, c: line });
  // ruler along the front edge: ticks every 0.2, long every 1
  for (let i = 0; i <= 50; i++) {
    const x = -5 + i * 0.2;
    const long = i % 5 === 0;
    b.box(0.018, 0.012, long ? 0.16 : 0.08, {
      r: 0,
      slot: 'flat',
      c: long ? 'mist' : 'steel',
      at: [x, 0.012, D / 2 - 0.2 - (long ? 0.04 : 0)],
    });
  }
  // feet and a tool rail at the back
  for (const [x, z] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const)
    b.cyl(0.32, 0.26, {
      seg: 28,
      slot: 'metal',
      c: 'slate',
      at: [x * (W / 2 - 0.9), -T - 0.26, z * (D / 2 - 0.8)],
    });
  b.box(W * 0.6, 0.1, 0.34, { r: 0.04, slot: 'metal', c: 'slate', at: [0, -0.02, -D / 2 + 0.36] });
  // corner bolts
  for (const [x, z] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const)
    b.cyl(0.07, 0.03, { seg: 12, slot: 'metal', c: 'steel', at: [x * (W / 2 - 0.2), 0, z * (D / 2 - 0.2)] });
  // light from below: glowing strips under the lip (the builder's `glow` slot, one draw call)
  const accent = ctx.manifest.theme.accent;
  for (const z of [-1, 1])
    b.box(W - 0.6, 0.03, 0.05, { r: 0, slot: 'glow', c: accent, at: [0, -T - 0.035, z * (D / 2 - 0.12)] });
  for (const x of [-1, 1])
    b.box(0.05, 0.03, D - 0.6, { r: 0, slot: 'glow', c: accent, at: [x * (W / 2 - 0.12), -T - 0.035, 0] });
  const model = b.build();
  const glow = model.mats.get('glow') as KGlowMaterial;
  return { model, glow, update: (t) => (glow.intensity = 1.9 + Math.sin(t * 1.2) * 0.35) };
}
