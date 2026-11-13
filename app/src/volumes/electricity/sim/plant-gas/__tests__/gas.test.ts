import { describe, expect, it } from 'vitest';
import { combinedCycle } from '../combined';
import { directCo2GPerKWh, hydrogenEnergyShare, leakGPerKWh, leakParityWithCoal, totalGPerKWh } from '../emissions';
import { districtOutageShare, engineChp } from '../engines';
import { airFlowKgS, bladeMetalTempC, bladeState, gasTurbine, GT_PRESETS } from '../gasTurbine';
import { ccgtStartFromStandstillH, finishMin, lanePowerPct } from '../startRace';

describe('M1 gas turbine', () => {
  it.each([
    [20, 1600, 0.437, 468.5, 652.0, 496.9, 0.478],
    [10, 1100, 0.3501, 326.8, 517.5, 272.0, 0.535],
    [15, 1300, 0.3966, 406.3, 554.2, 356.3, 0.525],
    [30, 1600, 0.4584, 565.4, 575.4, 476.6, 0.537],
    [20, 1400, 0.4222, 468.5, 553.2, 395.2, 0.536],
  ])('r %s, TIT %s → η %s, t₂ %s, t₄ %s, w_net %s, share %s', (r, tit, eta, t2, t4, w, share) => {
    const g = gasTurbine(r, tit);
    expect(g.eta).toBeCloseTo(eta, 4);
    expect(g.t2C).toBeCloseTo(t2, 1);
    expect(g.t4C).toBeCloseTo(t4, 1);
    expect(g.wNetKJkg).toBeCloseTo(w, 1);
    expect(g.compressorShare).toBeCloseTo(share, 3);
  });
  it('571 MW at r 20 / TIT 1600 → ṁ ≈ 1149 kg/s; flags', () => {
    expect(Math.round(airFlowKgS(571, gasTurbine(20, 1600)))).toBe(1149);
    expect(gasTurbine(20, 1700).beyondMaterials).toBe(true);
    expect(gasTurbine(40, 900).lowWorkWarning).toBe(true);
  });
  it('M2 blade metal: 950 all on, +120 / +200 / +350; creep > 1100, melting > 1300', () => {
    expect(bladeMetalTempC(true, true, true, 1600)).toBe(950);
    expect(bladeMetalTempC(false, true, true, 1600)).toBe(1070);
    expect(bladeMetalTempC(true, false, true, 1600)).toBe(1150);
    expect(bladeMetalTempC(true, true, false, 1600)).toBe(1300);
    expect(bladeState(1150)).toBe('creep');
    expect(bladeState(1301)).toBe('melting');
  });
});

describe('M3 combined cycle', () => {
  const cc = (r: number, tit: number, levels: 1 | 2 | 3 = 3, o = {}) => combinedCycle({ pressureRatio: r, titC: tit, levels, hrsg: true, firingMW: 0, ...o });
  it('r 20, TIT 1600, 3 levels: ε 0,8823, η_ST 0,3698, η_CC 0,6207, fuel 1306,6, ST 240,0, total 811,0 MW', () => {
    const c = cc(20, 1600);
    expect(c.heatRecovery).toBeCloseTo(0.8823, 4);
    expect(c.etaSt).toBeCloseTo(0.3698, 4);
    expect(c.eta).toBeCloseTo(0.6207, 4);
    expect(c.fuelMW).toBeCloseTo(1306.6, 1);
    expect(c.stMW).toBeCloseTo(240.0, 1);
    expect(c.totalMW).toBeCloseTo(811.0, 1);
  });
  it('2 levels ε 0,8352 → 0,6109; 1 level ε 0,7410 → 0,5913; HRSG off 0,4370; firing 100 MW → 270,0 MW, 0,598', () => {
    expect(cc(20, 1600, 2).heatRecovery).toBeCloseTo(0.8352, 4);
    expect(cc(20, 1600, 2).eta).toBeCloseTo(0.6109, 4);
    expect(cc(20, 1600, 1).heatRecovery).toBeCloseTo(0.741, 4);
    expect(cc(20, 1600, 1).eta).toBeCloseTo(0.5913, 4);
    expect(cc(20, 1600, 3, { hrsg: false }).eta).toBeCloseTo(0.437, 4);
    const f = cc(20, 1600, 3, { firingMW: 100 });
    expect(f.stMW).toBeCloseTo(270.0, 1);
    expect(f.eta).toBeCloseTo(0.598, 3);
  });
  it('presets E 0,330/0,540, F 0,349/0,587, H/J 0,364/0,623, aero 0,316/0,573; extremes', () => {
    const v = Object.values(GT_PRESETS).map((p) => cc(p.r, p.titC)).map((c) => [+c.etaSt.toFixed(3), +c.eta.toFixed(3)]);
    expect(v).toEqual([
      [0.33, 0.54],
      [0.349, 0.587],
      [0.364, 0.623],
      [0.316, 0.573],
    ]);
    expect(gasTurbine(40, 900).eta).toBeCloseTo(0.179, 3);
    expect(cc(40, 900).eta).toBeCloseTo(0.294, 3);
    expect(cc(4, 1700).etaSt).toBe(0.4);
    expect(cc(4, 1700).eta).toBeCloseTo(0.54, 3);
  });
});

describe('M4 start race, M5 engines, M6 emissions', () => {
  it('finish: engines 2,5, aero 6, heavy 15, CCGT hot 40 / warm 85 (≈ 1,5 h) / cold 180 min; CCGT = 0,7·GT + 0,3·ST', () => {
    expect([finishMin('gasEngine'), finishMin('aeroGt'), finishMin('heavyGt'), finishMin('ccgt', 'hot'), finishMin('ccgt', 'warm'), finishMin('ccgt', 'cold')]).toEqual([2.5, 6, 15, 40, 85, 180]);
    expect(lanePowerPct('ccgt', 20, 'hot')).toBeCloseTo(70, 9);
    expect(lanePowerPct('heavyGt', 11.5)).toBeCloseTo(50, 9);
    expect([4, 24, 72].map(ccgtStartFromStandstillH)).toEqual(['hot', 'warm', 'cold']);
  });
  it('engine CHP ε 0,45 / 0,66 / 0,87; district outages 5 % vs 100 %', () => {
    expect([0, 0.5, 1].map((u) => +engineChp(u).fuelUtilisation.toFixed(2))).toEqual([0.45, 0.66, 0.87]);
    expect(districtOutageShare('twenty10', 2)).toBeCloseTo(0.1, 9);
    expect(districtOutageShare('single200', 1)).toBe(1);
  });
  it('η 0,60: direct 336,6; leaks 1,5 % +54,5 (GWP₁₀₀) / +150,8 (GWP₂₀); 1 % +36,1; total 431', () => {
    expect(directCo2GPerKWh(0.6)).toBeCloseTo(336.6, 1);
    expect(leakGPerKWh(0.6, 0.015, 'gwp100')).toBeCloseTo(54.5, 1);
    expect(leakGPerKWh(0.6, 0.015, 'gwp20')).toBeCloseTo(150.8, 1);
    expect(leakGPerKWh(0.6, 0.01, 'gwp100')).toBeCloseTo(36.1, 1);
    expect(Math.round(totalGPerKWh(0.6, 0.015, 'gwp100'))).toBe(431);
  });
  it('H₂ blend 0,1145 / 0,2318 / 1; parity with coal at L ≈ 4,3 % (η 0,60, GWP₂₀)', () => {
    expect(hydrogenEnergyShare(0.3)).toBeCloseTo(0.1145, 4);
    expect(hydrogenEnergyShare(0.5)).toBeCloseTo(0.2318, 4);
    expect(hydrogenEnergyShare(1)).toBe(1);
    expect(leakParityWithCoal(0.6, 'gwp20')!).toBeCloseTo(0.043, 3);
  });
});
