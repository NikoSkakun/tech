/**
 * The last frame of `current/dc-ac`, rebuilt as a memory (steps `magnet-field` and `oersted`): a horizontal
 * copper wire on two posts over a brass compass, three `magenta` rings around the wire. `field` 0…1 lights the
 * rings; `needle` is the needle's deflection from north (rad, + = west), ≈ 79° for 5 A at 1 cm.
 */
import { Mesh, TorusGeometry, type Group } from 'three';
import { Builder } from '@/kit';
import { SEMANTIC } from '@/style';
import { COPPER } from './coil';
import { addCompassBody } from './compass';
import { glow } from '../world';

export const MEMORY_DEFLECTION = (79 * Math.PI) / 180;

export interface Memory {
  group: Group;
  field: number;
  needle: number;
  update(t: number): void;
}

export function createMemory(): Memory {
  const b = new Builder('memory');
  for (const z of [-0.9, 0.9]) {
    b.box(0.36, 0.08, 0.36, { at: [0, 0, z], r: 0.03, c: ['ink', 'slate'] });
    b.cyl(0.045, 0.5, { at: [0, 0.08, z], seg: 12, slot: 'gloss', c: 'white' });
  }
  b.rod([0, 0.6, -0.9], [0, 0.6, 0.9], 0.035, { slot: 'metal', c: COPPER });
  addCompassBody(b, 0.42, [0, 0, 0]);
  const nb = b.part('needle', { at: [0, 0.42 * 0.36, 0] });
  nb.cone(0.05, 0.33, { axis: 'x', seg: 4, c: SEMANTIC.poleN, s: [1, 0.3, 1] });
  nb.frame({ rot: [0, Math.PI, 0] }, () => nb.cone(0.05, 0.33, { axis: 'x', seg: 4, c: SEMANTIC.poleS, s: [1, 0.3, 1] }));
  const model = b.build();
  const ringMat = glow(SEMANTIC.fieldB, 0);
  const rings = [-0.55, 0, 0.55].map((z) => {
    const r = new Mesh(new TorusGeometry(0.32, 0.016, 8, 48), ringMat);
    r.position.set(0, 0.6, z);
    model.group.add(r);
    return r;
  });
  const needle = model.part('needle');
  const self: Memory = {
    group: model.group,
    field: 1,
    needle: MEMORY_DEFLECTION,
    update(t) {
      // the needle lies along +x at rotation 0: north (−z) is +π/2, west adds to it
      needle.rotation.y = Math.PI / 2 + self.needle;
      ringMat.intensity = 1.2 * self.field;
      rings.forEach((r, k) => {
        r.visible = self.field > 0.01;
        r.scale.setScalar(1 + 0.06 * Math.sin(t * 2.4 + k * 2.1));
      });
    },
  };
  self.update(0);
  return self;
}
