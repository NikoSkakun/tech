/**
 * Farm substation 33/150 kV and the first spans of the 150 kV line: the kit's `substation({ detail: 'light' })`
 * (line bay: breaker → disconnector → gantry; transformer bay: breaker → 150/35 kV transformer), a control
 * room, `latticeTower`s and a `powerLine` from the yard's own line port. The yard is a toy: the whole group
 * is scaled so that it sits next to the small farm turbines. The phase conductors carry the chapter's yellow
 * energy pulses (`K.energy`), brightness ∝ farm output.
 */
import { Group, Vector3 } from 'three';
import { K, type KToonMaterial } from '@/style';
import { Builder, addControlRoom, latticeTower, powerLine, substation, type KitModel, type Substation } from '@/kit';
import { LINE_TOWERS, SUBSTATION } from '../layout';
import type { World } from './world';

/** Toy scale of the yard and its towers relative to kit metres. */
export const GRID_SCALE = 0.42;

export interface Grid {
  group: Group;
  yard: Substation;
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

  // bay 1 = the outgoing 150 kV line (toward +Z), bay 2 = the 33/150 kV transformer the collector feeds
  const yard = substation({ kV: 150, detail: 'light', fence: true, bays: [{ type: 'line' }, { type: 'transformer', transformer: { hv: 150, lv: 35 } }] });
  group.add(yard.group);
  const cb = new Builder('farm-control-room');
  addControlRoom(cb, { width: 9, depth: 6 });
  const room = cb.build();
  room.group.position.set(-yard.footprint[0] / 2 - 7, 0, -4);
  room.group.rotation.y = Math.PI / 2;
  group.add(room.group);

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
  towers.forEach((t, i) => {
    const prev = i === 0 ? yard.anchorLocal('bay1.gantry.b1.p2') : towers[i - 1]!.group.position;
    t.group.rotation.y = Math.atan2(t.group.position.x - prev.x, t.group.position.z - prev.z);
  });
  const wire = K.energy({ color: 'steel', pulseColor: 'yellow', repeat: 0.09, speed: 14, length: 0.35, intensity: 3.2 });
  const line = powerLine([yard.ports[0]!, ...towers], { material: wire, sag: 0.05 });
  group.add(line.group);

  group.updateMatrixWorld(true);
  return {
    group,
    yard,
    wire,
    transformer: yard.anchorWorld('bay2.t.tank'),
    feed: yard.anchorWorld('bay2.t.lv2'),
    lit: [yard, room],
  };
}
