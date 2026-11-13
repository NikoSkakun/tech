/**
 * A small window of magnetic domains (step 6): a 5 × 3 grid of arrows on a dark plate that flip back and forth with
 * the field — each flip is one half of a hysteresis loop (100 flips per second at 50 Hz; shown slowed). One
 * instanced draw call; `setField(h)` (−1…1) turns every arrow toward the field with a short per-arrow lag.
 */
import { ConeGeometry, CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, Quaternion, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { K } from '@/style';

const COLS = 5;
const ROWS = 3;

export interface Domains {
  group: Group;
  /** Field −1…1; arrows follow it (snap with lag). */
  setField(h: number, dt: number): void;
  /** Flips counted since creation (for the probe). */
  readonly flips: number;
}

export function createDomains(): Domains {
  const group = new Group();
  const plate = new Mesh(new RoundedBoxGeometry(1.7, 1.05, 0.08, 3, 0.05), K.toon({ color: 'ink', rim: 0.8 }));
  plate.castShadow = true;
  const shaft = new CylinderGeometry(0.035, 0.035, 0.2, 10);
  shaft.translate(0, -0.06, 0);
  const tip = new ConeGeometry(0.075, 0.13, 14);
  tip.translate(0, 0.1, 0);
  const arrow = mergeGeometries([shaft, tip])!;
  arrow.rotateZ(-Math.PI / 2); // points along +X
  const arrows = new InstancedMesh(arrow, K.glow({ color: 'magenta', intensity: 1.3, whiten: 0, keepHue: true }), COLS * ROWS);
  group.add(plate, arrows);
  const angle = new Array<number>(COLS * ROWS).fill(0);
  const lag = angle.map((_, i) => 0.6 + ((i * 7) % 5) * 0.12);
  const m = new Matrix4();
  const q = new Quaternion();
  const z = new Vector3(0, 0, 1);
  const pos = new Vector3();
  const one = new Vector3(1, 1, 1);
  let flips = 0;
  let side = 1;
  return {
    group,
    get flips() {
      return flips;
    },
    setField(h, dt) {
      const want = h >= 0 ? 0 : Math.PI;
      if ((h >= 0 ? 1 : -1) !== side) {
        side = h >= 0 ? 1 : -1;
        flips++;
      }
      angle.forEach((a, i) => {
        angle[i] = a + (want - a) * Math.min(1, dt * 9 * lag[i]!);
        const c = i % COLS;
        const r = Math.floor(i / COLS);
        pos.set((c - (COLS - 1) / 2) * 0.32, (r - (ROWS - 1) / 2) * 0.3, 0.07);
        q.setFromAxisAngle(z, angle[i]! + (r % 2 ? 0.08 : -0.06));
        arrows.setMatrixAt(i, m.compose(pos, q, one));
      });
      arrows.instanceMatrix.needsUpdate = true;
    },
  };
}
