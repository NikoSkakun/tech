/**
 * AA battery in a holder, lying along local X with «+» at +X. Toy scale: 1.6 units long (real 50 mm).
 * The holder's spring clips carry the wire terminals (`plus` / `minus` anchors, on the table at y ≈ 0.16).
 * `heat` (0…1) makes the can glow along the heat ramp (short circuit: I²·r inside the cell).
 */
import type { Group, Object3D } from 'three';
import { applyHeat } from '@/fx';
import { Builder } from '@/kit';
import { SEMANTIC, type KToonMaterial } from '@/style';

export const BATTERY = { length: 1.6, radius: 0.31, axisY: 0.44, terminalX: 1.12 } as const;

export interface Battery {
  group: Group;
  plus: Object3D;
  minus: Object3D;
  /** Anchor on top of the can (labels, hotspots). */
  top: Object3D;
  heat: number;
}

export function createBattery(): Battery {
  const { length: L, radius: R, axisY: Y, terminalX: TX } = BATTERY;
  const b = new Builder('battery-aa');
  // holder: tray with two end walls and spring clips
  b.box(L + 0.75, 0.1, 0.95, { r: 0.04, c: ['ink', 'slate'] });
  for (const s of [-1, 1] as const) {
    b.box(0.12, 0.62, 0.8, { at: [s * (L / 2 + 0.2), 0.08, 0], r: 0.04, c: 'slate' });
    b.box(0.05, 0.4, 0.34, { at: [s * (L / 2 + 0.115), 0.24, 0], r: 0.015, slot: 'metal', c: 'mist' });
    // screw terminal on the table side of the wall
    b.cyl(0.085, 0.16, {
      at: [s * TX, 0.08, 0],
      seg: 16,
      slot: 'metal',
      c: s > 0 ? SEMANTIC.dcPlus : SEMANTIC.dcMinus,
    });
    b.cyl(0.05, 0.05, { at: [s * TX, 0.24, 0], seg: 12, slot: 'metal', c: 'mist' });
  }
  // the can: dark jacket with an amber band toward «+» (own `gloss` material so it can heat up)
  b.cyl(R, L * 0.62, { at: [-L / 2, Y, 0], axis: 'x', seg: 40, slot: 'gloss', c: 'ink', bevel: 0.03 });
  b.cyl(R + 0.002, L * 0.38, {
    at: [-L / 2 + L * 0.62, Y, 0],
    axis: 'x',
    seg: 40,
    slot: 'gloss',
    c: 'amber',
    bevel: 0.03,
  });
  b.cyl(R + 0.006, 0.05, {
    at: [-L / 2 + L * 0.6, Y, 0],
    axis: 'x',
    seg: 40,
    slot: 'metal',
    c: 'mist',
    bevel: 0.01,
  });
  // «+» nub and flat «−» plate
  b.cyl(0.11, 0.1, { at: [L / 2 - 0.02, Y, 0], axis: 'x', seg: 20, slot: 'metal', c: 'mist' });
  b.cyl(R * 0.8, 0.03, { at: [-L / 2 - 0.02, Y, 0], axis: 'x', seg: 28, slot: 'metal', c: 'mist' });
  // pole marks on the jacket (tertiary detail): «+» cross and «−» bar, facing up
  b.box(0.2, 0.012, 0.05, { at: [L / 2 - 0.3, Y + R, 0], r: 0, c: 'white' });
  b.box(0.05, 0.012, 0.2, { at: [L / 2 - 0.3, Y + R, 0], r: 0, c: 'white' });
  b.box(0.2, 0.012, 0.05, { at: [-L / 2 + 0.3, Y + R, 0], r: 0, c: 'white' });
  b.anchor('plus', TX, 0.16, 0)
    .anchor('minus', -TX, 0.16, 0)
    .anchor('top', 0, Y + R, 0);
  const model = b.build();
  const can = model.mats.get('gloss') as KToonMaterial;
  let heat = 0;
  return {
    group: model.group,
    plus: model.anchor('plus'),
    minus: model.anchor('minus'),
    top: model.anchor('top'),
    get heat() {
      return heat;
    },
    set heat(v: number) {
      heat = v;
      applyHeat(can, v, 1.6);
    },
  };
}
