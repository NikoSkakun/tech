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

const STRANDS = 18;
const SEGS = 4;
const SEG_LEN = 0.17;
const DOWN = new Vector3(0, -1, 0);
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

  // every strand is a chain of SEGS short capsules, so it can bend: it lies curled over the scalp at rest
  const hair = new InstancedMesh(
    new CapsuleGeometry(0.045, SEG_LEN, 4, 8),
    K.toon({ color: 'wireBrown' }),
    STRANDS * SEGS,
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
    const a = (i / STRANDS) * Math.PI * 2 + (i % 2) * 0.3;
    const tilt = 0.25 + (i % 3) * 0.3;
    return new Vector3(Math.sin(tilt) * Math.cos(a), Math.cos(tilt), Math.sin(tilt) * Math.sin(a));
  });
  // resting direction of segment k: from the scalp normal, curling down along the head (a combed-over tuft)
  const rest = roots.map((n) => {
    const along = DOWN.clone().addScaledVector(n, -DOWN.dot(n));
    if (along.lengthSq() < 1e-4) along.set(n.x || 1, 0, n.z);
    along.normalize();
    return Array.from({ length: SEGS }, (_, k) =>
      n
        .clone()
        .lerp(along, 0.35 + (0.55 * k) / (SEGS - 1))
        .normalize(),
    );
  });
  const toward = new Vector3();
  const seg = new Vector3();
  const taper = new Vector3();
  const m = new Matrix4();
  const q = new Quaternion();
  const dir = new Vector3();
  const pos = new Vector3();
  const local = new Vector3();
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
        // A charged balloon pulls the strand toward itself, the tip most: like-charged strands also push each
        // other apart, so the pull is mixed with the scalp normal (the hair "stands on end").
        pos.copy(root).multiplyScalar(0.52).add(HEAD);
        toward.copy(local).sub(pos).normalize().addScaledVector(root, 0.6).normalize();
        const shiver = 1 + 0.12 * Math.sin(t * 7 + i * 1.9) * lifted;
        for (let k = 0; k < SEGS; k++) {
          const pull = Math.min(lifted * (0.6 + (0.4 * k) / (SEGS - 1)) * shiver, 1);
          seg.copy(rest[i]![k]!).lerp(toward, pull).normalize();
          seg.y += 0.04 * Math.sin(t * 2 + i) * (1 - lifted); // a little sway at rest
          seg.normalize();
          const w = 1 - 0.14 * k; // thinner toward the tip
          pos.addScaledVector(seg, SEG_LEN * 0.5);
          m.compose(pos, q.setFromUnitVectors(Y, seg), taper.set(w, 1, w));
          hair.setMatrixAt(i * SEGS + k, m);
          pos.addScaledVector(seg, SEG_LEN * 0.5);
        }
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
