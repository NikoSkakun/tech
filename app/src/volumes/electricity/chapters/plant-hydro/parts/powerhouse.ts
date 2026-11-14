/**
 * The powerhouse at the toe of the dam (kit `Builder`): a long machine hall standing in the tailwater, its
 * glazed roof (part `roof`, lifted off in close-ups) showing the round «pucks» of the four vertical units on the
 * hall floor; the exciter caps on the pucks turn (parts `shaft0…3`, slowed down). Draft-tube outlets open under
 * the downstream wall at the water line; the step-up transformers stand on the tailrace deck.
 *
 * Anchors: `unit0…3` (puck centre on the floor), `outlet0…3` (draft-tube mouth), `tx0…3` (transformer
 * bushings), `roof`, `deck`.
 */
import { Builder, type KitModel } from '@/kit';
import { POWERHOUSE } from '../layout';

export interface Powerhouse extends KitModel {
  /** Shaft speed of every unit, rad/s on screen. */
  spin: number;
  update(dt: number): void;
}

export function buildPowerhouse(): Powerhouse {
  const { x0, x1, z0, z1, floorY: fy, height } = POWERHOUSE;
  const w = x1 - x0;
  const len = z1 - z0;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const b = new Builder('powerhouse');
  // substructure in the water: a heavy block with the draft-tube arches on the downstream face
  b.box(w + 10, fy + 8, len + 4, {
    r: 0.8,
    c: ['steel', 'steel.light'],
    slot: 'matte',
    at: [cx + 5, -8, cz],
  });
  POWERHOUSE.units.forEach((z, i) => {
    b.box(1.2, 5.5, 10, { r: 0.6, c: 'ink', at: [x1 + 9.6, -1.5, z] });
    b.anchor(`outlet${i}`, x1 + 10.5, 1.5, z);
  });
  // the hall: walls, a window band toward the tailrace, pilasters
  // solid up to the hall floor, then a 1 m parapet wall around the open hall (the roof sits on it)
  b.box(w, height - 3.6, len, { r: 0.7, c: ['mist', 'white'], slot: 'matte', at: [cx, fy, cz] });
  b.box(1, 3.6, len, { r: 0.3, c: 'white', slot: 'matte', at: [x0 + 0.5, fy + height - 3.6, cz] });
  b.box(1, 3.6, len, { r: 0.3, c: 'white', slot: 'matte', at: [x1 - 0.5, fy + height - 3.6, cz] });
  b.box(w, 3.6, 1, { r: 0.3, c: 'white', slot: 'matte', at: [cx, fy + height - 3.6, z0 + 0.5] });
  b.box(w, 3.6, 1, { r: 0.3, c: 'white', slot: 'matte', at: [cx, fy + height - 3.6, z1 - 0.5] });
  b.box(0.3, 4, len - 6, { r: 0, c: 'sky', slot: 'window', at: [x1 + 0.05, fy + height - 7, cz] });
  for (let z = z0 + 4; z <= z1 - 3; z += 8)
    b.box(1.2, height, 1.4, { r: 0.3, c: 'blue', at: [x1 + 0.4, fy, z] });
  b.box(1, 2.2, len + 0.6, { r: 0.3, c: 'blue', at: [cx, fy + height - 1, cz] });
  // hall floor seen through the roof: units as big round pucks with turning exciter caps
  b.box(w - 2, 0.4, len - 2, { r: 0.1, c: 'slate', at: [cx, fy + height - 3.6, cz] });
  POWERHOUSE.units.forEach((z, i) => {
    b.cyl(6.4, 1.6, { c: ['blue.dark', 'blue'], slot: 'gloss', seg: 40, at: [cx - 1, fy + height - 3.2, z] });
    b.cyl(6.6, 0.5, { c: 'yellow', seg: 40, at: [cx - 1, fy + height - 3.4, z] });
    const s = b.part(`shaft${i}`, { at: [cx - 1, fy + height - 1.6, z] });
    s.cyl(2.6, 1.2, { c: ['steel', 'mist'], slot: 'metal', seg: 24 });
    s.box(4.6, 0.5, 0.8, { r: 0.2, c: 'coral', at: [0, 1.1, 0] });
    b.anchor(`unit${i}`, cx - 1, fy + height - 1.6, z);
  });
  // glazed roof on a light frame: the visitor sees the pucks from the sky
  const roof = b.part('roof', { at: [cx, fy + height + 0.2, cz] });
  roof.box(w + 0.6, 0.5, len + 0.6, { r: 0.2, c: 'sky', slot: 'glass' });
  for (let z = -len / 2 + 2; z <= len / 2 - 1; z += 6)
    roof.box(w + 0.6, 0.7, 0.5, { r: 0.1, c: 'slate', at: [0, 0, z] });
  roof.box(1, 0.8, len + 0.6, { r: 0.2, c: 'slate', at: [-w / 2, 0, 0] });
  roof.box(1, 0.8, len + 0.6, { r: 0.2, c: 'slate', at: [w / 2, 0, 0] });
  b.anchor('roof', cx, fy + height + 1, cz);
  // tailrace deck with the step-up transformers (one per unit) and their bushings
  b.box(9, 1, len, { r: 0.4, c: 'steel.light', slot: 'matte', at: [x1 + 5, fy + 1, cz] });
  POWERHOUSE.units.forEach((z, i) => {
    b.box(4.2, 4.2, 5.4, { r: 0.6, c: ['slate', 'steel'], at: [x1 + 5, fy + 2, z + 4] });
    for (let k = -1.6; k <= 1.6; k += 0.8)
      b.box(4.6, 3.4, 0.2, { r: 0, c: 'steel', at: [x1 + 5, fy + 2.3, z + 4 + k] });
    for (let p = -1; p <= 1; p++) b.cyl(0.25, 2.2, { c: 'white', at: [x1 + 5 + p * 1.2, fy + 6.2, z + 4] });
    b.anchor(`tx${i}`, x1 + 5, fy + 8.4, z + 4);
  });
  b.anchor('deck', x1 + 5, fy + 2, cz);
  const model = b.build();
  const shafts = POWERHOUSE.units.map((_, i) => model.part(`shaft${i}`));
  return Object.assign(model, {
    spin: 1.2,
    update(this: Powerhouse, dt: number) {
      for (const s of shafts) s.rotation.y += this.spin * dt;
    },
  });
}
