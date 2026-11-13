import { describe, expect, it } from 'vitest';
import {
  continentScenario,
  createFrequencyModel,
  futureGridScenario,
  inertiaForInverterShare,
  initialRocofHzPerS,
  islandScenario,
  islandWithBessFcrScenario,
  kineticEnergyMWs,
  sampleAt,
  simulateFrequency,
  ukraineInCeScenario,
  type FrequencyParams,
} from '../frequency';

// Tolerances from grid.md §А: ±0,02 Hz, time ±0,3 s.
const HZ = 0.02;
const S = 0.3;

function run(p: FrequencyParams, deficitMW: number, durationS: number) {
  return simulateFrequency(p, [{ timeS: 0, deltaMW: deficitMW }], durationS, 0.01);
}

describe('frequency model — grid §А control points', () => {
  it('Continent, FCR only, −3000 MW', () => {
    const r = run(continentScenario(), 3000, 120);
    expect(sampleAt(r, 1)).toBeCloseTo(49.951, 2);
    expect(Math.abs(r.final.nadirHz - 49.753)).toBeLessThan(HZ);
    expect(Math.abs(r.final.nadirTimeS - 10.9)).toBeLessThan(S);
    expect(Math.abs(sampleAt(r, 60) - 49.834)).toBeLessThan(HZ);
    // quasi-steady state 50 − 3000/(15 000 + 3000) = 49,833
    expect(Math.abs(sampleAt(r, 120) - (50 - 3000 / 18000))).toBeLessThan(0.005);
  });

  it('Continent, FCR + aFRR, −3000 MW: aFRR takes over, FCR returns to 0', () => {
    const r = run(continentScenario({ afrr: true }), 3000, 600);
    expect(Math.abs(r.final.nadirHz - 49.76)).toBeLessThan(HZ);
    expect(Math.abs(sampleAt(r, 120) - 49.9)).toBeLessThan(HZ);
    expect(Math.abs(sampleAt(r, 300) - 50)).toBeLessThan(HZ);
    expect(r.final.pAfrrMW).toBeCloseTo(3000, 0);
    expect(Math.abs(r.final.pFcrMW)).toBeLessThan(5);
  });

  it('Island H = 4, FCR + UFLS, −1000 MW: only the 1st UFLS stage (750 MW)', () => {
    const r = run(islandScenario(), 1000, 60);
    expect(Math.abs(sampleAt(r, 1) - 49.51)).toBeLessThan(HZ);
    expect(Math.abs(r.final.nadirHz - 48.93)).toBeLessThan(HZ);
    expect(Math.abs(r.final.nadirTimeS - 2.45)).toBeLessThan(S);
    expect(r.final.pShedMW).toBe(750);
    expect(r.final.uflsStagesTripped).toBe(1);
    expect(Math.abs(sampleAt(r, 60) - 49.91)).toBeLessThan(HZ);
  });

  it.each([
    [2, 48.85, 1.3],
    [8, 48.97, 5.1],
  ])('Island H = %s s, −1000 MW → nadir %s Hz at %s s, UFLS 750 MW', (H, nadir, tN) => {
    const r = run(islandScenario({ inertiaH: H }), 1000, 30);
    expect(Math.abs(r.final.nadirHz - nadir)).toBeLessThan(HZ);
    expect(Math.abs(r.final.nadirTimeS - tN)).toBeLessThan(S);
    expect(r.final.pShedMW).toBe(750);
  });

  it('Island H = 4 without UFLS, −1000 MW → blackout at ≈ 8,9 s', () => {
    const r = run(islandScenario({ ufls: false }), 1000, 30);
    expect(r.final.blackout).toBe(true);
    expect(Math.abs(r.final.blackoutTimeS! - 8.9)).toBeLessThan(S);
    expect(r.final.band).toBe('blackout');
  });

  it('Island H = 4, FCR, −400 MW → nadir 49,43 at 6,4 s, no UFLS, f(60) = 49,849', () => {
    const r = run(islandScenario(), 400, 60);
    expect(Math.abs(r.final.nadirHz - 49.43)).toBeLessThan(HZ);
    expect(Math.abs(r.final.nadirTimeS - 6.4)).toBeLessThan(S);
    expect(r.final.pShedMW).toBe(0);
    expect(Math.abs(sampleAt(r, 60) - 49.849)).toBeLessThan(HZ);
  });

  it('Island H = 4, FCR + aFRR + UFLS, −1000 MW → nadir 48,93, f(120) = 50,00', () => {
    const r = run(islandScenario({ afrr: true }), 1000, 120);
    expect(Math.abs(r.final.nadirHz - 48.93)).toBeLessThan(HZ);
    expect(Math.abs(sampleAt(r, 120) - 50)).toBeLessThan(HZ);
  });

  it('Island H = 4, FCR + LFSM-O, load rejection −1000 MW → peak ≈ 50,80 at 2–2,5 s, f(60) ≈ 50,38', () => {
    const r = run(islandScenario({ lfsmO: true }), -1000, 60);
    expect(Math.abs(r.final.peakHz - 50.8)).toBeLessThan(HZ);
    expect(r.final.peakTimeS).toBeGreaterThan(2 - S);
    expect(r.final.peakTimeS).toBeLessThan(2.5 + S);
    expect(Math.abs(sampleAt(r, 60) - 50.38)).toBeLessThan(HZ);
  });

  it('Step 2, no controllers, island H = 4, −500 MW: RoCoF = −0,260 Hz/s (almost linear)', () => {
    expect(initialRocofHzPerS(500, 4, 12000)).toBeCloseTo(-0.2604, 4);
    const m = createFrequencyModel(islandScenario({ fcr: false, ufls: false }));
    m.addEvent(500);
    expect(m.state.rocofAtEventHzPerS).toBeCloseTo(-0.2604, 4);
    m.step(1);
    // almost linear: D·Δf bends the curve slightly (49,749 instead of 49,740)
    expect(Math.abs(m.state.fHz - (50 - 0.26))).toBeLessThan(HZ);
    expect(m.state.fHz).toBeGreaterThan(50 - 0.26);
  });

  it('Continent (CE), FCR, −1000 MW → RoCoF₀ −0,017 Hz/s, nadir 49,92 at 9,5 s, f(60) 49,945', () => {
    const m = createFrequencyModel(continentScenario());
    m.addEvent(1000);
    expect(m.state.rocofAtEventHzPerS).toBeCloseTo(-0.0167, 3);
    const r = run(continentScenario(), 1000, 60);
    expect(Math.abs(r.final.nadirHz - 49.92)).toBeLessThan(HZ);
    expect(Math.abs(r.final.nadirTimeS - 9.5)).toBeLessThan(S);
    expect(Math.abs(sampleAt(r, 60) - 49.945)).toBeLessThan(HZ);
  });

  it('§А.4 Ukraine in CE, −1000 MW → nadir ≈ 49,92 Hz, no UFLS', () => {
    const r = run(ukraineInCeScenario(), 1000, 60);
    expect(Math.abs(r.final.nadirHz - 49.92)).toBeLessThan(HZ);
    expect(r.final.pShedMW).toBe(0);
  });

  it('kinetic energy E_k = H·S (step 3 chips)', () => {
    expect(kineticEnergyMWs(4, 12000)).toBe(48000);
  });
});

describe('frequency model — grid §А.6 «future grid» (FFR law of the grid-forming BESS)', () => {
  it('H(x) = 6·(1 − x) + 0,5', () => {
    expect(inertiaForInverterShare(0.3)).toBeCloseTo(4.7, 9);
    expect(inertiaForInverterShare(0.8)).toBeCloseTo(1.7, 9);
  });

  it.each([
    // x, bess, rocof0, nadir, tNadir (NaN = not given), shed
    [0.3, 0, -0.44, 48.94, Number.NaN, 750],
    [0.3, 800, -0.44, 49.51, Number.NaN, 0],
    [0.8, 0, -1.23, 48.81, 1.1, 750],
    [0.8, 800, -1.23, 49.37, 1.5, 0],
  ])('x = %s, BESS %s MW', (x, bess, rocof0, nadir, tN, shed) => {
    const p = futureGridScenario(x, bess);
    const m = createFrequencyModel(p);
    m.addEvent(1000);
    expect(Math.abs(m.state.rocofAtEventHzPerS - rocof0)).toBeLessThan(0.01);
    const r = run(p, 1000, 30);
    expect(Math.abs(r.final.nadirHz - nadir)).toBeLessThan(HZ);
    if (!Number.isNaN(tN)) expect(Math.abs(r.final.nadirTimeS - tN)).toBeLessThan(S);
    expect(r.final.pShedMW).toBe(shed);
    if (bess > 0) expect(r.final.bessArmed).toBe(true);
  });
});

describe('frequency model — plant-future M4 (BESS as an FCR participant)', () => {
  it.each([
    [4, 0, 48.93, 2.45, 750, 49.93],
    [4, 250, 48.96, 3.5, 750, 49.93],
    [4, 500, 49.13, 8.2, 0, 49.72],
    [4, 750, 49.68, 3.3, 0, 49.84],
    [4, 1000, 49.81, 1.0, 0, 49.87],
    [2, 0, 48.85, 1.3, 750, 49.91],
  ])('H = %s s, P_b,max = %s MW', (H, pb, nadir, tN, shed, f30) => {
    const r = run(islandWithBessFcrScenario(H, pb), 1000, 60);
    expect(Math.abs(r.final.nadirHz - nadir)).toBeLessThan(HZ);
    expect(Math.abs(r.final.nadirTimeS - tN)).toBeLessThan(S);
    expect(r.final.pShedMW).toBe(shed);
    expect(Math.abs(sampleAt(r, 30) - f30)).toBeLessThan(HZ);
  });

  it('RoCoF(0) = −ΔP/M: −0,521 (H 4), −1,042 (H 2), −0,347 (H 6)', () => {
    for (const [H, ro] of [
      [4, -0.521],
      [2, -1.042],
      [6, -0.347],
    ] as const) {
      const m = createFrequencyModel(islandWithBessFcrScenario(H, 0));
      m.addEvent(1000);
      expect(m.state.rocofAtEventHzPerS).toBeCloseTo(ro, 3);
    }
  });
});

describe('frequency model — API invariants', () => {
  it('result does not depend on the frame dt (fixed internal step)', () => {
    const a = createFrequencyModel(islandScenario());
    const b = createFrequencyModel(islandScenario());
    a.addEvent(1000);
    b.addEvent(1000);
    for (let i = 0; i < 300; i++) a.step(1 / 60);
    for (let i = 0; i < 150; i++) b.step(1 / 30);
    expect(a.state.timeS).toBeCloseTo(b.state.timeS, 9);
    expect(a.state.fHz).toBeCloseTo(b.state.fHz, 9);
  });

  it('balance stays at 50 Hz without events; reset returns to the initial state', () => {
    const m = createFrequencyModel(islandScenario({ afrr: true, lfsmO: true }));
    m.step(10);
    expect(m.state.fHz).toBe(50);
    m.addEvent(1000);
    m.step(5);
    expect(m.state.fHz).toBeLessThan(50);
    m.reset();
    expect(m.state.fHz).toBe(50);
    expect(m.state.pShedMW).toBe(0);
    expect(m.state.eventTimeS).toBeNull();
  });

  it('mFRR ramps linearly to R in 750 s and lets aFRR release', () => {
    const m = createFrequencyModel(islandScenario({ afrr: true }));
    m.addEvent(1000);
    m.step(60);
    m.activateMfrr();
    m.step(375);
    expect(m.state.pMfrrMW).toBeCloseTo(500, 0);
    m.step(1200);
    expect(m.state.pMfrrMW).toBeCloseTo(1000, 6);
    // UFLS shed 750 is never restored in the model, so aFRR ends negative: 1000 − 1000 − 750 = −750
    expect(m.state.pAfrrMW).toBeCloseTo(-750, 0);
    expect(Math.abs(m.state.deltaFHz)).toBeLessThan(0.001);
  });

  it('no NaN at range bounds (H 1…8, huge events) and blackout freezes the state', () => {
    for (const H of [1, 8]) {
      const m = createFrequencyModel(islandScenario({ inertiaH: H, ufls: false, fcr: false }));
      m.addEvent(5000);
      for (let i = 0; i < 100; i++) m.step(1 / 30);
      expect(Number.isFinite(m.state.fHz)).toBe(true);
      expect(m.state.blackout).toBe(true);
      const t = m.state.timeS;
      m.step(1);
      expect(m.state.timeS).toBe(t);
    }
  });

  it('frequency band flags', () => {
    const m = createFrequencyModel(continentScenario());
    m.addEvent(3000);
    m.step(1);
    expect(m.state.band).toBe('normal'); // 49,951 → |Δf| < 50 mHz
    m.step(5);
    expect(m.state.band).toBe('emergency');
  });
});
