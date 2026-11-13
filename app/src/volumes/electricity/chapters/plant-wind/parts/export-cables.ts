/**
 * Offshore cables (step 10): inter-array strings on the sea bed (yellow energy pulses) from the turbines to
 * the platform, and the export link to the shore in two versions — one AC cable whose capacity is eaten by
 * `sky` charging current as it gets longer (`flow.reactive`), or an HVDC pair (+ `coral`, − `blue`).
 * The route leaves the sea block through its west wall, hangs across the strait and lands on the beach.
 */
import { Group, Vector3 } from 'three';
import { createWire, type Wire } from '@/fx';
import { G } from '@/kit';
import { SEMANTIC } from '@/style';
import { ISLAND, SEA } from '../layout';
import { PLATFORM, type Offshore } from './offshore';
import { seaDepth } from './sea';
import type { World } from './world';

export interface ExportCables {
  group: Group;
  array: Wire[];
  ac: Group;
  dc: Group;
  /** World point in the middle of the strait (label anchor). */
  mid: Vector3;
  /** Landing point of the cable on the island (converter station). */
  landing: Vector3;
  /** `distanceKm` = length of the link; `power` 0…1 = output of the offshore farm. */
  update(distanceKm: number, power: number): void;
}

/** Above this length the charging current makes HVDC the usual choice (the threshold is a convention). */
export const HVDC_FROM_KM = 80;

export function buildExportCables(world: World, offshore: Offshore): ExportCables {
  const group = new Group();
  group.name = 'offshore-cables';
  const look = { radius: 0.36, color: 'slate', repeat: 0.1, speed: 9, length: 0.4, intensity: 3.2, detail: 0.4, radialSegments: 8, castShadow: false } as const;
  const sea = offshore.sea.group;
  const array = offshore.strings.map((pts) => {
    const w = createWire(pts, look);
    sea.add(w);
    return w;
  });
  // export route in world space
  const local = (x: number, z: number, lift = 0.45): Vector3 => sea.localToWorld(new Vector3(x, -seaDepth(x) + lift, z));
  sea.updateMatrixWorld(true);
  const landing = new Vector3(162, world.y(162, 22) + 0.4, 22);
  const route = (dz: number): Vector3[] => {
    const z = PLATFORM[1] + dz;
    const exit = local(-SEA.sizeX / 2 + 1, z);
    const shore = new Vector3(ISLAND.semiX - 4, world.y(ISLAND.semiX - 16, 12) - 0.6, 12 + dz);
    return [
      local(PLATFORM[0], z, 9), // down the platform's J-tube
      local(PLATFORM[0] - 4, z),
      local(-60, z),
      exit,
      ...G.catenary(exit, shore, 7, 10).slice(1, -1), // slack across the strait
      shore,
      new Vector3(204, world.y(204, 16) + 0.15, 16 + dz),
      new Vector3(182, world.y(182, 20) + 0.2, 20 + dz),
      landing.clone().setZ(landing.z + dz),
    ];
  };
  const ac = new Group();
  const active = createWire(route(0), { ...look, radius: 0.5 });
  const reactive = createWire(route(0), { ...look, radius: 0.56, color: 'steel', pulseColor: SEMANTIC.reactive, repeat: 0.22, length: 0.22, speed: -5 });
  reactive.material.depthWrite = false;
  ac.add(active, reactive);
  const dc = new Group();
  const plus = createWire(route(-1.3), { ...look, radius: 0.42, color: SEMANTIC.dcPlus });
  const minus = createWire(route(1.3), { ...look, radius: 0.42, color: SEMANTIC.dcMinus });
  dc.add(plus, minus);
  group.add(ac, dc);
  const mid = route(0)[8]!.clone();
  return {
    group,
    array,
    ac,
    dc,
    mid,
    landing,
    update(distanceKm, power) {
      for (const w of array) w.material.power = 0.2 + 0.8 * power;
      // charging current ∝ cable length; what is left for active power shrinks (illustration)
      const charge = Math.min(1, distanceKm / 100);
      reactive.material.power = 0.15 + 1.1 * charge;
      active.material.power = power * (1 - 0.6 * charge);
      plus.material.power = minus.material.power = power;
    },
  };
}
