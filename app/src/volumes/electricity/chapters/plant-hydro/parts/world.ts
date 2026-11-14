/**
 * The valley island and everything that lives on it: terrain (`terrain.ts`), the reservoir surface, the dam,
 * the powerhouse, the switchyard and line (`grid.ts`), the little town by the bay, trees, grass, clouds,
 * birds, people on the dam crest, a fishing boat on the reservoir. Built in metres, all from `@/kit` plus the
 * chapter's hero models.
 */
import { Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import {
  birds,
  circlePath,
  cityBlock,
  clouds,
  forest,
  groundCover,
  people,
  traffic,
  type Island,
  type KitModel,
} from '@/kit';
import { DAM, FISH_LADDER, ISLAND, POWERHOUSE, PSH, RESERVOIR, SPILLWAY, SWITCHYARD, TOWN } from '../layout';
import { buildDam, type Dam } from './dam';
import { buildFishLadder, type FishLadder } from './fish-ladder';
import { buildPowerhouse, type Powerhouse } from './powerhouse';
import { buildTerrain } from './terrain';
import { buildReservoir, type Reservoir } from './water';

export interface World {
  island: Island;
  y(x: number, z: number): number;
  reservoir: Reservoir;
  dam: Dam;
  powerhouse: Powerhouse;
  fishLadder: FishLadder;
  town: KitModel;
  /** Models with per-frame animation (sway, drift, flapping, walking). */
  alive: KitModel[];
  /** Everything with lamps / lit windows. */
  lit: KitModel[];
}

/** Keep-out discs `[x, z, r]` for trees: structures and the water. */
function keepOut(): [number, number, number][] {
  const out: [number, number, number][] = [
    [SWITCHYARD.x, SWITCHYARD.z, 34],
    [PSH.bowl.x, PSH.bowl.z, PSH.bowl.r + 14],
    [PSH.station.x, PSH.station.z, 24],
    [TOWN.x, TOWN.z, TOWN.size * 0.75],
  ];
  for (let z = DAM.z0; z <= DAM.z1; z += 20) out.push([(DAM.faceX + DAM.toeX) / 2, z, 30]);
  for (let x = FISH_LADDER.x1; x <= FISH_LADDER.x0; x += 12) out.push([x, FISH_LADDER.z, 10]);
  return out;
}

export function buildWorld(ctx: ChapterContext): World {
  const rng = ctx.random.fork('world');
  const isl = buildTerrain();
  const y = (x: number, z: number): number => isl.heightAt(x, z);
  const reservoir = buildReservoir();
  isl.group.add(reservoir.mesh);
  const dam = buildDam();
  isl.group.add(dam.group);
  const powerhouse = buildPowerhouse();
  isl.group.add(powerhouse.group);
  const fishLadder = buildFishLadder(y);
  isl.group.add(fishLadder.group);
  const town = cityBlock({
    size: [TOWN.size, TOWN.size * 0.7],
    lot: 15,
    floors: [2, 7],
    gaps: 0.1,
    lit: 0.6,
    seed: 5,
  });
  town.group.position.set(TOWN.x, y(TOWN.x, TOWN.z), TOWN.z);
  town.group.rotation.y = -0.35;
  isl.group.add(town.group);

  const alive: KitModel[] = [powerhouse, fishLadder];
  const add = <T extends KitModel>(m: T): T => {
    isl.group.add(m.group);
    alive.push(m);
    return m;
  };
  const avoid = keepOut();
  // trees only on dry land above the reservoir's normal level (so a full reservoir never drowns them)
  // the scatter area is a disc of `radius`: the long island needs its long semi-axis
  const ground = {
    radius: ISLAND.semiX,
    heightAt: y,
    inside: (x: number, z: number, m?: number) =>
      isl.inside(x, z, m) && (x > DAM.toeX || y(x, z) > RESERVOIR.npr + 2) && y(x, z) < 120,
    dry: (x: number, z: number) => isl.dry(x, z) && y(x, z) > ISLAND.seaLevel + 1.5,
  };
  add(
    forest({
      count: ctx.quality.count(170, 80),
      ground,
      rng,
      avoid,
      clump: 0.7,
      kinds: ['conifer', 'pine', 'round', 'oak', 'birch', 'bush'],
    }),
  );
  add(groundCover({ kind: 'grass', ground, rng, count: ctx.quality.count(240, 100), avoid }));
  add(groundCover({ kind: 'rocks', ground: isl, rng, count: 50, avoid }));
  add(
    clouds({
      rng,
      count: ctx.quality.count(9, 5),
      radius: [240, 520],
      heights: [
        [170, 230],
        [-110, -60],
      ],
      size: [3, 5.5],
      speed: 2,
    }),
  );
  add(
    birds({
      rng,
      count: 7,
      centre: [-60, RESERVOIR.npr, -10],
      radius: [40, 90],
      height: [26, 50],
      size: 2.2,
      color: 'white',
    }),
  );
  add(
    birds({
      rng,
      count: 5,
      centre: [ISLAND.coastX, ISLAND.seaLevel, 30],
      radius: [30, 60],
      height: [18, 34],
      size: 2,
      color: 'white',
    }),
  );
  // people strolling along the crest, an engineer at the control house
  const crest = (z: number): Vector3 => new Vector3(DAM.crestX - 3, DAM.crestY, z);
  add(
    people(
      [
        {
          path: [crest(DAM.z1 - 8), crest(SPILLWAY.z1 + 4)],
          hat: 'white',
          color: 'coral',
          speed: 1,
          scale: 1.6,
        },
        { path: [crest(SPILLWAY.z1 + 10), crest(DAM.z1 - 20)], color: 'teal', speed: 0.8, scale: 1.6 },
        {
          at: [DAM.faceX + 5, DAM.crestY, DAM.z0 + 16],
          ry: 0.4,
          hat: 'yellow',
          color: 'orange',
          action: 'work',
          scale: 1.6,
        },
      ],
      rng,
    ),
  );
  // a fishing boat drifting on the reservoir, a boat in the bay
  const boats = add(
    traffic(
      [
        { kind: 'boat', path: circlePath(-120, RESERVOIR.npr + 0.05, 10, 26), mode: 'loop', speed: 2 },
        {
          kind: 'boat',
          path: circlePath(ISLAND.coastX + 50, ISLAND.seaLevel + 0.05, 30, 20),
          mode: 'loop',
          speed: 2.6,
        },
      ],
      rng,
    ),
  );
  void POWERHOUSE;
  return {
    island: isl,
    y,
    reservoir,
    dam,
    powerhouse,
    fishLadder,
    town,
    alive,
    lit: [boats, town, dam, powerhouse],
  };
}
