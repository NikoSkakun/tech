/**
 * Step 8: the pack builder's bench. `s` series groups run along X, the `p` parallel cells of a group along Z.
 * Up to 1000 cells are drawn one by one (instanced); bigger packs are drawn as blocks of k × k cells.
 * Series groups alternate their orientation (+ up / − up) so the copper busbars on top can zigzag from one
 * group to the next — the plates over a pair of columns are that zigzag's top half.
 */
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  type Group,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { K, SEMANTIC, col } from '@/style';
import type { Mats } from '../world';
import { group, mesh } from '../world';

const AREA = { w: 5.3, d: 3.0 } as const;
const MAX = 1000;

export interface PackGrid {
  group: Group;
  /** Rebuild for a cell shape and an s × p layout. Returns true when the pack is drawn as blocks. */
  set(shape: 'cylinder' | 'brick', color: 'violet' | 'sky', s: number, p: number): boolean;
  /** Pop-in animation of the last rebuild. */
  update(dt: number): void;
  /** Half extent of the current layout along X (callout anchors). */
  halfWidth: number;
}

export function createPackGrid(mats: Mats): PackGrid {
  const g = group('pack-grid');
  g.add(mesh(new RoundedBoxGeometry(AREA.w + 0.6, 0.14, AREA.d + 0.6, 4, 0.06), mats.dark, 0, 0.07, 0));
  const cellMat = K.toon({ color: 'white', gloss: 0.5 });
  const cylinders = new InstancedMesh(new CylinderGeometry(0.5, 0.5, 1, 20), cellMat, MAX);
  const bricks = new InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 2, 0.08), cellMat, MAX);
  const caps = new InstancedMesh(
    new CylinderGeometry(0.5, 0.5, 1, 16),
    K.toon({ color: 'white', gloss: 0.6 }),
    MAX,
  );
  const bars = new InstancedMesh(new BoxGeometry(1, 1, 1), mats.copper, 64);
  for (const m of [cylinders, bricks, caps, bars]) {
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    m.count = 0;
    g.add(m);
  }
  const m4 = new Matrix4();
  const q = new Quaternion();
  const pos = new Vector3();
  const scl = new Vector3();
  const tint = new Color();
  const plus = col(SEMANTIC.dcPlus);
  const minus = col(SEMANTIC.dcMinus);
  let pop = 1;
  const self: PackGrid = {
    group: g,
    halfWidth: 0.3,
    set(shape, color, s, p) {
      const n = s * p;
      const k = n <= MAX ? 1 : Math.ceil(Math.sqrt(n / MAX)); // cells per block edge
      const cols = Math.ceil(s / k);
      const rows = Math.ceil(p / k);
      const asBlocks = k > 1;
      // prismatic cells stand face to face along the series direction: thin in X, wide in Z (≈ 50 × 160 × 200 mm)
      const deep = shape === 'brick' && !asBlocks ? 3.1 : 1;
      const pitch = Math.min(AREA.w / cols, AREA.d / (rows * deep), 0.62);
      const body = shape === 'cylinder' && !asBlocks ? cylinders : bricks;
      const h = asBlocks ? pitch * 0.9 : Math.min(pitch * (shape === 'cylinder' ? 2.7 : 3.7), 1.3);
      const base = col(color);
      let i = 0;
      for (let c = 0; c < cols; c++)
        for (let r = 0; r < rows; r++) {
          pos.set((c - (cols - 1) / 2) * pitch, 0.14 + h / 2, (r - (rows - 1) / 2) * pitch * deep);
          body.setMatrixAt(i, m4.compose(pos, q, scl.set(pitch * 0.86, h, pitch * deep * 0.9)));
          // neighbouring series groups differ a little in tone, so the S groups read as stripes
          body.setColorAt(i, tint.copy(base).multiplyScalar(c % 2 ? 0.82 : 1));
          pos.y = 0.14 + h + 0.02 * pitch;
          caps.setMatrixAt(i, m4.compose(pos, q, scl.set(pitch * 0.42, 0.05 * pitch + 0.01, pitch * 0.42)));
          caps.setColorAt(i, c % 2 ? minus : plus);
          i++;
        }
      cylinders.count = body === cylinders ? i : 0;
      bricks.count = body === bricks ? i : 0;
      caps.count = asBlocks ? 0 : i;
      for (const m of [body, caps]) {
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }
      // busbars: one copper plate over each pair of columns (0–1, 2–3, …); the other pairs are joined underneath
      let b = 0;
      if (!asBlocks)
        for (let c = 0; c + 1 < cols && b < 64; c += 2) {
          pos.set((c + 0.5 - (cols - 1) / 2) * pitch, 0.14 + h + 0.07 * pitch + 0.02, 0);
          bars.setMatrixAt(
            b++,
            m4.compose(pos, q, scl.set(pitch * 1.5, 0.035 * pitch + 0.012, rows * pitch * deep * 0.94)),
          );
        }
      bars.count = b;
      bars.instanceMatrix.needsUpdate = true;
      self.halfWidth = (cols * pitch) / 2;
      pop = 0;
      return asBlocks;
    },
    update(dt) {
      if (pop >= 1) return;
      pop = Math.min(pop + dt * 3.2, 1);
      // back.out overshoot on the whole tray (cheap: one scale for all instances)
      const t = pop - 1;
      const e = 1 + 2.7 * t * t * t + 1.7 * t * t;
      for (const m of [cylinders, bricks, caps, bars]) m.scale.set(1, Math.max(e, 0.001), 1);
    },
  };
  return self;
}
