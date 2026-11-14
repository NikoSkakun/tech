/**
 * Site buildings of the unit that the kit does not have: the three diesel-generator houses (one per safety
 * channel, numbered 1/2/3 with coloured frames), the dry-storage pad with its row of concrete-steel casks and
 * the spray ponds — basins with fields of fountains (`createParticles`, falling drops).
 */
import { Group, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { boxEmitter, createParticles, type ParticleSystem } from '@/fx';
import { Builder, waterDisc, type KitModel } from '@/kit';
import { DIESELS, DRY_STORAGE, POND_SIZE, PONDS } from '../layout';
import type { World } from './world';

/** Frame colours of the three safety channels (also used by the safety exhibit of step 9). */
export const CHANNEL_COLORS = ['coral', 'amber', 'sky'] as const;

function dieselHouse(i: number): KitModel {
  const b = new Builder(`diesel-${i + 1}`);
  b.box(12, 7, 9, { r: 0.4, slot: 'matte', c: ['steel.light', 'mist'] });
  b.box(12.4, 0.8, 9.4, { r: 0.2, slot: 'matte', c: CHANNEL_COLORS[i], at: [0, 7, 0] });
  b.box(3, 4, 0.3, { r: 0.1, slot: 'metal', c: 'slate', at: [-3, 0, 4.5] });
  for (let k = 0; k < 2; k++) b.cyl(0.45, 4, { seg: 12, slot: 'metal', c: 'slate', at: [2 + k * 2.4, 7, -2] });
  b.box(1.2, 1.2, 0.2, { slot: 'glow', c: CHANNEL_COLORS[i], at: [3, 4.6, 4.6] });
  b.anchor('top', 0, 8, 0);
  return b.build();
}

function dryStorage(): KitModel {
  const b = new Builder('dry-storage');
  const w = DRY_STORAGE.perRow * DRY_STORAGE.spacing + 6;
  const d = DRY_STORAGE.rows * DRY_STORAGE.spacing + 6;
  b.box(w, 0.8, d, { r: 0.2, slot: 'matte', c: 'steel.light' });
  for (let r = 0; r < DRY_STORAGE.rows; r++)
    for (let i = 0; i < DRY_STORAGE.perRow; i++) {
      const x = (i - (DRY_STORAGE.perRow - 1) / 2) * DRY_STORAGE.spacing;
      const z = (r - (DRY_STORAGE.rows - 1) / 2) * DRY_STORAGE.spacing;
      b.cyl(1.7, 5.6, { seg: 24, slot: 'matte', c: ['steel', 'mist'], at: [x, 0.8, z] });
      b.cyl(1.75, 0.5, { seg: 24, slot: 'metal', c: 'slate', at: [x, 6.2, z] });
      b.cyl(0.5, 0.2, { seg: 12, slot: 'metal', c: 'steel', at: [x, 6.7, z] });
    }
  // low fence posts on the corners
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(0.2, 2.2, { seg: 8, c: 'slate', at: [(sx * w) / 2, 0, (sz * d) / 2] });
  b.anchor('top', 0, 7, 0);
  return b.build();
}

export interface Site {
  diesels: KitModel[];
  dry: KitModel;
  ponds: Group;
  fountains: ParticleSystem[];
  /** World anchors for callouts and hotspots. */
  at: { diesels: Vector3; dry: Vector3; ponds: Vector3 };
}

export function buildSite(ctx: ChapterContext, world: World): Site {
  const isl = world.island;
  const diesels = DIESELS.map(([x, , z], i) => {
    const m = dieselHouse(i);
    isl.place(m.group, x, z, Math.PI / 2);
    return m;
  });
  const dry = dryStorage();
  isl.place(dry.group, DRY_STORAGE.x, DRY_STORAGE.z, 0.2);
  const ponds = new Group();
  const fountains: ParticleSystem[] = [];
  for (const [x, , z] of PONDS) {
    const y = world.y(x, z);
    const b = new Builder('spray-pond');
    b.box(POND_SIZE.x + 3, 1.6, POND_SIZE.z + 3, { r: 0.6, slot: 'matte', c: 'steel.light', at: [0, -0.4, 0] });
    const rim = b.build();
    rim.group.position.set(x, y, z);
    const water = waterDisc(POND_SIZE.z / 2, 0, { shallow: 'sky', deep: 'blue', followLook: true });
    water.group.scale.set(POND_SIZE.x / POND_SIZE.z, 1, 1);
    water.group.position.set(x, y + 1.25, z);
    const spray = createParticles(ctx, {
      count: 900,
      emitter: boxEmitter([POND_SIZE.x * 0.86, 0.1, POND_SIZE.z * 0.8], { axis: [0, 1, 0], spread: 0.18 }),
      sprite: 'drop',
      color: ['white', 'sky.light'],
      life: [1.1, 1.6],
      speed: [6.5, 8],
      gravity: [0, -11, 0],
      size: [0.5, 0.75, 0.3],
      opacity: 0.85,
      blend: 'normal',
    });
    spray.position.set(x, y + 1.4, z);
    ponds.add(rim.group, water.group, spray);
    fountains.push(spray);
  }
  isl.group.add(ponds);
  const p = (x: number, z: number, dy: number): Vector3 => new Vector3(x, world.y(x, z) + dy, z);
  return {
    diesels,
    dry,
    ponds,
    fountains,
    at: { diesels: p(DIESELS[0]![0], DIESELS[0]![2], 9), dry: p(DRY_STORAGE.x, DRY_STORAGE.z, 8), ponds: p(PONDS[0]![0], PONDS[0]![2], 6) },
  };
}
