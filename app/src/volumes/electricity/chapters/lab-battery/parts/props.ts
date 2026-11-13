/** Small props shared by several steps (kit style: one merged model each). */
import type { Group } from 'three';
import { Builder } from '@/kit';

/** A power bank lying on the bench: rounded slab, USB ports, four charge LEDs. ≈ 0.75 × 0.16 × 0.42 units. */
export function createPowerBank(): Group {
  const b = new Builder('power-bank');
  b.box(0.75, 0.16, 0.42, { r: 0.06, slot: 'gloss', c: ['teal.dark', 'teal'] });
  b.box(0.1, 0.05, 0.02, { at: [-0.2, 0.05, 0.21], r: 0.01, c: 'ink' });
  b.box(0.1, 0.05, 0.02, { at: [0.0, 0.05, 0.21], r: 0.01, c: 'ink' });
  for (let k = 0; k < 4; k++)
    b.sphere(0.022, {
      at: [0.14 + k * 0.07, 0.165, 0.12],
      seg: 8,
      slot: 'glow',
      c: k < 3 ? 'lime' : 'slate',
    });
  return b.build().group;
}
