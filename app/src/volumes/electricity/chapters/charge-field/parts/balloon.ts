/**
 * Balloon and wall of step 6. The `pink` balloon collects `cyan` electron dots as it is charged; the wall is
 * shown in section with its molecules as little dumbbells (`coral` «+» end, `cyan` «−» end) that turn their
 * «+» ends toward a charged balloon — polarisation, which is why the balloon sticks to a neutral wall.
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
import { createOrbs } from '@/fx';
import { Builder } from '@/kit';
import { K, SEMANTIC } from '@/style';
import { STATIC } from '../layout';

export const BALLOON_R = 1.1;
const DOTS = 22;
const COLS = 3;
const ROWS = 7;

export interface BalloonModel {
  group: Group;
  body: Mesh;
  /** 0…1 share of the largest charge (−300 nC): number of electron dots shown. */
  charge: number;
  hover: number;
  update(dt: number, t: number): void;
}

export function createBalloonModel(): BalloonModel {
  const group = new Group();
  group.name = 'balloon';
  const body = new Mesh(
    new SphereGeometry(BALLOON_R, 40, 28),
    K.toon({
      color: 'pink',
      gloss: 0.85,
      rim: 1.2,
      gradient: { bottom: 'magenta', top: 'pink.light', range: [-1.1, 1.1] },
    }),
  );
  body.scale.set(1, 1.16, 1);
  const b = new Builder('balloon-knot');
  b.cone(0.14, 0.22, { seg: 12, c: 'magenta', at: [0, -BALLOON_R * 1.16 - 0.16, 0] });
  b.tube(
    [
      new Vector3(0, -1.42, 0),
      new Vector3(0.12, -2.0, 0.05),
      new Vector3(-0.08, -2.6, 0),
      new Vector3(0.05, -3.1, 0.04),
    ],
    0.018,
    { c: 'mist' },
  );
  const dots = createOrbs({ kind: 'electron', count: DOTS, radius: 0.085 });
  const seats = Array.from({ length: DOTS }, (_, i) => {
    const y = 0.8 - (1.6 * (i + 0.5)) / DOTS;
    const r = Math.sqrt(1 - y * y);
    return new Vector3(Math.cos(i * 2.4) * r, y * 1.16, Math.sin(i * 2.4) * r).multiplyScalar(
      BALLOON_R * 1.02,
    );
  });
  group.add(body, b.build().group, dots);
  let shown = 0;
  const balloon: BalloonModel = {
    group,
    body,
    charge: 0,
    hover: 0,
    update(dt, t) {
      shown += (balloon.charge - shown) * Math.min(dt * 8, 1);
      seats.forEach((p, i) =>
        dots.setPosition(
          i,
          p.x,
          p.y,
          p.z,
          Math.min(Math.max(shown * DOTS - i, 0), 1) * (1 + 0.1 * Math.sin(t * 3 + i)),
        ),
      );
      dots.commit();
      body.scale.set(1 + 0.03 * balloon.hover, 1.16 + 0.03 * balloon.hover, 1 + 0.03 * balloon.hover);
      group.rotation.z = 0.05 * Math.sin(t * 0.9);
    },
  };
  return balloon;
}

export interface Wall {
  group: Group;
  /** World-space position of the balloon and 0…1 strength of the polarisation it causes. */
  source: Vector3;
  polarisation: number;
  update(dt: number, t: number): void;
}

export function createWall(): Wall {
  const group = new Group();
  group.name = 'wall';
  group.position.set(STATIC.wallX, 0, 0);
  const b = new Builder('wall');
  b.box(1.7, 5.4, 2.6, { r: 0.1, slot: 'matte', c: ['slate', 'steel'], at: [0.85, 0, 0] });
  b.box(1.3, 4.9, 0.06, { r: 0.05, c: 'bg.deep', at: [0.85, 0.25, 1.3] }); // the section: a look inside the wall
  b.box(2.0, 0.16, 2.9, { r: 0.06, c: ['bg.plum', 'slate'], at: [0.85, -0.08, 0] });
  group.add(b.build().group);
  const n = COLS * ROWS;
  const plus = createOrbs({ kind: 'ion', color: SEMANTIC.proton, glyph: 'none', count: n, radius: 0.085 });
  const minus = createOrbs({ kind: 'ion', color: SEMANTIC.electron, glyph: 'none', count: n, radius: 0.085 });
  const bars = new InstancedMesh(new CapsuleGeometry(0.03, 0.2, 3, 6), K.toon({ color: 'mist' }), n);
  bars.frustumCulled = false;
  group.add(bars, plus, minus);
  const m = new Matrix4();
  const q = new Quaternion();
  const one = new Vector3(1, 1, 1);
  const p = new Vector3();
  const local = new Vector3();
  const Z = new Vector3(0, 0, 1);
  let k = 0;
  const wall: Wall = {
    group,
    source: new Vector3(),
    polarisation: 0,
    update(dt, t) {
      k += (wall.polarisation - k) * Math.min(dt * 5, 1);
      group.worldToLocal(local.copy(wall.source));
      for (let i = 0; i < n; i++) {
        p.set(0.42 + (i % COLS) * 0.43, 0.75 + Math.floor(i / COLS) * 0.66, 1.4);
        // at rest each molecule tumbles its own way; polarised, its «+» end turns to the balloon
        const rest = i * 2.4 + 0.5 * Math.sin(t * 0.8 + i);
        const toward = Math.atan2(local.y - p.y, local.x - p.x);
        const near = k * (1 - 0.18 * (i % COLS));
        const a = rest + Math.atan2(Math.sin(toward - rest), Math.cos(toward - rest)) * near;
        const dx = Math.cos(a) * 0.13;
        const dy = Math.sin(a) * 0.13;
        plus.setPosition(i, p.x + dx, p.y + dy, p.z);
        minus.setPosition(i, p.x - dx, p.y - dy, p.z);
        bars.setMatrixAt(i, m.compose(p, q.setFromAxisAngle(Z, a - Math.PI / 2), one));
      }
      plus.commit();
      minus.commit();
      bars.instanceMatrix.needsUpdate = true;
    },
  };
  return wall;
}
