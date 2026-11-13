import { describe, expect, it } from 'vitest';
import {
  acWave,
  bargeAnalogy,
  closingCurrentSpikePu,
  createSwing,
  createSynchroscope,
  equilibriumAngleDeg,
  floatingNeutral,
  generatorSpeedRpm,
  inductionMotorPoint,
  instantaneousPower,
  lineVoltage,
  maxPowerPu,
  motorConnection,
  neutralCurrent,
  openCircuitEmfKV,
  powerCompensation,
  RATED_TORQUE_NM,
  rlcCircuit,
  rotatingLoop,
  warOfCurrents,
} from '../index';

describe('Г1 rotating loop, ac-anatomy', () => {
  it('3000 rpm → 157,08 V, 50 Hz, 2-period window 40 ms, strobe ×50; 600 rpm → 31,42 V, 10 Hz', () => {
    const a = rotatingLoop(3000);
    expect(a.emfMaxV).toBeCloseTo(157.08, 2);
    expect(a.frequencyHz).toBe(50);
    expect(a.scopeWindowS).toBeCloseTo(0.04, 12);
    expect(a.visualSlowdown).toBe(50);
    expect(a.visualOmegaRadPerS).toBeCloseTo(2 * Math.PI, 9); // 1 turn per second on screen
    const b = rotatingLoop(600);
    expect(b.emfMaxV).toBeCloseTo(31.42, 2);
    expect(b.frequencyHz).toBe(10);
  });
  it('230 V RMS → 325 V peak; 60 Hz period 16,7 ms', () => {
    expect(acWave(230, 50, 0.005).instantaneousV).toBeCloseTo(325.27, 2);
    expect(acWave(230, 60, 0).periodS * 1000).toBeCloseTo(16.67, 2);
  });
});

describe('Г2 war of currents', () => {
  it('d = 1 km: DC 0,7 Ω, 16,30 A, 98,6 V, loss 186 W (10,4 %); AC 0,9997 A, 0,7 W (0,035 %), 109,96 V', () => {
    const { dc, ac } = warOfCurrents(1);
    expect(dc.lineOhm).toBeCloseTo(0.7, 9);
    expect(dc.currentA).toBeCloseTo(16.3, 2);
    expect(dc.lampV).toBeCloseTo(98.6, 1);
    expect(dc.lossW).toBeCloseTo(185.9, 1);
    expect(dc.lossFraction * 100).toBeCloseTo(10.4, 1);
    expect(ac.currentA).toBeCloseTo(0.9997, 4);
    expect(ac.lossW).toBeCloseTo(0.7, 2);
    expect(ac.lossFraction * 100).toBeCloseTo(0.035, 3);
    expect(ac.lampV).toBeCloseTo(109.96, 2);
  });
  it('1,5 km: 1,05 Ω, 93,7 V, brightness ≈ 58 %; 5 km: 3,5 Ω, 69,7 V', () => {
    const d = warOfCurrents(1.5).dc;
    expect(d.lineOhm).toBeCloseTo(1.05, 9);
    expect(d.lampV).toBeCloseTo(93.7, 1);
    expect(d.brightness).toBeCloseTo(0.58, 2);
    expect(warOfCurrents(5).dc.lampV).toBeCloseTo(69.7, 1);
  });
});

describe('Г3 three phases', () => {
  it.each([
    [[10, 10, 10], 0],
    [[10, 5, 0], 8.66],
    [[10, 0, 0], 10],
    [[16, 8, 4], 10.583],
  ] as const)('I = %j → I_N = %f A', (i, n) => {
    expect(neutralCurrent(i[0], i[1], i[2]).magnitudeA).toBeCloseTo(n, 3);
  });
  it('single-phase power pulses at 100 Hz between 0 and 2UI; three-phase symmetric is constant 3UI', () => {
    expect(instantaneousPower('single', 230, 10, 0)).toBeCloseTo(0, 9);
    expect(instantaneousPower('single', 230, 10, 0.005)).toBeCloseTo(4600, 6);
    for (const t of [0, 0.001, 0.0037]) expect(instantaneousPower('three', 230, 10, t)).toBeCloseTo(6900, 6);
  });
  it('Г3b: symmetric → no shift; asymmetric shifts the neutral; all off → 0', () => {
    expect(floatingNeutral([10, 10, 10]).neutralShiftV).toBeCloseTo(0, 9);
    const f = floatingNeutral([16, 4, 4]);
    expect(f.neutralShiftV).toBeGreaterThan(50);
    expect(f.loadVoltagesV[0]).toBeLessThan(230);
    expect(f.loadVoltagesV[1]).toBeGreaterThan(230);
    expect(floatingNeutral([0, 0, 0]).neutralShiftV).toBe(0);
  });
  it('star-delta: U_L = √3·230 ≈ 398 V; on 400 V: Y ok, Δ overheats', () => {
    expect(lineVoltage(230)).toBeCloseTo(398.4, 1);
    expect(motorConnection('star').ok).toBe(true);
    expect(motorConnection('delta')).toEqual({ windingV: 400, ok: false });
  });
});

describe('Г4 induction motor, synchronous generator', () => {
  it('T_n = 49,22 N·m; loads 25/50/100/150/250 % → s 0,72/1,45/3,00/4,79/14,37 %, n 1489/1478/1455/1428/1284', () => {
    expect(RATED_TORQUE_NM).toBeCloseTo(49.22, 2);
    const cases: [number, number, number][] = [
      [25, 0.72, 1489],
      [50, 1.45, 1478],
      [100, 3.0, 1455],
      [150, 4.79, 1428],
      [250, 14.37, 1284],
    ];
    for (const [load, s, n] of cases) {
      const p = inductionMotorPoint(load);
      expect(p.slip! * 100).toBeCloseTo(s, 2);
      expect(p.speedRpm).toBeCloseTo(n, 0);
    }
    expect(inductionMotorPoint(255)).toMatchObject({ stalled: true, zone: 'pullOut', slip: null });
    expect(inductionMotorPoint(200).zone).toBe('overload');
    expect(inductionMotorPoint(100, 4).speedRpm).toBeCloseTo(750 * 0.97, 0);
  });
  it('generator speed 3000 / 75 rpm; EMF 50 % → 15,5 kV, 100 % → 24, 150 % → 27,3 kV', () => {
    expect(generatorSpeedRpm(1)).toBe(3000);
    expect(generatorSpeedRpm(40)).toBe(75);
    expect(openCircuitEmfKV(0.5)).toBeCloseTo(15.5, 1);
    expect(openCircuitEmfKV(1)).toBeCloseTo(24, 12);
    expect(openCircuitEmfKV(1.5)).toBeCloseTo(27.3, 1);
  });
});

describe('Г5 synchronisation', () => {
  it('2985 rpm → 49,75 Hz, Δf −0,25 Hz, 4 s per turn; 3003 rpm → +0,05 Hz, 20 s', () => {
    const s = createSynchroscope(1, { speedRpm: 2985 });
    expect(s.state.generatorHz).toBeCloseTo(49.75, 9);
    expect(s.state.deltaHz).toBeCloseTo(-0.25, 9);
    expect(s.state.revolutionS).toBeCloseTo(-4, 9);
    const a0 = s.state.angleDeg;
    s.step(1);
    expect(((s.state.angleDeg - a0 + 540) % 360) - 180).toBeCloseTo(-90, 6);
    s.set({ speedRpm: 3003 });
    expect(s.state.revolutionS).toBeCloseTo(20, 6);
  });
  it('closing rules and current spike 5,0 (60°) / 10 (180°)', () => {
    expect(closingCurrentSpikePu(60)).toBeCloseTo(5, 9);
    expect(closingCurrentSpikePu(180)).toBeCloseTo(10, 9);
    const s = createSynchroscope(1, { speedRpm: 3003, excitation: 1.0 });
    for (let i = 0; i < 2000 && Math.abs(s.state.angleDeg) > 2; i++) s.step(0.01);
    expect(s.close().soft).toBe(true);
    s.set({ excitation: 0.96 });
    expect(s.close()).toMatchObject({ soft: false, voltageOk: false });
  });
  it('equilibria at ℰ = 2,2: 14,2° / 24,1° / 44,1° / 54,9° / 79,1°; P_max 1,222; unstable 155,9° at 0,5', () => {
    const exp: [number, number][] = [
      [0.3, 14.2],
      [0.5, 24.1],
      [0.85, 44.1],
      [1.0, 54.9],
      [1.2, 79.1],
    ];
    for (const [p, d] of exp) expect(equilibriumAngleDeg(p, 2.2)).toBeCloseTo(d, 1);
    expect(maxPowerPu(2.2)).toBeCloseTo(1.222, 3);
    expect(180 - equilibriumAngleDeg(0.5, 2.2)!).toBeCloseTo(155.9, 1);
    expect(equilibriumAngleDeg(1.3, 2.2)).toBeNull();
  });
  it('dynamics: 0,3 → 0,85 with 0,2 p.u./s ramp → max δ ≈ 46°, settles at 44,1° (oscillation ≈ 0,8 Hz)', () => {
    const m = createSwing({ mechanicalSetpointPu: 0.3 });
    m.set({ mechanicalSetpointPu: 0.85 });
    for (let i = 0; i < 450; i++) m.step(1 / 30);
    expect(m.state.maxDeltaDeg).toBeCloseTo(45.85, 0);
    expect(m.state.deltaDeg).toBeCloseTo(44.06, 1);
    expect(m.state.outOfStep).toBe(false);
  });
  it('0,5 → 1,2 with the ramp stays in step (max ≈ 83,7°); setpoint 1,3 > P_max → out of step', () => {
    const m = createSwing({ mechanicalSetpointPu: 0.5 });
    m.set({ mechanicalSetpointPu: 1.2 });
    for (let i = 0; i < 450; i++) m.step(1 / 30);
    expect(m.state.outOfStep).toBe(false);
    expect(m.state.maxDeltaDeg).toBeCloseTo(83.7, 0);
    m.set({ mechanicalSetpointPu: 1.3 });
    for (let i = 0; i < 150; i++) m.step(1 / 30);
    expect(m.state.outOfStep).toBe(true);
  });
});

describe('Г6 RLC, Г7 compensation', () => {
  it('RLC at 50 Hz: U_C 474,9 V > 1,5·230 → overvoltage; pure L → +90°, pure C → −90°', () => {
    const r = rlcCircuit({ frequencyHz: 50, resistanceOhm: 50, inductanceH: 0.3, capacitanceF: 30e-6, mode: 'RLC' });
    expect(r.currentA).toBeCloseTo(4.476, 3);
    expect(r.overvoltage).toBe(true);
    expect(rlcCircuit({ frequencyHz: 50, resistanceOhm: 50, inductanceH: 0.3, capacitanceF: 30e-6, mode: 'L' }).phaseDeg).toBeCloseTo(90, 9);
    expect(rlcCircuit({ frequencyHz: 50, resistanceOhm: 50, inductanceH: 0.3, capacitanceF: 30e-6, mode: 'C' }).phaseDeg).toBeCloseTo(-90, 9);
    expect(rlcCircuit({ frequencyHz: 50, resistanceOhm: 50, inductanceH: 0.3, capacitanceF: 30e-6, mode: 'R' }).phaseDeg).toBe(0);
  });
  it('cos φ 0,8: S 1875, Q 1125, I 8,152 A, 33,23 W; 38 μF → 631,6 var, 0,950, 6,865 A, 23,56 W; 67,7 μF → 1,000, 6,522 A, 21,27 W', () => {
    const a = powerCompensation(0.8, 0);
    expect(a.apparentBeforeVA).toBeCloseTo(1875, 9);
    expect(a.reactiveBeforeVar).toBeCloseTo(1125, 9);
    expect(a.currentA).toBeCloseTo(8.152, 3);
    expect(a.lineLossW).toBeCloseTo(33.23, 2);
    const b = powerCompensation(0.8, 38e-6);
    expect(b.capacitorVar).toBeCloseTo(631.6, 0);
    expect(b.powerFactorAfter).toBeCloseTo(0.95, 3);
    expect(b.currentA).toBeCloseTo(6.865, 2);
    expect(b.lineLossW).toBeCloseTo(23.56, 1);
    const c = powerCompensation(0.8, 67.7e-6);
    expect(c.powerFactorAfter).toBeCloseTo(1, 4);
    expect(c.currentA).toBeCloseTo(6.522, 3);
    expect(c.lineLossW).toBeCloseTo(21.27, 2);
    expect(powerCompensation(0.8, 80e-6).capacitive).toBe(true);
  });
  it('barge analogy: P = S·cos φ', () => {
    expect(bargeAnalogy(60).active).toBeCloseTo(0.5, 12);
    expect(bargeAnalogy(90).reactive).toBeCloseTo(Math.sin((80 * Math.PI) / 180), 12);
  });
});
