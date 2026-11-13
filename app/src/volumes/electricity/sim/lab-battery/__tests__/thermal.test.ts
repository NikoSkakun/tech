import { describe, expect, it } from 'vitest';
import { nailScenarioC, runModule, runOvercharge, runOven } from '../thermal-scenarios';

describe('lab-battery §M7 oven (model seconds from T₀ = 25 °C, ±1 s)', () => {
  const rows = [
    { chem: 'NMC', oven: 150, sei: 220, sep: 529, vent: 666, run: null, on: null },
    { chem: 'NMC', oven: 160, sei: 196, sep: 440, vent: 533, run: 804, on: 166 },
    { chem: 'NMC', oven: 200, sei: 139, sep: 272, vent: 313, run: 410, on: 165 },
    { chem: 'LFP', oven: 200, sei: 139, sep: 274, vent: 504, run: null, on: null },
    { chem: 'LFP', oven: 230, sei: 114, sep: 214, vent: 368, run: null, on: null },
    { chem: 'LFP', oven: 260, sei: 97, sep: 177, vent: 293, run: 638, on: 240 },
  ] as const;
  for (const r of rows) {
    it(`${r.chem} at ${r.oven} °C`, () => {
      const o = runOven(r.chem, r.oven);
      expect(Math.abs(o.events.sei! - r.sei)).toBeLessThanOrEqual(1);
      expect(Math.abs(o.events.separator! - r.sep)).toBeLessThanOrEqual(1);
      expect(Math.abs(o.events.vent! - r.vent)).toBeLessThanOrEqual(1);
      if (r.run === null) {
        expect(o.events.runaway).toBeUndefined();
        expect(o.finalC).toBeLessThan(r.oven + 15);
      } else {
        expect(Math.abs(o.events.runaway! - r.run)).toBeLessThanOrEqual(1);
        expect(Math.round(o.onsetC!)).toBe(r.on);
        expect(o.finalC).toBeCloseTo(r.chem === 'NMC' ? 750 : 450, 0);
      }
    });
  }
  it('room temperature: nothing happens, no NaN', () => {
    const o = runOven('NMC', 25, 600);
    expect(o.events).toEqual({});
    expect(o.finalC).toBeCloseTo(25, 9);
  });
});

describe('lab-battery §M7 overcharge without BMS (ramp 2 °C/min)', () => {
  it('NMC: SEI 2250, separator 3380, vent 3618, runaway 4297 s (≈ 166 °C, ≈ 72 min)', () => {
    const o = runOvercharge('NMC', false);
    expect(o.events.sei).toBeCloseTo(2250, -1);
    expect(Math.abs(o.events.separator! - 3380)).toBeLessThanOrEqual(1);
    expect(Math.abs(o.events.vent! - 3618)).toBeLessThanOrEqual(1);
    expect(Math.abs(o.events.runaway! - 4297)).toBeLessThanOrEqual(1);
    expect(Math.round(o.onsetC!)).toBe(166);
  });
  it('LFP: SEI 2250, separator 3418, vent 4882, runaway 6750 s (≈ 240 °C, ≈ 113 min)', () => {
    const o = runOvercharge('LFP', false);
    expect(o.events.sei).toBeCloseTo(2250, -1);
    expect(Math.abs(o.events.separator! - 3418)).toBeLessThanOrEqual(1);
    expect(Math.abs(o.events.vent! - 4882)).toBeLessThanOrEqual(1);
    expect(Math.abs(o.events.runaway! - 6750)).toBeLessThanOrEqual(1);
    expect(Math.round(o.onsetC!)).toBe(240);
  });
  it('with BMS: cut-off, no heating', () => {
    expect(runOvercharge('NMC', true).events).toEqual({});
  });
});

describe('lab-battery step 11 nail and propagation', () => {
  it('nail: NMC SOC ≥ 50 → runaway after 10 s; otherwise peak 120 / 100 °C at 30 s then cooling', () => {
    expect(nailScenarioC('NMC', 80, 9.9).runaway).toBe(false);
    expect(nailScenarioC('NMC', 80, 10).runaway).toBe(true);
    expect(nailScenarioC('NMC', 80, 60).tempC).toBeCloseTo(750, 0);
    expect(nailScenarioC('NMC', 30, 30).tempC).toBeCloseTo(120, 9);
    expect(nailScenarioC('LFP', 100, 30).tempC).toBeCloseTo(100, 9);
    expect(nailScenarioC('LFP', 100, 330).tempC).toBeCloseTo(25 + 75 / Math.E, 6);
  });
  it('NMC module: chain reaction without barrier, stops at one cell with the barrier', () => {
    const free = runModule('NMC', false);
    expect(free.runawayAtS.every((t) => t !== null)).toBe(true);
    expect(free.runawayAtS[1]!).toBeLessThan(free.runawayAtS[2]!);
    const barrier = runModule('NMC', true);
    expect(barrier.runawayAtS.slice(1)).toEqual([null, null, null]);
  });
  it('LFP module: chain reaction without barrier (cells at 193.5 / 319 / 380 s), barrier stops it', () => {
    const barrier = runModule('LFP', true);
    expect(barrier.runawayAtS.slice(1)).toEqual([null, null, null]);
    expect(runModule('LFP', false).runawayAtS).toEqual([0, 193.5, 319, 380]);
  });
});
