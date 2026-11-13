import { describe, expect, it } from 'vitest';
import {
  autoTapSteadyState,
  createOilThermal,
  createTapChanger,
  currentTransformer,
  eddyLossWPerKg,
  frequencyDemoEmfV,
  limbFluxes,
  lowVoltageKV,
  optimumLoad,
  smpsCoreVolume,
  teachingTransformer,
  topOilTemperatureC,
  transformerEfficiency,
  transmission,
  unbalancedVoltages,
  vectorGroup,
} from '../index';

const base = { primaryTurns: 500, secondaryTurns: 50, loadOhm: 2.3, loadConnected: true, supply: 'ac' as const };

describe('Т1 teaching transformer', () => {
  it('500/50, 2,3 Ω → ℰ₂ 23,0 V, I₂ 9,914 A, U₂ 22,80 V, I₁ ≈ 0,9916 A; P₁ > P₂', () => {
    const r = teachingTransformer(base);
    expect(r.secondaryEmfV).toBeCloseTo(23, 9);
    expect(r.secondaryA).toBeCloseTo(9.914, 3);
    expect(r.secondaryV).toBeCloseTo(22.8, 2);
    expect(r.primaryA).toBeCloseTo(0.9916, 4);
    expect(r.inputW).toBeGreaterThan(r.outputW);
    expect(r.overload).toBe(false);
  });
  it('N₂ = 1000 open → 460 V, I₁ = I_m = 0,02 A; N₁ = 300 open → b 1,667, I_m 0,469 A, saturated', () => {
    const a = teachingTransformer({ ...base, secondaryTurns: 1000, loadConnected: false });
    expect(a.secondaryV).toBeCloseTo(460, 9);
    expect(a.primaryA).toBeCloseTo(0.02, 12);
    const b = teachingTransformer({ ...base, primaryTurns: 300, loadConnected: false });
    expect(b.fluxRelative).toBeCloseTo(1.667, 3);
    expect(b.magnetisingA).toBeCloseTo(0.469, 3);
    expect(b.saturated).toBe(true);
    expect(teachingTransformer({ ...base, primaryTurns: 450 }).saturated).toBe(false);
    expect(teachingTransformer({ ...base, primaryTurns: 400 }).saturated).toBe(true);
  });
  it('500/100, 2,3 Ω → I₂ 19,83 A, I₁ 3,97 A > 3 A → protection opens the load', () => {
    const r = teachingTransformer({ ...base, secondaryTurns: 100 });
    expect(r.tripped).toBe(true);
    expect(r.secondaryA).toBe(0);
    expect(r.secondaryV).toBeCloseTo(46, 9);
    const loaded = teachingTransformer({ ...base, secondaryTurns: 100, loadOhm: 4 });
    expect(loaded.overload).toBe(true);
    expect(loaded.tripped).toBe(false);
  });
  it('DC → U₂ = 0, I₁ = 115 A; frequency demo ℰ₂ ∝ f/50', () => {
    const r = teachingTransformer({ ...base, supply: 'dc' });
    expect(r.secondaryV).toBe(0);
    expect(r.primaryA).toBe(115);
    expect(r.dcOverheat).toBe(true);
    expect(frequencyDemoEmfV(25, 23)).toBeCloseTo(11.5, 12);
    expect(frequencyDemoEmfV(0, 23)).toBe(0);
  });
});

describe('Т2 transmission', () => {
  it.each([
    [110, 524.9, 8.264],
    [220, 262.4, 2.066],
    [330, 175.0, 0.918],
    [500, 115.5, 0.4],
    [750, 77.0, 0.178],
  ])('100 MW at %d kV → %f A, %f MW', (kv, i, loss) => {
    const r = transmission(100, kv);
    expect(r.currentA).toBeCloseTo(i, 0);
    expect(r.lossW / 1e6).toBeCloseTo(loss, 3);
    expect(r.impossible).toBe(false);
  });
  it('110 kV ΔU 8,26 %; 35 kV 81,6 % and 10 kV 1000 % → impossible; wire temperature 70 °C at 110 kV', () => {
    expect(transmission(100, 110).dropFraction * 100).toBeCloseTo(8.26, 2);
    expect(transmission(100, 35)).toMatchObject({ impossible: true });
    expect(transmission(100, 35).dropFraction * 100).toBeCloseTo(81.6, 1);
    expect(transmission(100, 10).dropFraction * 100).toBeCloseTo(1000, 6);
    expect(transmission(100, 110).wireTemperatureC).toBe(70);
    expect(transmission(100, 750).wireTemperatureC).toBeLessThan(22);
  });
});

describe('Т3 oil temperature', () => {
  it('β 0 → 33,1; 0,6 → 49,9; 1 → 75,0 (61,25 with fans); 1,2 → 90,6 (73,0 with fans)', () => {
    expect(topOilTemperatureC(0, false)).toBeCloseTo(33.1, 1);
    expect(topOilTemperatureC(0.6, false)).toBeCloseTo(49.9, 1);
    expect(topOilTemperatureC(1, false)).toBeCloseTo(75, 9);
    expect(topOilTemperatureC(1, true)).toBeCloseTo(61.25, 9);
    expect(topOilTemperatureC(1.2, false)).toBeCloseTo(90.6, 1);
    expect(topOilTemperatureC(1.2, true)).toBeCloseTo(73.0, 1);
  });
  it('fans on above β ≈ 0,93, off below ≈ 0,857 (hysteresis); thermometer τ = 3 s', () => {
    const m = createOilThermal(0.9);
    expect(m.state.fansOn).toBe(false);
    m.setLoad(0.95);
    expect(m.state.fansOn).toBe(true);
    m.setLoad(0.9);
    expect(m.state.fansOn).toBe(true);
    m.setLoad(0.85);
    expect(m.state.fansOn).toBe(false);
    const t = createOilThermal(0);
    t.setLoad(0.6);
    t.step(3);
    expect(t.state.thermometerC).toBeCloseTo(49.89 + (33.12 - 49.89) * Math.exp(-1), 1);
  });
});

describe('Т4 tap changer', () => {
  it.each([
    [115, 0, 11.0, -3, 10.413],
    [115, 1, 10.475, 0, 10.475],
    [105, 1, 9.518, 5, 10.412],
    [121, 0.2, 11.469, -5, 10.439],
    [100, 1, 9.04, 8, 10.402],
  ])('U_HV %d kV, β %f → no OLTC %f kV; auto n = %d, %f kV', (hv, beta, raw, tap, lv) => {
    expect(lowVoltageKV(hv, beta, 0)).toBeCloseTo(raw, 3);
    const s = autoTapSteadyState(hv, beta);
    expect(s.tap).toBe(tap);
    expect(s.lvKV).toBeCloseTo(lv, 3);
  });
  it('time-domain regulator steps once per 1,5 s and reaches the same tap', () => {
    const t = createTapChanger();
    let changes = 0;
    for (let i = 0; i < 30; i++) if (t.step(1 / 30, { hvKV: 115, loadPu: 0, auto: true }).changed) changes++;
    expect(changes).toBe(1);
    for (let i = 0; i < 300; i++) t.step(1 / 30, { hvKV: 115, loadPu: 0, auto: true });
    expect(t.state.tap).toBe(-3);
    expect(t.state.inBand).toBe(true);
    t.manual(1, { hvKV: 115, loadPu: 0 });
    expect(t.state.tap).toBe(-2);
  });
});

describe('Т5 losses, Т6 groups, types', () => {
  it('old: 98,71 / 98,82 / 98,34 %, optimum 0,405 → 98,84 %, 7884 kWh; modern: 99,38 / 99,37 / 99,05 %, 0,345 → 99,41 %, 3390 kWh', () => {
    const e = (g: 'old' | 'modern', b: number): number => transformerEfficiency(g, b).efficiency * 100;
    expect(e('old', 0.25)).toBeCloseTo(98.71, 2);
    expect(e('old', 0.5)).toBeCloseTo(98.82, 2);
    expect(e('old', 1)).toBeCloseTo(98.34, 2);
    expect(optimumLoad('old').loadPu).toBeCloseTo(0.405, 3);
    expect(optimumLoad('old').efficiency * 100).toBeCloseTo(98.84, 2);
    expect(optimumLoad('old').annualNoLoadKWh).toBeCloseTo(7884, 6);
    expect(e('modern', 0.25)).toBeCloseTo(99.38, 2);
    expect(e('modern', 0.5)).toBeCloseTo(99.37, 2);
    expect(e('modern', 1)).toBeCloseTo(99.05, 2);
    expect(optimumLoad('modern').loadPu).toBeCloseTo(0.345, 3);
    expect(optimumLoad('modern').efficiency * 100).toBeCloseTo(99.41, 2);
    expect(optimumLoad('modern').annualNoLoadKWh).toBeCloseTo(3390, 0);
  });
  it('eddy losses 0,23 → 0,171; 0,27 → 0,236; 0,35 → 0,396; 1 → 3,23; 3 mm → 29,1 W/kg (estimate)', () => {
    expect(eddyLossWPerKg(0.23).wPerKg).toBeCloseTo(0.171, 3);
    expect(eddyLossWPerKg(0.27).wPerKg).toBeCloseTo(0.236, 3);
    expect(eddyLossWPerKg(0.35).wPerKg).toBeCloseTo(0.396, 3);
    expect(eddyLossWPerKg(1).wPerKg).toBeCloseTo(3.23, 2);
    expect(eddyLossWPerKg(3)).toMatchObject({ estimateOnly: true });
    expect(eddyLossWPerKg(3).wPerKg).toBeCloseTo(29.1, 1);
  });
  it('vector groups Yy0, Yd11, Dy11, Dyn11, Dd0, Yyn0; unbalance Dyn11 223,1/233,5 V, Yyn0 209,3/240,4 V', () => {
    expect(vectorGroup('Y', 'y').label).toBe('Yy0');
    expect(vectorGroup('Y', 'd').label).toBe('Yd11');
    expect(vectorGroup('D', 'y').label).toBe('Dy11');
    expect(vectorGroup('D', 'yn')).toMatchObject({ label: 'Dyn11', lvLeadDeg: 30, lvAngleCwDeg: 330 });
    expect(vectorGroup('D', 'd').label).toBe('Dd0');
    expect(vectorGroup('Y', 'yn').label).toBe('Yyn0');
    const d = unbalancedVoltages('D', 'yn', 1)!;
    expect(d[0]).toBeCloseTo(223.1, 1);
    expect(d[1]).toBeCloseTo(233.45, 2);
    const y = unbalancedVoltages('Y', 'yn', 1)!;
    expect(y[0]).toBeCloseTo(209.3, 1);
    expect(y[1]).toBeCloseTo(240.35, 2);
    expect(unbalancedVoltages('Y', 'd', 1)).toBeNull();
    const f = limbFluxes(0.0031);
    expect(f[0] + f[1] + f[2]).toBeCloseTo(0, 12);
  });
  it('CT 1000/1; SMPS 1 kHz → 26 cm³, 10 kHz → 4,7, 18 kHz → 3,0 (min 3 from 18,2 kHz)', () => {
    expect(currentTransformer(800, false).secondaryA).toBeCloseTo(0.8, 12);
    expect(currentTransformer(800, true)).toEqual({ secondaryA: 0, danger: true });
    expect(smpsCoreVolume(50).volumeCm3).toBe(250);
    expect(smpsCoreVolume(1000).volumeCm3).toBeCloseTo(26.4, 1);
    expect(smpsCoreVolume(1000).material).toBe('steel');
    expect(smpsCoreVolume(10000).volumeCm3).toBeCloseTo(4.7, 1);
    expect(smpsCoreVolume(18000).volumeCm3).toBeCloseTo(3.02, 2);
    expect(smpsCoreVolume(18300)).toMatchObject({ volumeCm3: 3, atMinimum: true, material: 'ferrite' });
  });
});
