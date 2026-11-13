/**
 * Journey-map emblem: a chunky three-blade turbine on a little green knoll (≤ 3 meshes, fits a unit sphere).
 */
import type { Object3D } from 'three';
import { Builder, bladeGeometry } from '@/kit';

export default function emblem(): Object3D {
  const b = new Builder('plant-wind-emblem');
  b.dome(0.62, 0.3, { c: ['green', 'lime'], seg: 28, at: [0, -0.95, 0], slot: 'matte' });
  b.cyl(0.085, 1.05, { rTop: 0.055, c: ['mist', 'white'], seg: 16, at: [0, -0.72, 0], slot: 'gloss' });
  b.capsule(0.12, 0.42, { axis: 'z', c: 'white', at: [0, 0.36, -0.04], slot: 'gloss' });
  b.sphere(0.1, { c: 'teal', at: [0, 0.36, 0.2], slot: 'gloss' });
  const blade = bladeGeometry({ tipRadius: 0.62, rootRadius: 0.07, chunk: 2.6, sections: 10 });
  for (let i = 0; i < 3; i++)
    b.add(blade, { c: 'white', slot: 'gloss', at: [0, 0.36, 0.2], rot: [0, 0, 0.35 + (i * Math.PI * 2) / 3] });
  return b.build().group;
}
