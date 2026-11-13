import { describe, expect, it } from 'vitest';
import { simulateHome, type DayTotals } from '../../core/S3-sim/home/day';
import { DEFAULT_APPLIANCES, homeLoadsKw, type ApplianceId } from '../../core/S3-sim/home/loads';
import type { HomeParams } from '../../core/S3-sim/home/params';
import { H, STEPS_PER_DAY, STEP_MIN } from '../../core/S3-sim/home/step';

type P = Partial<HomeParams>;
const KEYS: (keyof DayTotals)[] = [
  'pv',
  'load',
  'served',
  'unserved',
  'shed',
  'imp',
  'exp',
  'curt',
  'chg',
  'dis',
  'gen',
  'cost',
  'islandH',
  'darkH',
  'socMin',
  'socEnd',
  'selfSufficiency',
  'selfConsumption',
];
const TOL: Partial<Record<keyof DayTotals, number>> = {
  socMin: 0.3,
  socEnd: 0.3,
  selfSufficiency: 0.011,
  selfConsumption: 0.011,
};
const SU: P = { mode: 'self_use' };

/** lab-hybrid-home §M6 (day 3); tolerance ±0.05 kWh / UAH, ±0.3 p.p. SOC, ±0.01 SS/SC. */
const CASES: [string, P, number[]][] = [
  [
    'CP1',
    { mode: 'backup' },
    [2.1, 10.99, 8.12, 0, 2.87, 6.43, 0.11, 0, 2.53, 2.28, 0, 23.28, 8, 0, 79.03, 100.0, 0.21, 0.95],
  ],
  [
    'CP2',
    SU,
    [2.1, 10.99, 8.0, 0.13, 2.87, 6.2, 0, 0, 2.58, 2.33, 0, 22.56, 8, 0.25, 10.34, 30.0, 0.22, 1.0],
  ],
  [
    'CP3',
    { ...SU, season: 'summer', weather: 'clear', outage: 'none' },
    [31.97, 9.07, 9.07, 0, 0, 0, 21.66, 0, 4.1, 3.7, 0, 0, 0, 0, 62.24, 71.35, 1.0, 0.32],
  ],
  [
    'CP4',
    { ...SU, season: 'summer', weather: 'clear', outage: 'none', exportAllowed: false },
    [31.97, 9.07, 9.07, 0, 0, 0, 0, 22.33, 4.1, 3.7, 0, 0, 0, 0, 62.24, 71.35, 1.0, 0.3],
  ],
  [
    'CP5',
    { outage: 'blackout', mode: 'backup' },
    [2.1, 10.99, 7.79, 0, 3.2, 0, 0, 0, 0.25, 5.99, 0, 0, 24, 0, 40.72, 40.72, 1.0, 1.0],
  ],
  [
    'CP6',
    { ...SU, outage: 'blackout' },
    [2.1, 10.99, 3.95, 3.84, 3.2, 0, 0, 0, 0.37, 2.27, 0, 0, 24, 9.5, 10.0, 10.08, 0.51, 1.0],
  ],
  [
    'CP7',
    { outage: 'blackout', mode: 'backup', multiDay: true },
    [2.1, 10.99, 2.02, 5.77, 3.2, 0, 0, 0, 0.37, 0.33, 0, 0, 24, 17.42, 10.01, 10.08, 0.26, 1.0],
  ],
  [
    'CP8',
    { outage: 'blackout', mode: 'backup', multiDay: true, genKw: 3, genStartPct: 50 },
    [2.1, 10.99, 7.79, 0, 3.2, 0, 0, 0, 3.58, 5.58, 3.75, 0, 24, 0, 49.78, 50.79, 1.0, 1.0],
  ],
  [
    'CP9',
    { outage: 'hard_day', mode: 'backup', batKwh: 5.12 },
    [2.1, 10.99, 10.82, 0, 0.17, 8.49, 0.16, 0, 2.65, 3.11, 0, 33.84, 12, 0, 79.25, 85.2, 0.22, 0.92],
  ],
  [
    'CP10',
    { season: 'spring', weather: 'partly', outage: 'day12', mode: 'tou' },
    [15.08, 9.07, 7.54, 0, 1.53, 5.31, 0, 12.33, 4.57, 4.13, 0, 11.47, 12, 0, 59.18, 77.73, 0.3, 0.18],
  ],
  [
    'CP11',
    { ...SU, season: 'summer', weather: 'clear', outage: 'blackout', wholeHomeBackup: true },
    [31.97, 9.07, 9.07, 0, 0, 0, 0, 22.33, 4.1, 3.7, 0, 0, 24, 0, 62.24, 71.35, 1.0, 0.3],
  ],
  [
    'CP12',
    { ...SU, weather: 'clear', outage: 'day12' },
    [10.52, 10.99, 9.46, 0, 1.53, 0.31, 0, 0, 8.22, 6.91, 0, 0.68, 12, 0, 22.06, 44.9, 0.97, 1.0],
  ],
];
const SOC_TRACES: Record<string, number[]> = {
  CP1: [100.0, 100.0, 100.0, 99.56, 83.84, 100.0],
  CP2: [30.0, 30.0, 30.31, 29.56, 13.84, 30.0],
  CP3: [71.24, 64.05, 100.0, 99.36, 81.16, 71.35],
  CP5: [99.82, 86.74, 78.41, 68.65, 52.93, 40.72],
  CP8: [74.69, 61.61, 53.27, 78.73, 63.0, 50.79],
  CP12: [39.56, 29.69, 61.83, 88.68, 57.11, 44.9],
};

describe('lab-hybrid-home §M6 control scenarios CP1–CP12', () => {
  for (const [name, p, exp] of CASES) {
    it(name, () => {
      const r = simulateHome(p);
      KEYS.forEach((k, i) => {
        const tol = (TOL[k] ?? 0.05) + 1e-9;
        expect(Math.abs((r.totals[k] as number) - exp[i]!), `${name} ${k}`).toBeLessThanOrEqual(tol);
      });
      const tr = SOC_TRACES[name];
      if (tr)
        [0, 72, 144, 216, 252, 287].forEach((j, i) =>
          expect(Math.abs(r.trace[j]!.socPct - tr[i]!)).toBeLessThanOrEqual(0.3),
        );
      expect(r.trace).toHaveLength(288);
    });
  }
  it('CP8: generator runs in steps 196…210 (16:20–17:35)', () => {
    const r = simulateHome(CASES[7]![1]);
    const on = r.trace.map((f, k) => (f.genOn ? k : -1)).filter((k) => k >= 0);
    expect(on[0]).toBe(196);
    expect(on[on.length - 1]).toBe(210);
  });
});

const OFF = (...ids: ApplianceId[]) => DEFAULT_APPLIANCES.filter((a) => !ids.includes(a));
const CP4: P = { ...SU, season: 'summer', weather: 'clear', outage: 'none', exportAllowed: false };
const CP7: P = { outage: 'blackout', mode: 'backup', multiDay: true };
const WOC: P = { season: 'winter', weather: 'overcast', outage: 'none' };

describe('lab-hybrid-home step 8 challenges', () => {
  const ch: [string, P, Partial<Record<keyof DayTotals, number>>][] = [
    [
      '1 three days off-grid',
      { ...CP7, kwp: 12, batKwh: 20.48, enabled: OFF('tv_laptops') },
      { darkH: 0, socMin: 14.0 },
    ],
    [
      '1 second solution',
      { ...CP7, kwp: 12, enabled: OFF('tv_laptops', 'laptop_work', 'lights') },
      { darkH: 0, socMin: 24.1 },
    ],
    [
      '2 summer without export',
      { ...CP4, kwp: 3, enabled: [...DEFAULT_APPLIANCES, 'water_heater', 'air_cond'] },
      { curt: 0, imp: 0, socMin: 32.7 },
    ],
    ['2 fails with 2 kWp', { ...CP4, kwp: 2 }, { curt: 3.08 }],
    ['3 backup', { ...WOC, mode: 'backup' }, { cost: 35.42 }],
    ['3 self_use', { ...WOC, mode: 'self_use' }, { cost: 34.76 }],
    ['3 tou', { ...WOC, mode: 'tou' }, { cost: 21.64 }],
    ['3 tou 20.48 kWh', { ...WOC, mode: 'tou', batKwh: 20.48 }, { cost: 21.02 }],
    ['3 tou 5.12 kWh', { ...WOC, mode: 'tou', batKwh: 5.12 }, { cost: 28.2 }],
  ];
  for (const [name, p, exp] of ch) {
    it(name, () => {
      const t = simulateHome(p).totals;
      for (const [k, v] of Object.entries(exp))
        expect(Math.abs((t[k as keyof DayTotals] as number) - v)).toBeLessThanOrEqual(
          (TOL[k as keyof DayTotals] ?? 0.05) + 1e-9,
        );
    });
  }
});

describe('lab-hybrid-home §M2 load sums and §M5 zero-capacity battery', () => {
  it('critical + non-critical kWh/day: winter 6.59 + 3.20, spring/summer 4.67 + 3.20', () => {
    const want = { winter: [6.59, 3.2], spring: [4.67, 3.2], summer: [4.67, 3.2] } as const;
    for (const [season, [c, n]] of Object.entries(want)) {
      let cs = 0;
      let ns = 0;
      for (let k = 0; k < STEPS_PER_DAY; k++) {
        const l = homeLoadsKw(k * STEP_MIN, season as 'winter', new Set(DEFAULT_APPLIANCES));
        cs += l.crit * H;
        ns += l.non * H;
      }
      expect(Math.abs(cs - c)).toBeLessThan(0.006);
      expect(Math.abs(ns - n)).toBeLessThan(0.006);
    }
  });
  it('no battery in an island: output off, all PV curtailed, 24 dark hours', () => {
    const t = simulateHome({ batKwh: 0, outage: 'blackout' }).totals;
    expect(t.served).toBe(0);
    expect(Math.abs(t.curt - t.pv)).toBeLessThan(1e-6);
    expect(t.darkH).toBeCloseTo(24, 6);
    expect(Number.isNaN(t.socEnd)).toBe(true);
  });
  it('no battery with grid: no charge/discharge, export works', () => {
    const t = simulateHome({ batKwh: 0, season: 'summer', weather: 'clear', outage: 'none' }).totals;
    expect(t.chg).toBe(0);
    expect(t.dis).toBe(0);
    expect(t.unserved).toBe(0);
    expect(t.exp).toBeGreaterThan(0);
  });
});
