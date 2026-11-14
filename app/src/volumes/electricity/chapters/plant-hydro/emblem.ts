/**
 * Journey-map emblem: a little green valley closed by a concrete dam — blue reservoir behind it, a white
 * spillway jet and a tiny powerhouse at its toe (≤ 3 meshes: matte ground + concrete, gloss water + foam).
 */
import type { Object3D } from 'three';
import { Builder, G } from '@/kit';
import { PLANT_TYPE } from '@/style';

export default function emblem(): Object3D {
  const b = new Builder('plant-hydro-emblem');
  // two hills (valley walls) on a round base
  b.dome(0.82, 0.26, { c: ['green.dark', 'green'], seg: 28, at: [0, -0.62, 0], slot: 'matte' });
  b.sphere(0.42, { c: ['green', 'lime'], at: [-0.5, -0.42, -0.34], slot: 'matte' });
  b.sphere(0.36, { c: ['green', 'lime'], at: [0.5, -0.44, -0.3], slot: 'matte' });
  // gravity-dam wedge across the valley (profile in XY, extruded along Z → turned so the crest runs along X)
  const wedge = G.extrude(
    [
      [-0.08, 0],
      [0.42, 0],
      [0.06, 0.62],
      [-0.08, 0.62],
    ],
    1.1,
    { bevel: 0.03 },
  );
  b.add(wedge, { c: ['mist', 'white'], slot: 'matte', at: [0, -0.5, 0.02], rot: [0, -Math.PI / 2, 0] });
  b.box(0.36, 0.16, 0.18, { r: 0.04, c: 'slate', at: [0.24, -0.42, 0.5], slot: 'matte' });
  // reservoir behind the dam and the spillway jet
  b.cyl(0.6, 0.05, { seg: 32, c: PLANT_TYPE.hydro, at: [0, 0.02, -0.42], slot: 'gloss' });
  b.capsule(0.06, 0.5, { axis: 'z', c: 'white', at: [-0.28, -0.24, 0.36], rot: [0.9, 0, 0], slot: 'gloss' });
  return b.build().group;
}
