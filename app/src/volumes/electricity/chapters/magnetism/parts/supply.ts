/**
 * Bench power supply «з великою ручкою-регулятором»: a rounded case with a sloped front, a big knob (part
 * `knob`, turned by `level` −1…1), a status LED that glows with the output and two terminals (+ coral,
 * − blue). Origin: centre of the base; front faces +z. Terminals are anchors `plus` / `minus` on the top.
 */
import { Mesh, SphereGeometry, type Group, type Object3D } from 'three';
import { Builder } from '@/kit';
import { SEMANTIC } from '@/style';
import { glow } from '../world';

export interface SupplyModel {
  group: Group;
  plus: Object3D;
  minus: Object3D;
  knobAnchor: Object3D;
  /** Output −1…1 (knob angle and LED). */
  level: number;
  update(t: number): void;
}

export function createSupply(scale = 1): SupplyModel {
  const s = scale;
  const b = new Builder('supply');
  b.box(1.3 * s, 0.62 * s, 0.8 * s, { r: 0.08 * s, c: ['slate', 'steel'] });
  b.box(1.16 * s, 0.46 * s, 0.04 * s, { at: [0, 0.08 * s, 0.4 * s], r: 0.02 * s, c: 'ink' });
  // terminals on the top
  for (const [x, c] of [
    [-0.32, SEMANTIC.dcPlus],
    [0.32, SEMANTIC.dcMinus],
  ] as const) {
    b.cyl(0.075 * s, 0.1 * s, { at: [x * s, 0.62 * s, 0.1 * s], seg: 16, c });
    b.cyl(0.035 * s, 0.06 * s, { at: [x * s, 0.72 * s, 0.1 * s], seg: 10, slot: 'metal', c: 'mist' });
  }
  b.anchor('plus', -0.32 * s, 0.76 * s, 0.1 * s).anchor('minus', 0.32 * s, 0.76 * s, 0.1 * s);
  // the big knob with a pointer ridge
  const knob = b.part('knob', { at: [0.2 * s, 0.32 * s, 0.42 * s], rot: [Math.PI / 2, 0, 0] });
  knob.cyl(0.17 * s, 0.1 * s, { seg: 32, c: 'ink', bevel: 0.02 * s });
  knob.box(0.035 * s, 0.03 * s, 0.13 * s, { at: [0, 0.1 * s, -0.08 * s], r: 0, c: 'amber' });
  b.anchor('knob', 0.2 * s, 0.32 * s, 0.5 * s);
  const model = b.build();
  model.group.traverse((o) => ((o as Mesh).castShadow = true));
  const ledMat = glow('green', 0.3);
  const led = new Mesh(new SphereGeometry(0.05 * s, 12, 8), ledMat);
  led.position.set(-0.35 * s, 0.3 * s, 0.42 * s);
  model.group.add(led);
  const k = model.part('knob');
  const self: SupplyModel = {
    group: model.group,
    plus: model.anchor('plus'),
    minus: model.anchor('minus'),
    knobAnchor: model.anchor('knob'),
    level: 0,
    update(t) {
      k.rotation.y = -self.level * 2.4;
      ledMat.intensity = 0.3 + 1.3 * Math.min(Math.abs(self.level) * 3, 1) * (0.9 + 0.1 * Math.sin(t * 6));
    },
  };
  return self;
}
