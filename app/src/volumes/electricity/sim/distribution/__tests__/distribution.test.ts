import { describe, expect, it } from 'vitest';
import { solveKtp } from '../ktp';
import { LV_PRESETS, solveLvLine } from '../lvLine';
import { createNeutralWatch, solveNeutralBreak } from '../neutral';
import { buildingCurrents, crestV, faultSelectivity, thd } from '../powerQuality';
import { runRecloser } from '../recloser';
import { meterFlashHz, solveEntrance } from '../serviceEntrance';
import { solveStreet } from '../streetDay';
import { applyFault, canRestore, customersWithoutPower, localize, normalState, restore } from '../topology';

const r1 = (xs: number[]) => xs.map((x) => Math.round(x * 10) / 10);

describe('Р1 topology', () => {
  it('ring, fault TP2–TP3: 750 → 450 after localisation → 0 after closing the NOP', () => {
    let s = applyFault(normalState('ring'), '2-3');
    expect(customersWithoutPower(s)).toBe(750);
    s = localize(s);
    expect(customersWithoutPower(s)).toBe(450);
    s = restore(s);
    expect(customersWithoutPower(s)).toBe(0);
  });
  it('radial: 450 until repair, restore unavailable; mesh: 0; ring head section: 750 → 750 → 0', () => {
    const r = localize(applyFault(normalState('radial'), '2-3'));
    expect(customersWithoutPower(r)).toBe(450);
    expect(canRestore(r)).toBe(false);
    expect(customersWithoutPower(applyFault(normalState('mesh'), '2-3'))).toBe(0);
    let s = applyFault(normalState('ring'), 'S-1');
    expect(customersWithoutPower(s)).toBe(750);
    s = localize(s);
    expect(customersWithoutPower(s)).toBe(750);
    expect(customersWithoutPower(restore(s))).toBe(0);
  });
});

describe('Р2 recloser', () => {
  it('temporary: back after the first reclose at ≈ 1,05 s; permanent: lockout at ≈ 21,2 s, 40 dark', () => {
    const t = runRecloser('temporary', true);
    expect(t.endTimeS).toBeCloseTo(1.05, 9);
    expect(t.housesDarkAtEnd).toBe(0);
    const p = runRecloser('permanent', true);
    expect(p.endTimeS).toBeCloseTo(21.2, 9);
    expect(p.events.filter((e) => e.kind === 'trip').length).toBe(4);
    expect(p.housesDarkAtEnd).toBe(40);
    expect(runRecloser('permanent', false).housesDarkAtEnd).toBe(100);
  });
});

describe('Р3 0,4 kV line (70 mm², 235 V)', () => {
  const run = (k: keyof typeof LV_PRESETS) => solveLvLine({ sourceV: 235, crossSectionMm2: 70, houses: LV_PRESETS[k] });
  it.each([
    ['symmetric', [234.4, 233.7, 232.8, 234.0, 232.8, 231.5]],
    ['morning', [234.8, 234.6, 234.3, 234.7, 234.3, 233.8]],
    ['evening', [234.0, 232.8, 231.4, 233.3, 231.4, 229.2]],
    ['allOnL1', [231.5, 228.6, 226.3, 224.6, 223.4, 222.9]],
    ['uneven', [232.3, 230.5, 229.7, 235.1, 235.9, 234.8]],
  ] as const)('%s', (k, v) => expect(r1(run(k).voltagesV)).toEqual(v));
  it('currents: symmetric 26,1 A per phase, I_N = 0; all on L1 I_N = 78,3; uneven I_L1 65,2, I_N 58,8', () => {
    expect(r1(run('symmetric').headPhaseA)).toEqual([26.1, 26.1, 26.1]);
    expect(run('symmetric').headNeutralA).toBeLessThan(1e-9);
    expect(run('allOnL1').headNeutralA).toBeCloseTo(78.3, 1);
    expect(run('uneven').headPhaseA[0]).toBeCloseTo(65.2, 1);
    expect(run('uneven').headNeutralA).toBeCloseTo(58.8, 1);
  });
});

describe('Р4 broken neutral', () => {
  it.each([
    [[1000, 1000, 1000], [230, 230, 230]],
    [[3000, 300, 1000], [109.2, 334.0, 292.8]],
    [[2000, 100, 100], [31.4, 371.5, 371.5]],
  ] as const)('%j → %j V', (p, v) => expect(r1(solveNeutralBreak(p).loadV)).toEqual(v));
  it('|U_N′| = 129,8 V; two loads in series across 398,4 V → 19,0 / 379,4 V', () => {
    expect(solveNeutralBreak([3000, 300, 1000]).neutralShiftV).toBeCloseTo(129.8, 1);
    expect(r1(solveNeutralBreak([2000, 100, 0]).loadV.slice(0, 2))).toEqual([19.0, 379.4]);
  });
  it('relay saves the house in 0,2 s; without it the appliance burns after 0,5 s above 280 V', () => {
    const w = createNeutralWatch(true);
    for (let i = 0; i < 15; i++) w.step(1 / 60, [31.4, 371.5, 371.5]);
    expect(w.houses.map((h) => h.relayTripped)).toEqual([true, true, true]);
    expect(w.houses.some((h) => h.burnt)).toBe(false);
    const n = createNeutralWatch(false);
    for (let i = 0; i < 40; i++) n.step(1 / 60, [31.4, 371.5, 371.5]);
    expect(n.houses.map((h) => h.burnt)).toEqual([false, true, true]);
  });
});

describe('Р5 selectivity, Р6 harmonics', () => {
  it('kettle 250 A: C16 0,01 s; entrance 1200 A: C40; street 5000 A: fuse 0,082 s', () => {
    expect(faultSelectivity('kettle').find((r) => r.trips)!.id).toBe('C16');
    expect(faultSelectivity('serviceEntrance').find((r) => r.trips)!.id).toBe('C40');
    expect(faultSelectivity('streetNearTp')[0]!.timeS).toBeCloseTo(0.082, 3);
  });
  it('THD 7,81 % / 8,49 %; h₃ 10 % → crest 293 V; neutral 24 / 12 / 4,8 A, phase 12,8 / 10,8 / 10,1 A', () => {
    expect(thd({ h3: 0.05, h5: 0.06, h7: 0 })).toBeCloseTo(0.0781, 4);
    expect(thd({ h3: 0.06, h5: 0.06, h7: 0 })).toBeCloseTo(0.0849, 4);
    expect(Math.round(crestV({ h3: 0.1, h5: 0, h7: 0 }))).toBe(293);
    expect([1, 0.5, 0.2].map((k) => r1([buildingCurrents(k).neutralA, buildingCurrents(k).phaseA]))).toEqual([
      [24, 12.8],
      [12, 10.8],
      [4.8, 10.1],
    ]);
  });
});

describe('Р7 service entrance, KTP, meter', () => {
  it('1 phase: kettle + water heater + cooktop 43,5 A trips; + washer + aircon set 30,0 A ok', () => {
    const a = solveEntrance('single', [{ id: 'kettle' }, { id: 'waterHeater' }, { id: 'cooktop' }]);
    expect(a.maxCurrentA).toBeCloseTo(43.5, 1);
    expect(a.tripped).toBe(true);
    const b = solveEntrance('single', [{ id: 'kettle' }, { id: 'waterHeater' }, { id: 'washer' }, { id: 'aircon' }]);
    expect(b.maxCurrentA).toBeCloseTo(30.0, 1);
    expect(b.tripped).toBe(false);
  });
  it('3 phases: L1 17,4 / L2 17,4 / L3 8,7 A; + EV 11 kW → L1 33,3 A > 25 A', () => {
    const items = [{ id: 'kettle', phase: 0 }, { id: 'waterHeater', phase: 1 }, { id: 'cooktop' }] as const;
    expect(r1(solveEntrance('three', items).phaseCurrentsA)).toEqual([17.4, 17.4, 8.7]);
    const e = solveEntrance('three', [...items, { id: 'ev' }]);
    expect(e.phaseCurrentsA[0]).toBeCloseTo(33.3, 1);
    expect(e.tripped).toBe(true);
  });
  it('KTP oil 49,9 / 75,0 / 90,6 °C; incomer β·577 A; meter 1 flash/s at 3,6 kW', () => {
    expect(r1([0.6, 1, 1.2].map((b) => solveKtp(b).oilC))).toEqual([49.9, 75, 90.6]);
    expect(Math.round(solveKtp(1).incomerA)).toBe(577);
    expect(solveKtp(1.2).level).toBe('severe');
    expect(meterFlashHz(3600)).toBeCloseTo(1, 12);
  });
});

describe('Р8 street day', () => {
  it('morning; noon simple (trip of 3 and 6, 16 kW instead of 32); noon Volt-Watt', () => {
    expect(r1(solveStreet({ time: 'morning' }).voltagesV)).toEqual([235.5, 236.0, 236.3, 233.9, 233.6, 236.8]);
    const s = solveStreet({ time: 'noon' });
    expect(r1(s.voltagesBeforeTripV!)).toEqual([246.0, 250.4, 253.4, 236.2, 235.8, 257.9]);
    expect(s.invertersOff).toEqual([false, false, true, false, false, true]);
    expect(r1(s.voltagesV)).toEqual([242.9, 244.3, 244.2, 238.8, 238.8, 244.1]);
    expect(s.pvKW.reduce((a, b) => a + b, 0)).toBe(16);
    const v = solveStreet({ time: 'noon', inverters: 'voltWatt' });
    expect(r1([v.pvKW[0]!, v.pvKW[1]!, v.pvKW[2]!, v.pvKW[5]!])).toEqual([8.0, 8.0, 5.8, 3.1]);
    expect(r1(v.voltagesV)).toEqual([244.6, 247.7, 249.4, 237.4, 237.2, 251.0]);
  });
  it('evening without / with EV (L1 134 A), EV on 1,2,3,6 → 205,4 V; night smart → 224,2 V', () => {
    const none = [false, false, false, false, false, false];
    expect(r1(solveStreet({ time: 'evening', ev: none }).voltagesV)).toEqual([227.3, 225.4, 224.2, 229.6, 229.0, 222.5]);
    const e = solveStreet({ time: 'evening' });
    expect(r1(e.voltagesV)).toEqual([224.5, 219.7, 215.7, 232.2, 232.0, 209.7]);
    expect(Math.round(e.headPhaseA[0]!)).toBe(134);
    expect(solveStreet({ time: 'evening', ev: [true, true, true, false, false, true] }).voltagesV[5]).toBeCloseTo(205.4, 1);
    expect(solveStreet({ time: 'night', smartCharging: true }).voltagesV[5]).toBeCloseTo(224.2, 1);
    expect(solveStreet({ time: 'evening', smartCharging: true }).evActive.some(Boolean)).toBe(false);
  });
});
