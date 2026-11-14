/**
 * `CycleRig` in its Rankine configuration (step 5; a smaller copy is the heat-recovery loop of step 6): pump →
 * boiler (open-fronted brick furnace, the pipe snakes up through the flame, superheater and reheater coils) →
 * turbine (cut-open casing, blade rows growing as the steam expands, driving a generator) → condenser under the
 * turbine (cold river water in, warm water out) → back to the pump. Glass pipes tinted by what flows in them:
 * dense `blue` water, `white` hot steam, `mist` wet steam; numbered state points 1–4 match the T–s board.
 * Vertical XY plane, metres, origin = floor under the middle of the loop.
 */
import { CatmullRomCurve3, Group, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createFlame, createFlow, createSteam, type Flow } from '@/fx';
import { Builder, G, type KitModel } from '@/kit';
import { col } from '@/style';
import { tag } from '../world';

type V = [number, number, number];
const v = (p: V): Vector3 => new Vector3(...p);

/** The four legs of the loop (state 1 → 2 → 3 → 4 → 1). The boiler leg snakes up through the furnace. */
export const LEGS: Record<'pump' | 'boiler' | 'turbine' | 'condenser', V[]> = {
  pump: [[-1.5, 1.3, 0.4], [-6.6, 1.3, 0.4]],
  boiler: [[-6.6, 1.3, 0.4], [-9.6, 1.6, 0.4], [-10.2, 3.2, 0.4], [-13.8, 3.6, 0.4], [-14, 5.4, 0.4], [-10.2, 5.8, 0.4], [-10, 7.6, 0.4], [-13.8, 8, 0.4], [-13.6, 10, 0.4], [-12, 11.2, 0.4], [-8.2, 11.6, 0.4], [-4.6, 12.4, 0.2], [-0.6, 10, 0]],
  turbine: [[-0.6, 10, 0], [6.2, 10, 0]],
  condenser: [[6.2, 10, 0], [7.4, 8.4, 0.3], [7.4, 6.4, 0.6], [7.4, 2.4, 0.6], [4.4, 1.3, 0.5], [-1.5, 1.3, 0.4]],
};
export type Leg = keyof typeof LEGS;
export const LEG_ORDER: readonly Leg[] = ['pump', 'boiler', 'turbine', 'condenser'];
const LEG_TINT: Record<Leg, string> = { pump: 'blue', boiler: 'sky', turbine: 'pink', condenser: 'mist' };

export interface RankineRig {
  group: Group;
  model: KitModel;
  curves: Record<Leg, CatmullRomCurve3>;
  flows: Record<Leg, Flow>;
  /** Wet-steam droplets in the last turbine stages. */
  droplets: Flow;
  /** River water through the condenser tubes: cold in, warm out (the heat handed to the cold body). */
  cooling: Flow[];
  /** Steam vented to the sky when the condenser is taken away. */
  vent: ReturnType<typeof createSteam>;
  /** Parts that come and go: superheater coil, reheater loop, condenser. */
  parts: Record<'superheater' | 'reheater' | 'condenser' | 'rotor', Group>;
  at: Record<Leg | 'generator', Vector3>;
}

export function createRankineRig(ctx: ChapterContext, counts = 1, numbers = true): RankineRig {
  const group = new Group();
  group.name = 'rankine-rig';
  const b = new Builder('rankine');
  b.box(24, 0.5, 7, { r: 0.2, at: [-3.5, 0, -0.6], c: ['slate', 'steel'], slot: 'matte' });
  // boiler: an open-fronted brick furnace (back, sides, roof) so the pipe and the fire inside are seen
  b.box(7.2, 12, 0.7, { r: 0.2, at: [-11.9, 0, -2.2], c: ['coral.dark', 'red.dark'], slot: 'matte' });
  for (const x of [-15.3, -8.5]) b.box(0.7, 12, 3.6, { r: 0.2, at: [x, 0, -0.8], c: ['coral.dark', 'coral'], slot: 'matte' });
  b.box(7.8, 0.8, 4, { r: 0.25, at: [-11.9, 12, -0.8], c: 'coral', slot: 'matte' });
  b.cyl(1.0, 6.6, { axis: 'x', at: [-15.2, 13.7, -1.4], seg: 24, c: ['slate', 'steel'], slot: 'matte' });
  b.box(7.8, 0.3, 0.4, { r: 0.1, at: [-11.9, 11.6, 1.0], c: 'coral.light', slot: 'gloss' });
  // pump: volute + motor on a pedestal
  b.cyl(1.25, 1.2, { axis: 'z', at: [-4.2, 1.6, -0.2], seg: 28, c: ['steel', 'mist'], slot: 'metal' });
  b.box(2.2, 1.6, 1.6, { r: 0.3, at: [-4.2, 0.4, -1.6], c: ['teal.dark', 'teal'], slot: 'gloss' });
  // turbine: lower and back half of a conical casing (open front), blade rows on the rotor
  const shell = G.revolve([[1.5, 0], [1.7, 0.4], [2.9, 6.4], [3.1, 6.8]], { seg: 32, phiStart: 3.6, phiLength: 2.5 });
  b.add(shell.shell, { slot: 'gloss', c: ['teal.dark', 'teal'], at: [-0.6, 10, 0], rot: [0, 0, -Math.PI / 2] });
  for (const x of [0.4, 4.4]) b.box(1.2, 7.6, 1.6, { r: 0.2, at: [x, 0.5, -0.6], c: ['steel.dark', 'steel'], slot: 'matte' });
  // generator on the same shaft, beside the condenser
  b.cyl(0.22, 4.4, { axis: 'x', at: [5.8, 10, 0], seg: 12, c: 'steel', slot: 'metal' });
  b.cyl(1.7, 3.4, { axis: 'x', at: [9.9, 10, 0], seg: 32, c: ['green.dark', 'green'], slot: 'gloss', bevel: 0.2 });
  b.ring(1.72, 0.12, { axis: 'x', at: [10.5, 10, 0], seg: 32, tubeSeg: 6, c: 'yellow', slot: 'glow' });
  b.box(3, 8.4, 2.4, { r: 0.3, at: [11.6, 0.5, 0], c: ['steel.dark', 'steel'], slot: 'matte' });
  for (const leg of LEG_ORDER) b.tube(LEGS[leg].map(v), 0.55, { c: col(LEG_TINT[leg]).lerp(col('white'), 0.35), slot: 'glass' });
  const rotor = b.part('rotor', { at: [-0.6, 10, 0] });
  rotor.cyl(0.35, 6.8, { axis: 'x', seg: 14, c: 'steel', slot: 'metal' });
  for (let i = 0; i < 5; i++) {
    // a disc per stage, its blade rim growing with the steam's volume
    const r = 1.0 + i * 0.36;
    rotor.cyl(r - 0.35, 0.3, { axis: 'x', at: [0.5 + i * 1.3, 0, 0], seg: 28, c: 'steel.light', slot: 'metal' });
    for (let k = 0; k < 14; k++) rotor.box(0.12, r, 0.36, { r: 0.04, at: [0.65 + i * 1.3, 0, 0], rot: [(k / 14) * Math.PI * 2, 0, 0.35], c: i % 2 ? 'mist' : 'white', slot: 'metal' });
  }
  const sh = b.part('superheater', { at: [-11.9, 9.4, 0.4] });
  for (let i = 0; i < 4; i++) sh.ring(1.5, 0.18, { axis: 'y', at: [0, i * 0.5, 0], seg: 24, tubeSeg: 8, c: 'pink', slot: 'glow' });
  const rh = b.part('reheater', { at: [0, 0, 0] });
  rh.tube([v([2.6, 11.6, 0.2]), v([2.6, 14.6, 0.4]), v([-8, 15.4, 0.6]), v([-11.9, 12.6, 0.8])], 0.3, { c: 'pink', slot: 'glass' });
  for (let i = 0; i < 3; i++) rh.ring(1.2, 0.16, { axis: 'y', at: [-11.9, 6.6 + i * 0.45, 0.4], seg: 24, tubeSeg: 8, c: 'pink', slot: 'glow' });
  const cond = b.part('condenser', { at: [7.4, 4.4, 0] });
  cond.cyl(2.1, 5.6, { axis: 'z', at: [0, 0, -2.6], seg: 32, c: ['steel', 'mist'], slot: 'metal' });
  for (let i = 0; i < 9; i++) cond.cyl(0.14, 6.0, { axis: 'z', at: [-1.2 + (i % 3) * 1.2, -1.1 + Math.floor(i / 3) * 1.1, -2.8], seg: 8, c: 'blue', slot: 'gloss' });
  const model = b.build();
  group.add(model.group);
  const flame = createFlame({ height: 3.2, width: 4.4, power: 1 });
  flame.position.set(-11.9, 0.6, -0.4);
  group.add(flame);
  const curves = Object.fromEntries(LEG_ORDER.map((l) => [l, new CatmullRomCurve3(LEGS[l].map(v))])) as Record<Leg, CatmullRomCurve3>;
  const flow = (leg: Leg, color: 'blue' | 'white' | 'mist', n: number): Flow =>
    createFlow(ctx, { kind: 'blob', color, paths: [{ path: curves[leg] }], count: Math.round(n * counts), radius: color === 'blue' ? 0.24 : 0.3, speed: color === 'blue' ? 1.6 : 4, spread: 0.16, halo: false });
  const flows: Record<Leg, Flow> = { pump: flow('pump', 'blue', 16), boiler: flow('boiler', 'white', 90), turbine: flow('turbine', 'white', 24), condenser: flow('condenser', 'mist', 56) };
  for (const f of Object.values(flows)) group.add(f);
  const droplets = createFlow(ctx, { kind: 'blob', color: 'blue', paths: [{ path: new CatmullRomCurve3([v([3.6, 10, 0]), v([6.2, 10, 0])]) }], count: Math.round(14 * counts), radius: 0.16, speed: 5, spread: 1 });
  group.add(droplets);
  // river water through the condenser: cold blue in at the front, warm orange-tinted out at the back
  const cooling = [
    createFlow(ctx, { kind: 'blob', color: 'blue', paths: [{ path: new CatmullRomCurve3([v([-1.8, -3.8, 7]), v([-1.2, -1.1, 5]), v([-1.2, -1.1, 3.2])]) }], count: Math.round(18 * counts), radius: 0.24, speed: 2.4, spread: 0.3, halo: false }),
    createFlow(ctx, { kind: 'blob', color: col('orange').lerp(col('blue'), 0.35), paths: [{ path: new CatmullRomCurve3([v([1.2, 1.1, -2.8]), v([1.4, 1.2, -4.6]), v([2.4, -3.8, -6])]) }], count: Math.round(14 * counts), radius: 0.24, speed: 2.4, spread: 0.3, halo: false }),
  ];
  for (const f of cooling) model.part('condenser').add(f);
  const vent = createSteam(ctx, { radius: 1, height: 9, count: 30 });
  vent.position.set(7.4, 8.4, 0);
  vent.setEmitting(false, true);
  group.add(vent);
  if (numbers) {
    LEG_ORDER.forEach((leg, i) => {
      const t = tag(String(i + 1), 30, 'yellow', 'display');
      t.position.copy(v(LEGS[leg][0]!)).add(new Vector3(0, 1.3, 1.2));
      group.add(t);
    });
  }
  return {
    group,
    model,
    curves,
    flows,
    droplets,
    cooling,
    vent,
    parts: { superheater: model.part('superheater'), reheater: model.part('reheater'), condenser: model.part('condenser'), rotor: model.part('rotor') },
    at: { pump: v([-4.2, 3.2, 0.4]), boiler: v([-11.9, 12.8, 1]), turbine: v([2.6, 13, 0]), condenser: v([7.4, 4.4, 1.6]), generator: v([12.6, 11.4, 0]) },
  };
}
