import { describe, expect, it } from 'vitest';
import {
  H,
  STEPS_PER_DAY,
  STEP_MIN,
  autonomyHours,
  batterySize,
  createHomeLive,
  createIslandScene,
  homePvKw,
  inverterSize,
  islandLimitKw,
  microgridPeak,
  pvSize,
  rechargeHours,
  simulateHome,
  stepIndexAtHour,
  transferVerdicts,
  type Season,
  type Weather,
} from '..';

describe('lab-hybrid-home §M1 PV per kWp (energy/day, peak)', () => {
  const rows: [Season, Weather, number, number | null][] = [
    ['winter', 'clear', 2.1, 0.42],
    ['winter', 'partly', 1.26, null],
    ['winter', 'overcast', 0.42, null],
    ['spring', 'clear', 5.03, 0.72],
    ['spring', 'partly', 3.02, null],
    ['spring', 'overcast', 1.01, null],
    ['summer', 'clear', 6.39, 0.79],
    ['summer', 'partly', 3.84, null],
    ['summer', 'overcast', 1.28, null],
  ];
  for (const [s, w, e, pk] of rows) {
    it(`${s} ${w}`, () => {
      let sum = 0;
      let peak = 0;
      for (let k = 0; k < STEPS_PER_DAY; k++) {
        sum += homePvKw(k * STEP_MIN + STEP_MIN / 2, 1, s, w) * H;
        peak = Math.max(peak, homePvKw(k * STEP_MIN, 1, s, w));
      }
      expect(Math.abs(sum - e)).toBeLessThanOrEqual(0.006);
      if (pk !== null) expect(Math.abs(peak - pk)).toBeLessThanOrEqual(0.006);
    });
  }
  it('summer peak for 5 kWp = 3.94 kW', () => {
    let peak = 0;
    for (let k = 0; k < STEPS_PER_DAY; k++)
      peak = Math.max(peak, homePvKw(k * STEP_MIN, 5, 'summer', 'clear'));
    expect(peak).toBeCloseTo(3.94, 2);
  });
});

describe('lab-hybrid-home live stepper', () => {
  it('replays the same day as simulateHome when fed the same initial SOC', () => {
    const ref = simulateHome({ mode: 'self_use', outage: 'none', season: 'summer', weather: 'clear' });
    const soc0 = ref.trace[0]!.socPct; // SOC after step 0 of day 3
    const live = createHomeLive(
      { mode: 'self_use', outage: 'none', season: 'summer', weather: 'clear' },
      { startMin: 5, socPct: soc0 },
    );
    for (let k = 0; k < 287; k++) live.step(5);
    expect(live.state.socPct).toBeCloseTo(ref.totals.socEnd, 6);
  });
  it('manual blackout at any moment, generator manual start', () => {
    const live = createHomeLive(
      { mode: 'backup', outage: 'none', genKw: 3 },
      { startMin: 20 * 60, socPct: 60 },
    );
    live.setGrid(false);
    live.step(30);
    expect(live.state.gridOn).toBe(false);
    expect(live.state.flows!.grid).toBe(false);
    expect(live.state.genOn).toBe(false);
    live.startGenerator();
    live.step(5);
    expect(live.state.flows!.genKw).toBeGreaterThan(0);
    live.setGrid(true);
    live.step(5);
    expect(live.state.genOn).toBe(false);
    expect(live.state.flows!.impKw).toBeGreaterThan(0);
    expect(stepIndexAtHour(12)).toBe(144);
    expect(stepIndexAtHour(24)).toBe(287);
  });
});

describe('lab-hybrid-home step 5 island scene', () => {
  it('transfer verdicts: 10 ms all fine; 30 ms PC reboots and LEDs flicker; 100 ms boiler relights', () => {
    expect(transferVerdicts(10)).toEqual({ pc: 'ok', led: 'ok', boiler: 'ok', fridge: 'ok' });
    expect(transferVerdicts(30)).toMatchObject({ pc: 'reboot', led: 'flicker', boiler: 'ok' });
    expect(transferVerdicts(100).boiler).toBe('relight');
  });
  it('limit min(6 kW, 5.12 kW) → stove + water heater + kettle + 0.5 kW critical = 6 kW → overload, off 5 s, retry', () => {
    expect(islandLimitKw({ invKw: 6, batKwh: 10.24 })).toBeCloseTo(5.12, 9);
    const sc = createIslandScene({ invKw: 6, batKwh: 10.24 });
    sc.setLoad(1.5 + 2 + 2 + 0.5);
    expect(sc.state.outputOn).toBe(false);
    sc.step(4.9);
    expect(sc.state.outputOn).toBe(false);
    sc.setLoad(2.5);
    sc.step(0.2);
    expect(sc.state.outputOn).toBe(true);
    expect(sc.state.overloadCount).toBe(1);
  });
});

describe('lab-hybrid-home §M7 calculators', () => {
  it('autonomy 26.5 h; recharge 3.23 h / 1.29 h', () => {
    expect(autonomyHours(10.24, 100, 0.33)).toBeCloseTo(26.5, 1);
    expect(rechargeHours(10.24, 40, 100, 2)).toBeCloseTo(3.23, 2);
    expect(rechargeHours(10.24, 40, 100, 5)).toBeCloseTo(1.29, 2);
  });
  it('battery size 6.08 → 10.24; margin 0.2 → 7.30 → 10.24; 4 h → 1.52 → 5.12', () => {
    const a = batterySize(0.325, 16);
    expect(a.requiredKwh).toBeCloseTo(6.08, 2);
    expect(a.recommendedKwh).toBeCloseTo(10.24, 9);
    expect(batterySize(0.325, 16, 0.9, 0.95, 0.2).requiredKwh).toBeCloseTo(7.3, 2);
    expect(batterySize(0.325, 4).recommendedKwh).toBeCloseTo(5.12, 9);
  });
  it('inverter: 3 kW, with a kettle 5 kW', () => {
    const base = [
      { pRunKw: 0.15, kStart: 5 },
      { pRunKw: 0.1, kStart: 2 },
      { pRunKw: 0.15 },
      { pRunKw: 0.15 },
      { pRunKw: 0.02 },
      { pRunKw: 1.0, kStart: 5 },
    ];
    const a = inverterSize(base);
    expect(a.sumRunKw).toBeCloseTo(1.57, 9);
    expect(a.peakKw).toBeCloseTo(5.57, 9);
    expect(a.recommendedKw).toBe(3);
    const b = inverterSize([...base, { pRunKw: 2 }]);
    expect(b.peakKw).toBeCloseTo(7.57, 9);
    expect(b.recommendedKw).toBe(5);
  });
  it('PV: 9.79 kWh in June → 2.11 kWp (5 modules), December → 11.13 kWp (26 modules)', () => {
    const j = pvSize(9.79, 1, 5);
    expect(j.kwp).toBeCloseTo(2.11, 2);
    expect(j.modules).toBe(5);
    const d = pvSize(9.79, 1, 11);
    expect(Math.abs(d.kwp - 11.13)).toBeLessThan(0.006); // 11.125 rounded half-up
    expect(d.modules).toBe(26);
    expect(d.fitsWholeRoof).toBe(false);
  });
  it('microgrid peak: share 0.5 → 1.25 / 2.0; share 0 → 1.5 in both', () => {
    expect(microgridPeak(0.5, true)).toBe(1.25);
    expect(microgridPeak(0.5, false)).toBe(2.0);
    expect(microgridPeak(0, true)).toBe(1.5);
    expect(microgridPeak(0, false)).toBe(1.5);
  });
});
