import { describe, expect, it } from 'vitest';
import { chpOperatingPoint, MORNING_FULL_MIN, shortfallMWh } from '../chp';
import { clampLiveSteamTempC, steamClass, UNIT_PRESETS, unitEfficiency } from '../efficiency';
import { ccs, flueGasCleaning } from '../fluegas';
import { co2PerMWhHeatKg, co2PerTonneKg, fuelUse, unburntLossPct } from '../fuel';

describe('M1 fuel', () => {
  it.each([
    ['bituminous', 0.4, 360, 123.4, 851],
    ['lignite', 0.4, 900, 308.6, 909],
    ['anthracite', 0.4, 333, 114.3, 885],
    ['bituminous', 0.45, 320, null, 757],
  ] as const)('%s, 1000 MW, η %s → %s t/h, %s wagons, %s g/kWh', (c, eta, tph, wagons, g) => {
    const r = fuelUse(c, 1000, eta);
    expect(Math.round(r.coalTph)).toBe(tph);
    if (wagons !== null) expect(r.wagonsPerDay).toBeCloseTo(wagons, 1);
    expect(Math.round(r.co2GPerKWh)).toBe(g);
  });
  it('2365 kg CO₂ per tonne of bituminous; 364 / 341 / 354 kg per MWh of heat; q4 4,0 / 2,0 / 0,5 %', () => {
    expect(co2PerTonneKg('bituminous')).toBeCloseTo(2365, 6);
    expect((['lignite', 'bituminous', 'anthracite'] as const).map((c) => Math.round(co2PerMWhHeatKg(c)))).toEqual([364, 341, 354]);
    expect([40, 60, 75].map(unburntLossPct)).toEqual([4.0, 2.0, 0.5]);
  });
});

describe('M2 unit efficiency', () => {
  it.each([
    [{ pressureMPa: 17, tempC: 540 }, 0.37],
    [{ pressureMPa: 24, tempC: 540 }, 0.39],
    [{ pressureMPa: 24, tempC: 566 }, 0.41],
    [{ pressureMPa: 27, tempC: 600 }, 0.449],
    [{ pressureMPa: 35, tempC: 700 }, 0.487],
    [{ pressureMPa: 27, tempC: 600, regeneration: false }, 0.389],
    [{ pressureMPa: 27, tempC: 600, reheat: false }, 0.419],
    [{ pressureMPa: 17, tempC: 540, coolingWaterC: 25 }, 0.36],
    [{ pressureMPa: 1, tempC: 300 }, 0.18],
  ])('%j → %s', (p, e) => expect(unitEfficiency(p)).toBeCloseTo(e, 3));
  it('presets: old 200 MW 0,321; 300 MW 0,349; USC 0,449; Pingshan II 0,494', () => {
    expect([UNIT_PRESETS.old200, UNIT_PRESETS.ua300, UNIT_PRESETS.usc1000, UNIT_PRESETS.pingshan].map((p) => +unitEfficiency(p).toFixed(3))).toEqual([
      0.321, 0.349, 0.449, 0.494,
    ]);
  });
  it('step 5 counters: 17 MPa/540 °C → ≈ 920 g/kWh; 27/600 → ≈ 758 g/kWh', () => {
    expect(Math.round(fuelUse('bituminous', 1000, unitEfficiency({ pressureMPa: 17, tempC: 540 })).co2GPerKWh)).toBe(920);
    expect(Math.round(fuelUse('bituminous', 1000, unitEfficiency({ pressureMPa: 27, tempC: 600 })).co2GPerKWh)).toBe(758);
  });
  it('classes and the saturation limit', () => {
    expect(steamClass(17, 540)).toBe('subcritical');
    expect(steamClass(23.5, 540)).toBe('supercritical');
    expect(steamClass(27, 600)).toBe('usc');
    expect(steamClass(35, 700)).toBe('ausc');
    expect(clampLiveSteamTempC(10, 300)).toBeCloseTo(311, 6);
    expect(clampLiveSteamTempC(15, 300)).toBeCloseTo(342.2, 6);
    expect(clampLiveSteamTempC(25, 300)).toBe(300);
  });
});

describe('M3 flue gas, M4 CCS (bituminous, S 1 %, ash 15 %, 1000 MW, η 0,45)', () => {
  const run = (o = {}) => flueGasCleaning({ coal: 'bituminous', netMW: 1000, eta: 0.45, scr: true, esp: true, fgd: true, ...o });
  it('flue gas 2,8·10⁶ Nm³/h; SO₂ 6400 kg/h → 2286 → 68,6 mg/Nm³; dust 38 400 → 13 714 → 13,7 / 6,9; NOx 600 → 90', () => {
    const r = run();
    expect(r.flueGasNm3PerH).toBeCloseTo(2.8e6, -3);
    expect(Math.round(r.so2.rawKgPerH)).toBe(6400);
    expect(Math.round(r.so2.rawMgPerNm3)).toBe(2286);
    expect(r.so2.outMgPerNm3).toBeCloseTo(68.6, 1);
    expect(Math.round(r.dust.rawKgPerH)).toBe(38400);
    expect(Math.round(r.dust.rawMgPerNm3)).toBe(13714);
    expect(run({ fgd: false }).dust.outMgPerNm3).toBeCloseTo(13.7, 1);
    expect(r.dust.outMgPerNm3).toBeCloseTo(6.9, 1);
    expect(r.nox.outMgPerNm3).toBeCloseTo(90, 9);
    expect([r.so2.overLimit, r.dust.overLimit, r.nox.overLimit]).toEqual([false, false, false]);
  });
  it('gypsum ≈ 16,7 t/h, limestone ≈ 10,0 t/h; without cleaning every limit is exceeded', () => {
    const r = run();
    expect(r.gypsumTph).toBeCloseTo(16.7, 1);
    expect(r.limestoneTph).toBeCloseTo(10.0, 1);
    const dirty = run({ scr: false, esp: false, fgd: false });
    expect([dirty.so2.overLimit, dirty.dust.overLimit, dirty.nox.overLimit]).toEqual([true, true, true]);
    expect(dirty.ammoniaKgPerH).toBe(0);
  });
  it('CCS: 757 g/kWh → 750 MW, 75,7 t/h to the stack, 101 g/kWh', () => {
    expect(Math.round(ccs('bituminous', 1000, 0.45, false).stackGPerKWh)).toBe(757);
    const c = ccs('bituminous', 1000, 0.45, true);
    expect(c.netMW).toBe(750);
    expect(c.stackCo2Tph).toBeCloseTo(75.7, 1);
    expect(Math.round(c.stackGPerKWh)).toBe(101);
  });
});

describe('M5 CHP, M6 morning ramp', () => {
  it.each([
    [0, 300, 0.36],
    [300, 250, 0.66],
    [480, 220, 0.84],
  ])('Q = %s → P_el %s MW, ε %s', (q, p, e) => {
    const r = chpOperatingPoint(q);
    expect(r.electricMW).toBeCloseTo(p, 9);
    expect(r.fuelUtilisation).toBeCloseTo(e, 2);
  });
  it('100 % reached at 20,5 min; shortfall vs the 15-min target ramp = 9,0 MWh for a 300 MW unit', () => {
    expect(MORNING_FULL_MIN).toBe(20.5);
    expect(shortfallMWh(20.5)).toBeCloseTo(9.0, 2);
    expect(shortfallMWh(30)).toBeCloseTo(9.0, 2);
  });
});
