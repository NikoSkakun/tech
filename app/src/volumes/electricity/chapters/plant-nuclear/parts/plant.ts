/**
 * The power unit on the island: containment (two halves), turbine hall, two cooling towers with plumes, the
 * vent stack with blinking lights, block transformer, 750 kV switchyard and the outgoing line (yellow pulses,
 * brightness ∝ generator output), plus the site buildings (`site.ts`). Kit models wherever the kit has them.
 */
import { Group, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createPlume, type ParticleSystem } from '@/fx';
import { K, type KToonMaterial } from '@/style';
import { coolingTower, latticeTower, machineHall, powerLine, powerTransformer, stack, substation, type KitModel, type MachineHall } from '@/kit';
import { BLOCK_TRANSFORMER, CONTAINMENT, LINE_TOWERS, SWITCHYARD, TOWER_HEIGHT, TOWERS, TURBINE_HALL, VENT_STACK } from '../layout';
import { buildContainment, type Containment } from './containment';
import { buildInterior, type Interior } from './interior';
import { buildSite, type Site } from './site';
import { buildTurbineIsland, type TurbineIsland } from './turbine-island';
import type { World } from './world';

export interface Plant {
  containment: Containment;
  hall: MachineHall;
  towers: KitModel[];
  plumes: ParticleSystem[];
  site: Site;
  interior: Interior;
  island: TurbineIsland;
  /** Phase conductors of the outgoing line: tween `.power` (0…1). */
  wire: KToonMaterial;
  /** Kit models with lit windows / lamps (night), and models with an `update`. */
  lit: KitModel[];
  /** World anchors for callouts, hotspots and shots. */
  at: Record<'containment' | 'hall' | 'tower' | 'switchyard' | 'transformer' | 'reactor' | 'stackTop', Vector3>;
}

export function buildPlant(ctx: ChapterContext, world: World): Plant {
  const isl = world.island;
  const base = world.y(CONTAINMENT.x, CONTAINMENT.z);
  const containment = buildContainment();
  for (const m of [containment.back, containment.front]) {
    m.group.position.set(CONTAINMENT.x, base, CONTAINMENT.z);
    isl.group.add(m.group);
  }
  const hall = machineHall({ length: TURBINE_HALL.length, width: TURBINE_HALL.width, height: TURBINE_HALL.height, units: 1 });
  isl.place(hall.group, TURBINE_HALL.x, TURBINE_HALL.z, 0, 0.2);

  const towers = TOWERS.map(([x, , z]) => {
    const t = coolingTower({ height: TOWER_HEIGHT });
    isl.place(t.group, x, z);
    return t;
  });
  const plumes = towers.map((t) => {
    const plume = createPlume(ctx, { radius: TOWER_HEIGHT * 0.2, height: TOWER_HEIGHT * 0.9, wind: [3, 0, 1] });
    plume.position.copy(t.anchorWorld('top'));
    isl.group.worldToLocal(plume.position);
    isl.group.add(plume);
    return plume;
  });
  const vent = stack({ height: 96, radius: 3.4 });
  isl.place(vent.group, VENT_STACK[0], VENT_STACK[2]);

  const tr = powerTransformer({ hv: 750, lv: 24, scale: 1 });
  isl.place(tr.group, BLOCK_TRANSFORMER[0], BLOCK_TRANSFORMER[2], Math.PI / 2);

  // 750 kV switchyard (toy-compressed) and the first spans of the line
  const yardGroup = new Group();
  yardGroup.scale.setScalar(0.5);
  yardGroup.position.set(SWITCHYARD.x, world.y(SWITCHYARD.x, SWITCHYARD.z), SWITCHYARD.z);
  yardGroup.rotation.y = SWITCHYARD.ry;
  isl.group.add(yardGroup);
  const yard = substation({ kV: 750, detail: 'light', fence: true, bays: [{ type: 'line' }, { type: 'transformer', transformer: { hv: 750, lv: 24 } }] });
  yardGroup.add(yard.group);
  yardGroup.updateMatrixWorld(true);
  const towersL = LINE_TOWERS.map(([x, z], i) => {
    const t = latticeTower({ voltage: 750, type: i === LINE_TOWERS.length - 1 ? 'tension' : 'suspension', low: true });
    t.group.position.copy(yardGroup.worldToLocal(new Vector3(x, world.y(x, z), z)));
    yardGroup.add(t.group);
    return t;
  });
  towersL.forEach((t, i) => {
    const prev = i === 0 ? yard.anchorLocal('bay1.gantry.b1.p2') : towersL[i - 1]!.group.position;
    t.group.rotation.y = Math.atan2(t.group.position.x - prev.x, t.group.position.z - prev.z);
  });
  const wire = K.energy({ color: 'steel', pulseColor: 'yellow', repeat: 0.06, speed: 16, length: 0.35, intensity: 3.2 });
  const line = powerLine([yard.ports[0]!, ...towersL], { material: wire, sag: 0.05 });
  yardGroup.add(line.group);

  const site = buildSite(ctx, world);
  const interior = buildInterior(ctx, base);
  isl.group.add(interior.group);
  const island = buildTurbineIsland(ctx, base);
  isl.group.add(island.group);
  isl.group.updateMatrixWorld(true);
  const top = containment.back.anchorWorld('top');
  return {
    containment,
    hall,
    towers,
    plumes,
    site,
    interior,
    island,
    wire,
    lit: [hall, vent, yard, containment.back, island.turbine, ...towers],
    at: {
      containment: top.clone().add(new Vector3(0, -6, 0)),
      hall: new Vector3(TURBINE_HALL.x, base + TURBINE_HALL.height + 2, TURBINE_HALL.z),
      tower: towers[1]!.anchorWorld('top'),
      switchyard: yardGroup.localToWorld(new Vector3(0, 12, 0)),
      transformer: tr.anchorWorld('tank'),
      reactor: new Vector3(CONTAINMENT.x, base + 8, CONTAINMENT.z),
      stackTop: vent.anchorWorld('top'),
    },
  };
}
