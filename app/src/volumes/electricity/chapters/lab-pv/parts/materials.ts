/**
 * «Розібрати» (step 11): the module taken apart into its raw materials, each on a small weighing plate —
 * a glass slab, the aluminium frame, a roll of polymer film, silicon shards, a copper coil, a grain of silver.
 * Sizes follow the masses of `MODULE_MATERIALS_KG` (cube root, so 15 kg of glass and 5 g of silver both read).
 */
import { Group, type Object3D } from 'three';
import { Builder } from '@/kit';
import { MODULE_MATERIALS_KG } from '@electricity/sim/lab-pv';
import { shadows } from '../world';

export type MaterialId = keyof typeof MODULE_MATERIALS_KG;
export const MATERIAL_ORDER: readonly MaterialId[] = ['glass', 'aluminium', 'polymers', 'silicon', 'copper', 'silver'];

export interface Materials {
  group: Group;
  anchors: Record<MaterialId, Object3D>;
  update(t: number): void;
}

export function createMaterials(): Materials {
  const group = new Group();
  group.name = 'materials';
  const anchors = {} as Record<MaterialId, Object3D>;
  const plates: Object3D[] = [];
  MATERIAL_ORDER.forEach((id, i) => {
    const kg = MODULE_MATERIALS_KG[id];
    const s = Math.max(0.2, Math.cbrt(kg / 15)) * 0.9; // linear size of the pile
    const b = new Builder(`material-${id}`);
    b.cyl(0.5, 0.06, { seg: 28, slot: 'metal', c: 'steel' });
    b.cyl(0.44, 0.03, { seg: 28, slot: 'gloss', c: 'bg.indigo', at: [0, 0.06, 0] });
    const y = 0.1;
    if (id === 'glass') b.box(s * 1.3, s * 0.22, s * 0.9, { r: 0.02, slot: 'glass', c: 'sky', at: [0, y, 0] });
    else if (id === 'aluminium') {
      for (const k of [-1, 1]) {
        b.box(s * 1.5, s * 0.14, s * 0.14, { r: 0.01, slot: 'metal', c: 'mist', at: [0, y, k * s * 0.42] });
        b.box(s * 0.14, s * 0.14, s * 0.9, { r: 0.01, slot: 'metal', c: 'mist', at: [k * s * 0.68, y, 0] });
      }
    } else if (id === 'polymers') b.cyl(s * 0.5, s * 0.9, { seg: 24, slot: 'gloss', c: 'white', axis: 'x', at: [-s * 0.45, y + s * 0.5, 0] });
    else if (id === 'silicon') {
      for (const [x, z, r] of [[0, 0, 0], [0.5, 0.3, 0.6], [-0.4, 0.35, 1.2], [0.1, -0.45, 2]] as const) b.box(s * 0.7, s * 0.07, s * 0.5, { r: 0, slot: 'gloss', c: 'blue.dark', at: [x * s, y + r * 0.02, z * s], rot: [0, r, 0] });
    } else if (id === 'copper') b.ring(s * 0.7, s * 0.22, { seg: 28, tubeSeg: 10, slot: 'metal', c: 'orange', at: [0, y + s * 0.22, 0] });
    else b.sphere(s * 0.6, { seg: 16, slot: 'metal', c: 'white', at: [0, y, 0] });
    b.anchor('top', 0, y + s * 0.6, 0);
    const model = b.build();
    const g = shadows(model.group);
    g.position.set((i - (MATERIAL_ORDER.length - 1) / 2) * 1.08, 0, 0);
    group.add(g);
    plates.push(g);
    anchors[id] = model.anchor('top');
  });
  return {
    group,
    anchors,
    update(t) {
      plates.forEach((p, i) => (p.position.y = Math.abs(Math.sin(t * 1.3 + i * 0.7)) * 0.03));
    },
  };
}
