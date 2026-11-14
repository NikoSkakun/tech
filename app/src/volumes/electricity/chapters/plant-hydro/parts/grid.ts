/**
 * Switchyard (ВРП) on the south bank and the first spans of the outgoing line: kit `substation({ detail:
 * 'light' })` scaled to the toy valley, `latticeTower`s and a `powerLine` from the yard's line port. The plant's
 * output reaches the yard along a short three-phase busway from the transformer deck (L1 / L2 / L3 colours,
 * `K.energy` pulses). Phase conductors and busway carry yellow pulses, brightness ∝ output; a negative power
 * (step 8: the pumped-storage plant draws from the grid) runs the pulses backwards.
 */
import { Group, Mesh, Vector3 } from 'three';
import { K, SEMANTIC, type KToonMaterial } from '@/style';
import { Builder, G, latticeTower, powerLine, substation, type KitModel, type Substation } from '@/kit';
import { LINE_TOWERS, SWITCHYARD } from '../layout';
import type { World } from './world';

/** Toy scale of the yard and its towers relative to kit metres. */
export const GRID_SCALE = 0.5;

export interface Grid {
  group: Group;
  yard: Substation;
  /** Conductors and busway: brightness / direction of the pulses. */
  materials: KToonMaterial[];
  transformer: Vector3;
  lit: KitModel[];
  /** Output 0…1 (negative: power flows into the plant). */
  setPower(p: number): void;
}

export function buildGrid(world: World): Grid {
  world.island.group.updateMatrixWorld(true); // anchors below are read in world space before the first frame
  const group = new Group();
  group.name = 'hydro-grid';
  group.scale.setScalar(GRID_SCALE);
  group.position.set(SWITCHYARD.x, SWITCHYARD.y, SWITCHYARD.z);
  group.rotation.y = -0.5;
  world.island.group.add(group);
  const yard = substation({
    kV: 330,
    detail: 'light',
    fence: true,
    bays: [{ type: 'line' }, { type: 'transformer', transformer: { hv: 330, lv: 15 } }],
  });
  group.add(yard.group);
  group.updateMatrixWorld(true);
  const towers = LINE_TOWERS.map(([x, z], i) => {
    const t = latticeTower({
      voltage: 330,
      type: i === LINE_TOWERS.length - 1 ? 'tension' : 'suspension',
      low: true,
    });
    t.group.position.copy(group.worldToLocal(new Vector3(x, world.y(x, z), z)));
    group.add(t.group);
    return t;
  });
  towers.forEach((t, i) => {
    const prev = i === 0 ? yard.anchorLocal('bay1.gantry.b1.p2') : towers[i - 1]!.group.position;
    t.group.rotation.y = Math.atan2(t.group.position.x - prev.x, t.group.position.z - prev.z);
  });
  const wire = K.energy({
    color: 'steel',
    pulseColor: 'yellow',
    repeat: 0.08,
    speed: 14,
    length: 0.35,
    intensity: 3.2,
  });
  group.add(powerLine([yard.ports[0]!, ...towers], { material: wire, sag: 0.05 }).group);

  // busway from the powerhouse transformer deck to the yard's transformer bay: three phase-coloured rails on posts
  const from = world.powerhouse.anchorWorld('tx3');
  const to = yard.anchorWorld('bay2.t.lv2');
  const bus = new Builder('busway');
  const mats: KToonMaterial[] = [wire];
  const phase = [SEMANTIC.phaseL1, SEMANTIC.phaseL2, SEMANTIC.phaseL3];
  const route = [
    from.clone(),
    new Vector3(from.x + 14, from.y, from.z + 10),
    new Vector3(to.x - 12, from.y + 2, to.z - 6),
    to.clone(),
  ];
  const busGroup = new Group();
  phase.forEach((c, k) => {
    const m = K.energy({
      color: c,
      pulseColor: 'yellow',
      repeat: 0.06,
      speed: 10,
      length: 0.3,
      intensity: 2.6,
    });
    mats.push(m);
    const off = new Vector3(0, k * 0.9, 0);
    // a dense, rounded polyline: `uv.x` = metres along the rail, so the pulses keep their spacing at the bends
    const pts = G.roundPath(
      route.map((p) => p.clone().add(off)),
      4,
    );
    busGroup.add(new Mesh(G.tube(pts, 0.28, { seg: 8 }), m));
  });
  for (const p of route.slice(1, 3))
    bus.cyl(0.3, p.y - world.y(p.x, p.z) + 0.2, { c: 'slate', at: [p.x, world.y(p.x, p.z), p.z] });
  busGroup.add(bus.build().group);
  world.island.group.add(busGroup);
  group.updateMatrixWorld(true);
  return {
    group,
    yard,
    materials: mats,
    transformer: yard.anchorWorld('bay2.t.tank'),
    lit: [yard],
    setPower(p: number) {
      for (const m of mats) {
        m.power = Math.min(1, Math.abs(p));
        m.speed = (p >= 0 ? 1 : -1) * (m === wire ? 14 : 10);
      }
    },
  };
}
