/**
 * `StaticKit` figure of step 6: a capsule person in a woollen sweater (`mist`, knitted "loops") with strands of
 * hair that rise toward a charged balloon, and one arm whose pointing finger can be dragged to the balloon.
 * Scene units; the figure stands on the table at `STATIC.figureX`.
 */
import {
  CapsuleGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import { createHalo } from '@/fx';
import { Builder } from '@/kit';
import { K, SEMANTIC } from '@/style';
import { STATIC } from '../layout';

const STRANDS = 13;
const HEAD = new Vector3(0, 4.25, 0);
const SHOULDER = new Vector3(0.52, 3.1, 0.25);
const REACH = 2.1;
const Y = new Vector3(0, 1, 0);
/** Finger tip while the arm hangs at the side (the learner raises it by dragging the hand). */
export const REST_HAND = new Vector3(1.05, 1.55, 0.5);

export interface Figure {
  group: Group;
  /** Drag target at the finger tip. */
  hand: Mesh;
  /** Finger tip, local to the figure group (set it, then `update`). */
  finger: Vector3;
  /** World-space point that attracts the hair, and how strongly (0…1). */
  attract: Vector3;
  lift: number;
  /** 0…1: `coral` halo of the sweater that gave its electrons away. */
  charged: number;
  hover: number;
  /** Move the finger toward a local point, limited by the arm's reach. */
  pointAt(local: Vector3): void;
  update(dt: number, t: number): void;
}

export function createFigure(): Figure {
  const group = new Group();
  group.name = 'figure';
  group.position.set(STATIC.figureX, 0, 0);
  const b = new Builder('figure');
  b.cyl(0.95, 0.12, { seg: 28, bevel: 0.04, c: ['bg.plum', 'slate'] });
  for (const x of [-0.26, 0.26]) b.capsule(0.2, 1.5, { c: ['slate', 'steel'], at: [x, 0.85, 0] });
  b.capsule(0.62, 2.1, { seg: 20, slot: 'soft', c: ['steel', 'mist'], at: [0, 2.5, 0] }); // sweater
  for (let i = 0; i < 5; i++)
    b.ring(0.6 - Math.abs(i - 2) * 0.03, 0.045, {
      seg: 28,
      slot: 'soft',
      c: 'white',
      at: [0, 1.95 + i * 0.3, 0],
    }); // knitted rows
  b.ring(0.3, 0.12, { seg: 20, slot: 'soft', c: 'mist', at: [0, 3.55, 0] }); // collar
  b.sphere(0.56, { seg: 26, c: ['orange', 'amber.light'], at: [HEAD.x, HEAD.y, HEAD.z] });
  b.capsule(0.17, 1.5, { slot: 'soft', c: ['steel', 'mist'], at: [-0.72, 2.65, 0], rot: [0, 0, -0.16] }); // the resting arm
  group.add(b.build().group);

  const hair = new InstancedMesh(
    new CapsuleGeometry(0.035, 0.72, 4, 8),
    K.toon({ color: 'wireBrown' }),
    STRANDS,
  );
  hair.frustumCulled = false;
  const sleeve = K.toon({ color: 'mist' });
  const arm = new Mesh(new CapsuleGeometry(0.16, 1, 6, 12), sleeve);
  const palm = new Mesh(new SphereGeometry(0.17, 16, 12), K.toon({ color: 'amber.light' }));
  const hand = new Mesh(new SphereGeometry(0.5, 12, 8), K.flat('cyan'));
  hand.material.colorWrite = false;
  hand.material.depthWrite = false;
  const ping = createHalo({ color: 'cyan', size: 0.8, intensity: 0.5, amount: 0.5 });
  const halo = createHalo({ color: SEMANTIC.proton, size: 4.2, intensity: 0, amount: 0.2 });
  halo.position.set(0, 2.6, 0);
  group.add(halo, hair, arm, palm, hand, ping);

  const roots = Array.from({ length: STRANDS }, (_, i) => {
    const a = (i / STRANDS) * Math.PI * 2;
    const tilt = 0.35 + (i % 3) * 0.28;
    return new Vector3(Math.sin(tilt) * Math.cos(a), Math.cos(tilt), Math.sin(tilt) * Math.sin(a));
  });
  const m = new Matrix4();
  const q = new Quaternion();
  const dir = new Vector3();
  const pos = new Vector3();
  const local = new Vector3();
  const one = new Vector3(1, 1, 1);
  let lifted = 0;
  const figure: Figure = {
    group,
    hand,
    finger: REST_HAND.clone(),
    attract: new Vector3(),
    lift: 0,
    charged: 0,
    hover: 0,
    pointAt(target) {
      figure.finger.copy(target).sub(SHOULDER).clampLength(0.7, REACH).add(SHOULDER);
    },
    update(dt, t) {
      lifted += (figure.lift - lifted) * Math.min(dt * 6, 1);
      group.worldToLocal(local.copy(figure.attract));
      roots.forEach((root, i) => {
        // a resting strand droops outward; a charged balloon pulls it straight toward itself
        pos.copy(root).multiplyScalar(0.55).add(HEAD);
        dir
          .copy(root)
          .multiplyScalar(0.55)
          .setY(root.y * 0.55 - 0.5 + 0.06 * Math.sin(t * 2 + i))
          .normalize();
        dir
          .lerp(
            local.clone().sub(pos).normalize(),
            lifted * (0.75 + 0.25 * Math.sin(t * 7 + i * 1.9) * lifted),
          )
          .normalize();
        hair.setMatrixAt(i, m.compose(pos.addScaledVector(dir, 0.36), q.setFromUnitVectors(Y, dir), one));
      });
      hair.instanceMatrix.needsUpdate = true;
      // the arm: a capsule from the shoulder to the finger tip
      dir.copy(figure.finger).sub(SHOULDER);
      const length = dir.length();
      arm.position.copy(SHOULDER).addScaledVector(dir, 0.5);
      arm.quaternion.setFromUnitVectors(Y, dir.normalize());
      arm.scale.set(1, length / 1.32, 1);
      palm.position.copy(figure.finger);
      hand.position.copy(figure.finger);
      ping.position.copy(figure.finger);
      ping.intensity = 0.35 + 0.6 * figure.hover + 0.15 * Math.sin(t * 3);
      halo.intensity = 0.8 * figure.charged;
    },
  };
  return figure;
}
