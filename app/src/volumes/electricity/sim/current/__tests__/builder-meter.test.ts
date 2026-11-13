import { describe, expect, it } from 'vitest';
import {
  BUILDER_PRESETS,
  builderVoltmeter,
  gridNode as n,
  internalResistanceFromMeasurements,
  kvlWalk,
  readMeter,
  repairLamps,
  resetSources,
  solveBuilder,
  type MeterSetup,
  type Part,
} from '../index';

describe('§7 constructor', () => {
  it('series: two lamps on 12 V → 0,5 A, 3 W each, full brightness', () => {
    const { solution } = solveBuilder(BUILDER_PRESETS.series);
    expect(solution.parts.get('V1')!.currentA).toBeCloseTo(0.5, 5);
    expect(solution.parts.get('L1')!.powerW).toBeCloseTo(3, 4);
    expect(solution.parts.get('L1')!.brightness).toBeCloseTo(1, 3);
    expect(solution.newlyBurnt).toEqual([]);
    expect(solution.maxKclResidualA).toBeLessThan(1e-9);
  });
  it('one lamp on 12 V → 1 A, 12 W = 4·P_nom → burns (open circuit)', () => {
    const parts: Part[] = [
      { id: 'V1', kind: 'source', a: n(0, 0), b: n(0, 3), emfV: 12 },
      { id: 'L1', kind: 'lamp', a: n(0, 0), b: n(0, 3) },
    ];
    const r = solveBuilder(parts);
    expect(r.solution.newlyBurnt).toEqual(['L1']);
    expect(r.parts.find((p) => p.id === 'L1')!.burnt).toBe(true);
    expect(r.solution.parts.get('V1')!.currentA).toBe(0);
    expect(repairLamps(r.parts).find((p) => p.id === 'L1')!.burnt).toBe(false);
  });
  it('mixed preset: 3 A, 6 V on 2 Ω, branches 1 A and 2 A; KVL loop sums to 0', () => {
    const { solution } = solveBuilder(BUILDER_PRESETS.mixed);
    expect(solution.parts.get('V1')!.currentA).toBeCloseTo(3, 4);
    expect(solution.parts.get('R1')!.voltageV).toBeCloseTo(6, 4);
    expect(solution.parts.get('R2')!.currentA).toBeCloseTo(1, 4);
    expect(solution.parts.get('R3')!.currentA).toBeCloseTo(2, 4);
    const loop = kvlWalk(solution, [n(0, 3), n(0, 0), n(2, 0), n(2, 3)]);
    expect(loop.sum).toBeCloseTo(0, 9);
  });
  it('parallel preset (6 V): 0,5 A per lamp, 1 A total; divider 8 V + 4 V', () => {
    const p = solveBuilder(BUILDER_PRESETS.parallel).solution;
    expect(p.parts.get('L1')!.currentA).toBeCloseTo(0.5, 4);
    expect(p.parts.get('V1')!.currentA).toBeCloseTo(1, 4);
    const d = solveBuilder(BUILDER_PRESETS.divider).solution;
    expect(builderVoltmeter(d, n(3, 0), n(3, 3))).toBeCloseTo(4, 4);
    expect(d.parts.get('R1')!.voltageV).toBeCloseTo(8, 4);
  });
  it('garland: burning one lamp darkens both', () => {
    const parts = BUILDER_PRESETS.garland.map((p) => (p.id === 'L2' ? { ...p, burnt: true } : p));
    const s = solveBuilder(parts).solution;
    expect(s.parts.get('L1')!.brightness).toBe(0);
  });
  it('short circuit (wire across the source) → source trips, alarm, recoverable', () => {
    const parts: Part[] = [...BUILDER_PRESETS.series, { id: 'W9', kind: 'wire', a: n(0, 0), b: n(0, 3) }];
    const r = solveBuilder(parts);
    expect(r.solution.newlyTripped).toEqual(['V1']);
    expect(r.solution.shortCircuit).toBe(true);
    expect(r.solution.parts.get('L1')!.currentA).toBe(0);
    const again = solveBuilder(resetSources(r.parts.filter((p) => p.id !== 'W9')));
    expect(again.solution.shortCircuit).toBe(false);
  });
  it('floating parts read null on a voltmeter', () => {
    const parts: Part[] = [...BUILDER_PRESETS.series, { id: 'R9', kind: 'resistor', a: n(5, 0), b: n(5, 1), resistanceOhm: 10 }];
    const s = solveBuilder(parts).solution;
    expect(builderVoltmeter(s, n(5, 0), n(0, 3))).toBeNull();
  });
});

describe('§9 multimeter', () => {
  const setup = (over: Partial<MeterSetup>): MeterSetup => ({ battery: 'new', switchClosed: true, mode: 'vdc', red: 'B+', black: 'B-', milliFuseBlown: false, ...over });
  const value = (s: MeterSetup): number => {
    const d = readMeter(s).display;
    if (d.kind !== 'value') throw new Error(`expected value, got ${d.kind}`);
    return d.value;
  };
  it('new battery: U₀ 1,58 V open, 1,52 V loaded, I 0,304 A → r = 0,2 Ω', () => {
    const u0 = value(setup({ switchClosed: false }));
    expect(u0).toBeCloseTo(1.58, 6);
    const u = value(setup({}));
    expect(u).toBeCloseTo(1.519, 3);
    const i = value(setup({ mode: 'a10', red: 'Ja', black: 'Jb' }));
    expect(i).toBeCloseTo(0.303, 3); // 10 A range adds 0,01 Ω: 1,58/5,21
    expect(readMeter(setup({})).batteryCurrentA).toBeCloseTo(0.304, 3);
    expect(internalResistanceFromMeasurements(1.58, 1.58 * 5 / 5.2, 1.58 / 5.2)).toBeCloseTo(0.2, 9);
  });
  it('half-dead 0,241 A / 1,21 V; flat 0,164 A / 0,82 V', () => {
    expect(readMeter(setup({ battery: 'half' })).batteryCurrentA).toBeCloseTo(0.241, 3);
    expect(value(setup({ battery: 'half' }))).toBeCloseTo(1.205, 3);
    expect(readMeter(setup({ battery: 'flat' })).batteryCurrentA).toBeCloseTo(0.164, 3);
    expect(value(setup({ battery: 'flat' }))).toBeCloseTo(0.821, 3);
  });
  it('mA in series (replacing the jumper): 277 mA, fuse intact', () => {
    const r = readMeter(setup({ mode: 'ma', red: 'Ja', black: 'Jb' }));
    expect(r.display).toMatchObject({ kind: 'value', unit: 'A' });
    expect(value(setup({ mode: 'ma', red: 'Ja', black: 'Jb' }))).toBeCloseTo(0.277, 3);
    expect(r.blowsFuse).toBe(false);
  });
  it('mA across any battery → FUSE (2,26 / 1,23 / 0,46 A > 0,4 A)', () => {
    for (const battery of ['new', 'half', 'flat'] as const) {
      const r = readMeter(setup({ battery, mode: 'ma', switchClosed: false }));
      expect(r.display).toEqual({ kind: 'FUSE' });
      expect(r.blowsFuse).toBe(true);
    }
    expect(readMeter(setup({ mode: 'ma', red: 'Ja', black: 'Jb', milliFuseBlown: true })).display).toEqual({ kind: 'FUSE' });
  });
  it('10 A across the new battery → 7,52 A short circuit', () => {
    const r = readMeter(setup({ mode: 'a10', switchClosed: false }));
    expect(value(setup({ mode: 'a10', switchClosed: false }))).toBeCloseTo(7.52, 2);
    expect(r.shortCircuit).toBe(true);
  });
  it('ohmmeter: lamp 5,0 Ω, open switch OL, live circuit and across-battery errors; V~ 0,00', () => {
    expect(value(setup({ mode: 'ohm', switchClosed: false, red: 'La', black: 'Lb' }))).toBeCloseTo(5, 4);
    expect(readMeter(setup({ mode: 'ohm', switchClosed: false, red: 'Sa', black: 'Sb' })).display).toEqual({ kind: 'OL' });
    expect(readMeter(setup({ mode: 'ohm', switchClosed: true, red: 'La', black: 'Lb' })).display).toEqual({ kind: 'error', reason: 'liveCircuit' });
    expect(readMeter(setup({ mode: 'ohm', switchClosed: false })).display).toEqual({ kind: 'error', reason: 'acrossSource' });
    expect(value(setup({ mode: 'vac' }))).toBe(0);
  });
});
