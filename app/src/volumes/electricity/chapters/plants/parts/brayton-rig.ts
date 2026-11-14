/**
 * `CycleRig` in its Brayton configuration (step 6): the kit gas turbine with its casing lifted (bellmouth →
 * compressor → combustor ring → turbine → exhaust), a small generator on the cold end, and the flows: `sky` air
 * in, `orange` hot gas through the turbine, the exhaust leaving hot. A `yellow` pulse stream runs back along the
 * shaft from turbine to compressor (the work the compressor eats) and another to the generator. With the
 * heat-recovery boiler the exhaust passes a boiler box and leaves cool (blue-grey); a small Rankine loop grows
 * beside it. Metres, origin = floor under the machine's middle.
 */
import { CatmullRomCurve3, Group, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createFlow, createGasFlame, createHeatShimmer, type Flow } from '@/fx';
import { Builder, gasTurbine, turbogenerator, type GasTurbine, type KitModel } from '@/kit';
import { col } from '@/style';
import { createRankineRig, type RankineRig } from './rankine-rig';

export const BR_AXIS = 2.6;

export interface BraytonRig {
  group: Group;
  gt: GasTurbine;
  gen: KitModel;
  hrsg: Group;
  mini: RankineRig;
  air: Flow;
  hot: Flow;
  exhaust: Flow;
  cooled: Flow;
  toCompressor: Flow;
  toGenerator: Flow;
  shimmer: ReturnType<typeof createHeatShimmer>;
  /** The open-cycle exhaust stack (hidden while the heat-recovery boiler takes the exhaust). */
  openStack: Group;
  at: Record<'compressor' | 'combustor' | 'turbine' | 'exhaust' | 'generator', Vector3>;
  length: number;
}

const path = (pts: [number, number, number][]): { path: CatmullRomCurve3 }[] => [{ path: new CatmullRomCurve3(pts.map((p) => new Vector3(...p))) }];

export function createBraytonRig(ctx: ChapterContext): BraytonRig {
  const group = new Group();
  group.name = 'brayton-rig';
  const gt = gasTurbine({ axisHeight: BR_AXIS });
  // cutaway: the upper casing is taken away entirely (lifted, it floated over the machine and hid the board)
  gt.setOpen(0);
  gt.part('casingTop').visible = false;
  const L = gt.length;
  const x0 = -L / 2;
  gt.group.position.x = x0;
  const gen = turbogenerator({ cut: 1.6, axisHeight: BR_AXIS });
  gen.group.scale.setScalar(0.62);
  gen.group.rotation.y = Math.PI;
  gen.group.position.x = x0 - 0.6;
  group.add(gt.group, gen.group);
  const A = (name: string): Vector3 => gt.anchorLocal(name).add(new Vector3(x0, 0, 0));
  const at = { compressor: A('compressor'), combustor: A('combustor'), turbine: A('turbine'), exhaust: A('exhaust'), generator: new Vector3(x0 - 4, BR_AXIS + 2.4, 0) };
  const ax = BR_AXIS;
  const ex = at.exhaust.x;
  const air = createFlow(ctx, { kind: 'blob', color: 'sky', paths: path([[x0 - 1.5, ax + 3, 3], [x0 + 0.3, ax, 0.6], [at.combustor.x - 0.6, ax, 0.6]]), count: 60, radius: 0.18, speed: 5, spread: 0.9 });
  const hot = createFlow(ctx, { kind: 'blob', color: 'orange', paths: path([[at.combustor.x, ax, 0.6], [at.turbine.x, ax, 0.7], [ex + 0.5, ax, 0.6], [ex + 4, ax + 0.4, 0.6]]), count: 60, radius: 0.24, speed: 7, spread: 0.9 });
  // open cycle: the exhaust goes up a short stack and leaves as a calm warm haze (shimmer on top)
  const exhaust = createFlow(ctx, { kind: 'blob', color: col('orange').lerp(col('mist'), 0.45), paths: path([[ex + 3.6, ax + 0.3, 0.4], [ex + 5.4, ax + 1.2, 0], [ex + 5.6, 8.4, 0], [ex + 5.8, 12.5, 0]]), count: 26, radius: 0.24, speed: 3, spread: 0.5, halo: false });
  const cooled = createFlow(ctx, { kind: 'blob', color: col('steel').lerp(col('blue'), 0.35), paths: path([[ex + 4, ax + 0.4, 0.6], [ex + 6.5, ax + 0.8, 0.6], [ex + 8.5, ax + 3, 0.6], [ex + 9, ax + 12, 0.6]]), count: 40, radius: 0.3, speed: 4, spread: 0.8 });
  const toCompressor = createFlow(ctx, { kind: 'pulse', color: 'yellow', paths: path([[at.turbine.x, ax + 1.4, 1.8], [at.combustor.x, ax + 2, 1.8], [at.compressor.x, ax + 1.4, 1.8]]), count: 30, radius: 0.2, speed: 4, spread: 0.05 });
  const toGenerator = createFlow(ctx, { kind: 'pulse', color: 'yellow', paths: path([[at.compressor.x - 1, ax + 1.2, 1.6], [x0 - 1, ax + 1.6, 1.6], [x0 - 3.5, ax + 1.4, 1]]), count: 20, radius: 0.2, speed: 4, spread: 0.05 });
  group.add(air, hot, exhaust, cooled, toCompressor, toGenerator);
  const flames = [-0.8, 0.8].map((z) => {
    const f = createGasFlame({ height: 1.1, width: 0.5 });
    f.position.set(at.combustor.x, ax + 1.6, z);
    group.add(f);
    return f;
  });
  void flames;
  const shimmer = createHeatShimmer({ width: 2, height: 3.5 });
  shimmer.position.set(ex + 5.6, 10.4, 0);
  group.add(shimmer);
  const sb = new Builder('open-stack');
  sb.cyl(1.1, 8.6, { at: [ex + 5.6, 0, 0], seg: 24, c: ['steel.dark', 'steel'], slot: 'matte' });
  sb.ring(1.12, 0.1, { axis: 'y', at: [ex + 5.6, 7.6, 0], seg: 24, tubeSeg: 6, c: 'coral', slot: 'gloss' });
  sb.box(5.2, 2.6, 2.6, { r: 0.3, at: [ex + 2.9, ax - 1.3, 0], c: col('steel').lerp(col('orange'), 0.2), slot: 'glass' });
  const openStack = sb.build().group;
  group.add(openStack);
  // heat-recovery boiler + stack + a small Rankine loop behind it
  const hrsg = new Group();
  hrsg.name = 'hrsg';
  const b = new Builder('hrsg');
  b.box(4.2, 9, 4.4, { r: 0.4, at: [ex + 7, 0, 0], c: ['steel.dark', 'mist'], slot: 'matte' });
  b.cyl(0.9, 14, { at: [ex + 9, 0, -1], seg: 24, c: ['steel', 'white'], slot: 'matte' });
  b.box(4, 2.6, 2.6, { r: 0.3, at: [ex + 4.6, ax - 1.3, 0], c: 'steel', slot: 'matte' });
  hrsg.add(b.build().group);
  const mini = createRankineRig(ctx, 0.5, false);
  mini.group.scale.setScalar(0.4);
  mini.group.position.set(ex + 12.5, 0, -5);
  mini.vent.visible = false;
  hrsg.add(mini.group);
  group.add(hrsg);
  return { group, gt, gen, hrsg, mini, air, hot, exhaust, cooled, toCompressor, toGenerator, shimmer, openStack, at, length: L };
}
