/**
 * A big centre-zero galvanometer (steps `induction`, `to-generator`): a tilted case with a white arc dial,
 * ticks either side of the zero mark, a red needle (part `needle`, ±55° at full scale) and two terminals on
 * the top. `deflection` −1…1 (full scale). Origin: centre of the base; dial faces +z.
 */
import { type Mesh, type Group, type Object3D } from 'three';
import { Builder } from '@/kit';
import { SEMANTIC } from '@/style';

const SWING = (55 * Math.PI) / 180;

export interface Galvanometer {
  group: Group;
  face: Object3D;
  plus: Object3D;
  minus: Object3D;
  deflection: number;
  update(): void;
}

export function createGalvanometer(s = 1): Galvanometer {
  const b = new Builder('galvanometer');
  b.box(1.2 * s, 0.95 * s, 0.5 * s, { r: 0.1 * s, c: ['ink', 'slate'] });
  b.frame({ at: [0, 0.5 * s, 0.25 * s], rot: [-0.25, 0, 0] }, () => {
    b.box(1.04 * s, 0.7 * s, 0.03 * s, { at: [0, -0.06 * s, 0], r: 0.04 * s, mid: true, c: 'white' });
    // ticks on an arc around the pivot (pivot low in the face)
    for (let k = -5; k <= 5; k++) {
      const a = (k / 5) * SWING;
      const r = 0.48 * s;
      b.box(0.018 * s, (k === 0 ? 0.11 : k % 5 === 0 ? 0.09 : 0.06) * s, 0.01 * s, {
        at: [Math.sin(a) * r, -0.32 * s + Math.cos(a) * r, 0.02 * s],
        rot: [0, 0, -a],
        r: 0,
        mid: true,
        c: k === 0 ? 'ink' : k < 0 ? 'blue' : 'coral',
      });
    }
    b.cyl(0.05 * s, 0.04 * s, { axis: 'z', at: [0, -0.32 * s, 0], seg: 16, slot: 'metal', c: 'steel' });
    const needle = b.part('needle', { at: [0, -0.32 * s, 0.035 * s] });
    needle.box(0.02 * s, 0.5 * s, 0.012 * s, { at: [0, 0.25 * s, 0], r: 0, mid: true, c: 'red' });
    b.anchor('face', 0, 0.05 * s, 0.05 * s);
  });
  for (const [x, c] of [
    [-0.38, SEMANTIC.dcPlus],
    [0.38, SEMANTIC.dcMinus],
  ] as const) {
    b.cyl(0.06 * s, 0.08 * s, { at: [x * s, 0.95 * s, -0.05 * s], seg: 14, c });
    b.anchor(c === SEMANTIC.dcPlus ? 'plus' : 'minus', x * s, 1.03 * s, -0.05 * s);
  }
  const model = b.build();
  model.group.traverse((o) => ((o as Mesh).castShadow = true));
  const needle = model.part('needle');
  const self: Galvanometer = {
    group: model.group,
    face: model.anchor('face'),
    plus: model.anchor('plus'),
    minus: model.anchor('minus'),
    deflection: 0,
    update() {
      needle.rotation.z = -Math.max(-1.08, Math.min(1.08, self.deflection)) * SWING;
    },
  };
  return self;
}
