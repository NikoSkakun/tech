import { describe, expect, it } from 'vitest';
import { analyseWave, filterWave, lcGainDb, lcResonance, loadResistanceOhm, type WaveParams } from '..';

const rel = (a: number, b: number) => Math.abs(a / b - 1);

describe('lab-inverter §M2 waveforms without filter (±0.5 % U, ±0.3 p.p. THD)', () => {
  const rows: { p: WaveParams; u1: number; u: number | null; thd: number; thd50: number | null }[] = [
    { p: { kind: 'square', udcV: 325 }, u1: 292.6, u: 325.0, thd: 48.3, thd50: 47.3 },
    { p: { kind: 'quasi', udcV: 400, alphaDeg: 30 }, u1: 311.9, u: 326.6, thd: 31.1, thd50: 30.0 },
    { p: { kind: 'quasi', udcV: 325, alphaDeg: 45 }, u1: 206.9, u: 229.8, thd: 48.3, thd50: 47.3 },
    {
      p: { kind: 'spwm_bi', udcV: 400, fcHz: 20000, ma: 0.8125 },
      u1: 229.6,
      u: 400.0,
      thd: 142.7,
      thd50: 0.37,
    },
    {
      p: { kind: 'spwm_uni', udcV: 400, fcHz: 20000, ma: 0.8125 },
      u1: 229.6,
      u: 287.5,
      thd: 75.4,
      thd50: 0.32,
    },
    {
      p: { kind: 'spwm_uni', udcV: 400, fcHz: 20000, ma: 0.5 },
      u1: 141.4,
      u: 225.7,
      thd: 124.4,
      thd50: 0.84,
    },
    { p: { kind: 'spwm_uni', udcV: 400, fcHz: 20000, ma: 1.0 }, u1: 282.9, u: 319.2, thd: 52.2, thd50: 0.25 },
    { p: { kind: 'spwm_uni', udcV: 400, fcHz: 20000, ma: 1.15 }, u1: 307.3, u: null, thd: 43.1, thd50: null },
  ];
  for (const r of rows) {
    it(`${r.p.kind} ${JSON.stringify(r.p)}`, () => {
      const a = analyseWave(r.p);
      expect(rel(a.u1RmsV, r.u1)).toBeLessThanOrEqual(0.005);
      if (r.u !== null) expect(rel(a.uRmsV, r.u)).toBeLessThanOrEqual(0.005);
      expect(Math.abs(a.thd * 100 - r.thd)).toBeLessThanOrEqual(0.3);
      if (r.thd50 !== null) expect(Math.abs(a.thd50 * 100 - r.thd50)).toBeLessThanOrEqual(0.3);
    });
  }

  it('analytic checks: square U1 = 0.9003·Udc, quasi U1 = 0.9003·Udc·cos α, U = Udc·√(1 − 2α/π)', () => {
    expect(rel(analyseWave({ kind: 'square', udcV: 100 }).u1RmsV, 90.03)).toBeLessThan(1e-3);
    const q = analyseWave({ kind: 'quasi', udcV: 100, alphaDeg: 23.2 });
    expect(rel(q.u1RmsV, 90.03 * Math.cos((23.2 * Math.PI) / 180))).toBeLessThan(2e-3);
    expect(rel(q.uRmsV, 100 * Math.sqrt(1 - (2 * 23.2) / 180))).toBeLessThan(2e-3);
    expect(Math.abs(q.thd * 100 - 28.96)).toBeLessThan(0.3);
  });

  it('ladder (MMC) THD at m_a = 1: 2 → 48.34 %, 3 → 31.08 %, 5 → 17.60 %, 9 → 9.36 %, 21 → 3.90 %, 101 → 0.80 %', () => {
    const want: [number, number][] = [
      [2, 48.34],
      [3, 31.08],
      [5, 17.6],
      [9, 9.36],
      [21, 3.9],
      [101, 0.8],
    ];
    for (const [L, t] of want) {
      const a = analyseWave({ kind: 'ladder', udcV: 400, ma: 1, levels: L });
      expect(Math.abs(a.thd * 100 - t)).toBeLessThanOrEqual(0.05);
    }
    const l3 = analyseWave({ kind: 'ladder', udcV: 400, ma: 1, levels: 3 });
    const q30 = analyseWave({ kind: 'quasi', udcV: 400, alphaDeg: 30 });
    expect(Math.abs(l3.thd - q30.thd)).toBeLessThan(0.002);
  });
});

describe('lab-inverter §M3 LC filter (U_dc 400, m_a 0.8125, R 26.45 Ω)', () => {
  const R = 26.45;
  const rows: { p: WaveParams; L: number; C: number; f0: number; u1: number; thd: number; r?: number }[] = [
    { p: { kind: 'spwm_uni', udcV: 400, fcHz: 20000 }, L: 1.5, C: 10, f0: 1299, u1: 229.9, thd: 0.41 },
    { p: { kind: 'spwm_bi', udcV: 400, fcHz: 20000 }, L: 1.5, C: 10, f0: 1299, u1: 229.9, thd: 0.66 },
    { p: { kind: 'spwm_uni', udcV: 400, fcHz: 20000 }, L: 0.5, C: 5, f0: 3183, u1: 229.6, thd: 0.95 },
    { p: { kind: 'spwm_bi', udcV: 400, fcHz: 20000 }, L: 0.5, C: 5, f0: 3183, u1: 229.6, thd: 2.97 },
    { p: { kind: 'spwm_uni', udcV: 400, fcHz: 20000 }, L: 3.0, C: 20, f0: 650, u1: 230.8, thd: 0.4 },
    { p: { kind: 'spwm_uni', udcV: 400, fcHz: 5000 }, L: 1.5, C: 10, f0: 1299, u1: 230.1, thd: 1.05 },
    { p: { kind: 'spwm_uni', udcV: 400, fcHz: 5000 }, L: 0.5, C: 5, f0: 3183, u1: 229.9, thd: 6.68 },
    { p: { kind: 'spwm_uni', udcV: 400, fcHz: 2000 }, L: 1.5, C: 10, f0: 1299, u1: 230.1, thd: 6.96 },
    { p: { kind: 'spwm_bi', udcV: 400, fcHz: 2000 }, L: 1.5, C: 10, f0: 1299, u1: 230.1, thd: 69.6 },
    { p: { kind: 'spwm_bi', udcV: 400, fcHz: 10000 }, L: 1.5, C: 10, f0: 1299, u1: 230.2, thd: 1.88 },
    { p: { kind: 'square', udcV: 325 }, L: 1.5, C: 10, f0: 1299, u1: 293.0, thd: 53.1 },
    { p: { kind: 'quasi', udcV: 400, alphaDeg: 30 }, L: 1.5, C: 10, f0: 1299, u1: 312.3, thd: 35.8 },
    {
      p: { kind: 'spwm_uni', udcV: 400, fcHz: 20000, ma: 1.15 },
      L: 1.5,
      C: 10,
      f0: 1299,
      u1: 307.7,
      thd: 5.8,
    },
    {
      p: { kind: 'spwm_uni', udcV: 400, fcHz: 20000 },
      L: 1.5,
      C: 10,
      f0: 1299,
      u1: 229.9,
      thd: 0.57,
      r: 1e6,
    },
  ];
  for (const r of rows) {
    it(`${r.p.kind} f_c ${r.p.fcHz ?? '-'} L ${r.L} mH C ${r.C} μF R ${r.r ?? R}`, () => {
      const w = analyseWave({ ma: 0.8125, ...r.p });
      const f = filterWave(w, r.L * 1e-3, r.C * 1e-6, r.r ?? R);
      expect(Math.abs(f.f0Hz - r.f0)).toBeLessThan(1);
      expect(rel(f.u1RmsV, r.u1)).toBeLessThanOrEqual(0.005);
      expect(Math.abs(f.thd * 100 - r.thd)).toBeLessThanOrEqual(r.thd > 10 ? 0.3 : 0.02);
    });
  }
  it('analytic: |H| at 20 kHz = −47.5 dB, 40 kHz = −59.5 dB (1.5 mH, 10 μF, no damping)', () => {
    expect(lcGainDb(20000, 1.5e-3, 10e-6, 1e9)).toBeCloseTo(-47.5, 1);
    expect(lcGainDb(40000, 1.5e-3, 10e-6, 1e9)).toBeCloseTo(-59.5, 1);
    expect(lcResonance(1.5e-3, 10e-6).z0Ohm).toBeCloseTo(12.25, 2);
    expect(loadResistanceOhm(2000)).toBeCloseTo(26.45, 9);
    expect(loadResistanceOhm(0)).toBe(1e6);
  });
});

describe('lab-inverter §M4 dead time (averaged), U_dc 400, f_c 20 kHz, LC 1.5 mH/10 μF, R 26.45', () => {
  const rows = [
    { td: 0.5e-6, u1: 222.3, thd: 1.79 },
    { td: 1e-6, u1: 215.1, thd: 3.6 },
    { td: 2e-6, u1: 200.7, thd: 7.65 },
  ];
  for (const r of rows) {
    it(`t_d = ${r.td * 1e6} μs`, () => {
      const w = analyseWave({ kind: 'spwm_uni', udcV: 400, fcHz: 20000, ma: 0.8125, deadTimeS: r.td });
      expect(rel(w.u1RmsV, r.u1)).toBeLessThanOrEqual(0.005);
      const f = filterWave(w, 1.5e-3, 10e-6, 26.45);
      expect(Math.abs(f.thd * 100 - r.thd)).toBeLessThanOrEqual(0.05);
    });
  }
  it('compensation removes the error', () => {
    const w = analyseWave({
      kind: 'spwm_uni',
      udcV: 400,
      fcHz: 20000,
      ma: 0.8125,
      deadTimeS: 2e-6,
      deadTimeCompensation: true,
    });
    expect(rel(w.u1RmsV, 229.6)).toBeLessThan(0.005);
  });
});
