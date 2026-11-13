import { describe, expect, it } from 'vitest';
import {
  balanceTimeH,
  cellMassKg,
  createBms,
  galvanicPair,
  packCostUsd,
  runtimeHours,
  usableCapacityAh,
} from '..';

describe('lab-battery §M1 galvanic pair', () => {
  it('Zn–Cu 1.10 V; Li–Cu 3.38 V; Mg–Ag 3.17 V; cathode = larger E°; Li/Na/K react with water', () => {
    const zc = galvanicPair('Zn', 'Cu');
    expect(zc.emfV).toBeCloseTo(1.1, 9);
    expect(zc.cathode).toBe('Cu');
    expect(zc.anode).toBe('Zn');
    expect(galvanicPair('Cu', 'Li').emfV).toBeCloseTo(3.38, 9);
    expect(galvanicPair('Mg', 'Ag').emfV).toBeCloseTo(3.17, 9);
    expect(galvanicPair('Li', 'Cu').reactsWithWater).toBe(true);
    expect(galvanicPair('Zn', 'Cu').reactsWithWater).toBe(false);
  });
});

describe('lab-battery §M5 BMS', () => {
  it('usable capacity: one cell +5 % SOC → 95 Ah; cell #7 = 90 Ah balanced at the top → 90 Ah', () => {
    const q = Array.from({ length: 16 }, () => 100);
    const s = Array.from({ length: 16 }, (_, i) => (i === 3 ? 55 : 50));
    expect(usableCapacityAh(q, s)).toBeCloseTo(95, 9);
    const q7 = q.map((x, i) => (i === 6 ? 90 : x));
    expect(
      usableCapacityAh(
        q7,
        Array.from({ length: 16 }, () => 100),
      ),
    ).toBeCloseTo(90, 9);
  });
  it('equalisation time: 5 % of 100 Ah → 50 h passive (0.1 A), 2.5 h active (2 A)', () => {
    expect(balanceTimeH(5, 100, 0.1)).toBeCloseTo(50, 9);
    expect(balanceTimeH(5, 100, 2)).toBeCloseTo(2.5, 9);
  });
  it('charge without CAN stops on the high cell (BMS emergency); with CAN the current tapers', () => {
    const socs = Array.from({ length: 16 }, (_, i) => (i === 3 ? 60 : 50));
    const blind = createBms({ socPct: socs, link: 'none' });
    blind.start('charge');
    for (let k = 0; k < 4 * 3600; k += 60) blind.step(60);
    expect(blind.state.stop).toBe('bms-emergency');
    expect(blind.state.stopCell).toBe(3);
    expect(blind.state.ahThisRun).toBeGreaterThan(38);
    expect(blind.state.ahThisRun).toBeLessThan(41);
    const can = createBms({ socPct: socs, link: 'can' });
    can.start('charge');
    for (let k = 0; k < 4 * 3600; k += 60) can.step(60);
    expect(can.state.stop).toBe('complete');
    expect(Math.max(...can.state.cellVoltagesV)).toBeLessThanOrEqual(3.65 + 1e-6);
  });
  it('discharge stops when the weakest cell reaches 2.5 V; usable ≈ min capacity', () => {
    const q = Array.from({ length: 16 }, (_, i) => (i === 6 ? 90 : 100));
    const b = createBms({ capacitiesAh: q, socPct: Array.from({ length: 16 }, () => 100) });
    b.start('discharge');
    for (let k = 0; k < 3 * 3600; k += 30) b.step(30);
    expect(b.state.stop).toBe('cell-empty');
    expect(b.state.stopCell).toBe(6);
    expect(b.state.ahThisRun).toBeGreaterThan(88);
    expect(b.state.ahThisRun).toBeLessThanOrEqual(90);
  });
  it('passive balancing bleeds ≈ 0.1 A only above 3.40 V; active moves 2 A', () => {
    const socs = Array.from({ length: 16 }, (_, i) => (i === 0 ? 97 : 92));
    const p = createBms({ socPct: socs, balancing: 'passive' });
    p.step(1);
    expect(p.state.balancingA[0]).toBeCloseTo(3.37 / 33, 2);
    expect(p.state.balancingA[1]).toBe(0);
    const low = createBms({
      socPct: Array.from({ length: 16 }, (_, i) => (i === 0 ? 55 : 50)),
      balancing: 'passive',
    });
    low.step(1);
    expect(low.state.balancingA[0]).toBe(0); // 3.30 V < 3.40 V threshold
    const a = createBms({
      socPct: Array.from({ length: 16 }, (_, i) => (i === 0 ? 55 : 50)),
      balancing: 'active',
    });
    a.step(3600);
    expect(a.state.socPct[0]).toBeCloseTo(53, 6);
  });
});

describe('lab-battery §M8 calculators', () => {
  it('5 kWh: 125 / 31.25 / 20 kg; usable 250 / 34.7 / 22.2 kg', () => {
    expect(cellMassKg(5, 'leadAcid')).toEqual({ raw: 125, usable: 250 });
    expect(cellMassKg(5, 'lfp').raw).toBeCloseTo(31.25, 9);
    expect(cellMassKg(5, 'lfp').usable).toBeCloseTo(34.7, 1);
    expect(cellMassKg(5, 'nmc').raw).toBeCloseTo(20, 9);
    expect(cellMassKg(5, 'nmc').usable).toBeCloseTo(22.2, 1);
  });
  it('runtime 10 kWh, 90 %, 0.3 kW → 28.5 h; price 10 kWh: 14 740 $ (2010), 1080 $ (2025), 700 $ stationary', () => {
    expect(runtimeHours(10, 90, 0.3)).toBeCloseTo(28.5, 9);
    expect(packCostUsd(10, 2010)).toBe(14740);
    expect(packCostUsd(10, 2025)).toBe(1080);
    expect(packCostUsd(10, 2025, true)).toBe(700);
    expect(packCostUsd(10, 2022)).toBeGreaterThan(packCostUsd(10, 2021));
  });
});
