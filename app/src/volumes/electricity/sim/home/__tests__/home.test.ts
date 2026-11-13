import { describe, expect, it } from 'vitest';
import { applianceCurrentA, createHousePanel, groupCurrents, monthlyBill, useCost } from '../appliances';
import { autonomy } from '../backup';
import { cableSteady, createCableCircuit } from '../cable';
import { driftVelocityRmsMps, energyChain, linkCurrentA, oscillationAmplitudeM, plantOutputPerKettleKWh, signalDelayS } from '../finale';
import { lightingCost, resistivePowerRatio } from '../lighting';
import { shockScenario, rcdTest } from '../shock';
import { smpsOperatingPoint, transformerSize } from '../smps';
import { shortCircuitCurrentA } from '../index';

describe('§Б cable heating', () => {
  it('2,5 Cu B1: 16 A → 47,8 °C, 24 A → 70,0 °C; 2,5 Al B1 16 A → 59,9 °C; 1,5 Cu B1 24 A → 105,2 °C, C25 does not trip', () => {
    expect(cableSteady('cu2.5', 'B1', 16, 16, false).steadyC).toBeCloseTo(47.8, 1);
    expect(cableSteady('cu2.5', 'B1', 16, 24, false).steadyC).toBeCloseTo(70.0, 1);
    expect(cableSteady('al2.5', 'B1', 16, 16, false).steadyC).toBeCloseTo(59.9, 1);
    const r = cableSteady('cu1.5', 'B1', 25, 24, false);
    expect(r.steadyC).toBeCloseTo(105.2, 1);
    expect(r.breakerTripS).toBe(Infinity);
    expect(r.oversizedBreaker).toBe(true);
    expect(r.state).toBe('softening');
  });
  it('1,5 Cu + C10 + 24 A → thermal trip after 41,7 s; bad joint at 16 A → 12,8 W, +51 °C', () => {
    expect(cableSteady('cu1.5', 'B1', 10, 24, false).breakerTripS).toBeCloseTo(41.7, 1);
    const j = cableSteady('cu2.5', 'B1', 16, 16, true);
    expect(j.jointLossW).toBeCloseTo(12.8, 9);
    expect(j.hotSpotC - j.steadyC).toBeCloseTo(51.2, 9);
  });
  it('time domain: the breaker opens and the cable cools', () => {
    const c = createCableCircuit('cu1.5', 'B1', 10);
    for (let i = 0; i < 60; i++) c.step(1, 24);
    expect(c.breaker.closed).toBe(false);
    expect(c.breaker.tripTimeS!).toBeCloseTo(41.7, 1);
    expect(c.tempC).toBeLessThan(105);
  });
});

describe('§В fault to the enclosure and RCD', () => {
  const base = { peConnected: true, person: 'none' as const, rcdA: null, backgroundA: 0 };
  it('PE connected: I_f 396,6 A, U_t 55,5 V, C16 in 0,01 s', () => {
    const r = shockScenario(base);
    expect(r.faultCurrentA).toBeCloseTo(396.6, 1);
    expect(r.touchVoltageV).toBeCloseTo(55.5, 1);
    expect(r.clearedBy).toBe('mcb');
    expect(r.clearTimeS).toBe(0.01);
  });
  it('PE broken, wet barefoot: 191,7 mA; RCD 30 mA → 25 ms, AC-3; no RCD → AC-4; RCD 300 mA → AC-4 at ≈ 0,23 s', () => {
    const p = { ...base, peConnected: false, person: 'wetBarefoot' as const };
    const a = shockScenario({ ...p, rcdA: 0.03 });
    expect(a.bodyCurrentA * 1000).toBeCloseTo(191.7, 1);
    expect(a.clearTimeS).toBe(0.025);
    expect(a.zone).toBe('AC-3');
    expect(shockScenario(p).zone).toBe('AC-4');
    const c = shockScenario({ ...p, rcdA: 0.3 });
    expect(c.rcdTrips).toBe(false);
    expect(c.zone).toBe('AC-4');
    expect(c.fibrillationAtS).toBeCloseTo(0.235, 2);
  });
  it('dry floor 2,3 mA → AC-2, RCD silent; tap 230 mA + RCD → AC-3; L+N touch → RCD silent', () => {
    const d = shockScenario({ ...base, peConnected: false, person: 'dryShoes', rcdA: 0.03 });
    expect(d.bodyCurrentA * 1000).toBeCloseTo(2.28, 2);
    expect(d.zone).toBe('AC-2');
    expect(d.rcdTrips).toBe(false);
    expect(shockScenario({ ...base, peConnected: false, person: 'tap', rcdA: 0.03 }).zone).toBe('AC-3');
    const ln = shockScenario({ ...base, person: 'lineNeutral', rcdA: 0.03, backgroundA: 0.003 });
    expect(ln.rcdTrips).toBe(false);
    expect(ln.bodyCurrentA).toBeCloseTo(0.23, 9);
  });
  it('background leakage: 23 mA trips, 21 + 2,3 trips, 20 + 2,3 does not; TEST trips', () => {
    expect(shockScenario({ ...base, rcdA: 0.03, backgroundA: 0.023 }).rcdTrips).toBe(true);
    const dry = { ...base, peConnected: false, person: 'dryShoes' as const, rcdA: 0.03 };
    expect(shockScenario({ ...dry, backgroundA: 0.021 }).rcdTrips).toBe(true);
    expect(shockScenario({ ...dry, backgroundA: 0.02 }).rcdTrips).toBe(false);
    expect(rcdTest(0.03)).toBe(true);
  });
});

describe('§Г house, §А short circuit', () => {
  it('kettle + microwave + iron on C16: 8,70 + 5,49 + 9,57 = 23,75 A → trips after ≈ 175 s', () => {
    expect([applianceCurrentA('kettle'), applianceCurrentA('microwave'), applianceCurrentA('iron')].map((x) => +x.toFixed(2))).toEqual([8.7, 5.49, 9.57]);
    expect(groupCurrents(['kettle', 'microwave', 'iron']).groupsA.kitchen).toBeCloseTo(23.75, 2);
    const p = createHousePanel();
    for (const id of ['kettle', 'microwave', 'iron'] as const) p.switchOn(id);
    while (p.breaker('kitchen').closed && p.timeS < 400) p.step(0.5);
    expect(Math.abs(p.breaker('kitchen').tripTimeS! - 175)).toBeLessThan(1.5);
    expect(p.main.closed).toBe(true);
  });
  it('kettle + water heater: groups 8,7 A each, main 17,4 A; bill fridge 43,2 kWh → 186,6 грн; kettle 5 min → 0,167 kWh / 0,72 грн', () => {
    const g = groupCurrents(['kettle', 'waterHeater']);
    expect(g.groupsA.kitchen).toBeCloseTo(8.7, 1);
    expect(g.groupsA.bath).toBeCloseTo(8.7, 1);
    expect(g.mainA).toBeCloseTo(17.4, 1);
    const fridge = monthlyBill().find((r) => r.id === 'fridge')!;
    expect(fridge.kWhPerMonth).toBeCloseTo(43.2, 9);
    expect(fridge.uahPerMonth).toBeCloseTo(186.6, 1);
    expect(useCost(2000, 5).kWh).toBeCloseTo(0.167, 3);
    expect(useCost(2000, 5).uah).toBeCloseTo(0.72, 2);
    // heater 2 kW × 8 h (one day) → 16 kWh → 69,1 грн
    expect(useCost(2000, 480).kWh).toBe(16);
    expect(useCost(2000, 480).uah).toBeCloseTo(69.1, 1);
  });
  it('short-circuit button: I = min(250·In, 4000 A)', () => {
    expect(shortCircuitCurrentA(16)).toBe(4000);
    expect(shortCircuitCurrentA(10)).toBe(2500);
  });
});

describe('§Д SMPS, §Е light, §Ж finale, §З backup', () => {
  it('SMPS: laptop 65 W → η 0,93, P_in 69,9 W, heat 4,9 W, I_in 0,61 A; phone → η 0,898, 22,3 W; off 0,05 W', () => {
    const l = smpsOperatingPoint('laptop');
    expect([l.efficiency, +l.inW.toFixed(1), +l.heatW.toFixed(1), +l.inputCurrentA.toFixed(2)]).toEqual([0.93, 69.9, 4.9, 0.61]);
    const ph = smpsOperatingPoint('phone');
    expect(ph.efficiency!).toBeCloseTo(0.898, 3);
    expect(ph.inW).toBeCloseTo(22.3, 1);
    expect(smpsOperatingPoint('off').inW).toBe(0.05);
  });
  it('transformer size: 100 kHz N 83 (s 0,23), 10 kHz 53 (0,27), 1 MHz 83, 50 Hz 1', () => {
    expect(transformerSize(1e5)).toMatchObject({ timesSmaller: 83 });
    expect(transformerSize(1e5).linearScale).toBeCloseTo(0.23, 2);
    expect(transformerSize(1e4).timesSmaller).toBe(53);
    expect(transformerSize(1e4).linearScale).toBeCloseTo(0.27, 2);
    expect(transformerSize(1e6).timesSmaller).toBe(83);
    expect(transformerSize(50).timesSmaller).toBe(1);
  });
  it('lamps: 10 × 60 W × 4 h → 876 kWh, 3784,3 грн, 15 replacements; LED 109,5 kWh, 473,0 грн, 1', () => {
    const i = lightingCost('incandescent', 10, 4);
    expect([i.kWhPerYear, +i.uahPerYear.toFixed(1), i.replacementsPer10Years]).toEqual([876, 3784.3, 15]);
    const l = lightingCost('led', 10, 4);
    expect([l.kWhPerYear, +l.uahPerYear.toFixed(1), l.replacementsPer10Years]).toEqual([109.5, 473.0, 1]);
    expect(resistivePowerRatio(230, 120)).toBeCloseTo(0.27, 2);
    expect(resistivePowerRatio(120, 230)).toBeCloseTo(3.7, 1);
  });
  it('electrons: 8,70 A → 0,256 mm/s, 1,15 μm; 16 A → 2,12 μm; 1 A → 0,13 μm', () => {
    expect(driftVelocityRmsMps(8.7) * 1000).toBeCloseTo(0.256, 3);
    expect(oscillationAmplitudeM(8.7) * 1e6).toBeCloseTo(1.15, 2);
    expect(oscillationAmplitudeM(16) * 1e6).toBeCloseTo(2.12, 2);
    expect(oscillationAmplitudeM(1) * 1e6).toBeCloseTo(0.13, 2);
  });
  it('energy chain 1,085 kWh; primary 3,29 / 2,86 / 1,87 / 1,21 / 2,41; currents and delay', () => {
    expect(plantOutputPerKettleKWh()).toBeCloseTo(1.085, 3);
    expect((['nuclear', 'coal', 'ccgt', 'hydro', 'wind'] as const).map((s) => +energyChain(s).primaryKWh.toFixed(2))).toEqual([3.29, 2.86, 1.87, 1.21, 2.41]);
    expect(linkCurrentA(750e3, true) * 1000).toBeCloseTo(1.54, 2);
    expect(linkCurrentA(330e3, true) * 1000).toBeCloseTo(3.5, 1);
    expect(linkCurrentA(110e3, true) * 1000).toBeCloseTo(10.5, 1);
    expect(linkCurrentA(10e3, true)).toBeCloseTo(0.115, 3);
    expect(linkCurrentA(400, true)).toBeCloseTo(2.9, 1);
    expect(linkCurrentA(230, false)).toBeCloseTo(8.7, 1);
    // 1,756 ms (document: «≈ 1,75 ms», chip «≈ 1,7 ms»; audit H1)
    expect(signalDelayS() * 1000).toBeCloseTo(1.756, 3);
  });
  it('autonomy: station 1 kWh 109 W → 7,43 h; router → 40,5 h; fridge 13,5 h; + kettle overload; hybrid 37,4 h', () => {
    expect(autonomy('station1', ['router', 'lamps3', 'laptop']).hours).toBeCloseTo(7.43, 2);
    expect(autonomy('station1', ['router']).hours).toBeCloseTo(40.5, 1);
    const f = autonomy('station1', ['fridge']);
    expect(f.hours).toBeCloseTo(13.5, 9);
    expect(f.startW).toBe(750);
    expect(f.overload).toBe(false);
    const k = autonomy('station1', ['router', 'lamps3', 'laptop', 'kettle']);
    expect(k.runningW).toBe(2109);
    expect(k.overloadReason).toBe('continuous');
    expect(autonomy('hybrid', ['fridge', 'router', 'lamps3', 'gasBoiler']).hours).toBeCloseTo(37.4, 1);
  });
});
