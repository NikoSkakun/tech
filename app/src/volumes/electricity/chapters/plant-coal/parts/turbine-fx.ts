/**
 * Step 6 effects around the kit turbo-set: steam along the shaft that grows in volume from the small HP cylinder
 * (hot `white`+`pink`) through IP (`white`) to the big LP cylinders (`mist` wet steam with `blue` droplets — their
 * share is the wetness at the last stages); the reheat loop (cold reheat out of HP → boiler → hot reheat into IP);
 * and the three phases from the generator terminals to the step-up transformer and on to the switchyard.
 */
import { Group, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createBundle, createFlow, type Bundle, type Flow } from '@/fx';
import { Builder, addPipe, type KitModel } from '@/kit';
import { BOILER, ISLAND } from '../layout';
import type { MainBuilding } from './main-building';

export interface TurbineFx {
  group: Group;
  /** The reheat pipe loop + its steam (one actor). */
  loop: Group;
  steam: Flow[];
  lp: Flow;
  lpCount: number;
  bus: Bundle;
  grid: Bundle;
  /** World anchors for callouts / hotspots. */
  points: { hp: Vector3; ip: Vector3; lp1: Vector3; lp2: Vector3; gen: Vector3; gsu: Vector3; valves: Vector3; turning: Vector3; loop: Vector3 };
  /** Share of droplets among the LP steam particles (0…1). */
  setWetness(share: number): void;
  /** Steam flow and power 0…1. */
  setLoad(load: number): void;
}

export function buildTurbineFx(ctx: ChapterContext, main: MainBuilding, gantry: Vector3): TurbineFx {
  const group = new Group();
  group.name = 'turbine-fx';
  const t = main.turbo;
  const w = (name: string): Vector3 => t.anchorWorld(name);
  const axisY = w('coupling').y;
  const onAxis = (p: Vector3): Vector3 => new Vector3(p.x, axisY, p.z);
  const hp = w('hp1');
  const ip = w('ip1');
  const lp1 = w('lp1');
  const lp2 = w('lp2');
  const z = hp.z;
  const s = main.turboScale;
  const seg = (x0: number, x1: number): Vector3[] => [new Vector3(x0, axisY, z), new Vector3(x1, axisY, z)];
  const flow = (pts: Vector3[], color: 'pink.light' | 'white' | 'mist', radius: number, spread: number, n: number, instanceColors = false): Flow =>
    createFlow(ctx, { kind: 'blob', color, paths: pts, count: ctx.quality.count(n, Math.ceil(n / 3)), radius, speed: 6, spread, halo: false, instanceColors });
  // HP and IP: single flow along the shaft; the LP pair: one stream across both (wet steam)
  const hpFlow = flow(seg(hp.x - 2.2 * s, hp.x + 2.2 * s), 'pink.light', 0.22 * s, 0.7 * s, 30);
  const ipFlow = flow(seg(ip.x - 2.2 * s, ip.x + 2.2 * s), 'white', 0.3 * s, 1.1 * s, 34);
  const lpCount = 90;
  const lp = flow(seg(lp1.x - 3 * s, lp2.x + 3 * s), 'mist', 0.42 * s, 1.9 * s, lpCount, true);
  group.add(hpFlow, ipFlow, lp);
  // reheat loop: HP exhaust → up and north to the boiler house → back down into IP
  const out = w('reheatOut');
  const back = w('reheatIn');
  const g = ISLAND.ground;
  const north = BOILER.z + BOILER.d / 2 + 2;
  const top = g + 34;
  const b = new Builder('reheat-loop');
  const coldRoute = [out, new Vector3(out.x, top, out.z), new Vector3(out.x, top, north), new Vector3(out.x, top + 8, north - 4)];
  const hotRoute = [new Vector3(back.x, top + 8, north - 4), new Vector3(back.x, top + 4, north), new Vector3(back.x, top + 4, back.z), back];
  for (const r of [coldRoute, hotRoute]) addPipe(b, r.map((p) => [p.x, p.y, p.z] as const), { radius: 0.9, color: 'pink.light', bend: 2 });
  const pipes: KitModel = b.build();
  const loop = new Group();
  loop.add(pipes.group, flow(coldRoute, 'white', 0.5, 0.4, 16), flow(hotRoute, 'pink.light', 0.5, 0.4, 16));
  group.add(loop);
  // generator terminals → step-up transformer (LV) → switchyard
  const genT = ['gen.u', 'gen.v', 'gen.w'].map(w);
  const lv = ['lv1', 'lv2', 'lv3'].map((n) => main.gsu.anchorWorld(n));
  const hv = ['hv1', 'hv2', 'hv3'].map((n) => main.gsu.anchorWorld(n));
  const yard = [-3, 0, 3].map((dz) => gantry.clone().add(new Vector3(0, 0, dz)));
  const bus = createBundle(genT, lv, { radius: 0.35, repeat: 0.25, speed: 8, sag: 0.2 });
  const grid = createBundle(hv, yard, { radius: 0.3, repeat: 0.06, speed: 18, sag: 2.5 });
  group.add(bus, grid);
  const api: TurbineFx = {
    group,
    loop,
    steam: [hpFlow, ipFlow, lp],
    lp,
    lpCount,
    bus,
    grid,
    points: { hp, ip, lp1, lp2, gen: w('gen.stator'), gsu: main.gsu.anchorWorld('tank'), valves: onAxis(w('steamIn')).add(new Vector3(-1, 3, 0)), turning: onAxis(w('coupling')).add(new Vector3(0, 1.5 * s, 0)), loop: new Vector3(out.x, top, (out.z + north) / 2) },
    setWetness(share) {
      const n = Math.round(lpCount * share);
      for (let i = 0; i < lpCount; i++) lp.setInstanceColor(i, i % Math.round(lpCount / Math.max(1, n)) === 0 && n > 0 ? 'blue' : 'mist');
      lp.commit();
    },
    setLoad(load) {
      for (const f of api.steam) f.speed = 2 + 8 * load;
      bus.setPower(load);
      grid.setPower(load);
    },
  };
  return api;
}
