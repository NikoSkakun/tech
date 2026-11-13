import { describe, expect, it } from 'vitest';
import {
  CELLS,
  buildPack,
  fecPerYearFromCycles,
  li6Compatibility,
  stateOfHealth,
  yearsToSoh,
} from '../../core/S3-sim/battery';

describe('lab-battery §M4 pack builder', () => {
  it('LFP-314 16S1P → 51.2 V, 58.4/40.0 V, 314 Ah, 16.08 kWh, 157 A, 8.04 kW, 4.0 mΩ, 112.0 kg, 143.5 Wh/kg', () => {
    const p = buildPack(CELLS['LFP-314'], 16, 1);
    expect(p.uNomV).toBeCloseTo(51.2, 9);
    expect(p.uMaxV).toBeCloseTo(58.4, 9);
    expect(p.uMinV).toBeCloseTo(40.0, 9);
    expect(p.capacityAh).toBe(314);
    expect(p.energyKwh).toBeCloseTo(16.08, 2);
    expect(p.iMaxA).toBe(157);
    expect(p.pMaxKw).toBeCloseTo(8.04, 2);
    expect(p.resistanceMOhm).toBeCloseTo(4.0, 9);
    expect(p.massKg).toBeCloseTo(112.0, 9);
    expect(p.whPerKg).toBeCloseTo(143.5, 1);
    expect(p.li6.verdict).toBe('ok');
  });
  it('LFP-100 16S2P (the shared lab battery, DECISIONS §24) → 10.24 kWh, 200 A, 6.4 mΩ, 79.2 kg', () => {
    const p = buildPack(CELLS['LFP-100'], 16, 2);
    expect(p.energyKwh).toBeCloseTo(10.24, 9);
    expect(p.iMaxA).toBe(200);
    expect(p.resistanceMOhm).toBeCloseTo(6.4, 9);
    expect(p.massKg).toBeCloseTo(79.2, 9);
    expect(p.cells).toBe(32);
  });
  it('18650 10S4P, 21700 13S4P, 18650 96S74P', () => {
    const a = buildPack(CELLS['18650-NMC'], 10, 4);
    expect(a.uNomV).toBe(36);
    expect(a.capacityAh).toBe(12);
    expect(a.energyKwh).toBeCloseTo(0.43, 2);
    expect(a.iMaxA).toBe(60);
    expect(a.pMaxKw).toBeCloseTo(2.16, 9);
    expect(a.resistanceMOhm).toBeCloseTo(75, 9);
    expect(a.massKg).toBeCloseTo(2.35, 2);
    const b = buildPack(CELLS['21700-NMC'], 13, 4);
    expect(b.uNomV).toBeCloseTo(46.8, 9);
    expect(b.capacityAh).toBe(20);
    expect(b.energyKwh).toBeCloseTo(0.94, 2);
    expect(b.resistanceMOhm).toBeCloseTo(65, 9);
    const c = buildPack(CELLS['18650-NMC'], 96, 74);
    expect(c.uNomV).toBeCloseTo(345.6, 9);
    expect(c.capacityAh).toBe(222);
    expect(c.energyKwh).toBeCloseTo(76.72, 2);
    expect(c.cells).toBe(7104);
  });
  it('ЛІ-6 three-state compatibility', () => {
    expect(buildPack(CELLS['LFP-100'], 16, 1).li6).toEqual({ verdict: 'ok' });
    const lfp15 = buildPack(CELLS['LFP-100'], 15, 1);
    expect(lfp15.uMinV).toBeCloseTo(37.5, 9);
    expect(lfp15.uMaxV).toBeCloseTo(54.75, 9);
    expect(lfp15.li6.verdict).toBe('partial');
    const nmc14 = buildPack(CELLS['21700-NMC'], 14, 1);
    expect(nmc14.uMinV).toBeCloseTo(38.5, 9);
    expect(nmc14.uMaxV).toBeCloseTo(58.8, 9);
    expect(nmc14.uNomV).toBeCloseTo(50.4, 9);
    expect(nmc14.li6.verdict).toBe('partial');
    const lfp17 = buildPack(CELLS['LFP-100'], 17, 1);
    expect(lfp17.uMaxV).toBeCloseTo(62.05, 9);
    expect(lfp17.li6).toEqual({ verdict: 'fail', reason: 'overvoltage' });
    expect(buildPack(CELLS['18650-NMC'], 10, 1).li6).toEqual({ verdict: 'fail', reason: 'undervoltage' });
    expect(li6Compatibility(40, 48, 60).verdict).toBe('ok');
  });
});

describe('lab-battery §M6 toy ageing', () => {
  const base = { dodPct: 80, tempC: 25, socAvgPct: 60, fecPerYear: 300 };
  it('LFP 300 FEC/y DoD 80 25 °C SOC 60: 5 y 0.912, 10 y 0.853, 15 y 0.798', () => {
    const s = [5, 10, 15].map((y) => stateOfHealth({ chem: 'LFP', years: y, ...base }));
    expect(s.map((x) => Math.round(x * 1000) / 1000)).toEqual([0.912, 0.853, 0.798]);
  });
  it('NMC: 5 y 0.768, 10 y 0.579', () => {
    expect(stateOfHealth({ chem: 'NMC', years: 5, ...base })).toBeCloseTo(0.768, 3);
    expect(stateOfHealth({ chem: 'NMC', years: 10, ...base })).toBeCloseTo(0.579, 3);
  });
  it('LFP 10 y at 15/35/45 °C → 0.887/0.783/0.644', () => {
    const s = [15, 35, 45].map((t) => stateOfHealth({ chem: 'LFP', years: 10, ...base, tempC: t }));
    expect(s.map((x) => Math.round(x * 1000) / 1000)).toEqual([0.887, 0.783, 0.644]);
  });
  it('80 % at 292 FEC/y: LFP ≈ 15.1 y, NMC ≈ 4.3 y', () => {
    expect(yearsToSoh({ chem: 'LFP', ...base, fecPerYear: 292 })).toBeCloseTo(15.1, 1);
    expect(yearsToSoh({ chem: 'NMC', ...base, fecPerYear: 292 })).toBeCloseTo(4.3, 1);
    expect(fecPerYearFromCycles(365, 80)).toBe(292);
  });
  it('extreme sliders: NMC 730 cycles/y DoD 100 → 0.60 after ≈ 3.9 y; SOH clamped at 0', () => {
    const x = {
      chem: 'NMC' as const,
      dodPct: 100,
      tempC: 25,
      socAvgPct: 60,
      fecPerYear: fecPerYearFromCycles(730, 100),
    };
    expect(yearsToSoh(x, 0.6)).toBeCloseTo(3.9, 1);
    expect(stateOfHealth({ ...x, years: 20 })).toBe(0);
    expect(stateOfHealth({ ...x, years: 0 })).toBe(1);
  });
});
