import { describe, expect, it } from 'vitest';
import {
  createBarrage,
  createStorm,
  diameterForPower,
  foulingFactor,
  otec,
  pointAbsorber,
  relativeRange,
  seaLevelM,
  simulateBarrage,
  springNeapAverage,
  streamCapacityFactor,
  streamPowerW,
  theoreticalEnergyMwh,
  turbineUnit,
  wavePowerWPerM,
  wavelengthM,
} from '..';

describe('plant-ocean M1', () => {
  it('ψ 0 → 1, 90° → 0.37; sea level at t = 0 is H/2', () => {
    expect(relativeRange(0)).toBeCloseTo(1, 9);
    expect(relativeRange(90)).toBeCloseTo(0.37, 2);
    expect(seaLevelM(0, 8)).toBe(4);
    expect(seaLevelM(0, 8, true)).toBeCloseTo(5.6, 9);
  });
});

describe('plant-ocean M2 barrage (per cycle → per day / P_max / gen h per day / basin range)', () => {
  const rows = [
    ['ebb', 5, 405, 782, 112, 9.2, -0.61, 2.4],
    ['ebb', 8, 931, 1800, 240, 10.2, -0.53, 3.67],
    ['ebb', 11, 1277, 2467, 240, 11.6, 0.97, 4.97],
    ['ebb', 13.5, 1418, 2739, 240, 12.5, 2.52, 6.11],
    ['two-way', 5, 428, 827, 76, 16.0, -1.37, 1.37],
    ['two-way', 8, 881, 1702, 157, 16.9, -1.66, 1.66],
    ['two-way', 11, 1414, 2732, 240, 17.3, -1.87, 1.93],
    ['two-way', 13.5, 1698, 3282, 240, 17.5, -1.28, 2.46],
  ] as const;
  for (const [mode, H, cyc, day, pmax, hours, bmin, bmax] of rows) {
    it(`${mode} H = ${H} m`, () => {
      const r = simulateBarrage({ rangeM: H, mode });
      expect(Math.abs(r.energyPerCycleMwh - cyc)).toBeLessThanOrEqual(1);
      expect(Math.abs(r.energyPerDayMwh - day)).toBeLessThanOrEqual(1.5);
      expect(Math.abs(r.pMaxMw - pmax)).toBeLessThanOrEqual(0.6);
      expect(r.genHoursPerDay).toBeCloseTo(hours, 1);
      expect(r.basinMinM).toBeCloseTo(bmin, 2);
      expect(r.basinMaxM).toBeCloseTo(bmax, 2);
    });
  }
  it('h_start sensitivity at H = 8 (MWh/day)', () => {
    const e = (mode: 'ebb' | 'two-way', h: number) =>
      Math.round(simulateBarrage({ rangeM: 8, mode, hStartM: h }).energyPerDayMwh);
    expect([e('ebb', 2), e('ebb', 4), e('ebb', 6)]).toEqual([1655, 1800, 1699]);
    expect([e('two-way', 2), e('two-way', 2.8), e('two-way', 4)]).toEqual([1694, 1702, 1604]);
    expect(e('two-way', 4.5)).toBe(0);
  });
  it('spring–neap 29.5 d: ebb ≈ 1690 MWh/day, two-way ≈ 1750; 550–700 GWh/year', () => {
    const a = springNeapAverage({ rangeM: 8, mode: 'ebb' });
    const b = springNeapAverage({ rangeM: 8, mode: 'two-way' });
    expect(Math.abs(a.mwhPerDay - 1690)).toBeLessThan(20);
    expect(Math.abs(b.mwhPerDay - 1750)).toBeLessThan(20);
    for (const x of [a, b]) {
      expect(x.gwhPerYear).toBeGreaterThan(550);
      expect(x.gwhPerYear).toBeLessThan(700);
    }
  });
  it('theory E_p: H 8 → 1966 MWh, H 5 → 768 MWh; model takes 47 % / 53 %', () => {
    expect(Math.round(theoreticalEnergyMwh(8))).toBe(1966);
    expect(Math.round(theoreticalEnergyMwh(5))).toBe(768);
    expect(Math.round((931 / 1966) * 100)).toBe(47);
    expect(Math.round((405 / 768) * 100)).toBe(53);
  });
  it('rated head 5.38 m; manual mode: gates equalise, closed holds; dt-independent live stepping', () => {
    const b = createBarrage({ rangeM: 8, mode: 'manual' });
    b.command('closed');
    b.step(3 * 3600);
    expect(b.state.basinM).toBe(0);
    b.command('gates');
    b.step(3 * 3600);
    // 1440 m² of openings vs a 22 km² basin: the basin follows the falling sea with a lag of ≈ 1 m
    expect(b.state.basinM).toBeLessThan(0);
    expect(Math.abs(b.state.basinM - b.state.seaM)).toBeLessThan(Math.abs(b.state.seaM)); // vs a closed basin at 0
    expect(turbineUnit(5.38, 0.8).p / 1e6).toBeCloseTo(10, 1);
    expect(turbineUnit(5.0, 0.8).p).toBeLessThan(10e6);
    const a1 = createBarrage({ rangeM: 8, mode: 'ebb' });
    const a2 = createBarrage({ rangeM: 8, mode: 'ebb' });
    for (let k = 0; k < 600; k++) a1.step(1000 / 30);
    a2.step(20000);
    expect(a1.state.basinM).toBeCloseTo(a2.state.basinM, 6);
  });
});

describe('plant-ocean M3 tidal stream', () => {
  it('v 1 → 55 kW; 2 → 438; 3 → 1479; 4 → 1500 (capped)', () => {
    expect(streamPowerW(1) / 1e3).toBeCloseTo(55, 0);
    expect(streamPowerW(2) / 1e3).toBeCloseTo(438, 0);
    expect(streamPowerW(3) / 1e3).toBeCloseTo(1479, 0);
    expect(streamPowerW(4)).toBe(1.5e6);
    expect(streamPowerW(0.9)).toBe(0);
  });
  it('diameter for 1.5 MW: water 3 m/s 18.1 m, air 12 m/s 65.5 m; CF over 29.54 d = 0.381', () => {
    expect(diameterForPower(1.5e6, 3, 1025)).toBeCloseTo(18.1, 1);
    expect(diameterForPower(1.5e6, 12, 1.225)).toBeCloseTo(65.5, 1);
    const cf = streamCapacityFactor().capacityFactor;
    expect(cf).toBeCloseTo(0.381, 3);
    expect(cf).toBeGreaterThan(0.36);
    expect(cf).toBeLessThan(0.4);
  });
});

describe('plant-ocean M4–M6, step 7', () => {
  it('wave power (1;6) 2.9, (2;8) 15.7, (3;10) 44.2, (5;12) 147.2, (10;14) 686.8 kW/m; λ 56 / 100 / 156 m', () => {
    const rows = [
      [1, 6, 2.9],
      [2, 8, 15.7],
      [3, 10, 44.2],
      [5, 12, 147.2],
      [10, 14, 686.8],
    ] as const;
    for (const [h, t, p] of rows) expect(wavePowerWPerM(h, t) / 1000).toBeCloseTo(p, 1);
    expect(Math.round(wavelengthM(6))).toBe(56);
    expect(Math.round(wavelengthM(8))).toBe(100);
    expect(Math.round(wavelengthM(10))).toBe(156);
  });
  it('point absorber (T_e 8): T_n 8 → 1.000, A 2.5 (screen 2.0); 5 → 0.144; 12 → 0.187; 3 → ≈ 0.030', () => {
    const r = pointAbsorber(8, 8);
    expect(r.pNorm).toBeCloseTo(1, 9);
    expect(r.amplification).toBeCloseTo(2.5, 9);
    expect(r.screenAmplification).toBe(2);
    expect(pointAbsorber(5, 8).pNorm).toBeCloseTo(0.144, 3);
    expect(pointAbsorber(12, 8).pNorm).toBeCloseTo(0.187, 3);
    expect(pointAbsorber(3, 8).pNorm).toBeCloseTo(0.03, 2);
  });
  it('OTEC 26/4 → η_C 0.0735, η_net 0.0154; 28/4 → 0.0797 / 0.0167', () => {
    expect(otec(26, 4).etaCarnot).toBeCloseTo(0.0735, 4);
    expect(otec(26, 4).etaNet).toBeCloseTo(0.0154, 4);
    expect(otec(28, 4).etaCarnot).toBeCloseTo(0.0797, 4);
    expect(otec(28, 4).etaNet).toBeCloseTo(0.0167, 4);
    expect(otec(22, 5).uneconomic).toBe(true);
  });
  it('storm: without survival mode the mooring fails; with it the load stays below the limit; fouling −5 %/y', () => {
    const a = createStorm(false);
    a.step(10);
    expect(a.state.hsM).toBe(10);
    expect(a.state.damaged).toBe(true);
    const b = createStorm(true);
    b.step(10);
    expect(b.state.damaged).toBe(false);
    expect(b.state.capture).toBe(0);
    expect(foulingFactor(2)).toBeCloseTo(0.9, 9);
  });
});
