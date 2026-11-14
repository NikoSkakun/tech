/**
 * Journey-map emblem: a domed containment beside a little cooling tower with a puff of steam, on a green knoll,
 * a violet ring (plantType.nuclear) around the dome (≤ 3 meshes, fits a unit sphere).
 */
import type { Object3D } from 'three';
import { Builder } from '@/kit';
import { PLANT_TYPE } from '@/style';

export default function emblem(): Object3D {
  const b = new Builder('plant-nuclear-emblem');
  b.dome(0.78, 0.26, { c: ['green', 'lime'], seg: 28, at: [0, -0.95, 0], slot: 'matte' });
  // containment: cylinder + dome
  b.cyl(0.32, 0.6, { c: ['steel.light', 'white'], seg: 28, at: [-0.2, -0.72, 0.05], slot: 'matte' });
  b.dome(0.32, 0.24, { c: 'white', seg: 28, at: [-0.2, -0.12, 0.05], slot: 'matte' });
  b.ring(0.335, 0.035, { c: PLANT_TYPE.nuclear, at: [-0.2, -0.3, 0.05], slot: 'matte' });
  // cooling tower (hyperboloid by a lathe) and its puff
  b.lathe(
    [
      [0.26, 0],
      [0.19, 0.3],
      [0.16, 0.55],
      [0.19, 0.72],
    ],
    { c: ['mist', 'white'], seg: 24, at: [0.38, -0.78, -0.18], slot: 'matte' },
  );
  for (const [x, y, r] of [
    [0.38, 0.12, 0.17],
    [0.5, 0.26, 0.14],
    [0.3, 0.3, 0.12],
  ] as const)
    b.sphere(r, { c: 'white', seg: 16, at: [x, y, -0.18], slot: 'matte' });
  return b.build().group;
}
