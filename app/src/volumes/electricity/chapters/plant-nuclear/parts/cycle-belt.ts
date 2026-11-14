/**
 * The fuel-cycle «belt» of step 11: a strip of small dioramas from left to right — mine, mill (yellow cake,
 * `amber` with «U₃O₈»), conversion (UF₆), enrichment (a hall of spinning centrifuges), fabrication, reactor,
 * spent-fuel pool (glowing `sky`→`white`), dry storage (casks) — then a fork: reprocessing / a deep geological
 * repository (tunnels deep under the belt). A fuel assembly rides along the belt (`ride(s)`, s in stage units).
 * The «how much» exhibit: a cube of all the unit's spent fuel of 40 years beside a stadium. Metres.
 */
import { BoxGeometry, CylinderGeometry, Group, Mesh, Vector3 } from 'three';
import { createHalo } from '@/fx';
import { Builder, type KitModel } from '@/kit';
import { K } from '@/style';

export const STAGES = ['stMine', 'stMill', 'stConversion', 'stEnrich', 'stFab', 'stReactor', 'stPool', 'stDry'] as const;
const STEP = 12;
export const stageX = (i: number): number => (i - 4) * STEP;

export interface CycleBelt {
  group: Group;
  model: KitModel;
  centrifuges: Group[];
  fa: Mesh;
  ride(s: number): void;
  howMuch: Group;
  /** World-free anchors (local): top of each stage, the fork ends, the cube, the stadium. */
  at: { stage: Vector3[]; reprocess: Vector3; repository: Vector3; cube: Vector3; stadium: Vector3 };
}

export function buildCycleBelt(): CycleBelt {
  const group = new Group();
  const b = new Builder('fuel-cycle');
  // the belt: a long slab and tiles
  b.box(STEP * 9 + 8, 0.8, 9, { r: 0.3, slot: 'matte', c: ['slate', 'steel'], at: [STEP * 0.5, -0.8, 0] });
  for (let i = 0; i < 8; i++) b.box(STEP - 1.4, 0.2, 8, { r: 0.2, slot: 'matte', c: i % 2 ? 'bg.violet' : 'bg.plum', at: [stageX(i), 0, 0] });
  const x = stageX;
  // 0 mine: a pit with a head frame
  b.cyl(3.4, 0.4, { seg: 24, slot: 'matte', c: 'slate.dark', at: [x(0), 0.2, 0] });
  b.beam([x(0) - 1.5, 0.6, 0], [x(0), 5, 0], 0.3, { c: 'amber.dark' });
  b.beam([x(0) + 1.5, 0.6, 0], [x(0), 5, 0], 0.3, { c: 'amber.dark' });
  b.cyl(0.6, 0.3, { axis: 'z', seg: 16, slot: 'metal', c: 'steel', at: [x(0), 5, -0.15] });
  // 1 mill: a shed and a heap of yellow cake
  b.box(4, 2.6, 3.4, { r: 0.2, slot: 'matte', c: ['steel', 'mist'], at: [x(1) - 1.4, 0.2, -1.2] });
  b.cone(1.5, 1.2, { seg: 24, slot: 'matte', c: 'amber', at: [x(1) + 2, 0.2, 1.6] });
  // 2 conversion: tanks and pipes
  for (const dx of [-1.6, 0.6]) b.cyl(1.0, 3.6, { seg: 20, slot: 'gloss', c: ['steel', 'mist'], at: [x(2) + dx, 0.2, -0.5] });
  b.capsule(0.6, 3, { axis: 'x', seg: 16, slot: 'gloss', c: 'mist', at: [x(2) - 1.5, 0.9, 2] });
  // 3 enrichment: a hall floor (centrifuges are parts below)
  b.box(9.6, 0.3, 6.6, { r: 0.1, slot: 'matte', c: 'slate', at: [x(3), 0.2, 0] });
  // 4 fabrication: a hall with a pellet press and a row of finished assemblies
  b.box(5, 3, 3.4, { r: 0.2, slot: 'matte', c: ['steel', 'mist'], at: [x(4) - 1.6, 0.2, -1.4] });
  for (let i = 0; i < 4; i++) b.cyl(0.18, 3.6, { seg: 6, slot: 'metal', c: 'mist', at: [x(4) + 1.8 + i * 0.6, 0.2, 2] });
  // 5 reactor: a little containment
  b.cyl(2.6, 3.6, { seg: 32, slot: 'matte', c: ['steel.light', 'mist'], at: [x(5), 0.2, 0] });
  b.dome(2.6, 1.6, { seg: 32, slot: 'matte', c: 'mist', at: [x(5), 3.8, 0] });
  // 6 pool: basin; water + glow are separate
  b.box(7, 1.2, 5, { r: 0.2, slot: 'matte', c: ['slate', 'steel'], at: [x(6), 0.2, 0] });
  // 7 dry storage: casks
  for (let i = 0; i < 6; i++) b.cyl(0.8, 2.6, { seg: 20, slot: 'matte', c: ['steel', 'mist'], at: [x(7) - 3 + (i % 3) * 2.2, 0.2, -1.4 + Math.floor(i / 3) * 2.8] });
  // fork: reprocessing plant (up-right) and the repository (tunnels deep below)
  b.box(6, 3, 4, { r: 0.2, slot: 'matte', c: ['steel', 'mist'], at: [x(8) + 2, 0.2, -6] });
  b.cyl(0.5, 5, { seg: 12, slot: 'matte', c: 'mist', at: [x(8) + 4, 3.2, -6] });
  b.box(1.6, 22, 1.6, { r: 0.2, slot: 'matte', c: ['ink', 'slate'], at: [x(8) + 2, -22, 5] }); // shaft
  b.box(14, 1.2, 1.8, { r: 0.3, slot: 'matte', c: 'ink', at: [x(8) + 2, -22, 5] });
  for (let i = 0; i < 5; i++) b.cyl(0.35, 0.9, { seg: 12, slot: 'metal', c: 'amber.dark', at: [x(8) - 3 + i * 2.4, -21.5, 5] }); // copper capsules
  const model = b.build();
  group.add(model.group);
  // centrifuges: 12 tall cylinders turning (parts for the spin)
  const centrifuges: Group[] = [];
  for (let i = 0; i < 12; i++) {
    const g = new Group();
    const m = new Mesh(new CylinderGeometry(0.28, 0.28, 2.6, 16).translate(0, 1.6, 0), K.metal({ color: 'steel.light' }));
    const band = new Mesh(new CylinderGeometry(0.3, 0.3, 0.2, 16).translate(0, 2.2, 0), K.toon({ color: 'violet' }));
    g.add(m, band);
    g.position.set(x(3) - 3.6 + (i % 6) * 1.45, 0.3, -1.4 + Math.floor(i / 6) * 2.8);
    centrifuges.push(g);
    group.add(g);
  }
  const water = new Mesh(new BoxGeometry(6.4, 0.9, 4.4), K.glass({ color: 'sky', opacity: 0.6 }));
  water.position.set(x(6), 0.9, 0);
  const glow = createHalo({ color: 'sky.light', size: 7, intensity: 0.9 });
  glow.position.set(x(6), 1.6, 0);
  group.add(water, glow);
  // the riding assembly
  const fa = new Mesh(new CylinderGeometry(0.35, 0.35, 3, 6), K.toon({ color: 'violet.light' }));
  group.add(fa);
  const ride = (s: number): void => {
    const i = Math.min(7, Math.max(4, s));
    fa.position.set(x(4) + (i - 4) * STEP, i >= 5.6 && i <= 6.4 ? 0.9 : 5.2, 0.6);
  };
  ride(5);
  // «how much»: a 4,6 m cube of UO₂ beside a stadium (110 × 70 m pitch, in the distance)
  const howMuch = new Group();
  const cube = new Mesh(new BoxGeometry(4.6, 4.6, 4.6), K.toon({ color: 'slate.light' }));
  cube.position.set(x(7) + 1, 2.5, 10);
  const sb = new Builder('stadium');
  sb.box(110, 0.4, 70, { r: 2, slot: 'matte', c: 'green', at: [0, 0, 0] });
  sb.box(120, 8, 4, { r: 1, slot: 'matte', c: 'steel.light', at: [0, 0, -38] });
  sb.box(120, 8, 4, { r: 1, slot: 'matte', c: 'steel.light', at: [0, 0, 38] });
  const stadium = sb.build();
  stadium.group.position.set(x(4), -6, -75);
  howMuch.add(cube, stadium.group);
  group.add(howMuch);
  return {
    group,
    model,
    centrifuges,
    fa,
    ride,
    howMuch,
    at: {
      stage: STAGES.map((_, i) => new Vector3(x(i), 6.4, 0)),
      reprocess: new Vector3(x(8) + 2, 8.5, -6),
      repository: new Vector3(x(8) + 2, -20, 5),
      cube: new Vector3(x(7) + 1, 5.2, 10),
      stadium: new Vector3(x(4), 4, -75),
    },
  };
}
