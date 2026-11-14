/**
 * Journey-map emblem: a chunky boiler house with its striped stack and one cooling tower on a coal-dark
 * knoll, a warm furnace window (≤ 3 meshes, fits a unit sphere, front toward +Z).
 */
import type { Object3D } from 'three';
import { Builder } from '@/kit';
import { PLANT_TYPE } from '@/style';

export default function emblem(): Object3D {
  const b = new Builder('plant-coal-emblem');
  // knoll with a coal heap
  b.dome(0.78, 0.26, { c: ['slate.dark', 'slate'], seg: 28, at: [0, -0.92, 0], slot: 'matte' });
  b.dome(0.24, 0.14, { c: PLANT_TYPE.coal, seg: 14, at: [-0.48, -0.74, 0.2], slot: 'matte' });
  // boiler house + low turbine hall
  b.box(0.42, 0.86, 0.38, { r: 0.05, c: ['steel', 'mist'], at: [-0.08, -0.72, -0.05], slot: 'gloss' });
  b.box(0.62, 0.32, 0.26, { r: 0.04, c: ['amber.dark', 'amber'], at: [-0.02, -0.72, 0.26], slot: 'gloss' });
  b.box(0.3, 0.1, 0.02, { r: 0.01, c: 'orange', at: [-0.08, -0.36, 0.15], slot: 'glow' });
  // stack with red bands
  b.cyl(0.07, 1.5, { rTop: 0.045, c: 'white', seg: 16, at: [0.32, -0.74, -0.18], slot: 'gloss' });
  b.cyl(0.05, 0.1, { c: 'red', seg: 16, at: [0.32, 0.56, -0.18], slot: 'gloss' });
  b.cyl(0.05, 0.08, { c: 'red', seg: 16, at: [0.32, 0.38, -0.18], slot: 'gloss' });
  // cooling tower (hyperboloid lathe)
  b.lathe(
    [
      [0.3, 0],
      [0.22, 0.32],
      [0.19, 0.5],
      [0.21, 0.66],
    ],
    { c: ['mist', 'white'], seg: 28, at: [0.58, -0.74, 0.22], slot: 'gloss' },
  );
  return b.build().group;
}
