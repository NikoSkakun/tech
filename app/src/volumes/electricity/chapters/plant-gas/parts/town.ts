/**
 * The town of step 8 — also the «мапа району»: 5 × 4 quarters of simple blocks with lit windows (each quarter
 * its own model, so a quarter can go dark), a container gas-engine unit beside every quarter (instanced, with a
 * status lamp: `green` running, `red` failed) and the «one big station 200 MW» at the town's east edge. The
 * heat main from the engine hall comes in from the north. Origin: world.
 */
import { Group, InstancedMesh, Matrix4, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { Builder, G, addSimpleTower, instanced, type KitModel } from '@/kit';
import { K, col } from '@/style';
import { BIG_STATION, ISLAND, TOWN } from '../layout';
import { mergeBuilders, type Merged } from './merge';

export interface Town {
  group: Group;
  /** The merged quarters (one mesh per slot); `setLit(i, level)` dims a quarter's windows. */
  blocks: Merged;
  /** World centre of quarter i and of its container unit. */
  centre: Vector3[];
  unit: Vector3[];
  big: KitModel;
  bigAt: Vector3;
  containers: Group;
  /** 0 = 20 units serve the town … 1 = the single big station (containers fold away), eased by the step. */
  single: number;
  /** Per quarter: 1 = powered … 0 = dark. */
  powered: number[];
  /** Per unit: failed? (lamp `red`). */
  failed: boolean[];
  /** Night level of the whole scene (from `Live`). */
  night: number;
  update(dt: number): void;
}

export function buildTown(ctx: ChapterContext): Town {
  const rng = ctx.random.fork('town');
  const y0 = ISLAND.y;
  const group = new Group();
  const centre: Vector3[] = [];
  const unit: Vector3[] = [];
  const q = TOWN.quarter;
  const tones = [col('mist'), col('white'), col('sky.light'), col('pink.light'), col('amber.light')];
  const entries: { b: Builder; at: [number, number, number] }[] = [];
  for (let r = 0; r < TOWN.rows; r++)
    for (let c = 0; c < TOWN.cols; c++) {
      const cx = TOWN.x + (c - (TOWN.cols - 1) / 2) * q;
      const cz = TOWN.z + (r - (TOWN.rows - 1) / 2) * q;
      const b = new Builder(`quarter-${r}-${c}`);
      b.box(q - 3, 0.3, q - 3, { r: 0.4, slot: 'matte', c: col('slate').lerp(col('steel'), 0.4), at: [0, 0, 0] });
      const n = 2 + rng.int(0, 2);
      for (let k = 0; k < n; k++) {
        const w = 5 + rng.range(0, 3);
        const d = 5 + rng.range(0, 3);
        const fx = ((k % 2) - 0.5) * 8;
        const fz = (Math.floor(k / 2) - 0.5) * 8;
        b.frame({ at: [fx, 0.3, fz] }, () => addSimpleTower(b, w, d, 2 + rng.int(0, 3), rng, { color: tones[(r * 5 + c + k) % tones.length], lit: 0.85 }));
      }
      entries.push({ b, at: [cx, y0, cz] });
      centre.push(new Vector3(cx, y0 + 8, cz));
      unit.push(new Vector3(cx + q / 2 - 1.4, y0, cz + q / 2 - 1.6));
    }
  const blocks = mergeBuilders('town', entries);
  group.add(blocks.group);
  // a container unit: engine container, small stack, cooler on top
  const cb = new Builder('container-unit');
  cb.box(6, 2.6, 2.4, { r: 0.15, c: ['pink.dark', 'pink'], at: [0, 0, 0] });
  cb.cyl(0.25, 2.6, { seg: 10, slot: 'metal', c: 'steel', at: [-2.2, 2.6, 0] });
  cb.box(2.4, 0.8, 2.2, { r: 0.1, slot: 'metal', c: 'slate', at: [1.2, 2.6, 0] });
  const containerModel = cb.build();
  const containers = instanced(containerModel, unit.map((p) => ({ at: [p.x, p.y, p.z] as [number, number, number], ry: Math.PI / 2 })));
  group.add(containers);
  // status lamps on the containers: one instanced glow, colour per unit
  const lamps = new InstancedMesh(G.sphere(0.55, 10), K.glow({ color: 'white', intensity: 1.6, whiten: 0, keepHue: true }), unit.length);
  const m4 = new Matrix4();
  unit.forEach((p, i) => lamps.setMatrixAt(i, m4.makeTranslation(p.x, p.y + 3.6, p.z)));
  lamps.frustumCulled = false;
  group.add(lamps);
  const GREEN = col('green');
  const RED = col('red');
  // the single big station 200 MW: a block hall with two stacks
  const bb = new Builder('big-station');
  bb.box(34, 14, 20, { r: 0.4, c: ['mist', 'white'], at: [0, 0, 0] });
  bb.box(34.4, 1, 20.4, { r: 0.2, slot: 'matte', c: 'slate', at: [0, 14, 0] });
  for (const dx of [-8, 8]) {
    bb.cyl(1.6, 34, { rTop: 1.3, seg: 20, slot: 'gloss', c: ['steel', 'mist'], at: [dx, 14, -4] });
    bb.cyl(1.4, 1.2, { seg: 20, slot: 'gloss', c: 'pink', at: [dx, 46, -4] });
  }
  for (let k = 0; k < 6; k++) bb.box(4, 3, 0.2, { r: 0.05, slot: 'window', c: col('blue.dark'), at: [-14 + k * 5.6, 5, 10.1] });
  const big = bb.build();
  const bigAt = new Vector3(BIG_STATION.x, y0, BIG_STATION.z);
  big.group.position.copy(bigAt);
  group.add(big.group);
  const town: Town = {
    group,
    blocks,
    centre,
    unit,
    big,
    bigAt,
    containers,
    single: 0,
    powered: unit.map(() => 1),
    failed: unit.map(() => false),
    night: 0,
    update() {
      blocks.template.mats.night = town.night;
      town.powered.forEach((p, i) => blocks.setLit(i, p));
      big.night = town.night * (town.single > 0.5 && town.powered.every((p) => p === 0) ? 0 : 1);
      containers.visible = lamps.visible = town.single < 0.5;
      town.failed.forEach((f, i) => lamps.setColorAt(i, f ? RED : GREEN));
      if (lamps.instanceColor) lamps.instanceColor.needsUpdate = true;
    },
  };
  return town;
}
