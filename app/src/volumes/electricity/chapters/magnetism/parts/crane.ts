/**
 * Mini crane of step `solenoid`: a post with an arm, a rope and a pot electromagnet over a heap of 40 paper
 * clips and steel nuts. `lifted` (0…40, model М3: n ∝ B²) clips jump from the heap and hang under the magnet
 * in a cluster; when the field drops they fall back. One instanced mesh for the clips.
 */
import { InstancedMesh, Matrix4, type Mesh, Quaternion, Vector3, type Group } from 'three';
import { Builder } from '@/kit';
import type { Rng } from '@/engine/api';
import { COPPER } from './coil';

export const CLIPS = 40;

export interface Crane {
  group: Group;
  magnet: Group;
  /** Clips hanging now (eased). */
  lifted: number;
  update(dt: number, t: number): void;
}

export function createCrane(rng: Rng, armLen = 0.9, height = 2.0, hang = 0.95): Crane {
  const b = new Builder('crane');
  b.box(0.6, 0.1, 0.6, { r: 0.04, c: ['ink', 'slate'] });
  b.cyl(0.07, height, { at: [0, 0.1, 0], seg: 14, slot: 'metal', c: 'amber' });
  b.beam([0, height, 0], [armLen + 0.1, height, 0], 0.09, { r: 0.02, slot: 'metal', c: 'amber' });
  b.rod([-0.05, height - 0.5, 0], [armLen * 0.55, height, 0], 0.03, { slot: 'metal', c: 'amber' });
  b.cyl(0.07, 0.08, { at: [armLen, height - 0.09, 0], seg: 14, slot: 'metal', c: 'steel' });
  b.rod([armLen, height - 0.09, 0], [armLen, hang + 0.22, 0], 0.012, { slot: 'metal', c: 'ink' });
  const model = b.build();
  // pot electromagnet: steel cup with a copper winding showing at the rim
  const mb = new Builder('crane-magnet');
  mb.cyl(0.22, 0.2, { seg: 32, slot: 'metal', c: 'steel', bevel: 0.03 });
  mb.ring(0.165, 0.03, { at: [0, 0.02, 0], seg: 32, slot: 'metal', c: COPPER });
  mb.cyl(0.08, 0.06, { at: [0, 0.2, 0], seg: 16, slot: 'metal', c: 'mist' });
  const magnet = mb.build().group;
  magnet.position.set(armLen, hang, 0);
  model.group.add(magnet);
  // clips: rounded steel loops (two capsules side by side read as a paper clip from afar)
  const cb = new Builder('clip');
  cb.capsule(0.022, 0.16, { axis: 'x', slot: 'metal', c: 'mist' });
  cb.capsule(0.02, 0.12, { axis: 'x', slot: 'metal', c: 'mist', at: [0.02, 0, 0.04] });
  const clips = new InstancedMesh(cb.geometry('metal'), cb.mats.get('metal'), CLIPS);
  clips.castShadow = true;
  clips.frustumCulled = false;
  model.group.add(clips);
  const heap: Vector3[] = [];
  const hangAt: Vector3[] = [];
  const spinA: number[] = [];
  for (let i = 0; i < CLIPS; i++) {
    const r = 0.28 * Math.sqrt(rng.next());
    const a = rng.next() * Math.PI * 2;
    heap.push(new Vector3(armLen + Math.cos(a) * r, 0.03 + rng.next() * 0.06, Math.sin(a) * r));
    // hanging cluster: a cone of clips that grows downward with their number
    const ring = Math.floor(Math.sqrt(i));
    const ang = i * 2.4;
    hangAt.push(new Vector3(armLen + Math.cos(ang) * 0.06 * (ring + 1) * 0.5, hang - 0.05 - ring * 0.07, Math.sin(ang) * 0.06 * (ring + 1) * 0.5));
    spinA.push(rng.next() * Math.PI * 2);
  }
  const m4 = new Matrix4();
  const q = new Quaternion();
  const p = new Vector3();
  const one = new Vector3(1, 1, 1);
  const up = new Vector3(0, 1, 0);
  const pos = new Float32Array(CLIPS);
  const self: Crane = {
    group: model.group,
    magnet,
    lifted: 0,
    update(dt, t) {
      for (let i = 0; i < CLIPS; i++) {
        const want = i < Math.round(self.lifted) ? 1 : 0;
        // up fast (snap to the magnet), down a little slower (they fall)
        pos[i] = pos[i]! + (want - pos[i]!) * Math.min(dt * (want ? 9 : 6), 1);
        const k = pos[i]!;
        p.lerpVectors(heap[i]!, hangAt[i]!, k);
        p.y += Math.sin(k * Math.PI) * 0.25;
        p.x += k * Math.sin(t * 1.3 + i) * 0.006;
        q.setFromAxisAngle(up, spinA[i]! + k * 1.2);
        clips.setMatrixAt(i, m4.compose(p, q, one));
      }
      clips.instanceMatrix.needsUpdate = true;
    },
  };
  model.group.traverse((o) => ((o as Mesh).castShadow = true));
  return self;
}
