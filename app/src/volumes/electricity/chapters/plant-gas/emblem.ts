/**
 * Journey-map emblem: a chunky gas turbine in section on a little concrete knoll — the blades of the
 * compressor in `sky`, the hot turbine in `orange`, the gas ring in `violet` and a tall `pink` stack band
 * (plantType.gas). ≤ 3 meshes (one per slot), fits a unit sphere.
 */
import type { Object3D } from 'three';
import { Builder } from '@/kit';
import { PLANT_TYPE } from '@/style';

export default function emblem(): Object3D {
  const b = new Builder('plant-gas-emblem');
  b.dome(0.7, 0.28, { c: ['steel', 'mist'], seg: 28, at: [0, -0.92, 0], slot: 'matte' });
  // turbine body (casing cut open: a cone of blades inside a half shell)
  b.cone(0.34, 0.9, { axis: 'x', tip: 0.22, seg: 24, c: ['sky.dark', 'sky'], at: [-0.62, -0.32, 0.05], slot: 'gloss' });
  b.cyl(0.26, 0.42, { axis: 'x', rTop: 0.34, seg: 24, c: ['orange', 'amber'], at: [0.26, -0.32, 0.05], slot: 'gloss' });
  b.ring(0.38, 0.05, { axis: 'x', seg: 28, tubeSeg: 8, c: 'violet', at: [0.18, -0.32, 0.05], slot: 'gloss' });
  // stack with the plant-type band
  b.cyl(0.13, 1.3, { rTop: 0.1, seg: 20, c: ['mist', 'white'], at: [0.5, -0.72, -0.25], slot: 'gloss' });
  b.cyl(0.115, 0.16, { seg: 20, c: PLANT_TYPE.gas, at: [0.5, 0.36, -0.25], slot: 'gloss' });
  return b.build().group;
}
