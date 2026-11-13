/**
 * Switches of the RL circuit of step `inductance`. `createKnifeSwitch` — S1, a big knife switch whose blade
 * (part `blade`) lifts 65° when open; `createBreaker` — S2, a push-button breaker: two contact posts bridged by
 * a copper bar that jumps up when the branch is broken. `open` 0…1 (eased by the step). Origin: base centre;
 * contacts `a` / `b` along x.
 */
import { type Mesh, type Group, type Object3D } from 'three';
import { Builder } from '@/kit';
import { COPPER } from './coil';

export interface SwitchModel {
  group: Group;
  a: Object3D;
  b: Object3D;
  /** Point between the contacts (spark, hotspot). */
  gap: Object3D;
  /** A point on the body that is always solid (click target for tests). */
  hit: Object3D;
  open: number;
  update(): void;
}

export function createKnifeSwitch(len = 0.9): SwitchModel {
  const b = new Builder('knife-switch');
  b.box(len + 0.3, 0.1, 0.42, { r: 0.04, c: ['ink', 'slate'] });
  for (const x of [-len / 2, len / 2]) {
    b.box(0.1, 0.22, 0.16, { at: [x, 0.1, 0], r: 0.02, slot: 'metal', c: 'steel' });
  }
  const blade = b.part('blade', { at: [-len / 2, 0.27, 0] });
  blade.box(len + 0.06, 0.04, 0.1, { at: [len / 2, 0, 0], r: 0.015, mid: true, slot: 'metal', c: COPPER });
  blade.box(0.08, 0.26, 0.08, { at: [len + 0.02, 0.13, 0], r: 0.03, mid: true, c: 'red' });
  b.anchor('a', -len / 2, 0.1, 0).anchor('b', len / 2, 0.1, 0).anchor('gap', len / 2, 0.38, 0).anchor('hit', -len / 2, 0.22, 0.08);
  const model = b.build();
  model.group.traverse((o) => ((o as Mesh).castShadow = true));
  const part = model.part('blade');
  const self: SwitchModel = {
    group: model.group,
    a: model.anchor('a'),
    b: model.anchor('b'),
    gap: model.anchor('gap'),
    hit: model.anchor('hit'),
    open: 0,
    update() {
      part.rotation.z = self.open * 1.15;
    },
  };
  return self;
}

export function createBreaker(len = 0.5): SwitchModel {
  const b = new Builder('breaker');
  b.box(len + 0.28, 0.12, 0.4, { r: 0.04, c: ['ink', 'slate'] });
  for (const x of [-len / 2, len / 2]) b.cyl(0.06, 0.2, { at: [x, 0.12, 0], seg: 14, slot: 'metal', c: 'steel' });
  const bar = b.part('bar', { at: [0, 0.33, 0] });
  bar.box(len + 0.14, 0.05, 0.12, { r: 0.015, mid: true, slot: 'metal', c: COPPER });
  bar.cyl(0.09, 0.12, { at: [0, 0.025, 0], seg: 18, c: 'red' });
  b.anchor('a', -len / 2, 0.1, 0).anchor('b', len / 2, 0.1, 0).anchor('gap', len / 2, 0.34, 0).anchor('hit', -len / 2, 0.24, 0.06);
  const model = b.build();
  model.group.traverse((o) => ((o as Mesh).castShadow = true));
  const part = model.part('bar');
  const self: SwitchModel = {
    group: model.group,
    a: model.anchor('a'),
    b: model.anchor('b'),
    gap: model.anchor('gap'),
    hit: model.anchor('hit'),
    open: 0,
    update() {
      part.position.y = 0.33 + self.open * 0.22;
    },
  };
  return self;
}
