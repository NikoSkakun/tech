/**
 * `CycleRig` in its Rankine configuration (step 5; a smaller copy is the heat-recovery loop of step 6): pump →
 * boiler (flame under it, superheater and reheater coils) → turbine (a bladed cone on a shaft, driving a small
 * generator) → condenser (a drum with blue cooling tubes) → back to the pump, all joined by glass pipes in which
 * the working fluid flows: dense `blue` water, `white`+`pink` hot steam, `mist` wet steam. Vertical XY plane,
 * metres, origin = floor under the middle of the loop.
 */
import { CatmullRomCurve3, Group, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createFlame, createFlow, createSteam, type Flow } from '@/fx';
import { Builder, type KitModel } from '@/kit';

type V = [number, number, number];
const v = (p: V): Vector3 => new Vector3(...p);

/** The four legs of the loop (state 1 → 2 → 3 → 4 → 1). */
export const LEGS: Record<'pump' | 'boiler' | 'turbine' | 'condenser', V[]> = {
  pump: [[-2.5, 1.3, 0], [-6, 1.3, 0]],
  boiler: [[-6, 1.3, 0], [-11, 1.3, 0], [-12, 4, 0], [-12, 10, 0], [-9, 13.2, 0], [-2, 12.6, 0], [1.6, 10, 0]],
  turbine: [[1.6, 10, 0], [8, 10, 0]],
  condenser: [[8, 10, 0], [10.6, 8.6, 0], [10.6, 5.6, 0], [10.6, 2.2, 0], [7, 1.3, 0], [-2.5, 1.3, 0]],
};
export type Leg = keyof typeof LEGS;
export const LEG_ORDER: readonly Leg[] = ['pump', 'boiler', 'turbine', 'condenser'];

export interface RankineRig {
  group: Group;
  model: KitModel;
  curves: Record<Leg, CatmullRomCurve3>;
  flows: Record<Leg, Flow>;
  /** Wet-steam droplets in the last turbine stages. */
  droplets: Flow;
  /** Steam vented to the sky when the condenser is taken away. */
  vent: ReturnType<typeof createSteam>;
  /** Parts that come and go: superheater coil, reheater loop, condenser. */
  parts: Record<'superheater' | 'reheater' | 'condenser' | 'rotor', Group>;
  at: Record<Leg | 'generator', Vector3>;
}

export function createRankineRig(ctx: ChapterContext, counts = 1): RankineRig {
  const group = new Group();
  group.name = 'rankine-rig';
  const b = new Builder('rankine');
  // boiler: brick box with an open front showing the tubes, burner flame under it
  b.box(6.4, 11, 5, { r: 0.4, at: [-12, 0, -1.4], c: ['coral.dark', 'coral'], slot: 'matte' });
  b.box(6.6, 0.6, 5.2, { r: 0.2, at: [-12, 11, -1.4], c: 'slate', slot: 'matte' });
  // water-wall tubes on the open front, a steam drum on the roof, an inspection door and rivet bands
  for (let i = 0; i < 9; i++) b.cyl(0.22, 8.6, { at: [-14.6 + i * 0.65, 1.6, 1.15], seg: 10, c: ['orange.dark', 'orange'], slot: 'metal' });
  b.cyl(1.1, 6, { axis: 'x', at: [-15, 12.6, -1.4], seg: 28, c: ['steel', 'mist'], slot: 'metal' });
  b.box(1.4, 2, 0.3, { r: 0.15, at: [-9.6, 0.6, 1.15], c: 'ink', slot: 'gloss' });
  for (const y of [3.4, 7.4]) b.box(6.5, 0.25, 5.1, { r: 0.1, at: [-12, y, -1.4], c: 'coral.light', slot: 'gloss' });
  // pump: small steel volute + motor
  b.cyl(1.1, 1.4, { axis: 'z', at: [-4.2, 1.3, -0.7], seg: 28, c: 'steel', slot: 'metal' });
  b.box(1.6, 1.2, 1.2, { r: 0.2, at: [-4.2, 0, -2], c: 'teal', slot: 'gloss' });
  // turbine casing (open front half) and generator
  b.box(3.2, 3.2, 3.2, { r: 0.5, at: [11.6, 8.4, 0], c: ['teal.dark', 'teal'], slot: 'gloss' });
  b.cyl(0.25, 2.2, { axis: 'x', at: [9, 10, 0], seg: 16, c: 'steel', slot: 'metal' });
  b.box(13, 0.5, 6, { r: 0.2, at: [0, 0, -0.5], c: ['slate', 'steel'], slot: 'matte' });
  for (const leg of LEG_ORDER) b.tube(LEGS[leg].map(v), 0.6, { c: 'sky', slot: 'glass' });
  const rotor = b.part('rotor', { at: [1.6, 10, 0] });
  rotor.cone(1, 6.4, { axis: 'x', tip: 2.6, seg: 32, c: ['steel', 'mist'], slot: 'metal' });
  for (let i = 0; i < 5; i++) for (let k = 0; k < 8; k++) rotor.box(0.15, 0.9 + i * 0.35, 0.5, { at: [0.8 + i * 1.2, 0, 0], rot: [(k / 8) * Math.PI * 2, 0, 0.4], c: 'mist', slot: 'metal' });
  const sh = b.part('superheater', { at: [-12, 9, 1.2] });
  for (let i = 0; i < 4; i++) sh.ring(1.6, 0.18, { axis: 'y', at: [0, i * 0.5, 0], seg: 24, tubeSeg: 8, c: 'pink', slot: 'glow' });
  const rh = b.part('reheater', { at: [0, 0, 0] });
  rh.tube([v([4.6, 11.4, 0]), v([4.6, 14.6, 0]), v([-9, 15.4, 0]), v([-12, 12.4, 1.2])], 0.3, { c: 'pink', slot: 'glass' });
  for (let i = 0; i < 3; i++) rh.ring(1.3, 0.16, { axis: 'y', at: [-12, 6 + i * 0.45, 1.2], seg: 24, tubeSeg: 8, c: 'pink', slot: 'glow' });
  const cond = b.part('condenser', { at: [10.6, 4.2, 0] });
  cond.cyl(2.2, 6, { axis: 'z', at: [0, 0, -3], seg: 32, c: ['steel', 'mist'], slot: 'metal' });
  for (let i = 0; i < 9; i++) cond.cyl(0.14, 6.4, { axis: 'z', at: [-1.3 + (i % 3) * 1.3, -1.2 + Math.floor(i / 3) * 1.2, -3.2], seg: 8, c: 'blue', slot: 'gloss' });
  const model = b.build();
  group.add(model.group);
  const flame = createFlame({ height: 3, width: 3.6, power: 0.9 });
  flame.position.set(-12, 0.6, 1.4);
  group.add(flame);
  const curves = Object.fromEntries(LEG_ORDER.map((l) => [l, new CatmullRomCurve3(LEGS[l].map(v))])) as Record<Leg, CatmullRomCurve3>;
  const flow = (leg: Leg, color: 'blue' | 'white' | 'mist', n: number): Flow =>
    createFlow(ctx, { kind: 'blob', color, paths: [{ path: curves[leg] }], count: Math.round(n * counts), radius: color === 'blue' ? 0.22 : 0.3, speed: color === 'blue' ? 1.6 : 4, spread: 0.18 });
  const flows: Record<Leg, Flow> = { pump: flow('pump', 'blue', 14), boiler: flow('boiler', 'white', 70), turbine: flow('turbine', 'white', 24), condenser: flow('condenser', 'mist', 60) };
  for (const f of Object.values(flows)) group.add(f);
  const droplets = createFlow(ctx, { kind: 'blob', color: 'blue', paths: [{ path: new CatmullRomCurve3([v([5.5, 10, 0]), v([8, 10, 0])]) }], count: Math.round(14 * counts), radius: 0.16, speed: 5, spread: 1 });
  group.add(droplets);
  const vent = createSteam(ctx, { radius: 1, height: 9, count: 30 });
  vent.position.set(10.6, 8.6, 0);
  vent.setEmitting(false, true);
  group.add(vent);
  return {
    group,
    model,
    curves,
    flows,
    droplets,
    vent,
    parts: { superheater: model.part('superheater'), reheater: model.part('reheater'), condenser: model.part('condenser'), rotor: model.part('rotor') },
    at: { pump: v([-4.2, 3.4, 0]), boiler: v([-12, 12.2, 1]), turbine: v([4.6, 12.4, 0]), condenser: v([10.6, 6.8, 1]), generator: v([11.6, 12.2, 0]) },
  };
}
