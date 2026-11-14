/**
 * Step 2 props. The hero gondola on the dumper siding (under the time capsule); the «rank ladder» — three lumps
 * on plinths from loose brown lignite to glossy anthracite, each with a column whose height is its lower heating
 * value (`@electricity/sim/plant-coal` `COALS`); and the wagon field: one small gondola per wagon a 1000 MW unit
 * needs per day, lined up on a floating tray beside the island. New wagons roll in from the west.
 */
import { Group, InstancedMesh, Matrix4, type Mesh, type Object3D, Vector3 } from 'three';
import { COALS, type CoalType } from '@electricity/sim/plant-coal';
import { Builder, G, type KitModel } from '@/kit';
import { col } from '@/style';

export const RANKS: readonly CoalType[] = ['lignite', 'bituminous', 'anthracite'];

export function buildHeroWagon(): KitModel {
  const b = new Builder('hero-gondola');
  b.box(12.4, 3.2, 3.3, { r: 0.3, slot: 'gloss', c: ['ink', 'slate'], at: [0, 1.1, 0] });
  for (let i = -2; i <= 2; i++) b.box(0.2, 2.6, 3.36, { r: 0, slot: 'gloss', c: 'slate', at: [i * 2.4, 1.4, 0] });
  b.dome(1.6, 1.3, { s: [3.6, 1, 0.95], seg: 16, slot: 'facet', c: ['ink', 'steel'], at: [0, 4.1, 0] });
  for (const x of [-4.2, 4.2]) for (const z of [-0.8, 0.8]) b.cyl(0.5, 0.2, { axis: 'z', seg: 14, slot: 'metal', c: 'slate', at: [x, 0.5, z] });
  b.anchor('top', 0, 5.4, 0);
  return b.build();
}

export interface Ladder {
  group: Group;
  /** Lump centres (world) per coal type — callout anchors. */
  lumps: Record<CoalType, Vector3>;
  bars: Record<CoalType, Object3D>;
}

export function buildLadder(at: Vector3): Ladder {
  const group = new Group();
  group.position.copy(at);
  const slab = new Builder('ladder-slab');
  slab.box(66, 3, 16, { r: 1.2, slot: 'matte', c: ['slate', 'steel'], at: [0, -3, 0] });
  slab.cone(8, 10, { seg: 7, slot: 'facet', c: ['bg.violet', 'slate'], at: [0, -3, 0], rot: [Math.PI, 0, 0], s: [3, 1, 1] });
  group.add(slab.build().group);
  const lumps = {} as Record<CoalType, Vector3>;
  const bars = {} as Record<CoalType, Object3D>;
  RANKS.forEach((type, i) => {
    const x = (i - 1) * 21;
    const b = new Builder(`rank-${type}`);
    b.cyl(4.2, 3, { seg: 24, slot: 'gloss', c: ['steel', 'mist'], at: [x, 0, 0] });
    // lignite: loose, brownish and matte; bituminous: dark faceted; anthracite: black and glossy
    if (type === 'lignite') b.add(G.facet(1, 1), { slot: 'matte', c: col('slate').lerp(col('wireBrown'), 0.55), at: [x, 6, 0], s: [3.4, 2.6, 3] });
    if (type === 'bituminous') b.add(G.facet(1, 1), { slot: 'facet', c: ['ink', 'slate'], at: [x, 6, 0], s: [3, 2.6, 2.8] });
    if (type === 'anthracite') b.add(G.facet(1, 2), { slot: 'gloss', c: 'ink', at: [x, 6, 0], s: [2.8, 2.6, 2.6] });
    const model = b.build();
    group.add(model.group);
    lumps[type] = at.clone().add(new Vector3(x, 6, 0));
    // energy column: height ∝ lower heating value (0,6 m per MJ/kg, toy units)
    const bar = new Builder(`rank-bar-${type}`);
    bar.box(2.4, 1, 2.4, { r: 0.3, slot: 'gloss', c: ['orange.dark', 'orange'] });
    const barModel = bar.build();
    barModel.group.position.set(x + 6.4, 0, 0);
    barModel.group.scale.y = 0.6 * COALS[type].lhvMJkg;
    group.add(barModel.group);
    bars[type] = barModel.group;
  });
  return { group, lumps, bars };
}


export interface WagonField {
  group: Group;
  /** Number of wagons shown (eases toward `target`). */
  shown: number;
  target: number;
  update(dt: number): void;
}

const PER_ROW = 20;
const DX = 3.1;
const DZ = 2.4;
const MAX = 320;

export function buildWagonField(at: Vector3): WagonField {
  const group = new Group();
  group.position.copy(at);
  const tray = new Builder('wagon-tray');
  const rows = Math.ceil(MAX / PER_ROW);
  const cx = ((PER_ROW - 1) * DX) / 2;
  tray.box(PER_ROW * DX + 8, 2, rows * DZ + 8, { r: 1, slot: 'matte', c: ['slate', 'steel'], at: [cx, -2, ((rows - 1) * DZ) / 2] });
  for (let r = 0; r < rows; r++) tray.box(PER_ROW * DX + 2, 0.15, 0.9, { r: 0, slot: 'metal', c: 'steel.light', at: [cx, 0, r * DZ] });
  group.add(tray.build().group);
  const proto = new Builder('icon-gondola');
  proto.box(2.8, 1.1, 1.4, { r: 0.15, slot: 'gloss', c: ['ink', 'slate'] });
  proto.dome(0.6, 0.4, { s: [2, 1, 1], seg: 10, slot: 'gloss', c: 'ink', at: [0, 1.1, 0] });
  const mesh = proto.build().group.children[0] as Mesh;
  const inst = new InstancedMesh(mesh.geometry, mesh.material, MAX);
  inst.castShadow = true;
  inst.count = 0;
  group.add(inst);
  const m = new Matrix4();
  const api: WagonField = {
    group,
    shown: 0,
    target: 0,
    update(dt) {
      const before = api.shown;
      // roll in ≈ 60 wagons per second, never slower than 1.2 s for the whole change
      const rate = Math.max(60, Math.abs(api.target - api.shown) / 1.2);
      api.shown += Math.sign(api.target - api.shown) * Math.min(Math.abs(api.target - api.shown), rate * dt);
      if (api.shown === before && inst.count > 0) return;
      const n = Math.min(MAX, Math.ceil(api.shown));
      for (let i = 0; i < n; i++) {
        const a = Math.max(0, Math.min(1, api.shown - i)); // 0 → arriving from the west, 1 → in place
        const x = (i % PER_ROW) * DX - (1 - a) * 24;
        m.makeTranslation(x, 0, Math.floor(i / PER_ROW) * DZ);
        inst.setMatrixAt(i, m);
      }
      inst.count = n;
      inst.instanceMatrix.needsUpdate = true;
    },
  };
  return api;
}
