/**
 * The land: one round floating island with a concrete-and-gravel site for the power unit, a cooling-water lake
 * in the north-west, woods along the rim — and the life that keeps it moving (trees in the breeze, clouds,
 * birds, a few workers on the paths). All from `@/kit`.
 */
import { Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { col } from '@/style';
import { GROUND, birds, clouds, forest, groundCover, island, people, type Island, type KitModel } from '@/kit';
import { CONTAINMENT, DRY_STORAGE, ISLAND, LINE_TOWERS, PONDS, SWITCHYARD, TOWERS, TURBINE_HALL } from '../layout';

export interface World {
  island: Island;
  /** Ground height at (x, z). */
  y(x: number, z: number): number;
  /** Models with per-frame animation (sway, drift, flapping, walking). */
  alive: KitModel[];
}

/** Keep-out discs `[x, z, r]` for trees and rocks: build sites and sight lines. */
function keepOut(): [number, number, number][] {
  return [
    [CONTAINMENT.x, CONTAINMENT.z, 60],
    [TURBINE_HALL.x, TURBINE_HALL.z, 70],
    [TURBINE_HALL.x + 40, TURBINE_HALL.z + 30, 40],
    [SWITCHYARD.x, SWITCHYARD.z, 52],
    [DRY_STORAGE.x + 20, DRY_STORAGE.z, 36],
    [-92, 32, 30],
    ...TOWERS.map(([x, , z]) => [x, z, 64] as [number, number, number]),
    ...PONDS.map(([x, , z]) => [x, z, 44] as [number, number, number]),
    ...LINE_TOWERS.map(([x, z]) => [x, z, 14] as [number, number, number]),
    [0, 200, 60], // sight line of the overview camera
  ];
}

export function buildWorld(ctx: ChapterContext): World {
  const rng = ctx.random.fork('world');
  const concrete = col('mist').lerp(col('steel'), 0.35);
  const isl = island({
    radius: ISLAND.radius,
    seed: ISLAND.seed,
    relief: 1.3,
    biome: 'meadow',
    underside: 'floating',
    depth: 170,
    features: [
      { type: 'pad', x: 20, z: -10, w: 300, d: 150, corner: 30, y: 1.6, blend: 16, color: GROUND.gravel() },
      { type: 'pad', x: CONTAINMENT.x + 40, z: 0, w: 170, d: 70, corner: 10, y: 1.7, blend: 4, color: concrete },
      { type: 'pad', x: -52, z: 104, w: 150, d: 66, corner: 18, y: 1.6, blend: 10, color: GROUND.gravel() },
      { type: 'lake', x: -168, z: -120, r: 46 },
      { type: 'hill', x: 150, z: -150, r: 70, h: 10 },
      { type: 'hill', x: -170, z: 120, r: 60, h: 7 },
      { type: 'path', width: 4, color: GROUND.dirt(), path: [[-200, 40], [-120, 70], [-60, 60], [40, 70], [120, 80], [200, 110]] },
    ],
  });
  const y = (x: number, z: number): number => isl.heightAt(x, z);
  const alive: KitModel[] = [];
  const add = <T extends KitModel>(m: T): T => {
    isl.group.add(m.group);
    alive.push(m);
    return m;
  };
  const avoid = keepOut();
  add(forest({ count: ctx.quality.count(90, 44), ground: isl, rng, avoid, clump: 0.7, kinds: ['round', 'oak', 'poplar', 'birch', 'conifer', 'pine'] }));
  add(groundCover({ kind: 'grass', ground: isl, rng, count: ctx.quality.count(240, 100), avoid }));
  add(groundCover({ kind: 'flowers', ground: isl, rng, count: ctx.quality.count(120, 50), avoid }));
  add(groundCover({ kind: 'rocks', ground: isl, rng, count: 30, avoid }));
  add(clouds({ rng, count: ctx.quality.count(9, 5), radius: [300, 560], heights: [[150, 220], [-110, -50]], size: [2.4, 4.8], speed: 2 }));
  add(birds({ rng, count: 6, centre: [-168, 0, -120], radius: [30, 60], height: [20, 40], size: 1.6, color: 'white' }));
  // shift workers on the site roads (life and scale: a person is 1.75 m beside a 56 m containment)
  const p = (x: number, z: number): Vector3 => new Vector3(x, y(x, z), z);
  add(
    people(
      [
        { path: [p(-60, 34), p(20, 34), p(20, 26)], hat: 'white', color: 'blue', speed: 1.2, loop: true },
        { path: [p(110, 30), p(150, 34)], hat: 'yellow', color: 'orange', speed: 1 },
        { at: [-100, y(-100, 30), 30], ry: 1.2, hat: 'yellow', color: 'orange', action: 'work' },
        { at: [-138, y(-138, -18), -18], ry: 2.2, hat: 'white', color: 'teal', action: 'idle' },
      ],
      rng,
    ),
  );
  return { island: isl, y, alive };
}
