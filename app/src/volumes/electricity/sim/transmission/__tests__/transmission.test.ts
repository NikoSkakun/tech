import { describe, expect, it } from 'vitest';
import { compareAcDc, OVERHEAD_LOSS_EQUAL_KM } from '../acdc';
import { lineCurrentKA, runAutoReclose } from '../autoReclose';
import { chargingCurrent } from '../cable';
import { solveLosslessLine, voltageProfile } from '../line';
import { solveSag, SPAN_LENGTH0_M } from '../sag';
import { IN_REPAIR, IN_SERVICE, isInRepair, isInService, operate, type Apparatus } from '../switching';
import { naturalPowerMW, plantExitCurrents, VOLTAGE_CLASSES } from '../towers';

const ur = (l: number, p: number, reactor = false) => solveLosslessLine({ lengthKm: l, loadPu: p, reactor });

describe('ЛЕП-1 lossless line', () => {
  it.each([
    [400, 0, false, 1.0952],
    [400, 0.5, false, 1.0753],
    [400, 1, false, 1.0],
    [400, 1.2, false, 0.9322],
    [400, 0, true, 1.0],
    [400, 1, true, 0.8885],
    [200, 0, false, 1.0225],
    [600, 0, false, 1.2376],
    [600, 1, false, 1.0],
    [100, 0, false, 1.0055],
    [700, 0, false, 1.348],
  ])('l = %s km, p = %s, reactor %s → U_r = %s', (l, p, r, u) => {
    expect(ur(l, p, r).receivingPu!).toBeCloseTo(u, 4);
  });
  it('P_max: 400 km 1,343 (1,226 with reactor), 600 km 1,050 (0,849 with reactor); collapse beyond', () => {
    expect(ur(400, 0).maxPowerPu).toBeCloseTo(1.343, 3);
    expect(ur(400, 0, true).maxPowerPu).toBeCloseTo(1.226, 3);
    expect(ur(400, 0, true).reactorPu).toBeCloseTo(0.2131, 4);
    expect(ur(600, 0).maxPowerPu).toBeCloseTo(1.05, 3);
    expect(ur(600, 0, true).maxPowerPu).toBeCloseTo(0.849, 3);
    expect(ur(400, 1.5).collapse).toBe(true);
    expect(ur(600, 1, true).collapse).toBe(true);
    expect(voltageProfile({ lengthKm: 600, loadPu: 1, reactor: true })).toEqual([]);
  });
  it('profile starts at U_s = 1 and ends at U_r; P = p·2250 MW', () => {
    const prof = voltageProfile({ lengthKm: 400, loadPu: 0.2, reactor: false });
    expect(prof[0]!.uPu).toBeCloseTo(1, 9);
    expect(prof.at(-1)!.uPu).toBeCloseTo(ur(400, 0.2).receivingPu!, 9);
    expect(ur(400, 0.2).powerMW).toBeCloseTo(450, 9);
  });
});

describe('ЛЕП-2 sag and heating', () => {
  it('L₀ = 300,4356 m', () => expect(SPAN_LENGTH0_M).toBeCloseTo(300.4356, 4));
  it.each([
    [15, 0, false, 15, 7.0],
    [25, 710, false, 70, 9.18],
    [35, 710, false, 80, 9.53],
    [35, 710, true, 60, 8.83],
    [35, 900, false, 107.3, 10.41],
    [-10, 710, false, 35, 7.86],
    [25, 355, false, 36.25, 7.91],
    [-20, 0, false, -20, 5.15],
  ])('(%s °C, %s A, wind %s) → %s °C, %s m', (air, i, wind, theta, sag) => {
    const r = solveSag({ airTempC: air, currentA: i, wind, overgrown: false });
    expect(r.conductorTempC).toBeCloseTo(theta, 1);
    expect(r.sagM).toBeCloseTo(sag, 2);
  });
  it('35 °C, 710 A: safe on a cleared corridor, violation when overgrown; 900 A violates', () => {
    expect(solveSag({ airTempC: 35, currentA: 710, wind: false, overgrown: false }).violation).toBe(false);
    expect(solveSag({ airTempC: 35, currentA: 710, wind: false, overgrown: true }).violation).toBe(true);
    expect(solveSag({ airTempC: 25, currentA: 710, wind: false, overgrown: true }).violation).toBe(false);
    expect(solveSag({ airTempC: 35, currentA: 900, wind: false, overgrown: false }).violation).toBe(true);
  });
});

describe('ЛЕП-3 cable charging current', () => {
  it.each([
    [10, 79.8, 996.8],
    [50, 399.0, 916.9],
    [100, 798.1, 602.6],
    [125, 997.6, 69.4],
  ])('cable %s km → %s / %s A', (l, ic, ip) => {
    const r = chargingCurrent(l, 'cable');
    expect(r.chargingA).toBeCloseTo(ic, 1);
    expect(r.usefulA).toBeCloseTo(ip, 1);
  });
  it('l_crit 125,3 km (cable), ≈ 2784 km (overhead), doubled with reactors at both ends; DC has none', () => {
    expect(chargingCurrent(0, 'cable').criticalLengthKm).toBeCloseTo(125.3, 1);
    expect(Math.round(chargingCurrent(0, 'overhead').criticalLengthKm)).toBe(2784);
    expect(chargingCurrent(0, 'cable', false, true).criticalLengthKm).toBeCloseTo(250.6, 1);
    expect(chargingCurrent(150, 'cable', true).usefulA).toBe(1000);
    expect(chargingCurrent(130, 'cable').exhausted).toBe(true);
  });
});

describe('ЛЕП-4 AC vs DC (illustrative)', () => {
  it('overhead 1000 km: cost 6,0 / 5,0; losses 6,0 % / 4,9 %; 300 km: 2,5 / 4,3; 1,8 % / 2,45 %', () => {
    const a = compareAcDc(1000, 'overhead');
    expect([a.costAc, a.costDc, a.lossAcPct, a.lossDcPct].map((x) => +x!.toFixed(2))).toEqual([6, 5, 6, 4.9]);
    const b = compareAcDc(300, 'overhead');
    expect([b.costAc, b.costDc, b.lossAcPct, b.lossDcPct].map((x) => +x!.toFixed(2))).toEqual([2.5, 4.3, 1.8, 2.45]);
    expect(OVERHEAD_LOSS_EQUAL_KM).toBeCloseTo(560, 9);
  });
  it('cable 100 km: 7,0 / 6,0, DC loss 1,7 %; AC impossible beyond 125 km', () => {
    const c = compareAcDc(100, 'cable');
    expect([c.costAc, c.costDc, c.lossDcPct]).toEqual([7, 6, 1.7]);
    expect(c.lossAcPct).toBeNull();
    expect(c.acImpossible).toBe(false);
    expect(compareAcDc(126, 'cable').acImpossible).toBe(true);
  });
});

describe('ЛЕП-5 protection and auto-reclose', () => {
  it('temporary fault: success for t_AR ≥ 0,3 s, lockout below', () => {
    expect(runAutoReclose('temporary', 0.8).inService).toBe(true);
    expect(runAutoReclose('temporary', 0.3).inService).toBe(true);
    const r = runAutoReclose('temporary', 0.2);
    expect(r.inService).toBe(false);
    expect(r.events.at(-1)).toEqual({ timeS: 0.07 + 0.2 + 0.07, kind: 'lockout' });
  });
  it('permanent fault: lockout 70 ms after reclosing; ammeter 10 kA during the fault, 0 after opening', () => {
    const r = runAutoReclose('permanent', 0.8);
    expect(r.inService).toBe(false);
    expect(r.events.map((e) => e.kind)).toEqual(['fault', 'relay', 'open', 'reclose', 'refault', 'lockout']);
    expect(lineCurrentKA(r, 0.05)).toBe(10);
    expect(lineCurrentKA(r, 0.5)).toBe(0);
  });
  it('lightning into a phase: 1,5 MV breaks down the transformer without arrester, 750 kV with', () => {
    expect(runAutoReclose('lightningPhase', 0.8, false).transformerDamaged).toBe(true);
    expect(runAutoReclose('lightningPhase', 0.8, true)).toMatchObject({ transformerDamaged: false, surgeKV: 750 });
    expect(runAutoReclose('lightningShield').inService).toBe(true);
  });
});

describe('step 1, step 2 and step 8 helpers', () => {
  it('1000 MW → 26,7 kA / 855 A; 500 MW → 13,4 kA / 428 A', () => {
    const a = plantExitCurrents(1000);
    expect(a.generatorKA).toBeCloseTo(26.7, 1);
    expect(Math.round(a.lineA)).toBe(855);
    const b = plantExitCurrents(500);
    expect(b.generatorKA).toBeCloseTo(13.4, 1);
    expect(Math.round(b.lineA)).toBe(428);
  });
  it('natural power chips: 110 ≈ 30, 220 ≈ 127, 330 ≈ 363, 400 ≈ 552, 500 ≈ 893, 750 ≈ 2250 MW', () => {
    const chips = VOLTAGE_CLASSES.filter((c) => c.zcOhm !== null).map((c) => Math.round(naturalPowerMW(c.kV, c.zcOhm!)));
    expect(chips).toEqual([30, 56, 127, 363, 552, 893, 2250]);
  });
  it('switching: correct sequences succeed; interlocking blocks, otherwise faults reset the game', () => {
    let s = IN_SERVICE;
    for (const a of ['breaker', 'lineDisconnector', 'busDisconnector', 'earthing'] as Apparatus[]) {
      const r = operate(s, a, true);
      expect(r.outcome).toBe('ok');
      s = r.state;
    }
    expect(isInRepair(s)).toBe(true);
    for (const a of ['earthing', 'busDisconnector', 'lineDisconnector', 'breaker'] as Apparatus[]) s = operate(s, a, true).state;
    expect(isInService(s)).toBe(true);
    expect(operate(IN_SERVICE, 'lineDisconnector', true).outcome).toBe('blocked');
    expect(operate(IN_SERVICE, 'lineDisconnector', false)).toEqual({ state: IN_SERVICE, outcome: 'arcOnDisconnector' });
    expect(operate(IN_REPAIR, 'busDisconnector', false).outcome).toBe('closeOntoEarth');
  });
});
