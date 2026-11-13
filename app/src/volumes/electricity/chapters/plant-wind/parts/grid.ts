/**
 * Farm substation 33/150 kV and the first spans of the 150 kV line (kit apparatus, `latticeTower`,
 * `powerLine`). The yard is a toy: the whole group is scaled so that it sits next to the small farm turbines.
 * The phase conductors carry the chapter's yellow energy pulses (`K.energy`), brightness ∝ farm output.
 */
import { Group, Vector3 } from 'three';
import { K, type KToonMaterial } from '@/style';
import {
  Builder,
  TOWER_SPECS,
  addBreaker,
  addControlRoom,
  addFence,
  addGantry,
  addPowerTransformer,
  addSpan,
  latticeTower,
  powerLine,
  type KitModel,
  type LineSupport,
} from '@/kit';
import { LINE_TOWERS, SUBSTATION } from '../layout';
import type { World } from './world';

/** Toy scale of the yard and its towers relative to kit metres. */
export const GRID_SCALE = 0.42;

export interface Grid {
  group: Group;
  yard: KitModel;
  /** Material of the phase conductors: tween `.power` (0…1) and `.speed`. */
  wire: KToonMaterial;
  /** World position of the transformer tank (hotspot, cable end). */
  transformer: Vector3;
  /** World position where the collector cables enter the yard. */
  feed: Vector3;
  lit: KitModel[];
}

export function buildGrid(world: World): Grid {
  const group = new Group();
  group.name = 'farm-grid';
  group.scale.setScalar(GRID_SCALE);
  group.position.set(SUBSTATION.x, SUBSTATION.y, SUBSTATION.z);
  group.rotation.y = SUBSTATION.ry;
  world.island.group.add(group);

  // A light yard assembled from kit apparatus in the real order: line portal → breaker → 33/150 kV
  // transformer, wired phase by phase, with a control room and a mesh fence (the kit's full `substation`
  // bays cost ≈ 85k triangles each — too much for a background object).
  const b = new Builder('farm-substation');
  b.frame({ at: [0, 0, 15] }, () => addGantry(b, { kV: 150, bays: 1 }), 'g.');
  b.frame({ at: [0, 0, 5] }, () => addBreaker(b, { kV: 150 }), 'q.');
  b.frame({ at: [0, 0, -8], rot: [0, Math.PI / 2, 0] }, () => addPowerTransformer(b, { hv: 150, lv: 35 }), 't.');
  b.frame({ at: [-15, 0, -6], rot: [0, Math.PI / 2, 0] }, () => addControlRoom(b, { width: 9, depth: 6 }), 'c.');
  for (let k = 1; k <= 3; k++) {
    const drop = b.locate(`g.b1.p${k}.drop`);
    const top = b.locate(`q.p${k}.top`);
    const hv = b.locate(`t.hv${k}`);
    addSpan(b, drop, top, { sag: 0.06, radius: 0.07, segments: 8 });
    addSpan(b, top, hv, { sag: 0.05, radius: 0.07, segments: 8 });
  }
  addFence(b, { route: [[-24, -20], [24, -20], [24, 22], [-24, 22], [-24, -20]], kind: 'mesh', height: 2.4 });
  const yard = b.build();
  group.add(yard.group);
  const port = Object.assign(Object.create(yard) as KitModel, {
    spec: TOWER_SPECS[150],
    phases: [1, 2, 3].map((k) => `g.b1.p${k}`),
    shields: ['g.s1'],
  }) as LineSupport;

  // towers stand on the island; convert their world spots into the scaled, rotated yard frame
  group.updateMatrixWorld(true);
  const towers = LINE_TOWERS.map(([x, z], i) => {
    const t = latticeTower({ voltage: 150, type: i === LINE_TOWERS.length - 1 ? 'tension' : 'suspension', low: true });
    const p = group.worldToLocal(new Vector3(x, world.y(x, z), z));
    t.group.position.copy(p);
    group.add(t.group);
    return t;
  });
  // each tower looks along the line toward the next support
  const sites = [port, ...towers];
  towers.forEach((t, i) => {
    const prev = i === 0 ? new Vector3(0, 0, 0) : towers[i - 1]!.group.position;
    t.group.rotation.y = Math.atan2(t.group.position.x - prev.x, t.group.position.z - prev.z);
  });
  const wire = K.energy({ color: 'steel', pulseColor: 'yellow', repeat: 0.09, speed: 14, length: 0.35, intensity: 3.2 });
  const line = powerLine(sites, { material: wire, sag: 0.05 });
  group.add(line.group);

  group.updateMatrixWorld(true);
  return {
    group,
    yard,
    wire,
    transformer: yard.anchorWorld('t.tank'),
    feed: yard.anchorWorld('t.lv2'),
    lit: [yard],
  };
}
