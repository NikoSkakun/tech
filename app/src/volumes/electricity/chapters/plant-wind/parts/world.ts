/**
 * The land: one elongated floating island with a west hill for the hero turbine, a flat field for the farm,
 * a gravel yard for the substation and a beach with a strip of sea in the east — plus everything that keeps
 * it alive (trees and grass that lean with the wind, clouds, gulls, a technician, a boat). All from `@/kit`.
 */
import { Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { col } from '@/style';
import {
  GROUND,
  birds,
  circlePath,
  clouds,
  forest,
  groundCover,
  island,
  people,
  traffic,
  type Island,
  type KitModel,
} from '@/kit';
import { FARM, HERO, ISLAND, LINE_TOWERS, SEA, SUBSTATION } from '../layout';

export interface World {
  island: Island;
  /** Ground height at (x, z). */
  y(x: number, z: number): number;
  /** Models with per-frame animation (sway, drift, flapping, walking). */
  alive: KitModel[];
  /** Everything that has lamps / lit windows. */
  lit: KitModel[];
}

/** The farm field: a deeper green than the meadow, so the white turbines and their wakes stand out. */
const FIELD = col('green').lerp(col('teal'), 0.55).lerp(col('green.dark'), 0.25);

/** Outline multiplier of an ellipse with semi-axes (semiX, semiZ), relative to `semiZ`, with a soft wobble. */
function outline(theta: number): number {
  const a = ISLAND.semiX;
  const b = ISLAND.semiZ;
  const r = (a * b) / Math.hypot(b * Math.cos(theta), a * Math.sin(theta));
  return (r / b) * (1 + 0.035 * Math.sin(3 * theta + 0.6) + 0.025 * Math.sin(7 * theta + 2.1));
}

/** Keep-out discs `[x, z, r]` for trees: sight lines and build sites. */
export function keepOut(): [number, number, number][] {
  const out: [number, number, number][] = [
    [HERO.x, HERO.z, 34],
    [SUBSTATION.x, SUBSTATION.z, 38],
    ...LINE_TOWERS.map(([x, z]) => [x, z, 12] as [number, number, number]),
  ];
  // the whole farm field stays open (wheat and pasture under the turbines)
  for (let i = -3; i <= 3; i++) out.push([FARM.x + i * 52, FARM.z, 78]);
  return out;
}

export function buildWorld(ctx: ChapterContext): World {
  const rng = ctx.random.fork('world');
  // land sinks under the sea east of the coast line (logistic shore profile, metres)
  const shore = (x: number): number => 3.2 - 10.5 / (1 + Math.exp(-(x - ISLAND.coastX) / 7));
  const isl = island({
    radius: ISLAND.semiZ,
    outline,
    seed: 13,
    relief: 1.6,
    biome: 'meadow',
    underside: 'floating',
    depth: 150,
    sea: ISLAND.seaLevel,
    height: (x) => shore(x),
    features: [
      { type: 'hill', x: HERO.x, z: HERO.z, r: 58, h: HERO.hill },
      { type: 'hill', x: -40, z: 92, r: 40, h: 5 },
      { type: 'hill', x: 60, z: -112, r: 46, h: 4 },
      { type: 'pad', x: FARM.x, z: FARM.z, w: 318, d: 150, corner: 40, y: FARM.y, blend: 14, color: FIELD },
      { type: 'pad', x: SUBSTATION.x, z: SUBSTATION.z, w: 54, d: 46, corner: 6, y: SUBSTATION.y, blend: 8, color: GROUND.gravel() },
      {
        type: 'path',
        width: 3.2,
        color: GROUND.dirt(),
        path: [[HERO.x + 10, HERO.z + 6], [-104, 62], [-60, 50], [0, 56], [60, 60], [SUBSTATION.x - 30, SUBSTATION.z]],
      },
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
  add(forest({ count: ctx.quality.count(64, 36), ground: isl, rng, avoid, clump: 0.62, kinds: ['round', 'oak', 'poplar', 'birch', 'bush', 'conifer'] }));
  add(groundCover({ kind: 'grass', ground: isl, rng, count: ctx.quality.count(260, 120) }));
  add(groundCover({ kind: 'flowers', ground: isl, rng, count: ctx.quality.count(160, 60) }));
  add(groundCover({ kind: 'rocks', ground: isl, rng, count: 40, avoid }));
  add(clouds({ rng, count: ctx.quality.count(9, 5), radius: [260, 520], heights: [[110, 170], [-90, -40]], size: [2.2, 4.6], speed: 2.4 }));
  // gulls over the coast and around the hero rotor (kept above the blade tips)
  add(birds({ rng, count: 7, centre: [ISLAND.coastX + 18, 0, 20], radius: [26, 60], height: [16, 34], size: 1.5, color: 'white' }));
  add(birds({ rng, count: 5, centre: [HERO.x + 30, y(HERO.x, HERO.z), HERO.z - 30], radius: [44, 70], height: [70, 92], size: 1.5, color: 'white' }));
  // a technician by the tower door, a colleague walking up the service road
  const door = new Vector3(HERO.x + 1.8, y(HERO.x, HERO.z), HERO.z + 4.4);
  add(
    people(
      [
        { at: [door.x, door.y, door.z], ry: 2.6, hat: 'yellow', color: 'orange', action: 'work' },
        { path: [new Vector3(HERO.x + 12, y(HERO.x + 12, HERO.z + 7), HERO.z + 7), new Vector3(-104, y(-104, 62), 62)], hat: 'white', color: 'teal', speed: 1.1 },
      ],
      rng,
    ),
  );
  const boats = add(traffic([{ kind: 'boat', path: circlePath(ISLAND.coastX + 30, ISLAND.seaLevel + 0.05, 10, 16), mode: 'loop', speed: 2.2 }], rng));
  void SEA;
  return { island: isl, y, alive, lit: [boats] };
}
