/**
 * Knife switch («вимикач-тумблер»): a copper blade hinged on terminal `b` (+X) that drops into the clip of
 * terminal `a` (−X). The open blade stands at 55° — an unmistakable gap in the circuit. `closed` is the target
 * state; the blade eases to it in `update` (or jumps with `snap()`).
 */
import type { Group, Object3D } from 'three';
import { damp } from '@/engine/api';
import { Builder } from '@/kit';

export interface KnifeSwitch {
  group: Group;
  a: Object3D;
  b: Object3D;
  /** Tip of the handle (labels, pointer target). */
  handle: Object3D;
  closed: boolean;
  /** 0 open … 1 closed, as shown. */
  readonly amount: number;
  snap(): void;
  update(dt: number): void;
}

const OPEN_ANGLE = 0.96; // rad

export function createSwitch(): KnifeSwitch {
  const b = new Builder('knife-switch');
  b.box(1.5, 0.16, 0.8, { r: 0.05, c: ['ink', 'slate'] });
  for (const s of [-1, 1] as const) {
    b.cyl(0.085, 0.14, { at: [s * 0.58, 0.14, 0.24], seg: 16, slot: 'metal', c: 'mist' });
    b.cyl(0.05, 0.05, { at: [s * 0.58, 0.28, 0.24], seg: 12, slot: 'metal', c: 'steel' });
  }
  // clip (two jaws) on the `a` side, hinge post on the `b` side
  for (const z of [-0.075, 0.075])
    b.box(0.26, 0.3, 0.04, { at: [-0.5, 0.14, z - 0.1], r: 0.012, slot: 'metal', c: 'amber' });
  b.box(0.16, 0.34, 0.2, { at: [0.5, 0.14, -0.1], r: 0.03, slot: 'metal', c: 'amber' });
  const blade = b.part('blade', { at: [0.5, 0.4, -0.1] });
  blade.box(1.12, 0.14, 0.05, { at: [-0.5, -0.07, 0], r: 0.015, slot: 'metal', c: 'orange' });
  blade.cyl(0.07, 0.26, { at: [0, -0.0, -0.13], axis: 'z', seg: 16, slot: 'metal', c: 'steel' }); // hinge pin
  blade.cyl(0.1, 0.5, { at: [-1.12, 0.0, 0], axis: 'y', seg: 20, slot: 'gloss', c: 'coral', bevel: 0.04 }); // handle
  blade.anchor('handle', -1.12, 0.5, 0);
  b.anchor('a', -0.58, 0.16, 0.24).anchor('b', 0.58, 0.16, 0.24);
  const model = b.build();
  const part = model.part('blade');
  let amount = 0;
  const apply = (): void => void (part.rotation.z = -OPEN_ANGLE * (1 - amount));
  apply();
  const self: KnifeSwitch = {
    group: model.group,
    a: model.anchor('a'),
    b: model.anchor('b'),
    handle: model.anchor('blade.handle'),
    closed: false,
    get amount() {
      return amount;
    },
    snap() {
      amount = self.closed ? 1 : 0;
      apply();
    },
    update(dt) {
      amount = damp(amount, self.closed ? 1 : 0, 14, dt);
      apply();
    },
  };
  return self;
}
