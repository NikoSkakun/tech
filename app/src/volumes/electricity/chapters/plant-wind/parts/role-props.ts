/**
 * Props of the last step: three portal rings that lead on (hub, solar plants, the power system) and a bird
 * radar by the farm.
 * Built with the kit `Builder`; glowing parts use the always-on `glow` slot so they read at dusk.
 */
import { Builder, type KitModel } from '@/kit';
import type { ColorLike } from '@/style';

/**
 * Portal: a standing ring gate. Origin = centre of the opening, facing ±Z. `lit` = its chapter exists: the rim
 * glows; a gate to a chapter that is not built yet is a dark matte ring.
 */
export function buildPortal(color: ColorLike, radius = 19, lit = true): KitModel {
  const b = new Builder('portal');
  b.ring(radius, lit ? 1.5 : 1, { axis: 'z', seg: 48, tubeSeg: 10, c: color, slot: lit ? 'glow' : 'gloss' });
  if (lit) b.ring(radius * 0.8, 0.5, { axis: 'z', seg: 40, tubeSeg: 6, c: 'white', slot: 'glow' });
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
