/**
 * Props of step 9: the CO₂ «cloud» over the main stack (translucent `steel` sphere, its disc area ∝ g/kWh) and
 * the coal «ghost» beside it (`slate`, fixed 820 g/kWh); the gas's way from a well (with a flare) along a thin
 * line to the gas station, with leak points that puff `violet` methane; the hydrogen mixer — a `violet` methane
 * bottle, a `white` hydrogen bottle, the mixer and a test burner whose flame turns from blue to pale with H₂.
 */
import { CatmullRomCurve3, Group, Mesh, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createFlame, createFlow, createGasFlame, type Flame, type Flow } from '@/fx';
import { Builder, G, addPipe, addVerticalTank, type KitModel } from '@/kit';
import { K } from '@/style';
import { GAS, H2, ISLAND, STACK, WELL } from '../layout';

/** Sphere radius for a value in g/kWh: disc area ∝ value (r = k·√g). */
export const cloudRadius = (g: number): number => 1.5 * Math.sqrt(Math.max(0, g));

export interface Emissions {
  group: Group;
  cloud: Mesh;
  ghost: Mesh;
  cloudAt: Vector3;
  ghostAt: Vector3;
  leaks: Flow;
  leakPoints: Vector3[];
  flareAt: Vector3;
  mixer: KitModel;
  burnerAt: Vector3;
  gasFlame: Flame;
  h2Flame: Flame;
  setCloud(g: number): void;
  setLeak(share: number): void;
  setHydrogen(x: number): void;
}

export function buildEmissions(ctx: ChapterContext): Emissions {
  const group = new Group();
  group.name = 'emissions';
  const y0 = ISLAND.y;
  const cloudAt = new Vector3(STACK.x + 8, y0 + STACK.height + 36, STACK.z);
  const ghostAt = new Vector3(STACK.x - 90, y0 + STACK.height + 34, STACK.z - 30);
  const cloud = new Mesh(G.sphere(1, 40), K.glass({ color: 'steel', opacity: 0.55 }));
  cloud.position.copy(cloudAt);
  const ghost = new Mesh(G.sphere(1, 40), K.glass({ color: 'slate', opacity: 0.3 }));
  ghost.position.copy(ghostAt);
  ghost.scale.setScalar(cloudRadius(820));
  group.add(cloud, ghost);
  // the well, its flare stack and the thin line to the gas station
  const wb = new Builder('gas-well');
  wb.box(8, 0.4, 8, { r: 0.2, slot: 'matte', c: 'slate', at: [WELL.x, y0, WELL.z] });
  wb.cyl(0.5, 3, { seg: 14, slot: 'metal', c: 'steel', at: [WELL.x, y0 + 0.4, WELL.z] });
  for (const dy of [1.2, 2.2]) wb.cyl(0.8, 0.3, { seg: 14, slot: 'gloss', c: 'violet', at: [WELL.x, y0 + 0.4 + dy, WELL.z] });
  wb.cyl(0.35, 14, { seg: 12, slot: 'metal', c: 'steel', at: [WELL.x + 12, y0, WELL.z - 6] });
  const route = [new Vector3(WELL.x, y0 + 1, WELL.z), new Vector3(WELL.x - 26, y0 + 1, WELL.z - 16), new Vector3(GAS.station.x - 20, y0 + 1, GAS.station.z + 22), new Vector3(GAS.station.x - 38, y0 + 1, GAS.station.z + 2)];
  addPipe(wb, route.map((p) => [p.x, p.y, p.z] as [number, number, number]), { radius: 0.25, color: 'violet', supportEvery: 0 });
  const well = wb.build();
  group.add(well.group);
  const flareAt = new Vector3(WELL.x + 12, y0 + 14, WELL.z - 6);
  const flare = createFlame({ height: 5, width: 1.6, power: 0.8 });
  flare.position.copy(flareAt);
  group.add(flare);
  // leak points along the way: methane puffs rising (`violet`)
  const curve = new CatmullRomCurve3(route);
  const leakPoints = [0.15, 0.45, 0.75].map((t) => curve.getPoint(t));
  const leaks = createFlow(ctx, { kind: 'blob', color: 'violet', paths: leakPoints.map((p) => ({ path: [p.clone(), p.clone().add(new Vector3(1.5, 9, 0.5)), p.clone().add(new Vector3(3, 18, 1))] })), count: 90, radius: 0.5, speed: 3, spread: 0.6 });
  group.add(leaks);
  // hydrogen mixer: two bottles → mixer → test burner
  const mb = new Builder('h2-mixer');
  mb.box(18, 0.4, 10, { r: 0.2, slot: 'matte', c: ['steel', 'mist'], at: [H2.x, y0, H2.z] });
  mb.frame({ at: [H2.x - 5, y0 + 0.4, H2.z - 1] }, () => addVerticalTank(mb, { radius: 1.4, height: 6, color: 'violet', band: 'white' }), 'ch4.');
  mb.frame({ at: [H2.x + 1, y0 + 0.4, H2.z - 1] }, () => addVerticalTank(mb, { radius: 1.4, height: 6, color: 'white', band: 'mist' }), 'h2.');
  mb.box(2.2, 2.2, 2.2, { r: 0.3, slot: 'gloss', c: ['teal.dark', 'teal'], at: [H2.x + 6, y0 + 0.4, H2.z + 2] });
  mb.cyl(0.5, 1.6, { seg: 14, slot: 'metal', c: 'slate', at: [H2.x + 6, y0 + 2.6, H2.z + 2] });
  const mixer = mb.build();
  group.add(mixer.group);
  const burnerAt = new Vector3(H2.x + 6, y0 + 4.2, H2.z + 2);
  const gasFlame = createGasFlame({ height: 3, width: 0.9 });
  const h2Flame = createFlame({ height: 3.2, width: 0.8, colors: ['mist', 'white', 'sky'] });
  for (const f of [gasFlame, h2Flame]) {
    f.position.copy(burnerAt);
    group.add(f);
  }
  return {
    group,
    cloud,
    ghost,
    cloudAt,
    ghostAt,
    leaks,
    leakPoints,
    flareAt,
    mixer,
    burnerAt,
    gasFlame,
    h2Flame,
    setCloud(g) {
      cloud.scale.setScalar(cloudRadius(g));
    },
    setLeak(share) {
      leaks.density = Math.min(1, share / 0.05);
    },
    setHydrogen(x) {
      gasFlame.power = 1 - x;
      h2Flame.power = x;
    },
  };
}
