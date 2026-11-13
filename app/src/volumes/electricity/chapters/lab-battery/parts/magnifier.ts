/**
 * Step 7: the «вікно-лупа» on the anode — a round lens showing the edge of the graphite: ions (`lime`) slip
 * into the galleries while charging; when the regime is violated (cold, too much current) silvery lithium
 * needles grow on the edge instead (`plating` 0…1).
 */
import {
  CircleGeometry,
  ConeGeometry,
  type Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  TorusGeometry,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { ChapterContext } from '@/engine/api';
import { createFlow } from '@/fx';
import { K } from '@/style';
import type { Mats } from '../world';
import { group, mesh } from '../world';

export interface Magnifier {
  group: Group;
  /** Ion flow into the graphite, in C units (0 = idle). */
  flow: number;
  /** 0…1: how far the lithium needles have grown. */
  plating: number;
  update(dt: number): void;
}

/** Lens of radius 0.62 in its local XY plane, facing +Z. */
export function createMagnifier(ctx: ChapterContext, mats: Mats): Magnifier {
  const g = group('magnifier');
  const R = 0.62;
  g.add(mesh(new TorusGeometry(R, 0.05, 12, 64), mats.steel, 0, 0, 0));
  const handle = mesh(new RoundedBoxGeometry(0.09, 0.6, 0.09, 2, 0.03), mats.dark, 0.6, -0.72, 0);
  handle.rotation.z = 0.7;
  g.add(handle);
  const back = new Mesh(new CircleGeometry(R, 48), K.flat('bg.deep'));
  back.position.z = -0.02;
  const glass = new Mesh(new CircleGeometry(R, 48), mats.glass);
  glass.position.z = 0.12;
  glass.renderOrder = 5;
  g.add(back, glass);
  // graphite galleries: four slabs entering from the left, ions arrive from the right (the electrolyte side)
  const slab = new RoundedBoxGeometry(0.62, 0.075, 0.1, 2, 0.025);
  const ys = [-0.33, -0.11, 0.11, 0.33];
  for (const y of ys) g.add(mesh(slab, mats.graphite, -0.22 - Math.abs(y) * 0.15, y, 0.03, false));
  const lanes = [-0.22, 0, 0.22].map((y) => ({
    path: [
      new Vector3(0.52 - Math.abs(y) * 0.5, y + 0.03, 0.05),
      new Vector3(0.1, y, 0.05),
      new Vector3(-0.45 + Math.abs(y) * 0.4, y, 0.05),
    ],
  }));
  const ions = createFlow(ctx, {
    kind: 'ion',
    paths: lanes,
    count: 9,
    exactCount: true,
    radius: 0.05,
    speed: 0,
    endFade: 0.18,
    halo: false,
  });
  g.add(ions);
  const needleGeometry = new ConeGeometry(0.035, 0.3, 8);
  needleGeometry.rotateZ(-Math.PI / 2);
  needleGeometry.translate(0.15, 0, 0);
  const needles = new InstancedMesh(needleGeometry, K.metal({ color: 'mist', specular: 0.9 }), ys.length * 2);
  needles.frustumCulled = false;
  g.add(needles);
  const m4 = new Matrix4();
  const q = new Quaternion();
  const p = new Vector3();
  const s = new Vector3();
  const tilt = new Quaternion();
  const axis = new Vector3(0, 0, 1);
  const self: Magnifier = {
    group: g,
    flow: 0,
    plating: 0,
    update() {
      ions.speed = 0.25 * self.flow;
      ions.density = self.flow > 0.01 ? 1 : 0.35;
      let k = 0;
      for (const y of ys)
        for (const dy of [-0.03, 0.035]) {
          // needles sprout from the slab tips; alternate ones lag so the growth looks organic
          const grow = Math.min(Math.max(self.plating * 1.4 - (k % 3) * 0.2, 0), 1);
          tilt.setFromAxisAngle(axis, dy * 9);
          needles.setMatrixAt(
            k++,
            m4.compose(
              p.set(0.07 - Math.abs(y) * 0.15, y + dy, 0.05),
              q.copy(tilt),
              s.setScalar(Math.max(grow, 1e-4)),
            ),
          );
        }
      needles.instanceMatrix.needsUpdate = true;
    },
  };
  return self;
}
