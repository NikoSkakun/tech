/**
 * The P-V curve as a mountain (step 10): a thick ribbon whose ridge is P(U) — x = voltage, height = power —
 * `yellow` on top with an `amber` flank, standing on a base plate with voltage ticks. `setCurve` rewrites the
 * ridge in place (the curve changes every frame while a cloud passes), `at(v)` gives the ridge point for the
 * climber. Units: stage units; the mountain is `WIDTH` wide and up to `HEIGHT` tall.
 */
import { BufferAttribute, BufferGeometry, Group, Mesh, Vector3 } from 'three';
import { Builder } from '@/kit';
import { K } from '@/style';
import type { Text3D } from '@/text';
import { shadows, tag } from '../world';

export const MOUNTAIN = { width: 5.6, height: 3.0, depth: 0.9, vMax: 45, pMax: 500 } as const;
const COLS = 140;

export interface Mountain {
  group: Group;
  /** Rewrite the ridge from a power function P(U) [W] (called when the curve changed). */
  setCurve(powerAt: (v: number) => number, vocV: number): void;
  /** Ridge point for a voltage, in the mountain's frame (z = 0 = middle of the ribbon). */
  at(v: number, out?: Vector3): Vector3;
  xOf(v: number): number;
  labels: Text3D[];
}

export function createMountain(): Mountain {
  const group = new Group();
  group.name = 'mountain';
  const { width: W, height: H, depth: D, vMax, pMax } = MOUNTAIN;
  const xOf = (v: number): number => (v / vMax - 0.5) * W;
  const heights = new Float32Array(COLS + 1);

  // top strip (2 rows) + front wall + back wall, as separate vertices so the walls keep flat normals
  const n = COLS + 1;
  const pos = new Float32Array(n * 6 * 3);
  const nor = new Float32Array(n * 6 * 3);
  const index: number[] = [];
  for (let i = 0; i < COLS; i++) {
    for (const [a, b] of [[1, 0], [2, 3], [5, 4]] as const) {
      const p = i * 6;
      const q = (i + 1) * 6;
      index.push(p + a, p + b, q + a, q + a, p + b, q + b);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(pos, 3));
  geometry.setAttribute('normal', new BufferAttribute(nor, 3));
  geometry.setIndex(index);
  const write = (): void => {
    for (let i = 0; i < n; i++) {
      const x = (i / COLS - 0.5) * W;
      const y = heights[i]!;
      const dy = (heights[Math.min(COLS, i + 1)]! - heights[Math.max(0, i - 1)]!) / ((2 * W) / COLS);
      const k = 1 / Math.hypot(dy, 1);
      const rows: [number, number, number, number, number][] = [
        [y, D / 2, -dy * k, k, 0], // top, front edge
        [y, -D / 2, -dy * k, k, 0], // top, back edge
        [y, D / 2, 0, 0, 1], // front wall, top
        [0, D / 2, 0, 0, 1], // front wall, bottom
        [y, -D / 2, 0, 0, -1], // back wall, top
        [0, -D / 2, 0, 0, -1], // back wall, bottom
      ];
      rows.forEach(([py, pz, nx, ny, nz], r) => {
        const o = (i * 6 + r) * 3;
        pos[o] = x;
        pos[o + 1] = py;
        pos[o + 2] = pz;
        nor[o] = nx;
        nor[o + 1] = ny;
        nor[o + 2] = nz;
      });
    }
    geometry.attributes.position!.needsUpdate = true;
    geometry.attributes.normal!.needsUpdate = true;
    geometry.computeBoundingSphere();
  };
  write();
  const ridge = new Mesh(geometry, K.toon({ gradient: { bottom: 'amber.dark', top: 'yellow', range: [0, H * 0.85] }, rim: 0.7, highlight: 0.2 }));
  ridge.castShadow = true;
  ridge.position.y = 0.1; // sunk 2 cm into the base: the zero-height part beyond V_oc never fights the plate
  group.add(ridge);

  // base plate with a tick every 5 V
  const b = new Builder('mountain-base');
  b.box(W + 0.5, 0.12, D + 0.7, { r: 0.05, slot: 'gloss', c: ['bg.indigo', 'slate'] });
  for (let v = 0; v <= vMax; v += 5) b.box(0.03, 0.02, v % 10 ? 0.14 : 0.26, { r: 0, c: 'mist', at: [xOf(v), 0.12, D / 2 + 0.2] });
  group.add(shadows(b.build().group));
  const labels: Text3D[] = [];
  for (let v = 0; v <= 40; v += 10) {
    const t = tag(`${v} V`, 17, 'mist', 'mono');
    t.position.set(xOf(v), 0.02, D / 2 + 0.62);
    labels.push(t);
    group.add(t);
  }

  return {
    group,
    labels,
    xOf,
    setCurve(powerAt, vocV) {
      for (let i = 0; i < n; i++) {
        const v = (i / COLS) * vMax;
        heights[i] = v <= vocV ? Math.max(0, (powerAt(v) / pMax) * H) : 0;
      }
      write();
    },
    at(v, out = new Vector3()) {
      const f = Math.min(COLS, Math.max(0, (v / vMax) * COLS));
      const i = Math.min(COLS - 1, Math.floor(f));
      return out.set(xOf(v), Math.max(0.12, 0.1 + heights[i]! + (heights[i + 1]! - heights[i]!) * (f - i)), 0);
    },
  };
}
