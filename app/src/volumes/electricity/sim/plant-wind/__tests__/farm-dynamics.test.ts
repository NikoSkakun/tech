import { describe, expect, it } from 'vitest';
import {
  TURBINE_6MW,
  createTurbineSim,
  drivetrain,
  gustIncrement,
  histogram,
  simulateFarm,
  syntheticYear,
  turbinePowerW,
  wakeDeficit,
} from '..';

const D = 170;

describe('plant-wind M5 single wake (C_T 0.8, on the centre line)', () => {
  const rows = [
    { x: 5, k: 0.075, y: 0, v: 0.819, p: 0.55 },
    { x: 7, k: 0.075, y: 0, v: 0.868, p: 0.655 },
    { x: 10, k: 0.075, y: 0, v: 0.912, p: 0.757 },
    { x: 7, k: 0.04, y: 0, v: 0.773, p: 0.462 },
    { x: 7, k: 0.075, y: 0.5, v: 0.918, p: 0.774 },
    { x: 7, k: 0.075, y: 1.0, v: 0.98, p: 0.942 },
  ];
  for (const r of rows) {
    it(`x ${r.x}D, k ${r.k}, y ${r.y}D`, () => {
      const vr = 1 - wakeDeficit(r.x * D, r.y * D, D, 0.8, r.k);
      expect(vr).toBeCloseTo(r.v, 3);
      expect(vr ** 3).toBeCloseTo(r.p, 2);
    });
  }
  it('no wake upstream', () => expect(wakeDeficit(-100, 0, D, 0.8, 0.075)).toBe(0));
});

describe('plant-wind M5 farm 4 × 4 (v 8 m/s, k 0.075)', () => {
  const rows = [
    { s: 5, off: 0.639, on: 0.679 },
    { s: 7, off: 0.726, on: 0.756 },
    { s: 10, off: 0.809, on: 0.812 },
  ];
  for (const r of rows) {
    it(`s = ${r.s}D: ${r.off} / steering ${r.on}`, () => {
      expect(simulateFarm({ rowSpacingD: r.s }).efficiency).toBeCloseTo(r.off, 3);
      expect(simulateFarm({ rowSpacingD: r.s, steering: true }).efficiency).toBeCloseTo(r.on, 3);
    });
  }
  it('wind 285°, 7D: 0.973 without control, less with it; wind 0° → 0.639', () => {
    const off = simulateFarm({ windFromDeg: 285 }).efficiency;
    expect(off).toBeCloseTo(0.973, 3);
    expect(simulateFarm({ windFromDeg: 285, steering: true }).efficiency).toBeLessThan(off);
    expect(simulateFarm({ windFromDeg: 0 }).efficiency).toBeCloseTo(0.639, 3);
  });
  it('front row unwaked; steered turbines lose 1 − cos³20° ≈ 17 %', () => {
    const f = simulateFarm({ steering: true });
    const front = f.turbines.filter((t) => t.row === 0);
    expect(front.every((t) => t.inflowMs === 8 && t.yawed)).toBe(true);
    expect(front[0]!.powerW / turbinePowerW(TURBINE_6MW, 8)).toBeCloseTo(
      Math.cos((20 * Math.PI) / 180) ** 3,
      9,
    );
    expect(f.turbines.filter((t) => t.row === 3).every((t) => !t.yawed)).toBe(true);
  });
});

describe('plant-wind step 7 gust, storm, pitch; step 6 drivetrains', () => {
  it('gust: +4.24 at 0.5 s, +6.00 at 1 s, +2.21 at 2.5 s', () => {
    expect(gustIncrement(0.5)).toBeCloseTo(4.24, 2);
    expect(gustIncrement(1)).toBeCloseTo(6, 9);
    expect(gustIncrement(2.5)).toBeCloseTo(2.21, 2);
  });
  it('gust at 7 m/s: P never exceeds 6 MW, pitch lags its target', () => {
    const s = createTurbineSim({ vMs: 9 });
    s.gust();
    let pMax = 0;
    let lag = 0;
    for (let k = 0; k < 120; k++) {
      s.step(1 / 30);
      pMax = Math.max(pMax, s.state.powerW);
      lag = Math.max(lag, s.state.pitchTargetDeg - s.state.pitchDeg);
    }
    expect(pMax).toBeLessThanOrEqual(6e6);
    expect(pMax).toBe(6e6);
    expect(lag).toBeGreaterThan(0.5);
  });
  it('storm: hard cut-out → zone IV, feathered, stopped; storm control keeps producing at 28 m/s', () => {
    const s = createTurbineSim({ vMs: 12 });
    s.storm();
    for (let k = 0; k < 300; k++) s.step(1 / 30);
    expect(s.state.vMs).toBeCloseTo(28, 6);
    expect(s.state.zone).toBe('IV');
    expect(s.state.powerW).toBe(0);
    expect(s.state.rpm).toBe(0);
    expect(s.state.pitchDeg).toBeGreaterThan(85);
    s.setStormControl(true);
    s.step(0.1);
    expect(s.state.powerW / 1e6).toBeCloseTo(4.2, 6);
  });
  it('drivetrains: output 50 Hz; direct drive 100 pole pairs at ≈ 7.2 rpm → 12 Hz raw; DFIG converter 30 %', () => {
    const b = drivetrain('B_DIRECT', 8);
    expect(b.rawFrequencyHz).toBeCloseTo((100 * b.rotorRpm) / 60, 9);
    expect(b.outputHz).toBe(50);
    expect(drivetrain('A_DFIG', 8).converterShare).toBe(0.3);
    expect(drivetrain('C_MEDIUM', 2).outputHz).toBe(0);
  });
});

describe('plant-wind M6 synthetic year (deterministic)', () => {
  it('mean equals v̄, same seed → same series, histogram counts 8760 h', () => {
    const a = syntheticYear(7);
    const b = syntheticYear(7);
    const mean = a.speedMs.reduce((s, x) => s + x, 0) / 8760;
    expect(mean).toBeCloseTo(7, 3);
    expect(Array.from(a.speedMs.slice(0, 50))).toEqual(Array.from(b.speedMs.slice(0, 50)));
    expect(histogram(a.speedMs).reduce((s, x) => s + x, 0)).toBe(8760);
    expect(Math.min(...a.speedMs)).toBeGreaterThanOrEqual(0);
  });
});
