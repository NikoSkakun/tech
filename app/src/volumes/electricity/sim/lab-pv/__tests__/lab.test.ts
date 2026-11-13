import { describe, expect, it } from 'vitest';
import {
  CITY_YIELDS,
  KYIV_MONTHLY_37,
  KYIV_MONTHLY_60,
  SampledCurve,
  PvString,
  atmosphere,
  cellAssembly,
  checkString,
  cloudIrradiance,
  createMpptSim,
  cumulativeEnergyKwh,
  cutoffWavelengthNm,
  globalScan,
  kyivNoonElevationDeg,
  orientationYield,
  photon,
  poInit,
  poIterate,
  relativePower,
  stringVmpV,
  stringVocV,
  sunArc,
  uniformString,
} from '..';

describe('lab-pv §M5 atmosphere (Kasten–Young + Meinel, G_sc 1361), ±1 W/m²', () => {
  const rows = [
    { h: 90, am: 1.0, gn: 952.8, gh: 952.8 },
    { h: 41.8, am: 1.498, gn: 851.3, gh: 567.4 },
    { h: 30, am: 1.994, gn: 770.0, gh: 385.0 },
    { h: 15, am: 3.813, gn: 562.4, gh: 145.6 },
    { h: 5, am: 10.31, gn: 240.2, gh: 20.9 },
  ];
  for (const r of rows) {
    it(`h = ${r.h}°`, () => {
      const a = atmosphere(r.h);
      expect(Math.abs(a.airMass - r.am)).toBeLessThan(r.am > 5 ? 0.01 : 0.0015);
      expect(Math.abs(a.dniWm2 - r.gn)).toBeLessThanOrEqual(1);
      expect(Math.abs(a.beamHorizontalWm2 - r.gh)).toBeLessThanOrEqual(1);
    });
  }
  it('clamps the slider range 5…90°', () => {
    expect(atmosphere(0).elevationDeg).toBe(5);
    expect(atmosphere(120).elevationDeg).toBe(90);
  });
});

describe('lab-pv step 2 photons', () => {
  it('550 nm → 2.25 eV → 50 %; 1000 nm → 1.24 eV → 90 %; 400 nm → 3.10 eV → 36 %; cut-off 1107 nm', () => {
    expect(photon(550).energyEv).toBeCloseTo(2.25, 2);
    expect(Math.round(photon(550).usefulFraction * 100)).toBe(50);
    expect(photon(1000).energyEv).toBeCloseTo(1.24, 2);
    expect(Math.round(photon(1000).usefulFraction * 100)).toBe(90);
    expect(photon(400).energyEv).toBeCloseTo(3.1, 2);
    expect(Math.round(photon(400).usefulFraction * 100)).toBe(36);
    expect(Math.round(cutoffWavelengthNm())).toBe(1107);
    expect(photon(1200).absorbed).toBe(false);
    expect(photon(1100).absorbed).toBe(true);
  });
});

describe('lab-pv step 4 cell assembly', () => {
  it('6 series → 4.2 V 7 A; 3×2 → 2.1 V 14 A; 6 parallel → 0.7 V 42 A; power equal', () => {
    expect(cellAssembly(6, 1).voltageV).toBeCloseTo(4.2, 9);
    expect(cellAssembly(6, 1).currentA).toBe(7);
    const b = cellAssembly(3, 2);
    expect(b.voltageV).toBeCloseTo(2.1, 9);
    expect(b.currentA).toBe(14);
    const c = cellAssembly(1, 6);
    expect(c.voltageV).toBeCloseTo(0.7, 9);
    expect(c.currentA).toBe(42);
    expect(b.powerW).toBeCloseTo(c.powerW, 9);
  });
});

describe('lab-pv §M3 orientation (bilinear PVGIS table)', () => {
  it('control points', () => {
    expect(orientationYield(37, 0).specificYield).toBe(1114);
    expect(orientationYield(30, 22.5).specificYield).toBeCloseTo(1072.5, 9);
    expect(orientationYield(52.5, 0).specificYield).toBeCloseTo(1079.5, 9);
    expect(orientationYield(0, 123).specificYield).toBe(938);
    expect(Math.round(orientationYield(0, 0).fractionOfOptimum * 100)).toBe(84);
    expect(orientationYield(90, 0).specificYield).toBe(775);
    expect(Math.round(orientationYield(90, 0).fractionOfOptimum * 100)).toBe(70);
    expect(orientationYield(37, 90).specificYield).toBe(858);
    expect(orientationYield(37, -90).specificYield).toBe(858);
    expect(Math.round(orientationYield(37, 90).fractionOfOptimum * 100)).toBe(77);
    expect(orientationYield(37, 180).specificYield).toBe(547);
    expect(orientationYield(37, -180).specificYield).toBe(547);
    expect(Math.round(orientationYield(37, 180).fractionOfOptimum * 100)).toBe(49);
  });
  it('monthly arrays: 37° sums to 1114, 60° fixed data sums to 1052; December +12 %', () => {
    // the published monthly values sum to 1114.1 (rounding; logged in the audit)
    expect(Math.abs(KYIV_MONTHLY_37.reduce((a, b) => a + b, 0) - 1114)).toBeLessThan(0.15);
    expect(Math.abs(KYIV_MONTHLY_60.reduce((a, b) => a + b, 0) - 1052)).toBeLessThan(0.35); // sums to 1051.7
    expect(Math.round((KYIV_MONTHLY_60[11] / KYIV_MONTHLY_37[11] - 1) * 100)).toBe(12);
    const m = orientationYield(90, 0).monthly;
    expect(m.reduce((a, b) => a + b, 0)).toBeCloseTo(775, 0);
    expect(CITY_YIELDS.map((c) => c.yield)).toEqual([1086, 1114, 1264]);
  });
});

describe('lab-pv step 8 sun arcs over Kyiv', () => {
  it('noon elevation 63° (June), ≈16° (December), ≈39.5° (March 20)', () => {
    expect(kyivNoonElevationDeg('june21')).toBeCloseTo(63.0, 0);
    expect(kyivNoonElevationDeg('december21')).toBeCloseTo(16.1, 0);
    // 20 March = day 79: Cooper δ = −0.76° → 38.8° (the text's 39.5° is the δ = 0 equinox value)
    expect(kyivNoonElevationDeg('march20')).toBeCloseTo(38.79, 1);
  });
  it('arc is symmetric, incidence at noon on a 37° south module in June = |63 − 53| = 10°', () => {
    const arc = sunArc('june21', 37, 0);
    const noon = arc.find((s) => Math.abs(s.solarHour - 12) < 1e-9)!;
    expect(noon.azimuthDeg).toBeCloseTo(0, 6);
    expect(noon.incidenceDeg).toBeCloseTo(Math.abs(90 - 37 - noon.elevationDeg), 6);
    expect(arc[0]!.azimuthDeg).toBeLessThan(-90); // summer sunrise in the north-east
    expect(arc[0]!.azimuthDeg).toBeCloseTo(-arc[arc.length - 1]!.azimuthDeg, 6);
  });
});

describe('lab-pv §M4 array checks and degradation', () => {
  it('string limits', () => {
    expect(stringVocV(6, -20)).toBeCloseTo(263.0, 1);
    expect(stringVmpV(6, 70)).toBeCloseTo(170.7, 1);
    expect(stringVocV(11, -20)).toBeCloseTo(482.2, 1);
    expect(stringVocV(12, -20)).toBeCloseTo(526.0, 1);
    expect(stringVmpV(5, 70)).toBeCloseTo(142.2, 1);
    expect(checkString({ nSeries: 6 }).severity).toBe('ok');
    expect(checkString({ nSeries: 11 }).warnings).not.toContain('overvoltage');
    expect(checkString({ nSeries: 12 }).warnings).toContain('overvoltage');
    expect(checkString({ nSeries: 12 }).severity).toBe('red');
    expect(checkString({ nSeries: 5 }).warnings).toEqual(['below-start-voltage']);
    expect(checkString({ nSeries: 4 }).warnings).toContain('below-mppt-window-hot');
    expect(checkString({ nSeries: 6, orientations: ['S', 'E'] }).warnings).toEqual(['mixed-orientation']);
  });
  it('two strings in parallel on one MPPT: 26.6 A at MPP, 34.8 A design Isc → red', () => {
    const r = checkString({ nSeries: 6, nParallel: 2 });
    expect(r.impTotalA).toBeCloseTo(26.6, 1);
    expect(r.iscDesignA).toBeCloseTo(34.75, 2);
    expect(r.warnings).toEqual(
      expect.arrayContaining(['short-circuit-current', 'operating-current-clipping']),
    );
    expect(r.severity).toBe('red');
  });
  it('degradation and cumulative energy (TOPCon 25 y → 26 235 kWh, 30 y → 31 147 kWh)', () => {
    expect(relativePower(0)).toBe(1);
    expect(relativePower(1)).toBeCloseTo(0.99, 9);
    expect(relativePower(25)).toBeCloseTo(0.894, 9);
    expect(relativePower(25, 'PERC')).toBeCloseTo(1 - 0.02 - 0.0055 * 24, 9);
    expect(cumulativeEnergyKwh(25)).toBeCloseTo(26235, -1);
    expect(Math.round(cumulativeEnergyKwh(25))).toBe(26235);
    expect(Math.round(cumulativeEnergyKwh(30))).toBe(31147);
    expect(cumulativeEnergyKwh(30, 'PERC')).toBeLessThan(cumulativeEnergyKwh(30));
  });
});

describe('lab-pv §M2 MPPT P&O and global scan (ΔV = 0.5 V)', () => {
  const curveOf = (g: number[]) => new SampledCurve(new PvString({ modules: [g], tcC: 25 }).curve(600));
  it('STC: after 60 steps V_ref ∈ [32.5, 33.6] V and P ≥ 438.7 W', () => {
    const c = curveOf([1000, 1000, 1000]);
    const s = poInit(c);
    expect(s.vRefV).toBeCloseTo(0.8 * 39.4, 1);
    for (let k = 0; k < 60; k++) poIterate(s, c, 0.5);
    expect(s.vRefV).toBeGreaterThanOrEqual(32.5);
    expect(s.vRefV).toBeLessThanOrEqual(33.6);
    expect(s.pW).toBeGreaterThanOrEqual(438.7 - 1.3); // the oscillation visits 438.7 W
    let pMin = Infinity;
    for (let k = 0; k < 6; k++) pMin = Math.min(pMin, poIterate(s, c, 0.5).pW);
    expect(pMin).toBeGreaterThanOrEqual(438.6);
  });
  it('partial shading: P&O stuck near 35.3 V (≈ 242.8 W); scan → 21.3 V, 287.3 W; then 21.4…22.4 V, P ≥ 283.9 W', () => {
    const c = curveOf([1000, 1000, 500]);
    const s = poInit(c);
    for (let k = 0; k < 60; k++) poIterate(s, c, 0.5);
    expect(Math.abs(s.vRefV - 35.3)).toBeLessThan(0.6);
    expect(Math.abs(s.pW - 242.8)).toBeLessThan(1.2);
    const scan = globalScan(c);
    expect(scan.samples).toHaveLength(41);
    expect(scan.best.vV).toBeCloseTo(21.35, 1);
    expect(Math.abs(scan.best.pW - 287.3)).toBeLessThan(0.5);
    const s2 = poInit(c, scan.best.vV);
    let vMin = Infinity;
    let vMax = -Infinity;
    let pMin = Infinity;
    for (let k = 0; k < 60; k++) {
      poIterate(s2, c, 0.5);
      if (k >= 50) {
        vMin = Math.min(vMin, s2.vRefV);
        vMax = Math.max(vMax, s2.vRefV);
        pMin = Math.min(pMin, s2.pW);
      }
    }
    expect(vMin).toBeGreaterThanOrEqual(21.3);
    expect(vMax).toBeLessThanOrEqual(22.4);
    expect(pMin).toBeGreaterThanOrEqual(283.8);
  });
  it('cloud profile 1000 → 300 → 1000 W/m² over 4 s', () => {
    expect(cloudIrradiance(0)).toBe(1000);
    expect(cloudIrradiance(2)).toBe(300);
    expect(cloudIrradiance(1)).toBe(650);
    expect(cloudIrradiance(3)).toBe(650);
    expect(cloudIrradiance(4)).toBe(1000);
  });
  it('time-domain sim: tracks a cloud with η_MPPT > 0.9; bigger ΔV oscillates more; deterministic for dt ≤ 1/30', () => {
    const run = (dv: number, dt: number) => {
      const sim = createMpptSim({ deltaVV: dv, frequencyHz: 20 });
      for (let t = 0; t < 5; t += dt) sim.step(dt);
      sim.startCloud();
      for (let t = 0; t < 5; t += dt) sim.step(dt);
      return sim.state;
    };
    const a = run(0.5, 1 / 30);
    expect(a.etaLast10s).toBeGreaterThan(0.9);
    expect(a.etaLast10s).toBeLessThanOrEqual(1);
    expect(a.gWm2).toBe(1000);
    const b = run(0.5, 1 / 60);
    expect(Math.abs(a.etaLast10s - b.etaLast10s)).toBeLessThan(0.02);
    const sim = createMpptSim({ partialShading: true, frequencyHz: 10 });
    for (let k = 0; k < 300; k++) sim.step(1 / 30);
    expect(sim.state.pW).toBeLessThan(250);
    sim.globalScan();
    for (let k = 0; k < 90; k++) sim.step(1 / 30);
    expect(sim.state.pW).toBeGreaterThan(283);
    sim.reset();
    expect(sim.state.timeS).toBe(0);
  });
  it('uniform string MPP helper', () => {
    expect(new PvString(uniformString(1000, 25, 6)).mpp().pW).toBeCloseTo(6 * 439.9, -1);
  });
});
