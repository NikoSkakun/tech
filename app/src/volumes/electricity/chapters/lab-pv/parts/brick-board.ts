/**
 * «Збери модуль» (step 4): six toy cell bricks (0.7 V, 7 A each; `coral` plus cap, `blue` minus cap) on a
 * breadboard. `setLayout` slides them into 6 in series, 3 in series × 2 in parallel, or 6 in parallel; two bus
 * bars appear where branches join. Positions are eased toward a pure function of the layout.
 */
import { Group, Mesh, type Object3D, type Vector3 } from 'three';
import { damp } from '@/engine/api';
import { Builder } from '@/kit';
import { K, SEMANTIC } from '@/style';
import { shadows } from '../world';

export type BrickLayout = 's6' | 's3p2' | 'p6';
/** Series count and parallel count of every layout. */
export const BRICK_LAYOUTS: Record<BrickLayout, { series: number; parallel: number }> = {
  s6: { series: 6, parallel: 1 },
  s3p2: { series: 3, parallel: 2 },
  p6: { series: 1, parallel: 6 },
};

const LEN = 0.5;
const STEP_X = LEN + 0.03;

export interface BrickBoard {
  group: Group;
  bricks: Object3D[];
  setLayout(layout: BrickLayout): void;
  update(dt: number, t: number): void;
}

export function createBrickBoard(): BrickBoard {
  const group = new Group();
  group.name = 'brick-board';
  const base = new Builder('breadboard');
  base.box(3.5, 0.1, 2.3, { r: 0.05, slot: 'gloss', c: ['bg.indigo', 'slate'] });
  for (let i = 0; i < 12; i++) for (let j = 0; j < 7; j++) base.cyl(0.025, 0.012, { seg: 8, c: 'ink', at: [(i - 5.5) * 0.28, 0.1, (j - 3) * 0.3] });
  group.add(shadows(base.build().group, false));

  const one = new Builder('brick');
  one.box(LEN - 0.12, 0.16, 0.26, { r: 0.04, slot: 'gloss', c: ['bg.indigo', 'blue'] });
  one.box(0.07, 0.17, 0.27, { r: 0.03, slot: 'gloss', c: SEMANTIC.dcPlus, at: [LEN / 2 - 0.035, 0, 0] });
  one.box(0.07, 0.17, 0.27, { r: 0.03, slot: 'gloss', c: SEMANTIC.dcMinus, at: [-LEN / 2 + 0.035, 0, 0] });
  for (const z of [-0.07, 0, 0.07]) one.box(LEN - 0.14, 0.006, 0.012, { r: 0, slot: 'metal', c: 'mist', at: [0, 0.16, z] });
  const proto = one.build();
  const meshes = proto.group.children.filter((o): o is Mesh => (o as Mesh).isMesh);
  const bricks: Object3D[] = [];
  for (let i = 0; i < 6; i++) {
    const g = new Group();
    for (const m of meshes) g.add(Object.assign(new Mesh(m.geometry, m.material), { castShadow: true }));
    g.position.set((i - 2.5) * STEP_X, 0.1, 0);
    bricks.push(g);
    group.add(g);
  }
  // bus bars of parallel branches (plus side and minus side)
  const bar = (color: string): Mesh => {
    const m = new Mesh(new Builder('bus').box(0.06, 0.1, 1, { r: 0.02, slot: 'gloss', c: 'white' }).geometry('gloss'), K.toon({ color, gloss: 0.5 }));
    m.position.y = 0.1;
    m.scale.z = 0.001;
    group.add(m);
    return m;
  };
  const plusBar = bar(SEMANTIC.dcPlus);
  const minusBar = bar(SEMANTIC.dcMinus);

  const target: Vector3[] = bricks.map((b) => b.position.clone());
  const bus = { x: 0, len: 0.001 };
  const place = (layout: BrickLayout): void => {
    const { series, parallel } = BRICK_LAYOUTS[layout];
    const pitchZ = parallel === 6 ? 0.34 : 0.5;
    bricks.forEach((_, i) => {
      const row = Math.floor(i / series);
      const k = i % series;
      target[i]!.set((k - (series - 1) / 2) * STEP_X, 0.1, (row - (parallel - 1) / 2) * pitchZ);
    });
    bus.x = (series * STEP_X) / 2 + 0.04;
    bus.len = parallel > 1 ? (parallel - 1) * pitchZ + 0.3 : 0.001;
  };
  place('s6');

  return {
    group,
    bricks,
    setLayout: place,
    update(dt, t) {
      bricks.forEach((b, i) => {
        b.position.x = damp(b.position.x, target[i]!.x, 6, dt);
        b.position.z = damp(b.position.z, target[i]!.z, 6, dt);
        b.position.y = 0.1 + Math.abs(Math.sin(t * 1.6 + i * 0.9)) * 0.012; // idle life
      });
      for (const [m, s] of [[plusBar, 1], [minusBar, -1]] as const) {
        m.position.x = damp(m.position.x, s * bus.x, 6, dt);
        m.scale.z = damp(m.scale.z, bus.len, 6, dt);
      }
    },
  };
}
