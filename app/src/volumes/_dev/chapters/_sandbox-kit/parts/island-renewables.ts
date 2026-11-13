/** Parade island 4 — renewables & home: coast with wind turbines on land and at sea, PV farm, trackers, CSP, BESS, and the lab house. */
import { Vector3 } from 'three';
import {
  Builder,
  GROUND,
  addBessContainer,
  addElectricCar,
  addPortableGenerator,
  addWallbox,
  birds,
  circlePath,
  clouds,
  cutawayHouse,
  forest,
  groundCover,
  heliostat,
  instanced,
  island,
  kioskSubstation,
  parabolicTrough,
  people,
  pvTable,
  pvTracker,
  traffic,
  windTurbine,
} from '@/kit';
import { Parade, type ParadeBuilder } from './parade';

export const buildRenewables: ParadeBuilder = (ctx) => {
  const rng = ctx.random.fork('renewables');
  const parade = new Parade('island-renewables');
  const land = (x: number, z: number): number => 3.6 - 7.5 / (1 + Math.exp(-(x * 0.55 + z * 0.83 - 24) / 6));
  const isl = parade.add(
    island({
      radius: 66,
      seed: 55,
      relief: 0.8,
      biome: 'steppe',
      underside: 'slab',
      sea: -1.0,
      height: land,
      features: [
        { type: 'hill', x: -34, z: -30, r: 24, h: 7 },
        { type: 'pad', x: 6, z: -30, w: 44, d: 26, corner: 5, y: 3.4, blend: 5 },
        { type: 'pad', x: -30, z: 14, w: 26, d: 24, corner: 5, y: 3.4, blend: 5, color: GROUND.gravel() },
        { type: 'pad', x: 2, z: 6, r: 11, y: 3.4, blend: 5 },
      ],
    }),
  );
  const g = isl.group;
  const y = (x: number, z: number): number => isl.heightAt(x, z);
  // wind: three turbines on the hill, two offshore on monopiles (toy scale)
  const mills: [number, number, boolean][] = [[-42, -38, false], [-28, -44, false], [-46, -18, false], [38, 40, true], [52, 20, true]];
  mills.forEach(([x, z, sea], i) => {
    const t = parade.add(windTurbine({ hubHeight: sea ? 30 : 34, rotorDiameter: 40, foundation: sea ? 'offshore' : 'onshore', depth: 6, accent: sea ? 'yellow' : 'coral' }), g);
    t.group.position.set(x, sea ? -1.0 : y(x, z), z);
    t.setYaw(0.6);
    t.rotorSpeed = 1.1 + i * 0.12;
  });
  // PV farm: instanced tables in rows, plus a row of single-axis trackers
  const table = pvTable({ cols: 6, rows: 2 });
  const rows = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) rows.push({ at: [-10 + c * 8.2, 3.4, -38 + r * 7] as const, ry: Math.PI });
  g.add(instanced(table, rows));
  parade.add(table, g).group.visible = false;
  for (let i = 0; i < 2; i++) {
    const tr = parade.add(pvTracker({ modules: 8 }), g);
    tr.group.position.set(-4 + i * 7, 3.4, -15.5);
    tr.group.rotation.y = Math.PI / 2;
    tr.setAngle(0.5 - i * 0.2);
  }
  // CSP corner: heliostats aimed at one point, a parabolic trough
  for (let i = 0; i < 4; i++) {
    const h = parade.add(heliostat({ size: 0.9 }), g);
    h.group.position.set(-38 + (i % 3) * 7, 3.4, 8 + Math.floor(i / 3) * 8 + (i % 3) * 1.5);
    h.aim(new Vector3(0.35, 0.8, -0.45).normalize(), new Vector3(-20, 22, 22));
  }
  const trough = parade.add(parabolicTrough({ length: 14 }), g);
  trough.group.position.set(-22, 3.4, 20);
  trough.group.rotation.y = 0.4;
  // storage yard and the lab house with its EV and generator
  const b = new Builder('yard');
  for (let i = 0; i < 3; i++) b.frame({ at: [22 + i * 3.4, 3.4, -18], rot: [0, 0, 0] }, () => addBessContainer(b), `bess${i}.`);
  b.frame({ at: [15.5, y(15.5, 9), 9], rot: [0, Math.PI / 2, 0] }, () => addElectricCar(b, 'sky'), 'ev.');
  b.frame({ at: [8.3, y(8.3, 6) + 1.6, 9.2], rot: [0, Math.PI / 2, 0] }, () => addWallbox(b), 'wallbox.');
  b.frame({ at: [-7, y(-7, 12), 12], rot: [0, 0.4, 0] }, () => addPortableGenerator(b, { canopy: true }), 'gen.');
  parade.add(b.build(), g);
  const ktp = parade.add(kioskSubstation(), g);
  ktp.group.position.set(34, 3.5, -22);
  ktp.group.rotation.y = -Math.PI / 2;
  const house = parade.add(cutawayHouse({ boardLevers: false }), g);
  house.group.position.set(2, y(2, 6), 6);
  house.setOpen(true);
  house.battery?.setSoc(0.8);
  // life
  const avoid: [number, number, number][] = [[6, -30, 30], [-30, 14, 20], [2, 6, 13], [-38, -34, 16], [24, -18, 9]];
  parade.add(forest({ count: 40, ground: isl, rng, avoid, kinds: ['round', 'poplar', 'pine', 'bush', 'fruit'], clump: 0.4 }), g);
  for (const kind of ['grass', 'flowers', 'rocks'] as const) parade.add(groundCover({ kind, ground: isl, rng, count: 50, avoid }), g);
  parade.add(traffic([{ kind: 'boat', path: circlePath(40, -0.95, 34, 9), mode: 'loop' }], rng), g);
  parade.add(
    people(
      [
        { at: [4.5, y(4.5, 12), 12], ry: 0.3 },
        { at: [5.6, y(5.6, 12.4), 12.4], ry: -0.5, scale: 0.62 },
        { at: [6.2, y(6.2, 11.6), 11.6], scale: 0.26, color: 'orange' },
        { at: [20, 3.45, -14.5], hat: 'yellow', action: 'work', color: 'lime' },
      ],
      rng,
    ),
    g,
  );
  parade.add(clouds({ rng, count: 5 }), g);
  parade.add(birds({ rng, count: 6, centre: [30, 0, 30] }), g);
  return parade;
};
