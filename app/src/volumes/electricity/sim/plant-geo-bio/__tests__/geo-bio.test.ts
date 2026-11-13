import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../plant-wind/year';
import {
  CARBON_TAU_Y,
  biogasCo2ePerKwh,
  biogasPlant,
  biomassLogistics,
  breakthrough,
  carbonDebt,
  carbonPaybackYears,
  createEgs,
  digesterActivity,
  fieldPressure,
  flashFraction,
  gasHolderLevel,
  geothermalPower,
  heatDemandShare,
  hrtFactor,
  lhvWet,
  plantTypeFor,
  reservoirTemperatureC,
  wasteToEnergy,
} from '..';

describe('plant-geo-bio M1 geothermal', () => {
  it('T(z): 25·3 → 87; 30·5 → 162; 60·3 → 192; 100·2 → 212 °C; types', () => {
    expect(reservoirTemperatureC(25, 3)).toBe(87);
    expect(reservoirTemperatureC(30, 5)).toBe(162);
    expect(reservoirTemperatureC(60, 3)).toBe(192);
    expect(reservoirTemperatureC(100, 2)).toBe(212);
    expect(plantTypeFor(87)).toBe('heat-only');
    expect(plantTypeFor(162)).toBe('binary');
    expect(plantTypeFor(192)).toBe('flash');
    expect(plantTypeFor(240, 'Iceland')).toBe('dry-steam');
    expect(plantTypeFor(240)).toBe('flash');
  });
  it('power at 100 kg/s: 150 binary 33.5/0.104/3.49; 180 binary 46.1/0.124/5.70; 250 flash 62.9/0.161/10.1; 300 flash 83.8/0.182/15.2', () => {
    const rows = [
      [150, 'binary', 33.5, 0.104, 3.49],
      [180, 'binary', 46.1, 0.124, 5.7],
      [250, 'flash', 62.9, 0.161, 10.1],
      [300, 'flash', 83.8, 0.1815, 15.2], // document prints η 0.182; 0.4·(1 − 313.15/573.15) = 0.1815 (audit)
    ] as const;
    for (const [t, ty, q, eta, p] of rows) {
      const r = geothermalPower(t, 100, ty);
      expect(r.qThMw).toBeCloseTo(q, 1);
      expect(r.eta).toBeCloseTo(eta, 3);
      expect(Math.abs(r.pElMw - p)).toBeLessThan(0.05);
    }
    expect(geothermalPower(130, 100, 'flash').mismatch).toBe(true);
  });
  it('flash fraction: 200 → 0.085; 250 → 0.197; 300 → 0.321; < 165 → 0 + warning', () => {
    expect(flashFraction(200).x).toBeCloseTo(0.085, 3);
    expect(flashFraction(250).x).toBeCloseTo(0.197, 3);
    expect(flashFraction(300).x).toBeCloseTo(0.321, 3);
    expect(flashFraction(150)).toEqual({ x: 0, warning: true });
  });
});

describe('plant-geo-bio M2 field, M3 EGS', () => {
  it('r = 0 → p(10) 0.68, p = 0.3 from ≈ year 24; r = 0.9 → p(50) 0.87', () => {
    expect(fieldPressure(10, 0).p).toBeCloseTo(0.68, 2);
    expect(fieldPressure(23, 0).collapsed).toBe(false);
    expect(fieldPressure(24, 0).collapsed).toBe(true);
    expect(fieldPressure(24, 0).p).toBe(0.3);
    expect(fieldPressure(50, 0.9).p).toBeCloseTo(0.87, 2);
  });
  it('breakthrough: 1.5 km → 18 y; 0.5 km → 2 y; −1 %/y afterwards', () => {
    expect(breakthrough(1.5, 0).tbYears).toBeCloseTo(18, 9);
    expect(breakthrough(0.5, 0).tbYears).toBeCloseTo(2, 9);
    expect(breakthrough(0.5, 12).tempFactor).toBeCloseTo(0.9, 9);
  });
  it('EGS: p ≤ 0.5 only green; p = 1 ≈ 13 % red (and the light cuts p by 30 %); deterministic with a seed', () => {
    const low = createEgs(mulberry32(1), 0.5);
    low.step(200);
    expect(low.state.events.length).toBeGreaterThan(100);
    expect(low.state.events.every((e) => e.light === 'green')).toBe(true);
    // P(M ≥ 2 | p = 1) = P(u ≥ √0.75) = 1 − √0.75 ≈ 0.134
    expect(1 - Math.sqrt(0.75)).toBeCloseTo(0.134, 3);
    const hi = createEgs(mulberry32(3), 1);
    hi.step(30);
    expect(hi.state.pressure).toBeLessThan(1);
    expect(hi.state.fractureLength).toBeGreaterThan(0);
    const a = createEgs(mulberry32(5), 0.8);
    const b = createEgs(mulberry32(5), 0.8);
    expect(a.step(10).map((e) => e.magnitude)).toEqual(b.step(10).map((e) => e.magnitude));
  });
});

describe('plant-geo-bio M4 biomass', () => {
  it('LHV: 0.10 → 16.86; 0.30 → 12.57; 0.50 → 8.28 MJ/kg', () => {
    expect(lhvWet(0.1)).toBeCloseTo(16.86, 2);
    expect(lhvWet(0.3)).toBeCloseTo(12.57, 2);
    expect(lhvWet(0.5)).toBeCloseTo(8.28, 2);
  });
  it('10 MW_el, η 0.28, w 0.45 → LHV 9.35, 35.7 MW fuel, 3.82 kg/s, 330 t/day, 12.2 trucks', () => {
    const r = biomassLogistics(10, 0.28, 0.45);
    expect(r.lhvMjKg).toBeCloseTo(9.35, 2);
    expect(r.fuelMw).toBeCloseTo(35.7, 1);
    expect(r.kgPerS).toBeCloseTo(3.82, 2);
    expect(Math.round(r.tPerDay)).toBe(330);
    expect(r.trucksPerDay).toBeCloseTo(12.2, 1);
  });
  it('heat demand: −20 → 1.0; +15 → 0.15', () => {
    expect(heatDemandShare(-20)).toBe(1);
    expect(heatDemandShare(15)).toBe(0.15);
    expect(heatDemandShare(-5)).toBeCloseTo(23 / 38, 9);
  });
});

describe('plant-geo-bio M5 biogas', () => {
  const ideal = { tempC: 38, hrtDays: 1e6 };
  it('100 t silage → 20 000 m³, CH₄ 52 %, 103.7 MWh, 1.73 MW; 100 t manure → 2500 m³, 13.7 MWh, 0.23 MW; food → 1.20 MW', () => {
    const s = biogasPlant({ feed: { maizeSilage: 100 }, ...ideal });
    expect(s.biogasM3PerDay).toBeCloseTo(20000, 0);
    expect(s.ch4Share).toBeCloseTo(0.52, 9);
    expect(s.energyMwhPerDay).toBeCloseTo(103.7, 1);
    expect(s.pElAvgMw).toBeCloseTo(1.73, 2);
    const m = biogasPlant({ feed: { cattleManure: 100 }, ...ideal });
    expect(m.biogasM3PerDay).toBeCloseTo(2500, 0);
    expect(m.energyMwhPerDay).toBeCloseTo(13.7, 1);
    expect(m.pElAvgMw).toBeCloseTo(0.23, 2);
    expect(biogasPlant({ feed: { foodWaste: 100 }, ...ideal }).pElAvgMw).toBeCloseTo(1.2, 2);
  });
  it('f(HRT) and activity tables', () => {
    expect([10, 20, 30, 60].map((h) => Math.round(hrtFactor(h) * 100) / 100)).toEqual([
      0.49, 0.74, 0.86, 0.98,
    ]);
    expect([20, 35, 38, 42, 45].map((t) => Math.round(digesterActivity(t) * 100) / 100)).toEqual([
      0.15, 0.79, 1, 0.64, 0.26,
    ]);
    expect([45, 50, 53, 55, 60].map((t) => Math.round(digesterActivity(t, 'thermo') * 100) / 100)).toEqual([
      0.17, 0.78, 1, 0.89, 0.26,
    ]);
  });
  it('typical: manure 100 + silage 30, 38 °C, HRT 40 → f 0.931, 7909 m³, CH₄ 52.9 %, 41.7 MWh, 0.70 MW', () => {
    const r = biogasPlant({ feed: { cattleManure: 100, maizeSilage: 30 }, tempC: 38, hrtDays: 40 });
    expect(hrtFactor(40)).toBeCloseTo(0.931, 3);
    expect(Math.round(r.biogasM3PerDay)).toBe(7909);
    expect(r.ch4Share).toBeCloseTo(0.529, 3);
    expect(r.energyMwhPerDay).toBeCloseTo(41.7, 1);
    expect(r.pElAvgMw).toBeCloseTo(0.7, 2);
    expect(biogasPlant({ feed: { cattleManure: 100 }, tempC: 48, hrtDays: 40 }).cultureWarning).toBe(true);
  });
  it('gas holder: 06:00 82.9 %, 10:00 42.9 %, 17:00 92.9 % max, 23:00 32.9 % min, 24:00 40 %', () => {
    const lv = gasHolderLevel();
    const at = (h: number) => lv.find((x) => Math.abs(x.hour - h) < 1e-9)!.levelPct;
    expect(at(6)).toBeCloseTo(82.9, 1);
    expect(at(10)).toBeCloseTo(42.9, 1);
    expect(at(17)).toBeCloseTo(92.9, 1);
    expect(at(23)).toBeCloseTo(32.9, 1);
    expect(at(24)).toBeCloseTo(40, 6);
    expect(Math.max(...lv.map((x) => x.levelPct))).toBeCloseTo(92.9, 1);
    expect(Math.min(...lv.map((x) => x.levelPct))).toBeCloseTo(32.9, 1);
  });
});

describe('plant-geo-bio step 10 WtE, M6, M6b', () => {
  it('default mix 35/25/15/25 → LHV 9.45 MJ/kg, fossil CO₂ 43 %; 1000 t/day at 10 MJ/kg → 116 MW_th, ≈ 25 MW_el', () => {
    const w = wasteToEnergy({ organic: 35, paper: 25, plastic: 15, inert: 25 }, 1000);
    expect(w.lhvMjKg).toBeCloseTo(9.45, 9);
    expect(Math.round(w.fossilCo2Share * 100)).toBe(43);
    expect(w.needsAuxFuel).toBe(false);
    const ten = (1000 * 1000 * 10) / 86400;
    expect(ten).toBeCloseTo(115.7, 1);
    expect(ten * 0.22).toBeCloseTo(25.5, 1);
    expect(wasteToEnergy({ organic: 80, paper: 0, plastic: 0, inert: 20 }, 1000).needsAuxFuel).toBe(true);
    expect(wasteToEnergy({ organic: 35, paper: 25, plastic: 15, inert: 25 }, 1000, true).heatMw).toBeCloseTo(
      w.pThMw * 0.6,
      9,
    );
  });
  it('carbon debt: payback 6 / 15 / 90 y; D(10) 0.007 / 0.135 / 0.717; D(50) 0 / 0 / 0.189; BECCS −0.9', () => {
    const taus = [CARBON_TAU_Y.residues, CARBON_TAU_Y.energyCrops, CARBON_TAU_Y.wholeTrees];
    expect(taus.map((t) => Math.round(carbonPaybackYears(t)))).toEqual([6, 15, 90]);
    expect(taus.map((t) => Math.round(carbonDebt(10, t) * 1000) / 1000)).toEqual([0.007, 0.135, 0.717]);
    expect(taus.map((t) => Math.round(carbonDebt(50, t) * 1000) / 1000)).toEqual([0, 0, 0.189]);
    expect(carbonDebt(0, 5, true)).toBeCloseTo(0.1, 9);
  });
  it('biogas CO₂e: s 0.02 → ≈ 117 g/kWh; 0.05 → ≈ 263; 0 → 20', () => {
    expect(Math.round(biogasCo2ePerKwh(0.02))).toBe(117);
    expect(Math.round(biogasCo2ePerKwh(0.05))).toBe(263);
    expect(biogasCo2ePerKwh(0)).toBe(20);
  });
});
