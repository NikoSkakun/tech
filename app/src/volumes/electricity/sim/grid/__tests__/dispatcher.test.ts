import { describe, expect, it } from 'vitest';
import { gridLoadMW, pvOutputMW, windOutputMW } from '@electricity/sim/core/S2-sim/profiles';
import { createDispatcher, dayReport, importPrice } from '../dispatcher';
import { ZERO_TOTALS } from '../dispatcher/balance';

describe('grid §Б.1–Б.2 profiles', () => {
  it('load: winter 07:30 → 13,1 GW; 18:30 → 16,0 GW; summer 21:00 → 12,5 GW', () => {
    expect(gridLoadMW('winter', 7.5)).toBeCloseTo(13100, 6);
    expect(gridLoadMW('winter', 18.5)).toBeCloseTo(16000, 6);
    expect(gridLoadMW('summer', 21)).toBeCloseTo(12500, 6);
  });
  it('PV winter clear 6000 MW: 12:00 → 2100, 10:00 → 1417 (±2), 17:00 → 0', () => {
    expect(pvOutputMW(6000, 'winter', 12)).toBeCloseTo(2100, 6);
    expect(Math.abs(pvOutputMW(6000, 'winter', 10) - 1417)).toBeLessThanOrEqual(2);
    expect(pvOutputMW(6000, 'winter', 17)).toBe(0);
  });
  it('wind 1500 MW windy: 03:00 → 675, 15:00 → 375; 00:00 → 631', () => {
    expect(windOutputMW(1500, 'windy', 3)).toBeCloseTo(675, 6);
    expect(windOutputMW(1500, 'windy', 15)).toBeCloseTo(375, 6);
    expect(Math.round(windOutputMW(1500, 'windy', 0))).toBe(631);
  });
  it('import price p_imp(h)', () => {
    expect([0, 6, 9, 16, 21, 23].map(importPrice)).toEqual([70, 120, 90, 180, 110, 110]);
  });
});

describe('grid §Б day dispatcher', () => {
  it('initial state at 00:00 (winter) is balanced (≈ 0) at 50 Hz', () => {
    const d = createDispatcher();
    const r = d.stepOnce()!;
    expect(Math.abs(r.imbalanceMW)).toBeLessThan(2);
    expect(r.fHz).toBe(50);
    expect(r.coalMW).toBe(720);
  });

  it('manual day without any action: the system survives on reserves, UFLS and import from ENTSO-E', () => {
    const d = createDispatcher();
    const rep = d.runToEnd();
    expect(d.state.history.length).toBe(288);
    expect(rep.stars).toBeLessThanOrEqual(1);
    for (const s of d.state.history) expect(Number.isFinite(s.fHz)).toBe(true);
  });

  // Б.6 sanity: normal day → ENS 0, UFLS 0, quality ≥ 95 %. Values pinned (docs/audits/sim-S2-sim.md).
  it('auto-dispatcher, normal winter day: ENS 0, UFLS 0, quality 100 %, 3 stars', () => {
    const rep = createDispatcher({ mode: 'normal' }, true).runToEnd();
    expect(rep.ensMWh).toBe(0);
    expect(rep.uflsEvents).toBe(0);
    expect(rep.frequencyQuality).toBeGreaterThanOrEqual(0.95);
    expect(rep.stars).toBe(3);
    expect(rep.costMEur).toBeCloseTo(13.9, 1);
    expect(rep.co2kt).toBeCloseTo(51.6, 1);
  });

  it('auto-dispatcher, hard winter day: planned queues only, ENS pinned at ≈ 8,2k MWh (document: 1–4k, see audit)', () => {
    const d = createDispatcher({ mode: 'hard' }, true);
    const rep = d.runToEnd();
    expect(rep.blackout).toBe(false);
    expect(rep.uflsEvents).toBe(0);
    expect(rep.ensUflsMWh).toBe(0);
    expect(rep.ensMWh).toBeGreaterThan(8100);
    expect(rep.ensMWh).toBeLessThan(8300);
    expect(rep.stars).toBe(2);
    const q = d.state.history.filter((s) => s.queueMW > 0);
    expect(q[0]!.timeMin).toBeGreaterThanOrEqual(18 * 60);
  });

  it('auto-dispatcher, summer days: both 3 stars', () => {
    for (const mode of ['normal', 'hard'] as const) {
      const rep = createDispatcher({ mode, season: 'summer' }, true).runToEnd();
      expect(rep.ensMWh).toBe(0);
      expect(rep.stars).toBe(3);
    }
  });

  it('forecast noise is deterministic for a seed', () => {
    const a = createDispatcher({ noiseSeed: 7 }, true).runToEnd();
    const b = createDispatcher({ noiseSeed: 7 }, true).runToEnd();
    expect(a).toEqual(b);
  });

  it('stars rule (§Б.7) and «hours without power for 5 %»', () => {
    const base = { ...ZERO_TOTALS, steps: 288, qualitySteps: 288, loadMWhSum: 288 * 1000 * (5 / 60) };
    expect(dayReport(base, false).stars).toBe(3);
    expect(dayReport({ ...base, ensQueueMWh: 100 }, false).stars).toBe(2);
    expect(dayReport({ ...base, uflsEvents: 1 }, false).stars).toBe(1);
    expect(dayReport(base, true).stars).toBe(0);
    expect(dayReport({ ...base, ensQueueMWh: 100 }, false).hoursWithoutPowerFor5Pct).toBeCloseTo(2, 9);
  });
});
