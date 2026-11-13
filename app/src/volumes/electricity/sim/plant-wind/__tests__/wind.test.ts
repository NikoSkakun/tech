import { describe, expect, it } from 'vitest';
import {
  TERRAIN_ALPHA,
  TURBINE_15MW,
  TURBINE_6MW,
  actuatorDisk,
  airDensity,
  airfoil,
  annualEnergy,
  bladeSection,
  pitchDeg,
  ratedSpeed,
  rotorRpm,
  shearMeanSpeed,
  sweptArea,
  turbinePowerW,
  windPowerW,
} from '..';

describe('plant-wind M1 power in the wind', () => {
  it('D 170, v 10, T 15 → A 22 698 m², P 13.90 MW; ρ(−20) 1.394, ρ(35) 1.146', () => {
    expect(Math.round(sweptArea(170))).toBe(22698);
    expect(windPowerW(10, 170, airDensity(15)) / 1e6).toBeCloseTo(13.9, 2);
    expect(airDensity(-20)).toBeCloseTo(1.394, 3);
    expect(airDensity(35)).toBeCloseTo(1.146, 3);
    expect(windPowerW(16, 170) / windPowerW(8, 170)).toBeCloseTo(8, 9);
  });
});

describe('plant-wind M2 actuator disk', () => {
  it('a = 1/3 → C_p 0.5926, D₂ 1.414·D; 0.1 → 0.324; 0.2 → 0.512; 0.45 → 0.5445, D₂ 2.35·D', () => {
    const b = actuatorDisk(1 / 3);
    expect(b.cp).toBeCloseTo(0.5926, 4);
    expect(b.d2Rel).toBeCloseTo(1.414, 3);
    expect(actuatorDisk(0.1).cp).toBeCloseTo(0.324, 3);
    expect(actuatorDisk(0.2).cp).toBeCloseTo(0.512, 3);
    const e = actuatorDisk(0.45);
    expect(e.cp).toBeCloseTo(0.5445, 4);
    expect(e.d2Rel).toBeCloseTo(2.35, 2);
    expect(actuatorDisk(0.325).atBetz).toBe(true);
    expect(actuatorDisk(0.9).a).toBe(0.45);
  });
});

describe('plant-wind M3 airfoil and blade', () => {
  it('kinematics: r/R 1 → φ 4.76°, θ −1.2°; 0.25 → 18.4°, 12.4°; 0.15 → 29.1°, 23.1°', () => {
    expect(bladeSection(1).phiDeg).toBeCloseTo(4.76, 2);
    expect(bladeSection(1).twistDeg).toBeCloseTo(-1.24, 1);
    expect(bladeSection(0.25).phiDeg).toBeCloseTo(18.4, 1);
    expect(bladeSection(0.25).twistDeg).toBeCloseTo(12.4, 1);
    expect(bladeSection(0.15).phiDeg).toBeCloseTo(29.1, 1);
  });
  it('C_L linear to 12°, max 1.4 at 16°, 0.9 at 25°; C_D 0.008 at 0°, 0.35 at 25°; stall from 14°', () => {
    expect(airfoil(6).cl).toBeCloseTo(2 * Math.PI * ((6 * Math.PI) / 180) * 0.9, 9);
    expect(airfoil(16).cl).toBeCloseTo(1.4, 9);
    expect(airfoil(25).cl).toBeCloseTo(0.9, 9);
    let mx = 0;
    for (let a = -5; a <= 25; a += 0.5) mx = Math.max(mx, airfoil(a).cl);
    expect(mx).toBeCloseTo(1.4, 6);
    expect(airfoil(0).cd).toBeCloseTo(0.008, 9);
    expect(airfoil(25).cd).toBeCloseTo(0.35, 9);
    expect(airfoil(14).stalled).toBe(true);
    expect(airfoil(6).liftToDrag).toBeGreaterThan(40);
  });
});

describe('plant-wind M4 power curve, rpm, pitch', () => {
  const T = TURBINE_6MW;
  it('v_r 9.96; P(3) 0.164, P(6) 1.312, P(8) 3.111, P(12) 6.0 MW; P(25) 0 / 6.0 storm; P(28, storm) 4.2', () => {
    expect(ratedSpeed(T)).toBeCloseTo(9.96, 2);
    expect(turbinePowerW(T, 3) / 1e6).toBeCloseTo(0.164, 3);
    expect(turbinePowerW(T, 6) / 1e6).toBeCloseTo(1.312, 3);
    expect(turbinePowerW(T, 8) / 1e6).toBeCloseTo(3.111, 3);
    expect(turbinePowerW(T, 12) / 1e6).toBe(6);
    expect(turbinePowerW(T, 25)).toBe(0);
    expect(turbinePowerW(T, 25, true) / 1e6).toBe(6);
    expect(turbinePowerW(T, 28, true) / 1e6).toBeCloseTo(4.2, 9);
    expect(turbinePowerW(T, 35, true)).toBe(0);
    expect(turbinePowerW(T, 2.9)).toBe(0);
  });
  it('offshore 15 MW: v_r 10.86, P(8) 5.995 MW', () => {
    expect(ratedSpeed(TURBINE_15MW)).toBeCloseTo(10.86, 2);
    expect(turbinePowerW(TURBINE_15MW, 8) / 1e6).toBeCloseTo(5.995, 3);
  });
  it('rpm: 8 → 7.2; v_r → 8.95; ≥ 11.25 → 10.1; pitch 0 below v_r, ≈ 25° at 25, 90° stopped', () => {
    expect(rotorRpm(T, 8)).toBeCloseTo(7.2, 1);
    expect(rotorRpm(T, ratedSpeed(T))).toBeCloseTo(8.95, 2);
    expect(rotorRpm(T, 11.25)).toBeCloseTo(10.1, 9);
    expect(rotorRpm(T, 26)).toBe(0);
    expect(rotorRpm(T, 26, true)).toBe(10.1);
    expect(pitchDeg(T, 9)).toBe(0);
    expect(pitchDeg(T, 24.9)).toBeCloseTo(25, 0);
    expect(pitchDeg(T, 26)).toBe(90);
  });
});

describe('plant-wind M6 annual energy (Weibull k = 2, η_loss 0.85)', () => {
  it('v̄ 6/7/8 → CF 0.273/0.357/0.430, AEP 14.3/18.8/22.6 GWh; no losses 0.321/0.420/0.506', () => {
    const rows = [
      [6, 0.273, 14.3, 0.321],
      [7, 0.357, 18.8, 0.42],
      [8, 0.43, 22.6, 0.506],
    ] as const;
    for (const [v, cf, aep, cf0] of rows) {
      const e = annualEnergy(TURBINE_6MW, v);
      expect(Math.abs(e.capacityFactor - cf)).toBeLessThanOrEqual(0.0006); // 0.2725 is printed as 0.273
      expect(e.aepWh / 1e9).toBeCloseTo(aep, 1);
      expect(e.capacityFactorNoLoss).toBeCloseTo(cf0, 3);
    }
    expect(annualEnergy(TURBINE_6MW, 8).weibullC).toBeCloseTo(1.1284 * 8, 3);
  });
  it('offshore 15 MW at 9 m/s → CF 0.445, AEP 58.6 GWh', () => {
    const e = annualEnergy(TURBINE_15MW, 9);
    expect(Math.abs(e.capacityFactor - 0.445)).toBeLessThanOrEqual(0.0006); // 0.4455
    expect(Math.abs(e.aepWh / 1e9 - 58.6)).toBeLessThanOrEqual(0.1); // 58.54 (CF 0.4455 × 131.4 GWh)
  });
  it('shear profile 8.5 m/s at 200 m: speeds and CF at 60/100/150 m for α 0.10/0.14/0.25', () => {
    const rows: [number, number[], number[]][] = [
      [TERRAIN_ALPHA.sea, [7.54, 7.93, 8.26], [0.398, 0.425, 0.447]],
      [TERRAIN_ALPHA.steppe, [7.18, 7.71, 8.16], [0.371, 0.41, 0.441]],
      [TERRAIN_ALPHA.forest, [6.29, 7.15, 7.91], [0.298, 0.369, 0.424]],
    ];
    for (const [alpha, vs, cfs] of rows) {
      [60, 100, 150].forEach((h, i) => {
        const v = shearMeanSpeed(h, alpha);
        expect(v).toBeCloseTo(vs[i]!, 2);
        expect(Math.abs(annualEnergy(TURBINE_6MW, v).capacityFactor - cfs[i]!)).toBeLessThanOrEqual(0.0015);
      });
    }
  });
});
