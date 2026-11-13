import { describe, expect, it } from 'vitest';
import {
  AVERAGED_CONSTANT,
  coilFlux,
  createDcMotor,
  createInduction,
  createRlCircuit,
  createRotatingCoil,
  emWave,
  lenzRingDeflectionDeg,
  magnetMoment,
  motorSteadyState,
  peakEmf,
  poyntingCircuit,
  speedOfLightFromConstants,
  startingTorqueNm,
  terminalVelocity,
  tubeFall,
  tubeTransitTime,
  brakingCoefficient,
} from '../index';

const run = (step: (dt: number) => unknown, seconds: number, dt = 1 / 30): void => {
  for (let t = 0; t < seconds - 1e-9; t += dt) step(dt);
};

describe('М4 DC motor', () => {
  it('k̄ = 0,011459; U = 6 V: no-load 523,6 rad/s = 5000 rpm, start torque 0,0344 N·m, 3 A', () => {
    expect(AVERAGED_CONSTANT).toBeCloseTo(0.011459, 6);
    expect(motorSteadyState(6, 0)!.speedRpm).toBeCloseTo(5000, 6);
    expect(startingTorqueNm(6)).toBeCloseTo(0.0344, 4);
  });
  it.each([
    [0.005, 0.436, 4273, 2.24, 0.85],
    [0.01, 0.873, 3546, 3.71, 0.709],
    [0.02, 1.745, 2091, 4.38, 0.418],
  ])('τ = %f N·m → I %f A, n %f rpm, P %f W, η %f', (tl, i, n, p, eta) => {
    const s = motorSteadyState(6, tl)!;
    expect(s.currentA).toBeCloseTo(i, 3);
    expect(s.speedRpm / n).toBeCloseTo(1, 3);
    expect(s.mechanicalPowerW).toBeCloseTo(p, 2);
    expect(s.efficiency).toBeCloseTo(eta, 2);
  });
  it('time-domain model reaches the exact steady state with b = 10⁻⁶ (1,5 % below the b = 0 table — audit G-M4)', () => {
    const m = createDcMotor({ voltageV: 6, loadTorqueNm: 0.005 });
    run((dt) => m.step(dt), 3);
    const kb = AVERAGED_CONSTANT;
    const wExact = ((kb * 6) / 2 - 0.005) / ((kb * kb) / 2 + 1e-6);
    expect(m.state.omegaRadPerS / wExact).toBeCloseTo(1, 4);
    expect(Math.abs(m.state.speedRpm / 4273 - 1)).toBeLessThan(0.02);
    expect(m.state.currentA).toBeCloseTo(0.4363 + (1e-6 * m.state.omegaRadPerS) / kb, 3);
    const m2 = createDcMotor({ voltageV: 6, loadTorqueNm: 0 });
    run((dt) => m2.step(dt), 0.3046);
    expect(m2.state.speedRpm / 5000).toBeCloseTo(1 - Math.exp(-1), 1);
  });
  it('U = 3 V: start torque 0,0172 — at τ ≥ 0,018 the motor does not start (I = U/R); jam → U/R', () => {
    const m = createDcMotor({ voltageV: 3, loadTorqueNm: 0.018 });
    run((dt) => m.step(dt), 1);
    expect(m.state.stalled).toBe(true);
    expect(m.state.currentA).toBeCloseTo(1.5, 9);
    const j = createDcMotor({ voltageV: 12, loadTorqueNm: 0 });
    run((dt) => j.step(dt), 1);
    j.set({ jammed: true });
    j.step(1 / 30);
    expect(j.state.omegaRadPerS).toBe(0);
    expect(j.state.currentA).toBeCloseTo(6, 9);
  });
  it('slip rings: the coil swings around θ = π and stops, ammeter ≈ U/R', () => {
    const m = createDcMotor({ voltageV: 6, mode: 'slipRings' });
    // amplitude e-folding 2J/b₂ = 0,8 s; from a start near the unstable θ ≈ 0 the swing needs ~6 s to die out
    run((dt) => m.step(dt), 8);
    expect(Math.abs(m.state.omegaRadPerS)).toBeLessThan(0.05);
    expect(Math.cos(m.state.angleRad)).toBeCloseTo(-1, 3);
    expect(m.state.currentA).toBeCloseTo(3, 2);
  });
});

describe('М5 induction', () => {
  it('m: NdFeB 0,875, ferrite 0,25 A·m²; Φ(0) = 3,67×10⁻⁵ Wb', () => {
    expect(magnetMoment('neodymium')).toBeCloseTo(0.875, 3);
    expect(magnetMoment('ferrite')).toBeCloseTo(0.25, 3);
    expect(coilFlux('neodymium', 0)).toBeCloseTo(3.665e-5, 8);
  });
  it('peaks: N = 200, v = 1 → 0,420 V; N = 1000 → 2,10 V; N = 200, v = 3 → 1,26 V', () => {
    expect(peakEmf('neodymium', 200, 1)).toBeCloseTo(0.42, 3);
    expect(peakEmf('neodymium', 1000, 1)).toBeCloseTo(2.1, 2);
    expect(peakEmf('neodymium', 200, 3)).toBeCloseTo(1.26, 2);
  });
  it('auto drop from 10 cm: v ≈ 1,4 m/s at the centre, two opposite peaks ≈ ±0,6 V (N = 200)', () => {
    const m = createInduction({ turns: 200 });
    m.startAutoDrop();
    let min = 0;
    let max = 0;
    let vCentre = 0;
    for (let i = 0; i < 4000 && m.state.autoDropping; i++) {
      const prevZ = m.state.zM;
      const s = m.step(1 / 4000);
      if (prevZ > 0 && s.zM <= 0) vCentre = Math.abs(s.vMPerS);
      min = Math.min(min, s.emfV);
      max = Math.max(max, s.emfV);
    }
    expect(vCentre).toBeCloseTo(1.4, 1);
    expect(min).toBeLessThan(-0.5);
    expect(max).toBeGreaterThan(0.55);
    expect(max).toBeLessThan(0.7);
  });
  it('dragging at 1 m/s gives the analytic EMF after the 30 ms filter settles; LED from 1,8 V', () => {
    const m = createInduction({ turns: 1000 });
    m.drag(0.1, 0);
    let z = 0.1;
    let peak = 0;
    for (let i = 0; i < 600; i++) {
      z -= 1 / 600;
      const s = m.drag(z, 1 / 600);
      peak = Math.max(peak, Math.abs(s.emfV));
    }
    // the 30 ms velocity filter lags slightly: the peak (z = a/2) is reached 92 ms after the start → 95 %
    expect(peak / 2.1).toBeGreaterThan(0.95);
    expect(peak / 2.1).toBeLessThan(1);
    const fast = createInduction({ turns: 1000 });
    fast.drag(0.05, 0);
    let lit = false;
    for (let i = 1; i <= 60; i++) lit = fast.drag(0.05 - i * 0.002, 1 / 600).ledBrightness > 0 || lit;
    expect(lit).toBe(true);
  });
});

describe('М6 eddy braking', () => {
  it('k_Cu 1,308; Al 0,827 → v_t 0,237; times PVC 0,452, Cu 6,68, Al 4,24, slotted 1,73 s; heat Cu 0,029 W', () => {
    expect(brakingCoefficient('copper')).toBeCloseTo(1.308, 3);
    expect(brakingCoefficient('aluminium')).toBeCloseTo(0.827, 3);
    expect(terminalVelocity('aluminium')).toBeCloseTo(0.237, 3);
    expect(tubeTransitTime('pvc').exactS).toBeCloseTo(0.452, 3);
    expect(tubeTransitTime('copper').estimateS).toBeCloseTo(6.68, 2);
    expect(tubeTransitTime('copper').exactS).toBeCloseTo(6.68, 2);
    expect(tubeTransitTime('aluminium').exactS).toBeCloseTo(4.24, 2);
    expect(tubeTransitTime('copperSlotted').exactS).toBeCloseTo(1.73, 2);
    expect(tubeFall('copper', 5).heatW).toBeCloseTo(0.029, 3);
    expect(lenzRingDeflectionDeg(3, false)).toBe(15);
    expect(lenzRingDeflectionDeg(-0.5, false)).toBeCloseTo(-7.5, 9);
    expect(lenzRingDeflectionDeg(3, true)).toBe(0);
  });
});

describe('М7 RL circuit', () => {
  it('S1 on: τ = 0,1 s, I₂(0,1) = 0,759 A, I₂(0,3) = 1,140 A, W = 0,72 J at 1,2 A', () => {
    const c = createRlCircuit();
    c.set({ s1On: true });
    run((dt) => c.step(dt), 0.1, 0.1 / 3);
    expect(c.state.i2A).toBeCloseTo(0.759, 3);
    expect(c.state.i1A).toBeCloseTo(1.2, 9);
    run((dt) => c.step(dt), 0.2, 0.2 / 6);
    expect(c.state.i2A).toBeCloseTo(1.14, 3);
    run((dt) => c.step(dt), 2);
    expect(c.state.storedJ).toBeCloseTo(0.72, 4);
  });
  it('S1 off: τ′ = 0,05 s, I₂(0,05) = 0,441, I₂(0,15) = 0,060; I₁ = −I₂; |u_L| ≤ 24 V, no neon', () => {
    const c = createRlCircuit({ s1On: true });
    run((dt) => c.step(dt), 3);
    c.set({ s1On: false });
    c.step(0.05);
    expect(c.state.i2A).toBeCloseTo(0.441, 3);
    expect(c.state.i1A).toBeCloseTo(-c.state.i2A, 12);
    expect(Math.abs(c.state.inductorV)).toBeLessThanOrEqual(24);
    c.step(0.1);
    expect(c.state.i2A).toBeCloseTo(0.06, 3);
    expect(c.state.neonLit).toBe(false);
  });
  it('S2 break: 1 ms → 1200 V (core) / 6 V (air); 10 ms → 120 V; 0,1 ms → 12 kV shown as 2000 V', () => {
    const cases: [boolean, number, number, boolean][] = [
      [true, 1e-3, 1200, true],
      [false, 1e-3, 6, false],
      [true, 1e-2, 120, true],
      [true, 1e-4, 12000, true],
    ];
    for (const [core, dtBreak, v, neon] of cases) {
      const c = createRlCircuit({ s1On: true, ironCore: core, breakTimeS: dtBreak });
      run((dt) => c.step(dt), 10);
      c.set({ s2Closed: false });
      expect(c.state.breakEmfV).toBeCloseTo(v, 6);
      expect(c.state.breakEmfDisplayV).toBeCloseTo(Math.min(v, 2000), 6);
      expect(c.state.neonLit).toBe(neon);
      c.step(0.1);
      expect(c.state.i2A).toBe(0);
      expect(c.state.i1A).toBeCloseTo(1.2, 9);
    }
  });
});

describe('М8 rotating coil & Maxwell', () => {
  it('120 rpm → 6,3 V; 600 rpm → 31,4 V (re-exported shared model)', () => {
    const c = createRotatingCoil({ speedRpm: 120 });
    expect(c.state.emfMaxV).toBeCloseTo(6.28, 2);
    c.set({ speedRpm: 600 });
    c.step(1 / 30);
    expect(c.state.emfMaxV).toBeCloseTo(31.42, 2);
  });
  it('c = 1/√(μ₀ε₀); 5×10¹⁴ Hz → 600 nm visible; 100 MHz radio; Poynting 12 V/12 Ω → 12 W, 24 V/1 Ω → 576 W', () => {
    expect(speedOfLightFromConstants() / 299792458).toBeCloseTo(1, 6);
    expect(emWave(5e14).wavelengthM * 1e9).toBeCloseTo(599.6, 1);
    expect(emWave(5e14).band).toBe('visible');
    expect(emWave(1e8).band).toBe('radio');
    expect(poyntingCircuit(12, 12)).toMatchObject({ currentA: 1, powerW: 12 });
    expect(poyntingCircuit(24, 1).powerW).toBe(576);
  });
});
