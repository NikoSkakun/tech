/** Diorama recipes, second half: solar, geothermal + biomass, ocean (tidal barrage), the future (see `plant-dioramas.ts`). */
import { CatmullRomCurve3, Vector3 } from 'three';
import { createHalo, createHotSteam, createSmoke, createSteam, createWaterStrip } from '@/fx';
import { GROUND, addBessContainer, addFactoryHall, addPvTable, addSilo, addSphericalTank, addStack } from '@/kit';
import { at, pad, yard } from './diorama-util';
import type { DioramaSpec } from './plant-islands';

export const SOLAR: DioramaSpec = {
  island: { seed: 18, biome: 'steppe', features: [pad(0, 0, 96, 76, 2, GROUND.dirt())] },
  build(k) {
    const { b } = k;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 2; c++) {
        b.frame({ at: at(k, -22 + c * 30, -26 + r * 15) }, () => addPvTable(b, { cols: 5, rows: 2, tilt: 0.55 }));
      }
    }
    // a solar tower with its heliostat ring hint (concentrated solar shares the steam island)
    b.cyl(2.2, 38, { at: [30, 2, -20], seg: 24, c: ['steel', 'mist'], slot: 'matte' });
    b.cyl(4, 6, { at: [30, 40, -20], seg: 24, c: ['amber.dark', 'amber'], slot: 'gloss' });
    k.add(createHalo({ color: 'amber', size: 16, intensity: 1.3 }), 30, 43, -20);
    return { port: yard(k, 34, 24), top: [0, 34, 0] };
  },
};

export const GEO_BIO: DioramaSpec = {
  island: { seed: 21, biome: 'rock', relief: 2.2, features: [pad(4, 4, 80, 60, 2)] },
  build(k) {
    const { b } = k;
    b.frame({ at: at(k, -6, -10) }, () => addFactoryHall(b, { length: 24, width: 14, height: 14, roof: 'gable', accent: 'orange' }));
    // geothermal wellheads with silencers, steam escaping
    for (const [x, z] of [[-30, 14], [-14, 24]] as const) {
      b.cyl(1.4, 4, { at: [x, 2, z], seg: 16, c: 'orange', slot: 'gloss' });
      b.cyl(3, 9, { at: [x + 5, 2, z], seg: 20, c: ['steel', 'mist'], slot: 'matte' });
      k.add(createSteam(k.ctx, { radius: 2.2, height: 18, wind: [2, 0, 1], count: 18 }), x + 5, 11, z);
    }
    // biomass: silos and a small stack
    for (const x of [16, 26]) b.frame({ at: at(k, x, 18) }, () => addSilo(b, { radius: 4, height: 16, color: 'green.light' }));
    b.frame({ at: at(k, 24, -14) }, () => addStack(b, { height: 36, radius: 1.8, bands: 2 }), 'st.');
    k.add(createSmoke(k.ctx, { radius: 1, height: 16, wind: [2, 0, 1], count: 16 }), ...b.locate('st.top').toArray());
    return { port: yard(k, 36, 2, -Math.PI / 2), top: [0, 32, 0] };
  },
};

export const OCEAN: DioramaSpec = {
  island: { seed: 25, biome: 'meadow', sea: 0, height: (x) => 4 - 9 / (1 + Math.exp(-(x - 4) / 5)), features: [pad(-30, 0, 30, 40, 4)] },
  build(k) {
    const { b } = k;
    // tidal barrage: a low wall across the bay with sluice turbines
    for (let i = 0; i < 7; i++) b.box(6, 7, 8, { at: [14 + i * 6, -2, 6 - i * 1.5], r: 0.4, c: ['steel', 'mist'], slot: 'matte' });
    b.box(42, 1, 4, { at: [32, 5, 1.5], r: 0.3, c: 'cyan.dark', slot: 'gloss', rot: [0, 0.25, 0] });
    for (let i = 0; i < 3; i++) {
      const x = 20 + i * 12;
      const c = new CatmullRomCurve3([new Vector3(x, 0.4, 10 - i * 3), new Vector3(x + 1, 0.3, 22 - i * 3), new Vector3(x + 2, 0.2, 34 - i * 3)]);
      k.add(createWaterStrip(c, { width: 4, speed: 5, whiteWater: 0.7 }));
    }
    b.frame({ at: at(k, -30, -6) }, () => addFactoryHall(b, { length: 16, width: 10, height: 9, roof: 'gable', accent: 'cyan' }));
    return { port: yard(k, -30, 14), top: [26, 20, 2] };
  },
};

export const FUTURE: DioramaSpec = {
  island: { seed: 29, biome: 'meadow', features: [pad(0, 0, 90, 70, 2, GROUND.concrete())] },
  build(k) {
    const { b } = k;
    for (let i = 0; i < 4; i++) b.frame({ at: at(k, -30 + i * 9, 22), rot: [0, Math.PI / 2, 0] }, () => addBessContainer(b, { length: 12, color: 'lime.light' }));
    b.frame({ at: at(k, 26, 22) }, () => addSphericalTank(b, { radius: 7, color: 'white' }));
    // tokamak: a torus vessel on a plinth with a plasma ring glowing inside
    b.cyl(16, 3, { at: [-4, 2, -16], seg: 40, c: ['steel', 'mist'], slot: 'matte' });
    b.ring(11, 4.2, { at: [-4, 9, -16], axis: 'y', seg: 48, tubeSeg: 20, c: ['steel', 'mist'], slot: 'metal' });
    b.ring(11, 1.2, { at: [-4, 13.4, -16], axis: 'y', seg: 48, tubeSeg: 10, c: 'lime', slot: 'glow' });
    k.add(createHotSteam(k.ctx, { radius: 0.8, height: 6, count: 8 }), 26, 16, 22);
    k.add(createHalo({ color: 'magenta', size: 26, intensity: 1.1 }), -4, 13, -16);
    return { port: yard(k, 34, -14), top: [-4, 30, -16] };
  },
};
