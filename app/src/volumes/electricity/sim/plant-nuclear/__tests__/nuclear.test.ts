import { describe, expect, it } from 'vitest';
import { feedPerProduct } from '../enrichment';
import { FISSION_TOTAL_MEV, kEff, kInfFast, kInfModerated, neutronGenerations, promptGrowthPerSecond, promptOnlyPower } from '../fission';
import { createReactor, decayHeatFraction, delayedStepResponse } from '../kinetics';
import { createPressurizer, subcoolingMarginC } from '../pressurizer';

const runTo = (r: ReturnType<typeof createReactor>, t: number) => {
  while (r.state.timeS < t - 1e-9) r.step(1 / 30);
};
const pcm = (rho: number) => Math.round(rho * 1e5);

describe('M1, M2 fission and k_eff', () => {
  it('energy split totals 202,6 MeV', () => expect(FISSION_TOTAL_MEV).toBeCloseTo(202.6, 9));
  it('k∞ and k_eff control points', () => {
    expect(kInfModerated(4.5)).toBeCloseTo(1.2851, 4);
    expect(kEff(4.5, true, 0.66, 'large')).toBeCloseTo(0.9997, 4);
    expect(kInfFast(4.5)).toBeCloseTo(0.5308, 4);
    expect(kEff(4.5, false, 0, 'large')).toBeCloseTo(0.515, 3);
    expect(kInfModerated(0.711)).toBeCloseTo(0.9488, 4);
    expect(kEff(0.711, true, 0, 'large')).toBeCloseTo(0.9204, 4);
    expect(kInfFast(90)).toBeCloseTo(1.9714, 4);
    expect(kEff(90, false, 0, 'large')).toBeCloseTo(1.912, 3);
  });
  it('stochastic generations are deterministic per seed', () => {
    expect(neutronGenerations(1.0, 10, 5)).toEqual(neutronGenerations(1.0, 10, 5));
    expect(neutronGenerations(0.5, 30, 5).at(-1)).toBe(0);
  });
  it('step 4: without delayed neutrons ×148 (+50 pcm) and ×22 000 (+100 pcm) per second; chart capped at 10³', () => {
    expect(Math.round(promptGrowthPerSecond(50))).toBe(148);
    expect(promptGrowthPerSecond(100)).toBeCloseTo(22026, 0);
    expect(promptOnlyPower(100, 1)).toBe(1000);
    // with delayed neutrons: prompt jump β/(β−ρ) = 1,083 and a 150 s period
    expect(delayedStepResponse(50, 0)).toBeCloseTo(1.0833, 4);
    expect(delayedStepResponse(50, 150) / delayedStepResponse(50, 0)).toBeCloseTo(Math.E, 9);
  });
});

describe('M3 point kinetics + heat balance', () => {
  it('L 1 → 0,8 at h 0,70: (10 s) 0,884 / 2651 / 306,85 / −55; (30 s) 0,812 / 2436 / 306,18 / −35; (120 s) 0,800 / 2400 / 305,00', () => {
    const r = createReactor();
    r.set({ load: 0.8 });
    runTo(r, 10);
    expect([+r.state.n.toFixed(3), Math.round(r.state.thermalMW), +r.state.tempC.toFixed(2), pcm(r.state.reactivity)]).toEqual([0.884, 2651, 306.85, -55]);
    runTo(r, 30);
    expect([+r.state.n.toFixed(3), Math.round(r.state.thermalMW), +r.state.tempC.toFixed(2), pcm(r.state.reactivity)]).toEqual([0.812, 2436, 306.18, -35]);
    runTo(r, 120);
    expect([+r.state.n.toFixed(3), Math.round(r.state.thermalMW), +r.state.tempC.toFixed(2)]).toEqual([0.8, 2400, 305]);
  });
  it('h 0,70 → 0,75: (5 s) 1,023 / 3068 / 305,10 / +12; (120 s) 1,017 / 3050 / 305,50; h → 0,60: 0,967 / 2900 / 304,00', () => {
    const r = createReactor();
    r.set({ rodTarget: 0.75 });
    runTo(r, 5);
    expect([+r.state.n.toFixed(3), Math.round(r.state.thermalMW), +r.state.tempC.toFixed(2), pcm(r.state.reactivity)]).toEqual([1.023, 3068, 305.1, 12]);
    runTo(r, 120);
    expect([+r.state.n.toFixed(3), Math.round(r.state.thermalMW), +r.state.tempC.toFixed(2)]).toEqual([1.017, 3050, 305.5]);
    const d = createReactor();
    d.set({ rodTarget: 0.6 });
    runTo(d, 120);
    expect([+d.state.n.toFixed(3), Math.round(d.state.thermalMW), +d.state.tempC.toFixed(2)]).toEqual([0.967, 2900, 304]);
  });
  it('h → 1,00: (10 s) 1,045 / 3134 / 305,37 / +19; automatic scram at ≈ 16,2 s (n > 1,07)', () => {
    const r = createReactor();
    r.set({ rodTarget: 1 });
    runTo(r, 10);
    expect([+r.state.n.toFixed(3), Math.round(r.state.thermalMW), +r.state.tempC.toFixed(2), pcm(r.state.reactivity)]).toEqual([1.045, 3134, 305.37, 19]);
    runTo(r, 20);
    expect(r.state.scramReason).toBe('power');
    expect(Math.abs(r.state.scramTimeS! - 16.2)).toBeLessThan(0.1);
  });
  it('scram at t = 0: 0,115 / 505 / −5000; 10 s 270; 60 s 81; 600 s 46 MW; cooling lost from 600 s → 322,3 °C at 1200 s, 351,1 °C at 2400 s', () => {
    const r = createReactor();
    r.scram();
    expect([+r.state.n.toFixed(3), Math.round(r.state.thermalMW), pcm(r.state.reactivity)]).toEqual([0.115, 505, -5000]);
    runTo(r, 10);
    expect([Math.round(r.state.thermalMW), +r.state.tempC.toFixed(1), pcm(r.state.reactivity)]).toEqual([270, 306.7, -5052]);
    runTo(r, 60);
    expect([Math.round(r.state.thermalMW), +r.state.tempC.toFixed(1), pcm(r.state.reactivity)]).toEqual([81, 306.0, -5031]);
    runTo(r, 600);
    expect([Math.round(r.state.thermalMW), +r.state.tempC.toFixed(1)]).toEqual([46, 305.5]);
    r.loseCooling();
    runTo(r, 1200);
    expect([Math.round(r.state.thermalMW), +r.state.tempC.toFixed(1)]).toEqual([39, 322.3]);
    runTo(r, 2400);
    expect([Math.round(r.state.thermalMW), +r.state.tempC.toFixed(1)]).toEqual([33, 351.1]);
    expect(r.state.alarm).toBe('boiling');
  });
  it('diesels restore cooling after 15 s; accumulators add 50 MW once; T capped at 374 °C', () => {
    const r = createReactor();
    r.scram();
    r.loseCooling();
    runTo(r, 3000);
    const t0 = r.state.tempC;
    r.startDiesels();
    runTo(r, 3014);
    expect(r.state.coolingLost).toBe(true);
    runTo(r, 3100);
    expect(r.state.coolingLost).toBe(false);
    expect(r.state.tempC).toBeLessThan(t0);
    const c = createReactor();
    c.scram();
    c.loseCooling();
    runTo(c, 20000);
    expect(c.state.tempC).toBe(374);
    expect(c.state.alarm).toBe('uncovering');
  });
});

describe('M4 subcooling margin, M5 decay heat, M6 enrichment', () => {
  it('margin: 15,7 MPa +25,8; 12 MPa +4,7; 11 MPa ≈ −2,1 °C; heaters raise the pressure 0,02 MPa/s', () => {
    expect(subcoolingMarginC(15.7)).toBeCloseTo(25.8, 6);
    expect(subcoolingMarginC(12)).toBeCloseTo(4.7, 6);
    expect(subcoolingMarginC(11)).toBeCloseTo(-2.15, 2);
    const pz = createPressurizer(12);
    pz.setMode('heaters');
    pz.step(10);
    expect(pz.pressureMPa).toBeCloseTo(12.2, 9);
  });
  it.each([
    [1, 6.02],
    [10, 3.73],
    [60, 2.55],
    [600, 1.53],
    [3600, 1.01],
    [86400, 0.444],
    [604800, 0.238],
    [2592000, 0.131],
    [3.15e7, 0.026],
  ])('D(%s s) = %s %%', (t, pct) => expect(decayHeatFraction(t) * 100).toBeCloseTo(pct, pct < 0.1 ? 3 : pct < 1 ? 3 : 2));
  it.each([
    [4.5, 0.25, 9.22],
    [3.0, 0.25, 5.97],
    [5.0, 0.2, 9.39],
    [5.0, 0.3, 11.44],
  ])('x_P %s, x_T %s → %s', (p, t, f) => expect(feedPerProduct(p, t)).toBeCloseTo(f, 2));
});
