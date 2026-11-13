/**
 * Props of the last step: the holographic balance of pros (`green`) and challenges (`amber`) hanging over the
 * island, three portal rings that lead on (hub, solar plants, the power system) and a bird radar by the farm.
 * Built with the kit `Builder`; glowing parts use the always-on `glow` slot so they read at dusk.
 */
import { Builder, type KitModel } from '@/kit';
import type { ColorLike } from '@/style';

/** Balance: a beam on a pivot with two ring pans; `span` = distance between the pans. Origin = pivot. */
export function buildBalance(span: number): KitModel {
  const b = new Builder('balance');
  const half = span / 2;
  b.rod([-half, 0, 0], [half, 0, 0], 1.2, { c: 'sky', slot: 'glow', seg: 8 });
  b.sphere(4, { c: 'white', slot: 'glow', seg: 14 });
  ([[-half, 'green'], [half, 'amber']] as const).forEach(([x, color], k) => {
    const pan = b.part(k === 0 ? 'pros' : 'cons', { at: [x, 0, 0] });
    const r = 42;
    pan.ring(r, 1.7, { axis: 'y', seg: 56, tubeSeg: 8, c: color, slot: 'glow', at: [0, -26, 0] });
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3 + 0.5;
      pan.rod([0, 0, 0], [Math.cos(a) * r, -26, Math.sin(a) * r], 0.4, { c: 'mist', slot: 'glow', seg: 5 });
    }
    // «cards» round the pan: one tile per argument of the step's text
    const n = k === 0 ? 4 : 5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pan.box(13, 8, 0.8, { r: 1.6, c: color, slot: 'glow', at: [Math.cos(a) * r, -25, Math.sin(a) * r], rot: [0, -a + Math.PI / 2, 0] });
    }
    pan.anchor(k === 0 ? 'pros' : 'cons', 0, -14, 0);
  });
  return b.build();
}

/** Portal: a standing ring gate with a glowing rim. Origin = centre of the opening, facing ±Z. */
export function buildPortal(color: ColorLike, radius = 19): KitModel {
  const b = new Builder('portal');
  b.ring(radius, 1.5, { axis: 'z', seg: 48, tubeSeg: 10, c: color, slot: 'glow' });
  b.ring(radius * 0.8, 0.5, { axis: 'z', seg: 40, tubeSeg: 6, c: 'white', slot: 'glow' });
  b.cyl(radius * 0.78, 0.3, { axis: 'z', seg: 40, c: 'bg.indigo', slot: 'glass', at: [0, 0, -0.15] });
  return b.build();
}

/** Bird radar: a mast with a rotating bar antenna (`part('antenna')`) and a camera pod. */
export function buildRadar(): KitModel {
  const b = new Builder('bird-radar');
  b.cyl(0.9, 0.5, { seg: 14, slot: 'matte', c: 'mist' });
  b.cyl(0.28, 9, { seg: 10, slot: 'gloss', c: ['steel', 'mist'], at: [0, 0.5, 0] });
  b.box(1.5, 1.1, 1.5, { r: 0.2, slot: 'gloss', c: 'white', at: [0, 9.4, 0] });
  b.sphere(0.45, { seg: 10, slot: 'gloss', c: 'slate', at: [0.9, 9.9, 0] });
  b.sphere(0.16, { seg: 6, slot: 'glow', c: 'green', at: [0, 10.7, 0.5] });
  const ant = b.part('antenna', { at: [0, 10.9, 0] });
  ant.box(4.6, 0.5, 0.36, { r: 0.12, slot: 'gloss', c: 'teal' });
  ant.cyl(0.14, 0.5, { seg: 6, c: 'slate', at: [0, -0.4, 0] });
  b.anchor('top', 0, 11.6, 0);
  return b.build();
}
