/**
 * Switchyard in the east and the first spans of the outgoing line: the kit's `substation({ detail: 'light' })`
 * (a line bay and a step-up transformer bay), lattice towers and a `powerLine` whose phase conductors carry the
 * chapter's `yellow` energy pulses (`K.energy`, brightness ∝ island output). The yard is a toy: scaled so it
 * sits next to the plant. Kit lines run along local Z: the group is turned so the line leaves toward +X.
 */
import { Group, type Vector3 } from 'three';
import { K, type KToonMaterial } from '@/style';
import { latticeTower, powerLine, substation, type KitModel, type Substation } from '@/kit';
import { ISLAND, YARD } from '../layout';

export const YARD_SCALE = 0.5;

export interface Yard {
  group: Group;
  yard: Substation;
  /** Material of the phase conductors: `.power` 0…1. */
  wire: KToonMaterial;
  transformer: Vector3;
  lit: KitModel[];
}

export function buildYard(): Yard {
  const group = new Group();
  group.name = 'yard';
  group.scale.setScalar(YARD_SCALE);
  group.position.set(YARD.x, ISLAND.y, YARD.z);
  group.rotation.y = Math.PI / 2; // local +Z → world +X
  const yard = substation({ kV: 330, detail: 'light', fence: true, bays: [{ type: 'line' }, { type: 'transformer', transformer: { hv: 330, lv: 20 } }] });
  group.add(yard.group);
  const towers = [70, 130].map((d, i) => {
    const t = latticeTower({ voltage: 330, type: i === 1 ? 'tension' : 'suspension', low: true });
    t.group.position.set(yard.anchorLocal('bay1.gantry.b1.p2').x, 0, d);
    group.add(t.group);
    return t;
  });
  const wire = K.energy({ color: 'steel', pulseColor: 'yellow', repeat: 0.08, speed: 16, length: 0.35, intensity: 3.2 });
  const line = powerLine([yard.ports[0]!, ...towers], { material: wire, sag: 0.05 });
  group.add(line.group);
  group.updateMatrixWorld(true);
  return { group, yard, wire, transformer: yard.anchorWorld('bay2.t.tank'), lit: [yard] };
}
