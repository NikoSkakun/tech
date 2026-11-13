import { describe, expect, it } from 'vitest';
import { CELLS, chargeCcCv, discharge, ocvV, platingRisk } from '../../core/S3-sim/battery';

const rel = (a: number, b: number) => Math.abs(a / b - 1);

describe('lab-battery §M2 discharge (soc0 100, ±0.3 % Ah/Wh, ±0.01 V)', () => {
  const rows = [
    { c: '21700-NMC', r: 0.2, t: 25, ah: 4.983, wh: 18.41, min: 299.0, mid: 3.68 },
    { c: '21700-NMC', r: 0.5, t: 25, ah: 4.959, wh: 18.05, min: 119.0, mid: null },
    { c: '21700-NMC', r: 1.0, t: 25, ah: 4.918, wh: 17.47, min: 59.0, mid: 3.52 },
    { c: '21700-NMC', r: 2.0, t: 25, ah: 4.836, wh: 16.35, min: 29.0, mid: 3.322 },
    { c: '21700-NMC', r: 0.5, t: 0, ah: 4.421, wh: 15.66, min: null, mid: null },
    { c: '21700-NMC', r: 0.5, t: -10, ah: 3.905, wh: 13.59, min: null, mid: null },
    { c: '21700-NMC', r: 0.5, t: -20, ah: 3.388, wh: 11.53, min: null, mid: null },
    { c: 'LFP-100', r: 0.2, t: 25, ah: 99.767, wh: 324.04, min: 299.3, mid: 3.272 },
    { c: 'LFP-100', r: 0.5, t: 25, ah: 99.431, wh: 319.13, min: 119.3, mid: 3.23 },
    { c: 'LFP-100', r: 1.0, t: 25, ah: 98.861, wh: 311.15, min: 59.3, mid: 3.16 },
    { c: 'LFP-100', r: 2.0, t: 25, ah: 97.722, wh: 296.05, min: 29.3, mid: 3.026 },
    { c: 'LFP-100', r: 0.5, t: 0, ah: 88.889, wh: 279.19, min: null, mid: null },
    { c: 'LFP-100', r: 0.5, t: -10, ah: 78.681, wh: 243.78, min: null, mid: null },
    { c: 'LFP-100', r: 0.5, t: -20, ah: 68.444, wh: 208.44, min: null, mid: null },
  ] as const;
  for (const r of rows) {
    it(`${r.c} ${r.r}C ${r.t} °C`, () => {
      const d = discharge(CELLS[r.c], r.r, r.t);
      expect(rel(d.ah, r.ah)).toBeLessThanOrEqual(0.003);
      expect(rel(d.wh, r.wh)).toBeLessThanOrEqual(0.003);
      if (r.min !== null) expect(Math.abs(d.minutes - r.min)).toBeLessThanOrEqual(0.1);
      if (r.mid !== null) expect(Math.abs(d.midVoltageV - r.mid)).toBeLessThanOrEqual(0.01);
      expect(d.heatJ).toBeGreaterThan(0);
      // energy balance: Wh delivered + heat ≈ ∫OCV·I dt
      expect(d.meanVoltageV).toBeLessThan(ocvV(CELLS[r.c].chem, 100));
    });
  }
  it('over-current chip: 21700 above 2 C, LFP-100 above 1 C', () => {
    expect(discharge(CELLS['21700-NMC'], 2, 25).overCurrent).toBe(false);
    expect(discharge(CELLS['21700-NMC'], 3, 25).overCurrent).toBe(true);
    expect(discharge(CELLS['LFP-100'], 1.5, 25).overCurrent).toBe(true);
  });
  it('OCV tail above 100 % and clamp below 0 %', () => {
    expect(ocvV('LFP', 102)).toBeCloseTo(4.6, 9);
    expect(ocvV('NMC', -5)).toBe(2.75);
    expect(ocvV('LFP', 50)).toBe(3.3);
  });
});

describe('lab-battery §M3 CC/CV (soc0 0, 25 °C; ±1 % time, ±0.3 p.p. SOC)', () => {
  const rows = [
    { c: '21700-NMC', r: 0.5, u: 4.2, cc: 111.6, socCv: 93.0, tot: 134.1, t80: 96.0, end: 99.8 },
    { c: '21700-NMC', r: 1.0, u: 4.2, cc: 49.8, socCv: 83.0, tot: 81.9, t80: 48.0, end: 99.8 },
    { c: '21700-NMC', r: 0.5, u: 4.1, cc: null, socCv: null, tot: 129.3, t80: null, end: 91.8 },
    { c: 'LFP-100', r: 0.5, u: 3.65, cc: 119.5, socCv: 99.6, tot: 120.3, t80: 96.0, end: 100.0 },
    { c: 'LFP-100', r: 1.0, u: 3.65, cc: 58.9, socCv: 98.1, tot: 62.2, t80: 48.0, end: 100.0 },
  ] as const;
  for (const r of rows) {
    it(`${r.c} ${r.r}C U_max ${r.u}`, () => {
      const c = chargeCcCv(CELLS[r.c], r.r, { uMaxV: r.u });
      if (r.cc !== null) expect(rel(c.ccMinutes, r.cc)).toBeLessThanOrEqual(0.01);
      if (r.socCv !== null) expect(Math.abs(c.socAtCvPct! - r.socCv)).toBeLessThanOrEqual(0.3);
      expect(rel(c.totalMinutes, r.tot)).toBeLessThanOrEqual(0.01);
      if (r.t80 !== null) expect(rel(c.minutesTo80!, r.t80)).toBeLessThanOrEqual(0.01);
      expect(Math.abs(c.finalSocPct - r.end)).toBeLessThanOrEqual(0.3);
      expect(c.overcharge).toBe(false);
    });
  }
  it('warnings: overcharge above the chemistry limit; plating red below 0 °C, amber below 10 °C above 0.5 C', () => {
    expect(chargeCcCv(CELLS['21700-NMC'], 0.5, { uMaxV: 4.3 }).overcharge).toBe(true);
    expect(platingRisk(-1, 0.1)).toBe('red');
    expect(platingRisk(5, 0.6)).toBe('amber');
    expect(platingRisk(5, 0.5)).toBe('none');
    expect(platingRisk(25, 2)).toBe('none');
    const cold = chargeCcCv(CELLS['LFP-100'], 0.5, { tC: -20 });
    expect(cold.plating).toBe('red');
    expect(Number.isFinite(cold.totalMinutes)).toBe(true);
  });
});
