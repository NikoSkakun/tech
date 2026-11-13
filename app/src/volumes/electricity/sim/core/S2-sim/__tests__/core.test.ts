import { describe, expect, it } from 'vitest';
import { solveDcPowerFlow } from '../dcPowerFlow';
import { bisect, FixedStepper, interp1, seededRandom, solveLinear } from '../math';
import { clearMarket } from '../meritOrder';
import { DEFAULT_QUASI_STEADY, solveQuasiSteady } from '../quasiSteadyFrequency';
import { shortLineReceivingKV, solveRadialFeeder, threePhaseCurrentA } from '../voltageDrop';

describe('math', () => {
  it('solveLinear, bisect, interp1 hold ends, FixedStepper carries the remainder, seeded RNG repeats', () => {
    expect(solveLinear([[2, 1], [1, 3]], [3, 5]).map((x) => +x.toFixed(9))).toEqual([0.8, 1.4]);
    expect(() => solveLinear([[1, 1], [1, 1]], [1, 2])).toThrow();
    expect(bisect((x) => x * x, 2, 0, 2)).toBeCloseTo(Math.SQRT2, 9);
    expect(interp1([0, 1], [5, 7], -1)).toBe(5);
    expect(interp1([0, 1], [5, 7], 0.5)).toBe(6);
    const s = new FixedStepper(0.005);
    let n = 0;
    for (let i = 0; i < 60; i++) n += s.advance(1 / 60);
    expect(n).toBe(200);
    const a = seededRandom(3);
    const b = seededRandom(3);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('merit order and DC power flow invariants', () => {
  it('clearing: price null when demand exceeds the stack, ties keep the input order', () => {
    const r = clearMarket(
      [
        { id: 'a', volumeMW: 100, priceEurPerMWh: 0 },
        { id: 'b', volumeMW: 100, priceEurPerMWh: 0 },
      ],
      150,
    );
    expect(r.marginalId).toBe('b');
    expect(r.stack.map((x) => x.acceptedMW)).toEqual([100, 50]);
    expect(clearMarket([{ id: 'a', volumeMW: 10, priceEurPerMWh: 5 }], 20).priceEurPerMWh).toBeNull();
  });
  it('flows satisfy the power balance at every bus (KCL) and islands without generation go dark', () => {
    const buses = [
      { id: 'g', injectionMW: 300, pMaxMW: 500 },
      { id: 'a', injectionMW: -100 },
      { id: 'b', injectionMW: -200 },
      { id: 'c', injectionMW: -50 },
    ];
    const lines = [
      { id: 'ga', from: 'g', to: 'a', reactance: 0.1, ratingMW: 300, inService: true },
      { id: 'ab', from: 'a', to: 'b', reactance: 0.2, ratingMW: 300, inService: true },
      { id: 'gb', from: 'g', to: 'b', reactance: 0.1, ratingMW: 300, inService: true },
      { id: 'bc', from: 'b', to: 'c', reactance: 0.1, ratingMW: 300, inService: false },
    ];
    const r = solveDcPowerFlow(buses, lines);
    const net = (id: string) =>
      lines.reduce((s, l) => s + (l.from === id ? r.flowsMW[l.id]! : l.to === id ? -r.flowsMW[l.id]! : 0), 0);
    for (const b of ['g', 'a', 'b']) expect(net(b)).toBeCloseTo(r.injectionMW[b]!, 9);
    expect(r.deadBuses).toEqual(['c']);
    expect(r.unservedMW).toBe(50);
  });
});

describe('voltage drop and quasi-steady frequency', () => {
  it('short line, three-phase current and feeder losses ≥ 0', () => {
    expect(shortLineReceivingKV(330, 6, 64, 0, 0)).toBe(330);
    expect(threePhaseCurrentA(1e6, 10e3)).toBeCloseTo(57.74, 2);
    const f = solveRadialFeeder({ sourcePhaseV: 230, sectionPhaseOhm: [0.02, 0.02], nominalV: 230, loads: [{ node: 1, phase: 0, powerW: 4600 }] });
    // single-phase load: phase + neutral, 20 A through 0,04 Ω each way → 2·I²·R = 32 W
    expect(f.lossW).toBeCloseTo(32, 9);
    expect(f.loadVoltageV[0]).toBeCloseTo(230 - 20 * 0.08, 9);
  });
  it('deviation grows monotonically with the deficit and the pool absorbs the first 600 MW', () => {
    const p = { ...DEFAULT_QUASI_STEADY, loadMW: 15000, ufls: false };
    expect(solveQuasiSteady(-600, p).fHz).toBe(50);
    let prev = 50;
    for (const d of [700, 900, 1200, 1500]) {
      const f = solveQuasiSteady(-d, p).fHz;
      expect(f).toBeLessThan(prev);
      prev = f;
    }
    expect(solveQuasiSteady(1000, p).fHz).toBeGreaterThan(50);
  });
});
