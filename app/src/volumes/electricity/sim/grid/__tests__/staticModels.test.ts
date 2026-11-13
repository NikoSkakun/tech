import { describe, expect, it } from 'vitest';
import { runAuction } from '../auction';
import { deficitMinute, scheduledSectors } from '../deficitEvening';
import { NIGHT_PRESET, solveLineVoltage } from '../lineVoltage';
import { DEFAULT_QUASI_STEADY, solveQuasiSteady } from '@electricity/sim/core/S2-sim/quasiSteadyFrequency';

describe('grid §В line voltage (330 kV, 200 km)', () => {
  // Q_C/2 is computed from b = 3,5 μS/km: 38,1 Mvar (the document rounds to 38) → ±0,1 kV / ±0,2 Mvar
  it.each([
    [{}, 301.0, 'low'],
    [{ capacitor: true }, 330.1, 'normal'],
    [{ ...NIGHT_PRESET }, 329.7, 'normal'],
    [{ ...NIGHT_PRESET, capacitor: true }, 358.8, 'high'],
    [{ ...NIGHT_PRESET, capacitor: true, reactor: true }, 339.4, 'normal'],
  ] as const)('%j → %s kV', (p, kv, zone) => {
    const r = solveLineVoltage(p);
    expect(Math.abs(r.receivingKV - kv)).toBeLessThanOrEqual(0.1);
    expect(r.zone).toBe(zone);
  });

  it('p.u. values 0,912 and 1,087; STATCOM holds 330 kV with ≈ 149,5 Mvar', () => {
    expect(solveLineVoltage().receivingPu).toBeCloseTo(0.912, 3);
    expect(solveLineVoltage({ ...NIGHT_PRESET, capacitor: true }).receivingPu).toBeCloseTo(1.087, 3);
    const s = solveLineVoltage({ statcom: true });
    expect(Math.abs(s.statcomMvar - 149.5)).toBeLessThan(0.2);
    expect(s.receivingKV).toBeCloseTo(330, 6);
  });

  it('trip above 1,10 p.u., collapse-risk below 0,90 p.u.', () => {
    expect(solveLineVoltage({ pMW: 0, qLoadMvar: 0, capacitor: true }).lineTripped).toBe(true);
    expect(solveLineVoltage({ pMW: 600, qLoadMvar: 300 }).zone).toBe('collapse-risk');
  });
});

describe('grid §Г auction', () => {
  it.each([
    [12000, false, 110],
    [13000, false, 130],
    [9000, false, 20],
    [12000, true, 20],
  ] as const)('D = %s MW, sunny %s → p* = %s €/MWh', (d, sunny, p) => {
    expect(runAuction({ demandMW: d, windy: false, sunny }).priceEurPerMWh).toBe(p);
  });

  it('16 GW → deficit 400 MW, no price; revenue chip p*·7000', () => {
    const r = runAuction({ demandMW: 16000, windy: false, sunny: false });
    expect(r.deficitMW).toBe(400);
    expect(r.priceEurPerMWh).toBeNull();
    expect(runAuction({ demandMW: 12000, windy: false, sunny: false }).nuclearRevenueEur).toBe(770000);
  });

  it('sunny cumulative steps 3000, 10 000, 12 000 with hydro marginal', () => {
    const r = runAuction({ demandMW: 12000, windy: false, sunny: true });
    expect(r.stack.slice(0, 3).map((s) => s.cumulativeMW)).toEqual([3000, 10000, 12000]);
    expect(r.marginalId).toBe('hydro');
  });
});

describe('grid §Б.4 quasi-steady frequency', () => {
  const q = (bal: number, extra = {}) => solveQuasiSteady(bal, { ...DEFAULT_QUASI_STEADY, loadMW: 15000, ...extra });
  it('island: r = −300 → 49,887 Hz', () => {
    const r = q(-900);
    expect(r.residualMW).toBe(-300);
    expect(r.fHz).toBeCloseTo(49.887, 3);
  });
  it('island: r = −800 → x = 2,0 → UFLS 5 % (750) → r = −50 → 49,981 Hz', () => {
    const r = q(-1400);
    expect(r.uflsShedMW).toBe(750);
    expect(r.residualMW).toBe(-50);
    expect(r.fHz).toBeCloseTo(49.981, 3);
  });
  it('connected, X_ext = 1000, r = −800 → 49,955 Hz, P_unsch = 680 MW', () => {
    const r = q(-1400, { extGainMWPerHz: 15000, extLimitDeficitMW: 1000, extLimitSurplusMW: 2100 });
    expect(r.fHz).toBeCloseTo(49.955, 3);
    expect(r.unscheduledMW).toBeCloseTo(680, 0);
  });
});

describe('grid §Е deficit evening', () => {
  const m = (d: number, s: Parameters<typeof deficitMinute>[1]) => deficitMinute(d, s, 30);
  it('1600, nothing → UFLS 750, f = 49,906, margin 0', () => {
    const r = m(1600, { kind: 'nothing' });
    expect(r.freq.uflsShedMW).toBe(750);
    expect(r.freq.fHz).toBeCloseTo(49.906, 3);
    expect(r.freq.poolMarginMW).toBe(0);
  });
  it('1600, 2 queues → 50,000 Hz, margin 500, 2/6 sectors off (10 %)', () => {
    const r = m(1600, { kind: 'schedule', queues: 2 });
    expect(r.freq.fHz).toBe(50);
    expect(r.freq.poolMarginMW).toBe(500);
    expect(r.offShare).toBeCloseTo(0.1, 9);
    expect(r.scheduledSectors).toEqual([0, 1]);
  });
  it('1600, 1 queue → 49,906; conserve → 49,667 (no UFLS); 1200 nothing → 49,333', () => {
    expect(m(1600, { kind: 'schedule', queues: 1 }).freq.fHz).toBeCloseTo(49.906, 3);
    const c = m(1600, { kind: 'conserve' });
    expect(c.freq.fHz).toBeCloseTo(49.667, 3);
    expect(c.freq.uflsShedMW).toBe(0);
    expect(deficitMinute(1600, { kind: 'conserve' }, 5).freq.uflsShedMW).toBe(750); // first 10 min = nothing
    expect(m(1200, { kind: 'nothing' }).freq.fHz).toBeCloseTo(49.333, 3);
  });
  it('rotation every 90 min modulo 6', () => {
    expect(scheduledSectors(2, 0)).toEqual([0, 1]);
    expect(scheduledSectors(2, 90)).toEqual([2, 3]);
    expect(scheduledSectors(4, 90)).toEqual([4, 5, 0, 1]);
  });
});
