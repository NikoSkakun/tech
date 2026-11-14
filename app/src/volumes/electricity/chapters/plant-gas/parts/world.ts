/**
 * The land: one floating island with concrete yards for the plant (centre and east), a town pad in the
 * south-east, meadows and copses around, a pond in the south-west — plus what keeps it alive (trees that
 * sway, clouds, birds, workers, a gas-company van). All from `@/kit`.
 */
import { Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { col } from '@/style';
import { GROUND, birds, clouds, forest, groundCover, island, people, traffic, type Island, type KitModel } from '@/kit';
import { ENGINES, GAS, HALL, ISLAND, PADS, PEAKER, STACK, TOWN, WELL, YARD } from '../layout';

export interface World {
  island: Island;
  /** Ground height at (x, z). */
  y(x: number, z: number): number;
  /** Models with per-frame animation (sway, drift, flapping, walking). */
  alive: KitModel[];
  /** Everything that has lamps / lit windows. */
  lit: KitModel[];
}

const CONCRETE = col('mist').lerp(col('steel'), 0.35).lerp(col('violet.light'), 0.08);

/** Outline multiplier of an ellipse with semi-axes (semiX, semiZ), relative to `semiZ`, with a soft wobble. */
function outline(theta: number): number {
  const a = ISLAND.semiX;
  const b = ISLAND.semiZ;
  const r = (a * b) / Math.hypot(b * Math.cos(theta), a * Math.sin(theta));
  return (r / b) * (1 + 0.03 * Math.sin(3 * theta + 0.9) + 0.022 * Math.sin(8 * theta + 2.4));
}

/** Keep-out rectangles → discs `[x, z, r]` for trees: every pad, the pipeline corridor, the well. */
export function keepOut(): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (const p of Object.values(PADS)) {
    const n = Math.max(1, Math.round(p.w / p.d));
    for (let i = 0; i < n; i++) out.push([p.x + ((i + 0.5) / n - 0.5) * p.w, p.z, Math.max(p.d, p.w / n) * 0.62 + 6]);
  }
  for (let x = GAS.pipeIn[0]; x < GAS.station.x; x += 18) out.push([x, GAS.pipeIn[1] + 6, 10]);
  out.push([WELL.x, WELL.z, 20], [YARD.x, YARD.z, 40]);
  return out;
}

export function buildWorld(ctx: ChapterContext): World {
  const rng = ctx.random.fork('world');
  const pad = (p: { x: number; z: number; w: number; d: number }, color = CONCRETE): { type: 'pad'; x: number; z: number; w: number; d: number; corner: number; y: number; blend: number; color: typeof CONCRETE } => ({
    type: 'pad',
    x: p.x,
    z: p.z,
    w: p.w,
    d: p.d,
    corner: 18,
    y: ISLAND.y,
    blend: 12,
    color,
  });
  const isl = island({
    radius: ISLAND.semiZ,
    outline,
    seed: 21,
    relief: 1.8,
    biome: 'meadow',
    underside: 'floating',
    depth: 160,
    features: [
      { type: 'hill', x: -150, z: -150, r: 70, h: 10 },
      { type: 'hill', x: 70, z: -160, r: 60, h: 7 },
      { type: 'hill', x: WELL.x, z: WELL.z, r: 40, h: 3 },
      { type: 'lake', x: -110, z: 128, r: 30, squash: 0.6, rot: 0.3 },
      pad(PADS.gas),
      pad(PADS.plant),
      pad(PADS.east),
      pad(PADS.town, col('slate').lerp(col('steel'), 0.55)),
      { type: 'pad', x: YARD.x, z: YARD.z, w: 64, d: 52, corner: 6, y: ISLAND.y, blend: 8, color: GROUND.gravel() },
      {
        type: 'path',
        width: 5,
        color: GROUND.dirt(),
        path: [[GAS.station.x + 10, GAS.station.z + 40], [-120, 64], [0, 70], [PEAKER.x, 70], [TOWN.x - 70, TOWN.z]],
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
  add(forest({ count: ctx.quality.count(90, 46), ground: isl, rng, avoid, clump: 0.6, kinds: ['round', 'oak', 'poplar', 'birch', 'bush', 'conifer'] }));
  add(groundCover({ kind: 'grass', ground: isl, rng, count: ctx.quality.count(240, 110), avoid }));
  add(groundCover({ kind: 'flowers', ground: isl, rng, count: ctx.quality.count(140, 60), avoid }));
  add(groundCover({ kind: 'rocks', ground: isl, rng, count: 36, avoid }));
  add(clouds({ rng, count: ctx.quality.count(9, 5), radius: [300, 560], heights: [[140, 200], [-110, -50]], size: [2.4, 5], speed: 2 }));
  add(birds({ rng, count: 7, centre: [-120, 0, 90], radius: [40, 80], height: [40, 60], size: 1.6, color: 'white' }));
  add(birds({ rng, count: 5, centre: [STACK.x - 40, 0, -40], radius: [60, 90], height: [96, 120], size: 1.6, color: 'white' }));
  // people for scale: a gas-station operator, two workers by the hall, a walker on the service road
  add(
    people(
      [
        { at: [GAS.station.x + 14, y(GAS.station.x + 14, GAS.station.z + 18), GAS.station.z + 18], ry: 2.2, hat: 'yellow', color: 'orange', action: 'work' },
        { at: [HALL.x + 10, ISLAND.y, HALL.z + 17], ry: 0.4, hat: 'white', color: 'blue' },
        { at: [HALL.x + 12, ISLAND.y, HALL.z + 16], ry: -2.4, hat: 'yellow', color: 'teal' },
        { at: [ENGINES.x - 30, ISLAND.y, ENGINES.z + 22], ry: 1.2, hat: 'white', color: 'coral', action: 'work' },
        { path: [new Vector3(-60, y(-60, 70), 70), new Vector3(60, y(60, 70), 70)], hat: 'yellow', color: 'violet', speed: 1.1 },
      ],
      rng,
    ),
  );
  const van = add(
    traffic(
      [{ kind: 'van', path: [new Vector3(-180, y(-180, 50), 50), new Vector3(-120, y(-120, 64), 64), new Vector3(0, y(0, 70), 70), new Vector3(90, y(90, 70), 70)], mode: 'pingpong', speed: 5 }],
      rng,
    ),
  );
  return { island: isl, y, alive, lit: [van] };
}
