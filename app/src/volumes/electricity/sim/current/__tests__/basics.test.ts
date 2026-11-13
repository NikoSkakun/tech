import { describe, expect, it } from 'vitest';
import {
  appliancePower,
  createOerstedCompass,
  createShortCircuit,
  drift,
  electronsPerSecond,
  filamentResistanceOhm,
  kettleBoil,
  lampFlicker,
  lineLosses,
  oerstedDeflectionRad,
  ohmBench,
  snailDistanceM,
  sourceEmfLamp,
  sourceVoltage,
  wireResistanceOhm,
} from '../index';

const deg = (r: number): number => (r * 180) / Math.PI;

describe('steps current/drift (§2)', () => {
  it('0,3 A → 1,87×10¹⁸ e⁻/s; 1 A → 6,24×10¹⁸', () => {
    expect(electronsPerSecond(0.3) / 1.87e18).toBeCloseTo(1, 2);
    expect(electronsPerSecond(1) / 6.24e18).toBeCloseTo(1, 2);
  });
  it('1 A, 1 mm² → 7,35×10⁻⁵ m/s, 40 800 s; 10 A, 1,5 mm² → 4,90×10⁻⁴, 1,7 h; t_s ≈ 14 ns', () => {
    const a = drift(1, 1);
    expect(a.driftMPerS / 7.35e-5).toBeCloseTo(1, 3);
    expect(a.electronTimeS / 40800).toBeCloseTo(1, 2);
    expect(drift(10, 1.5).driftMPerS / 4.9e-4).toBeCloseTo(1, 2);
    expect(drift(10, 1.5).electronTimeS / 3600).toBeCloseTo(1.7, 1);
    expect(a.signalTimeS * 1e9).toBeCloseTo(14.3, 1);
    expect(a.slowdown / 1e8).toBeCloseTo(1, 0);
  });
  it('range ends: 0,1 A, 6 mm² → 1,2×10⁻⁶; 16 A, 0,5 mm² → 2,35×10⁻³ m/s; snail 74 μm/s', () => {
    expect(drift(0.1, 6).driftMPerS / 1.2e-6).toBeCloseTo(1, 1);
    expect(drift(16, 0.5).driftMPerS / 2.35e-3).toBeCloseTo(1, 2);
    expect(drift(16, 0.5).electronTimeS / 60).toBeCloseTo(21, 0);
    expect(drift(0.1, 6).electronTimeS / 86400).toBeCloseTo(28, 0);
    expect(snailDistanceM(1, 1, 1) * 1e6).toBeCloseTo(73.5, 0);
  });
});

describe('§3 source-emf, §4 Ohm bench', () => {
  it('ℰ 1,5 V → 62,5 mA, 94 mW; 12 V → 0,5 A, 6 W, full brightness', () => {
    expect(sourceEmfLamp(1.5).currentA).toBeCloseTo(0.0625, 9);
    expect(sourceEmfLamp(1.5).powerW).toBeCloseTo(0.094, 3);
    expect(sourceEmfLamp(12)).toMatchObject({ currentA: 0.5, powerW: 6, brightness: 1, labSupply: true });
  });
  it('NiCr 1 m 0,1 mm² → 11,0 Ω, 2 V → 0,182 A; Cu → 0,168 Ω, CC 3 A @ 0,504 V; Cu 10 m 0,01 mm² → 16,8 Ω', () => {
    expect(wireResistanceOhm('NiCr', 1, 0.1)).toBeCloseTo(11, 9);
    const r = ohmBench(2, { kind: 'wire', material: 'NiCr', lengthM: 1, areaMm2: 0.1 });
    expect(r.currentA).toBeCloseTo(0.182, 3);
    expect(r.constantCurrent).toBe(false);
    const cu = ohmBench(2, { kind: 'wire', material: 'Cu', lengthM: 1, areaMm2: 0.1 });
    expect(cu.resistanceOhm).toBeCloseTo(0.168, 9);
    expect(cu).toMatchObject({ currentA: 3, constantCurrent: true });
    expect(cu.voltageV).toBeCloseTo(0.504, 9);
    expect(wireResistanceOhm('Cu', 10, 0.01)).toBeCloseTo(16.8, 9);
  });
  it('lamp 12 V/5 W: 1 V → 11,0 Ω, 0,091 A; 6 V → 21,7 Ω, 0,276 A; 12 V → 28,8 Ω, 0,417 A', () => {
    expect(filamentResistanceOhm(1)).toBeCloseTo(11.0, 1);
    expect(ohmBench(1, { kind: 'lamp' }).currentA).toBeCloseTo(0.091, 3);
    expect(filamentResistanceOhm(6)).toBeCloseTo(21.7, 1);
    expect(ohmBench(6, { kind: 'lamp' }).currentA).toBeCloseTo(0.276, 3);
    expect(ohmBench(12, { kind: 'lamp' }).currentA).toBeCloseTo(0.417, 3);
    expect(ohmBench(12, { kind: 'lamp' }).constantCurrent).toBe(false);
  });
  it('glow above 10 W; CC points still on I = U/R', () => {
    const r = ohmBench(12, { kind: 'wire', material: 'NiCr', lengthM: 0.2, areaMm2: 0.1 });
    expect(r.constantCurrent).toBe(true);
    expect(r.voltageV / r.currentA).toBeCloseTo(r.resistanceOhm, 9);
    expect(r.glow).toBeGreaterThan(0);
    expect(ohmBench(1, { kind: 'wire', material: 'NiCr', lengthM: 1, areaMm2: 0.1 }).glow).toBe(0);
  });
});

describe('§5 circuit and short circuit', () => {
  it('closed: 0,288 A, lamp 1,44 V', () => {
    const m = createShortCircuit({ switchClosed: true });
    expect(m.state.batteryCurrentA).toBeCloseTo(0.288, 3);
    expect(m.state.lampV).toBeCloseTo(1.44, 2);
  });
  it('jumper on the lamp: 7,14 A, lamp ≈ 0,07 V, fuse blows after 0,3 s, then current 0', () => {
    const m = createShortCircuit({ switchClosed: true, jumper: 'lamp' });
    expect(m.state.batteryCurrentA).toBeCloseTo(7.14, 2);
    expect(m.state.lampV).toBeCloseTo(0.071, 3);
    for (let i = 0; i < 8; i++) m.step(1 / 30);
    expect(m.state.fuseBlown).toBe(false);
    for (let i = 0; i < 2; i++) m.step(1 / 30);
    expect(m.state.fuseBlown).toBe(true);
    expect(m.state.batteryCurrentA).toBe(0);
    m.replaceFuse();
    expect(m.state.fuseBlown).toBe(false);
  });
  it('jumper on the battery bypasses the fuse: 7,14 A, I²r ≈ 10 W, fuse intact, battery heats 8 °C/s → 60 °C at 5 s', () => {
    const m = createShortCircuit({ switchClosed: true, jumper: 'battery' });
    expect(m.state.batteryCurrentA).toBeCloseTo(7.14, 2);
    expect(m.state.batteryInternalW).toBeCloseTo(10.2, 1);
    expect(m.state.lampV).toBeCloseTo(0.071, 3);
    for (let i = 0; i < 149; i++) m.step(1 / 30);
    expect(m.state.fuseBlown).toBe(false);
    expect(m.state.overheatWarning).toBe(false);
    m.step(1 / 30);
    m.step(1 / 30);
    expect(m.state.overheatWarning).toBe(true);
    m.set({ jumper: 'none' });
    m.step(1 / 30);
    expect(m.state.batteryTemperatureC).toBe(20);
  });
  it('without fuse a lamp jumper heats the battery instead', () => {
    const m = createShortCircuit({ switchClosed: true, jumper: 'lamp', fuseInstalled: false });
    for (let i = 0; i < 60; i++) m.step(1 / 30);
    expect(m.state.batteryTemperatureC).toBeCloseTo(36, 0);
  });
});

describe('§6 power, §8 losses, §10 AC/Oersted', () => {
  it('all appliances 5395 W, 23,5 A; kettle 30 min → 1 kWh = 3,6 MJ; boiling 1 L: 334,9 kJ, 0,116 kWh, 209 s', () => {
    const all = appliancePower(['led', 'charger', 'laptop', 'tv', 'microwave', 'kettle', 'heater']);
    expect(all.totalW).toBe(5395);
    expect(all.currentA).toBeCloseTo(23.5, 1);
    expect(all.breakerWouldTrip).toBe(true);
    const k = appliancePower(['kettle'], 0.5);
    expect(k.energyKWh).toBeCloseTo(1, 12);
    expect(k.energyMJ).toBeCloseTo(3.6, 12);
    const b = kettleBoil();
    expect(b.heatJ / 1000).toBeCloseTo(334.9, 1);
    expect(b.electricKWh).toBeCloseTo(0.116, 3);
    expect(b.timeS).toBeCloseTo(209.3, 1);
  });
  it.each([
    [12, 10.07, 7.3, 113.5, 0.06],
    [24, 17.05, 83.7, 325.4, 0.205],
    [48, 21.13, 514, 500, 0.507],
    [120, 14.42, 1498, 233, 0.865],
    [230, 8.34, 1841, 78.0, 0.959],
    [400, 4.93, 1945, 27.2, 0.986],
    [1000, 2.0, 1991, 4.5, 0.998],
  ])('%d V, 50 m, 1,5 mm² → I %f A, P_load %f, P_loss %f, η %f', (u, i, pl, ploss, eta) => {
    const r = lineLosses(u, 1.5, 50);
    expect(r.lineOhm).toBeCloseTo(1.12, 9);
    expect(r.currentA / i).toBeCloseTo(1, 2);
    expect(r.loadW / pl).toBeCloseTo(1, 2);
    expect(Math.abs(r.lossW - ploss)).toBeLessThan(Math.max(0.005 * ploss, 0.05)); // table rounding
    expect(r.efficiency).toBeCloseTo(eta, 3);
  });
  it('230 V, 2,5 mm² → 0,672 Ω, 8,48 A, 1902 W, 48 W, 97,5 %', () => {
    const r = lineLosses(230, 2.5, 50);
    expect(r.lineOhm).toBeCloseTo(0.672, 9);
    expect(r.currentA).toBeCloseTo(8.48, 2);
    expect(r.loadW).toBeCloseTo(1902, 0);
    expect(r.lossW).toBeCloseTo(48.3, 1);
    expect(r.efficiency).toBeCloseTo(0.975, 3);
  });
  it('AC 325 V peak at 5 ms; DC 1,5 V; flicker depth 5 %', () => {
    expect(sourceVoltage('ac', 0.005)).toBeCloseTo(325, 9);
    expect(sourceVoltage('dc', 0.123)).toBe(1.5);
    expect(lampFlicker('ac', 0.005)).toBeCloseTo(0.95, 9);
  });
  it('Oersted: 5 A, 1 cm → 79°, 1 A → 45°, reversed → −θ; needle settles within ~1 s', () => {
    expect(deg(oerstedDeflectionRad(5))).toBeCloseTo(78.7, 1);
    expect(deg(oerstedDeflectionRad(1))).toBeCloseTo(45, 6);
    expect(deg(oerstedDeflectionRad(-5))).toBeCloseTo(-78.7, 1);
    const c = createOerstedCompass();
    let a = 0;
    for (let i = 0; i < 30; i++) a = c.step(1 / 30, true, 1);
    expect(deg(a)).toBeCloseTo(78.7, -1);
  });
});
