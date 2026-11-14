/**
 * The land: one elongated floating island with concrete pads for the main building and the gas path, a coal-dark
 * yard inside the railway loop, a gravel switchyard, and the city on its own islet in the east. Plus what keeps
 * it alive: the coal train on its loop, a few trees at the rim, clouds, birds over the ash pond, workers.
 */
import { Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import {
  GROUND,
  birds,
  clouds,
  forest,
  groundCover,
  island,
  people,
  rails,
  train,
  type Island,
  type KitModel,
  type Train,
} from '@/kit';
import { ASH_POND, BOILER, CCS, GAS, HALL, ISLAND, RAIL, SWITCHYARD, TOWERS, YARD } from '../layout';
import { noShadow } from './shadows';

export interface World {
  island: Island;
  y(x: number, z: number): number;
  train: Train;
  /** Centre line of the rail loop (rail head). */
  railPath: Vector3[];
  /** Models with per-frame animation (sway, drift, flapping, walking, the train). */
  alive: KitModel[];
  /** Everything that has lamps / lit windows (driven by the time of day). */
  lit: KitModel[];
}

/** Outline multiplier of an ellipse with semi-axes (semiX, semiZ), relative to `semiZ`, with a soft wobble. */
function outline(theta: number): number {
  const a = ISLAND.semiX;
  const b = ISLAND.semiZ;
  const r = (a * b) / Math.hypot(b * Math.cos(theta), a * Math.sin(theta));
  return (r / b) * (1 + 0.03 * Math.sin(3 * theta + 0.9) + 0.02 * Math.sin(7 * theta + 2.4));
}

/** Rounded-rectangle loop of the railway, counter-clockwise seen from above. */
export function railRoute(): [number, number][] {
  const { x0, x1, z0, z1 } = RAIL;
  return [
    [x0, z1],
    [x1, z1],
    [x1, z0],
    [x0, z0],
  ];
}

export function buildWorld(ctx: ChapterContext): World {
  const rng = ctx.random.fork('world');
  const g = ISLAND.ground;
  const isl = island({
    radius: ISLAND.semiZ,
    outline,
    seed: 21,
    relief: 1.2,
    biome: 'meadow',
    underside: 'floating',
    depth: 170,
    features: [
      // main building + gas path: one concrete apron
      { type: 'pad', x: (BOILER.x + GAS.stack.x) / 2 - 6, z: (BOILER.z + HALL.z) / 2 + 2, w: 230, d: 110, corner: 10, y: g, blend: 10, color: GROUND.concrete() },
      // coal yard inside the rail loop
      { type: 'pad', x: YARD.x, z: YARD.z, w: 132, d: 110, corner: 14, y: g, blend: 10, color: GROUND.dirt() },
      { type: 'pad', x: (RAIL.x0 + RAIL.x1) / 2, z: (RAIL.z0 + RAIL.z1) / 2, w: RAIL.x1 - RAIL.x0 + 22, d: RAIL.z1 - RAIL.z0 + 22, corner: 30, y: g, blend: 12 },
      { type: 'pad', x: SWITCHYARD.x, z: SWITCHYARD.z, w: 60, d: 44, corner: 6, y: g, blend: 8, color: GROUND.gravel() },
      ...TOWERS.map(([x, z]) => ({ type: 'pad' as const, x, z, r: 40, y: g, blend: 10, color: GROUND.concrete() })),
      { type: 'pad', x: ASH_POND.x, z: ASH_POND.z, r: ASH_POND.r + 8, y: g - 0.6, blend: 10, color: GROUND.dirt() },
      { type: 'pad', x: CCS.x, z: CCS.z, w: 50, d: 36, corner: 6, y: g, blend: 8, color: GROUND.concrete() },
      { type: 'path', width: 6, color: GROUND.asphalt(), path: [[-90, 130], [-40, 92], [60, 80], [SWITCHYARD.x - 34, SWITCHYARD.z - 10]] },
    ],
  });
  const y = (x: number, z: number): number => isl.heightAt(x, z);
  const alive: KitModel[] = [];
  const add = <T extends KitModel>(m: T): T => {
    isl.group.add(m.group);
    alive.push(m);
    return m;
  };

  const track = rails({ route: railRoute(), closed: true, ground: isl, bend: RAIL.corner, step: 2.6 });
  isl.group.add(track.group);
  const railPath = track.paths['centre'] ?? [];
  // locomotive + 12 gondolas (document): one slow lap ≈ 70 s, the dumper drum turns on its own cycle
  const coalTrain = add(train({ path: railPath, wagons: 12, kind: 'coal', speed: 8, color: 'amber', mode: 'loop' }));

  const avoid: [number, number, number][] = [
    [0, 10, 150],
    [YARD.x, YARD.z, 110],
    [SWITCHYARD.x, SWITCHYARD.z, 50],
    [ASH_POND.x, ASH_POND.z, 60],
    [CCS.x, CCS.z, 40],
    ...TOWERS.map(([x, z]) => [x, z, 52] as [number, number, number]),
  ];
  add(forest({ count: ctx.quality.count(54, 30), ground: isl, rng, avoid, clump: 0.7, kinds: ['round', 'poplar', 'birch', 'bush', 'conifer'] }));
  add(groundCover({ kind: 'grass', ground: isl, rng, count: ctx.quality.count(110, 50), avoid }));
  add(clouds({ rng, count: ctx.quality.count(9, 5), radius: [330, 620], heights: [[150, 220], [-120, -60]], size: [2.6, 5], speed: 1.6 }));
  add(birds({ rng, count: 9, centre: [ASH_POND.x, y(ASH_POND.x, ASH_POND.z), ASH_POND.z], radius: [20, 46], height: [14, 30], size: 1.3, color: 'white' }));
  const gate = new Vector3(-40, y(-40, 92), 92);
  add(
    people(
      [
        { at: [HALL.x - 30, g, HALL.z + 17], ry: 0.4, hat: 'yellow', color: 'orange', action: 'work' },
        { at: [HALL.x - 26, g, HALL.z + 18], ry: 3.6, hat: 'white', color: 'blue', action: 'idle' },
        { path: [gate, new Vector3(30, g, 60), new Vector3(60, g, 80)], hat: 'yellow', color: 'teal', speed: 1.2 },
        { at: [GAS.esp.x, g, GAS.z + 22], ry: 2.2, hat: 'yellow', color: 'coral', action: 'work' },
      ],
      rng,
    ),
  );
  noShadow(...alive.filter((m) => /people|birds|grass|clouds/.test(m.group.name)).map((m) => m.group));
  return { island: isl, y, train: coalTrain, railPath, alive, lit: [] };
}
