/**
 * Diorama recipes of the nine plant islands (kit metres on a 60 m island, see `plant-islands.ts`). Each recipe
 * shapes the ground, builds the structures into the island's Builder and adds the moving things. Toy
 * proportions: towers and stacks are compressed so that every plant reads at thumbnail size.
 */
import { CatmullRomCurve3, Vector3 } from 'three';
import { createPlume, createSmoke, createHeatShimmer, createWaterStrip } from '@/fx';
import { GROUND, addCoolingTower, addFactoryHall, addHorizontalTank, addStack, windFleet } from '@/kit';
import type { PlantId } from '../plants-data';
import type { DioramaSpec } from './plant-islands';
import { FUTURE, GEO_BIO, OCEAN, SOLAR } from './plant-dioramas-2';

import { at, pad, yard } from './diorama-util';

const COAL: DioramaSpec = {
  island: { seed: 3, biome: 'industrial', features: [pad(0, 0, 92, 70, 2), pad(-30, 26, 30, 20, 2, GROUND.coal())] },
  build(k) {
    const { b } = k;
    b.frame({ at: at(k, 6, -8) }, () => addFactoryHall(b, { length: 30, width: 16, height: 22, roof: 'gable', accent: 'slate' }));
    b.frame({ at: at(k, -14, -14) }, () => addFactoryHall(b, { length: 14, width: 14, height: 34, roof: 'flat', accent: 'slate' }));
    b.frame({ at: at(k, -32, -22) }, () => addStack(b, { height: 74, radius: 3.2, bands: 3 }), 'stack.');
    b.frame({ at: at(k, 30, 18) }, () => addCoolingTower(b, { height: 42 }), 'ct.');
    // coal heap on the yard
    b.dome(11, 6, { at: [-30, 2, 26], slot: 'facet', c: ['ink', 'slate'], s: [1.3, 1, 0.8] });
    const smoke = k.add(createSmoke(k.ctx, { radius: 1.6, height: 26, wind: [3, 0, 1], count: 26 }), ...b.locate('stack.top').toArray());
    const plume = k.add(createPlume(k.ctx, { radius: 6, height: 30, wind: [2.5, 0, 1], count: 26 }), ...b.locate('ct.top').toArray());
    void smoke;
    void plume;
    return { port: yard(k, 34, -24), top: [0, 48, 0] };
  },
};

const GAS: DioramaSpec = {
  island: { seed: 5, biome: 'steppe', features: [pad(0, 0, 90, 60, 2)] },
  build(k) {
    const { b } = k;
    b.frame({ at: at(k, -6, -6) }, () => addFactoryHall(b, { length: 34, width: 18, height: 16, roof: 'flat', accent: 'pink' }));
    // heat-recovery boiler: a tall box between the hall and the stack
    b.box(12, 26, 14, { r: 0.6, at: [20, 2, -6], c: ['steel.dark', 'mist'], slot: 'matte' });
    b.frame({ at: at(k, 32, -6) }, () => addStack(b, { height: 46, radius: 2.4, bands: 0, color: 'mist' }), 'st.');
    for (const z of [18, 26]) b.frame({ at: at(k, -24, z), rot: [0, Math.PI / 2, 0] }, () => addHorizontalTank(b, { radius: 3, length: 14, color: 'pink.light' }));
    const shimmer = k.add(createHeatShimmer({ width: 5, height: 14 }), ...b.locate('st.top').toArray());
    void shimmer;
    return { port: yard(k, 34, 24, Math.PI), top: [0, 40, 0] };
  },
};

const NUCLEAR: DioramaSpec = {
  island: { seed: 9, biome: 'meadow', features: [pad(-6, 0, 80, 64, 2, GROUND.concrete())] },
  build(k) {
    const { b } = k;
    // reactor building: cylinder + dome, a band in the nuclear violet
    b.cyl(12, 20, { at: [-14, 2, -2], seg: 40, c: ['mist', 'white'], slot: 'matte' });
    b.cyl(12.15, 1.4, { at: [-14, 17, -2], seg: 40, c: 'violet', slot: 'gloss' });
    b.dome(12, 9, { at: [-14, 22, -2], seg: 40, c: 'white', slot: 'gloss' });
    b.frame({ at: at(k, 10, -6) }, () => addFactoryHall(b, { length: 24, width: 14, height: 16, roof: 'flat', accent: 'violet' }));
    b.frame({ at: at(k, 24, 24) }, () => addCoolingTower(b, { height: 46 }), 'ct1.');
    b.frame({ at: at(k, -26, 28) }, () => addCoolingTower(b, { height: 46 }), 'ct2.');
    for (const name of ['ct1.top', 'ct2.top']) k.add(createPlume(k.ctx, { radius: 7, height: 34, wind: [2, 0, 1.5], count: 26 }), ...b.locate(name).toArray());
    return { port: yard(k, 36, -22), top: [-14, 40, -2] };
  },
};

const HYDRO: DioramaSpec = {
  island: { seed: 12, biome: 'meadow', relief: 1.2, features: [{ type: 'hill', x: -14, z: -24, r: 40, h: 22 }, { type: 'lake', x: -16, z: -22, r: 20, depth: 4, level: 20 }, pad(16, 22, 40, 22, 2)] },
  build(k) {
    const { b } = k;
    // concrete arch dam closing the reservoir toward the valley
    const dam = new CatmullRomCurve3([new Vector3(-34, 0, -2), new Vector3(-16, 0, 3), new Vector3(2, 0, -2)]);
    for (let i = 0; i <= 8; i++) {
      const p = dam.getPoint(i / 8);
      b.box(5, 22, 6, { at: [p.x, k.y(p.x, p.z) - 2, p.z], r: 0.4, c: ['steel', 'mist'], slot: 'matte' });
    }
    b.box(18, 8, 10, { at: [-16, 2, 16], r: 0.5, c: ['blue.dark', 'sky.light'] });
    const spill = new CatmullRomCurve3([new Vector3(-16, 21, 2), new Vector3(-16, 12, 7), new Vector3(-16, 3, 12), new Vector3(-12, 2.5, 40)]);
    k.add(createWaterStrip(spill, { width: 5, speed: 9, whiteWater: 0.5 }));
    return { port: yard(k, 26, 22), top: [-16, 34, -10] };
  },
};

const WIND: DioramaSpec = {
  island: { seed: 15, biome: 'meadow', features: [pad(30, 26, 22, 18, 2)] },
  build(k) {
    const sites: [number, number][] = [[-22, -18], [12, -24], [-30, 18], [2, 6]];
    const fleet = windFleet(sites.map(([x, z], i) => ({ at: [x, k.y(x, z), z], yaw: 0.5, speed: 1.4 + 0.12 * i, phase: i * 0.7 })), { hubHeight: 34, rotorDiameter: 36 });
    k.add(fleet.group);
    k.alive.push(fleet);
    return { port: yard(k, 30, 26), top: [-8, 60, -6] };
  },
};

export const DIORAMAS: Readonly<Record<PlantId, DioramaSpec>> = {
  coal: COAL,
  gas: GAS,
  nuclear: NUCLEAR,
  hydro: HYDRO,
  wind: WIND,
  solar: SOLAR,
  geoBio: GEO_BIO,
  ocean: OCEAN,
  future: FUTURE,
};
