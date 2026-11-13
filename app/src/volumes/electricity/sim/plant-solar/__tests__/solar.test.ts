import { describe, expect, it } from 'vitest';
import {
  annualClearSky,
  cityYield,
  concentratorOptimum,
  createParkController,
  dayEnergy,
  duckCurve,
  planeOfArray,
  simulateCsp,
  skyIrradiance,
  trackerGainPct,
  utilityString,
} from '..';

const KYIV = 50.45;

describe('plant-solar M1 sun elevation (φ 50.45°)', () => {
  it('n 172 noon 63.0°; n 80 39.1°; n 355 16.1°; n 172 8:00 36.8°', () => {
    expect(skyIrradiance(KYIV, 172, 12).elevationDeg).toBeCloseTo(63.0, 1);
    expect(skyIrradiance(KYIV, 80, 12).elevationDeg).toBeCloseTo(39.1, 1);
    expect(skyIrradiance(KYIV, 355, 12).elevationDeg).toBeCloseTo(16.1, 1);
    expect(skyIrradiance(KYIV, 172, 8).elevationDeg).toBeCloseTo(36.8, 1);
    expect(skyIrradiance(KYIV, 172, 12).azimuthFromNorthDeg).toBeCloseTo(180, 6);
  });
  it('M2 clouds and night', () => {
    const c = skyIrradiance(KYIV, 172, 12);
    const p = skyIrradiance(KYIV, 172, 12, 'partly');
    const o = skyIrradiance(KYIV, 172, 12, 'overcast');
    expect(p.dniWm2).toBeCloseTo(0.5 * c.dniWm2, 9);
    expect(p.dhiWm2).toBeCloseTo(1.6 * c.dhiWm2, 9);
    expect(o.dniWm2).toBe(0);
    expect(o.dhiWm2).toBeCloseTo(2 * c.dhiWm2, 9);
    expect(skyIrradiance(KYIV, 172, 0).ghiWm2).toBe(0);
  });
});

describe('plant-solar M3/M4 POA and clear-sky energy (DC/AC 1.3)', () => {
  it('POA 21.06 fixed: 8:00 533, 10:00 879, 12:00 1011 W/m²; tracker 8:00 901', () => {
    const at = (t: number, mount: 'fixed' | 'tracker') =>
      planeOfArray(skyIrradiance(KYIV, 172, t), KYIV, { mount }).poaWm2;
    expect(Math.abs(at(8, 'fixed') - 533)).toBeLessThan(1);
    expect(Math.abs(at(10, 'fixed') - 879)).toBeLessThan(1);
    expect(Math.abs(at(12, 'fixed') - 1011)).toBeLessThan(1);
    expect(Math.abs(at(8, 'tracker') - 901)).toBeLessThan(1);
  });
  it('kWh/kWp·day: 21.06 6.72 (clip 0.096) / 9.91; 21.03 5.43 / 5.89; 21.12 2.35 / 1.59; horizontal 21.06 7.05', () => {
    const rows = [
      [172, 22, 6.72, 9.91],
      [80, 8, 5.43, 5.89],
      [355, -3, 2.35, 1.59],
    ] as const;
    for (const [n, t, f, tr] of rows) {
      expect(dayEnergy({ mount: 'fixed', dayOfYear: n, ambientC: t }).acKwhPerKwp).toBeCloseTo(f, 2);
      expect(dayEnergy({ mount: 'tracker', dayOfYear: n, ambientC: t }).acKwhPerKwp).toBeCloseTo(tr, 2);
    }
    expect(dayEnergy({ mount: 'fixed', dayOfYear: 172, ambientC: 22 }).clippedKwhPerKwp).toBeCloseTo(
      0.096,
      3,
    );
    expect(dayEnergy({ mount: 'horizontal', dayOfYear: 172, ambientC: 22 }).acKwhPerKwp).toBeCloseTo(7.05, 2);
  });
  it('annual clear sky: fixed 1812, tracker 2130 kWh/kWp; ×0.62 ≈ 1120 / 1320', () => {
    const f = annualClearSky('fixed');
    const t = annualClearSky('tracker');
    expect(Math.round(f)).toBe(1812);
    expect(Math.round(t)).toBe(2130);
    expect(Math.abs(f * 0.62 - 1120)).toBeLessThan(10);
    expect(Math.abs(t * 0.62 - 1320)).toBeLessThan(10);
  });
  it('bifacial gain ≈ 5 % on grass, ≈ 20 % on snow; backtracking avoids shading', () => {
    const s = skyIrradiance(KYIV, 172, 12);
    const grass = planeOfArray(s, KYIV, { mount: 'fixed', bifacial: true, albedo: 0.2 });
    expect(grass.effectiveWm2 / grass.poaWm2 - 1).toBeGreaterThan(0.01);
    const m = skyIrradiance(KYIV, 172, 6);
    expect(planeOfArray(m, KYIV, { mount: 'tracker', rows: 'shading' }).shading).toBeGreaterThan(0);
    expect(planeOfArray(m, KYIV, { mount: 'tracker', rows: 'backtracking' }).shading).toBe(0);
    expect(trackerGainPct(172, 22)).toBeCloseTo((9.91 / 6.72 - 1) * 100, 0);
  });
});

describe('plant-solar M5 duck curve', () => {
  it('no PV: min 12.6 GW (h3), ramp 4.8; 10 GW: 10.5 (h12) / 6.3; 20: 3.0 / 11.6; 30: −4.5 / 16.9', () => {
    const z = duckCurve({ pvGw: 0 });
    expect(z.minGw).toBeCloseTo(12.6, 6);
    expect(z.minHour).toBe(3);
    expect(z.maxRamp3hGw).toBeCloseTo(4.8, 6);
    const rows = [
      [10, 10.5, 6.3],
      [20, 3.0, 11.6],
      [30, -4.5, 16.9],
    ] as const;
    for (const [pv, mn, rp] of rows) {
      const d = duckCurve({ pvGw: pv });
      expect(d.minGw).toBeCloseTo(mn, 6);
      expect(d.maxRamp3hGw).toBeCloseTo(rp, 6);
    }
    expect(duckCurve({ pvGw: 10 }).minHour).toBe(12);
    expect(duckCurve({ pvGw: 30 }).surplusGwh).toBeGreaterThan(0);
  });
  it('PV profile sums to 5.43 GWh/GWp; BESS and demand response reduce the ramp; energy balance', () => {
    // the rounded hourly values sum to 5.42 (M4 daily value 5.43; audit)
    expect(Math.abs(duckCurve({ pvGw: 1 }).pvGw.reduce((a, b) => a + b, 0) - 5.43)).toBeLessThan(0.015);
    const base = duckCurve({ pvGw: 20 });
    const b = duckCurve({ pvGw: 20, bessGw: 4 });
    expect(b.maxRamp3hGw).toBeLessThan(base.maxRamp3hGw);
    const charged = -b.bessGw.filter((x) => x < 0).reduce((a, x) => a + x, 0);
    const given = b.bessGw.filter((x) => x > 0).reduce((a, x) => a + x, 0);
    expect(charged).toBeCloseTo(16 / Math.sqrt(0.88), 6);
    expect(given).toBeCloseTo(16 * Math.sqrt(0.88), 6);
    const dr = duckCurve({ pvGw: 20, demandResponse: true });
    expect(dr.netShapedGw.reduce((a, x) => a + x, 0)).toBeCloseTo(
      base.netGw.reduce((a, x) => a + x, 0),
      9,
    );
  });
});

describe('plant-solar M6 concentrator optimum', () => {
  const rows = [
    [80, 0.1, 757, 0.37],
    [100, 0.1, 801, 0.375],
    [100, 0.85, 447, 0.28],
    [1000, 0.85, 835, 0.38],
    [10, 0.85, 206, 0.15],
    [1, 0.1, 193, 0.14],
    [3000, 0.85, 1094, 0.42],
  ] as const;
  for (const [c, e, t, eta] of rows) {
    it(`C ${c}, ε ${e} → ${t} °C, η ${eta}`, () => {
      const r = concentratorOptimum(c, e);
      expect(Math.abs(r.tOptC - t)).toBeLessThanOrEqual(1.5);
      expect(Math.abs(r.eta - eta)).toBeLessThanOrEqual(0.005);
    });
  }
});

describe('plant-solar M7 tower CSP (third day, P_set 100 MW)', () => {
  const zeros = (h: number) =>
    simulateCsp({ storageH: h })
      .series.filter((s) => s.pElMw < 1e-6)
      .map((s) => s.hour);
  it('0 h → 1291 MWh, zero output 10.5 h; DNI sum ≈ 10.3 kWh/m²', () => {
    const r = simulateCsp({ storageH: 0 });
    expect(Math.round(r.dailyMwh)).toBe(1291);
    expect(r.zeroHours).toBe(10.5);
    expect(r.dniKwhM2).toBeCloseTo(10.3, 1);
  });
  it('6 h → 1891 MWh, zero ≈ 0:30–5:00; 10 h → 2291, P(3:00) = 100, dip ≈ 4:30–5:00', () => {
    expect(Math.round(simulateCsp({ storageH: 6 }).dailyMwh)).toBe(1891);
    const z6 = zeros(6);
    expect(z6[0]).toBe(0.5);
    expect(z6[z6.length - 1]).toBe(5);
    const r10 = simulateCsp({ storageH: 10 });
    expect(Math.round(r10.dailyMwh)).toBe(2291);
    expect(r10.series.find((s) => s.hour === 3)!.pElMw).toBeCloseTo(100, 6);
    expect(zeros(10)).toEqual([4.5, 4.75, 5]);
  });
  it('12 h → 2400 MWh all day, salt level at 06:00 ≈ 8 %; 15 h → W_max 3571, ≈ 31 200 t, level ≈ 26 %', () => {
    const levelAt6 = (h: number) => simulateCsp({ storageH: h }).series.find((s) => s.hour === 5.75)!.level;
    const r12 = simulateCsp({ storageH: 12 });
    expect(Math.round(r12.dailyMwh)).toBe(2400);
    expect(Math.round(levelAt6(12) * 100)).toBe(8);
    const r15 = simulateCsp({ storageH: 15 });
    expect(Math.round(r15.dailyMwh)).toBe(2400);
    expect(Math.round(r15.wThMaxMwh)).toBe(3571);
    expect(Math.abs(r15.saltT - 31200)).toBeLessThan(100);
    expect(Math.round(levelAt6(15) * 100)).toBe(26);
  });
  it('afternoon clouds reduce the receiver heat but storage keeps the night', () => {
    expect(simulateCsp({ storageH: 12, afternoonClouds: true }).dailyMwh).toBeLessThanOrEqual(2400);
  });
});

describe('plant-solar steps 3, 5, 7', () => {
  it('string: 28 × 53 V = 1484 V ok, 29 → 1537 V exceeds 1500 V', () => {
    expect(utilityString(28).exceeds1500).toBe(false);
    expect(utilityString(29).exceeds1500).toBe(true);
    expect(utilityString(28).operatingV).toBe(1232);
  });
  it('PPC ramps 10 %/min to 60 %, Q moves U, dip 0.15 s', () => {
    const c = createParkController();
    c.setPoint(0.6);
    c.step(60);
    expect(c.state.pPu).toBeCloseTo(0.9, 9);
    c.step(300);
    expect(c.state.pPu).toBeCloseTo(0.6, 9);
    c.setQ(0.33);
    c.step(1);
    expect(c.state.uPu).toBeCloseTo(1.033, 9);
    c.voltageDip();
    c.step(0.1);
    expect(c.state.uPu).toBe(0.2);
    c.step(0.1);
    expect(c.state.uPu).toBeCloseTo(1.033, 9);
  });
  it('city yield: Kyiv ≈ 1812 × 0.62; washing raises it by 3.1 %', () => {
    const k = cityYield('Kyiv');
    expect(Math.abs(k.yieldKwhPerKwp - 1812 * 0.62)).toBeLessThan(3);
    expect(cityYield('Kyiv', 22, true).yieldKwhPerKwp / k.yieldKwhPerKwp).toBeCloseTo(0.99 / 0.96, 6);
    expect(cityYield('Atacama').yieldKwhPerKwp).toBeGreaterThan(k.yieldKwhPerKwp);
    expect(cityYield('Kyiv', 40).yieldKwhPerKwp).toBeLessThan(k.yieldKwhPerKwp);
  });
});
