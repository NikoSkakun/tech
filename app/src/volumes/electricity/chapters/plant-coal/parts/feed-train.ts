/**
 * Step 7 hero: the water's way back to the boiler, unrolled in one line in front of the turbine hall (document:
 * «розгорнутий у лінію для читабельності»): condenser in cutaway (kit) → condensate pump → four low-pressure
 * heaters → the deaerator on its high stand (O₂ bubbles escape) → the feed pump with its own little drive turbine →
 * three high-pressure heaters → the riser to the economizer. Thin `white` extraction lines bring steam from the
 * turbine to every heater; the water in the line is coloured by temperature (≈ 30 → 150 → 180 → 290 °C).
 */
import { Group, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createFlow, createParticles, boxEmitter, type Flow } from '@/fx';
import { Builder, addPipe, heatExchanger, pump, type KitModel } from '@/kit';
import type { ColorToken } from '@/style';
import { BOILER, ISLAND, RIGS } from '../layout';
import type { MainBuilding } from './main-building';

export interface FeedTrain {
  group: Group;
  condenser: KitModel;
  /** Extraction lines from the turbine (hidden with regeneration off). */
  extraction: Group;
  /** Water flows per segment; recoloured when regeneration is off. */
  water: Flow[];
  /** World anchors. */
  points: Record<'condenser' | 'lp' | 'deaerator' | 'pump' | 'hp' | 'riser' | 'o2' | 'vacuum' | 'treatment', Vector3>;
  /** Water colours: by temperature with regeneration, all cold `blue` without it. */
  setRegen(on: boolean): void;
}

const g = ISLAND.ground;
const X0 = RIGS.feed.x;
const Z = RIGS.feed.z;
/** Positions along the line (x offset from the start). */
export const FEED_X = { condenser: 0, pump: 17, lp: [29, 41, 53, 65], deaerator: 84, feedPump: 103, hp: [117, 129, 141], riser: 154 } as const;

function heater(b: Builder, x: number, r: number, len: number, y: number, c: [ColorToken, ColorToken]): void {
  b.capsule(r, len, { axis: 'x', seg: 24, slot: 'gloss', c, at: [x - len / 2, y, 0] });
  for (const s of [-1, 1]) b.box(1, y - r + 0.4, r * 1.2, { r: 0.1, slot: 'matte', c: 'slate', at: [x + s * len * 0.3, 0, 0] });
}

export function buildFeedTrain(ctx: ChapterContext, main: MainBuilding): FeedTrain {
  const group = new Group();
  group.position.set(X0, g, Z);
  const condenser = heatExchanger({ kind: 'condenser', length: 14, radius: 4, cut: 1.9, cold: 'blue', hot: 'mist' });
  condenser.group.position.set(FEED_X.condenser, 0, 0);
  group.add(condenser.group);
  const b = new Builder('feed-train');
  b.box(FEED_X.riser + 14, 0.6, 16, { r: 0.3, slot: 'matte', c: ['slate', 'steel'], at: [FEED_X.riser / 2, -0.3, 0] });
  for (const x of FEED_X.lp) heater(b, x, 2.6, 9, 4, ['sky.dark', 'sky']);
  // deaerator: big tank on a high stand, storage vessel under it
  b.capsule(4, 14, { axis: 'x', seg: 28, slot: 'gloss', c: ['steel', 'mist'], at: [FEED_X.deaerator - 7, 16, 0] });
  b.cyl(2.2, 4, { seg: 20, slot: 'gloss', c: ['steel', 'mist'], at: [FEED_X.deaerator + 3, 18, 0] });
  for (const dx of [-6, 6]) for (const dz of [-3, 3]) b.box(0.8, 12, 0.8, { r: 0.1, slot: 'metal', c: 'slate', at: [FEED_X.deaerator + dx, 0, dz] });
  for (const x of FEED_X.hp) heater(b, x, 3, 9, 4.4, ['amber.dark', 'amber']);
  // feed pump drive turbine (coupled to the kit pump)
  b.cyl(1.8, 5, { seg: 24, axis: 'x', slot: 'gloss', c: ['coral.dark', 'coral'], at: [FEED_X.feedPump + 4, 2.4, 0] });
  const water = (pts: number[][]): Vector3[] => pts.map(([x, y]) => new Vector3(x!, y!, 0));
  const mainLine = water([[FEED_X.condenser + 6, 1], [FEED_X.pump, 1], [FEED_X.lp[0]! - 6, 4], [FEED_X.lp[3]! + 6, 4], [FEED_X.deaerator - 9, 16], [FEED_X.deaerator + 6, 12], [FEED_X.feedPump - 3, 2], [FEED_X.hp[0]! - 6, 4.4], [FEED_X.hp[2]! + 6, 4.4], [FEED_X.riser, 4.4], [FEED_X.riser, 18]]);
  addPipe(b, mainLine.map((p) => [p.x, p.y - 0.2, p.z - 3.6] as const), { radius: 0.7, color: 'steel.light', bend: 2 });
  const feed = b.build();
  group.add(feed.group);
  const pumpA = pump({ size: 1.6 });
  pumpA.group.position.set(FEED_X.pump, 0, 0);
  const pumpB = pump({ size: 2 });
  pumpB.group.position.set(FEED_X.feedPump, 0, 0);
  group.add(pumpA.group, pumpB.group);
  // riser to the economizer: up, north over the turbine hall, into the boiler house
  const riser = new Builder('riser');
  const toBoiler = [new Vector3(X0 + FEED_X.riser, g + 18, Z - 3.6), new Vector3(X0 + FEED_X.riser, g + 40, Z - 3.6), new Vector3(X0 + FEED_X.riser, g + 40, BOILER.z + BOILER.d / 2 + 4), new Vector3(BOILER.x + BOILER.w / 2 - 2, g + 30, BOILER.z + BOILER.d / 2 + 4)];
  addPipe(riser, toBoiler.map((p) => [p.x - X0, p.y - g, p.z - Z] as const), { radius: 0.8, color: 'amber', bend: 3, supportEvery: 0 });
  group.add(riser.build().group);
  // water flows: four temperature segments along the line (in the pipe in front of the machines)
  const shift = (pts: Vector3[]): Vector3[] => pts.map((p) => new Vector3(p.x, p.y + 0.4, -3.6));
  const seg = (a: number, z: number, color: ColorToken): Flow => createFlow(ctx, { kind: 'blob', color, paths: shift(mainLine.slice(a, z + 1)), count: ctx.quality.count(10 * (z - a) + 8, 6), radius: 0.55, speed: 6, spread: 0.3, halo: false });
  const flows = [seg(0, 2, 'blue'), seg(2, 4, 'sky'), seg(4, 6, 'amber.light'), seg(6, 10, 'amber')];
  group.add(...flows);
  // extraction lines: arcs from the turbine sections to the heaters
  const extraction = new Group();
  const ext = new Builder('extraction');
  const t = main.turbo;
  const axis = t.anchorWorld('coupling');
  const from = [t.anchorWorld('lp2'), t.anchorWorld('lp2'), t.anchorWorld('lp1'), t.anchorWorld('lp1'), t.anchorWorld('ip1'), t.anchorWorld('ip1'), t.anchorWorld('hp1'), t.anchorWorld('hp1')];
  const to = [...FEED_X.lp, FEED_X.deaerator, ...FEED_X.hp].map((x, i) => new Vector3(X0 + x, g + (i === 4 ? 20 : 7), Z));
  to.forEach((p, i) => {
    const a = from[i]!.clone().setY(axis.y + 3).add(new Vector3(i % 2 ? 1.5 : -1.5, 0, 0));
    const mid = a.clone().lerp(p, 0.5).setY(Math.max(a.y, p.y) + 12);
    ext.tube([a, mid, p].map((v) => v.clone().sub(group.position)), 0.28, { slot: 'gloss', c: 'white' });
  });
  extraction.add(ext.build().group);
  group.add(extraction);
  // dissolved oxygen leaves the deaerator vent
  const o2 = createParticles(ctx, { count: ctx.quality.count(26, 10), emitter: boxEmitter([2, 0.5, 2]), sprite: 'bubble', color: 'sky', life: [1.6, 2.4], speed: [2, 3], size: 0.7, gravity: [0, 1, 0], fadeOut: 0.4 });
  o2.position.set(FEED_X.deaerator + 3, 22.5, 0);
  group.add(o2);
  const w = (x: number, y: number, z = 0): Vector3 => new Vector3(X0 + x, g + y, Z + z);
  return {
    group,
    condenser,
    extraction,
    water: flows,
    points: {
      condenser: w(FEED_X.condenser, 9),
      lp: w(FEED_X.lp[1]! + 6, 7),
      deaerator: w(FEED_X.deaerator, 20),
      pump: w(FEED_X.feedPump + 4, 4),
      hp: w(FEED_X.hp[1]!, 8),
      riser: w(FEED_X.riser, 26),
      o2: w(FEED_X.deaerator + 3, 27),
      vacuum: w(FEED_X.condenser - 5, 4, 4),
      treatment: w(FEED_X.pump + 2, 2, 6),
    },
    setRegen(on) {
      const colors: ColorToken[] = on ? ['blue', 'sky', 'amber.light', 'amber'] : ['blue', 'blue', 'blue', 'blue'];
      flows.forEach((f, i) => f.setColor(colors[i]!));
    },
  };
}
