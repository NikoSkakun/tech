import { describe, expect, it } from 'vitest';
import {
  ampereSwingAngle,
  barMagnet,
  compassAngleFromNorth,
  createCompass,
  createDomains,
  cutMagnet,
  electronBeam,
  magnetField,
  magnetForce,
  magnetPoles,
  oerstedProbe,
  solenoid,
  traceMagnetLines,
} from '../index';

const deg = (r: number): number => (r * 180) / Math.PI;

describe('М1 bar magnets', () => {
  it('poles ±q_m = m/l at ±l/2; cut halves keep q_m', () => {
    const m = barMagnet(0, 0, 0);
    const [n, s] = magnetPoles(m);
    expect(n.strengthAm).toBeCloseTo(20, 12);
    expect(s.strengthAm).toBeCloseTo(-20, 12);
    expect(n.position.x).toBeCloseTo(0.05, 12);
    const [a, b] = cutMagnet(m);
    expect(magnetPoles(a)[0].strengthAm).toBeCloseTo(20, 12);
    expect(a.lengthM).toBeCloseTo(0.05, 12);
    expect(b.momentAm2).toBe(1);
  });
  it('far from the magnet the compass follows the Earth field (north); on the axis it points along the magnet', () => {
    const m = [barMagnet(0, 0, 0)];
    const far = magnetField(m, 0.39, 0.0);
    expect(Math.abs(far.x) + Math.abs(far.y)).toBeGreaterThan(0);
    const axis = magnetField(m, 0.15, 0);
    expect(axis.x).toBeGreaterThan(Math.abs(axis.y)); // dominated by the magnet, pointing away from N
    const noMagnet = magnetField([], 0.1, 0.1);
    expect(noMagnet.y).toBeCloseTo(20e-6, 15);
  });
  it('field lines leave N and end at S (some leave the table)', () => {
    const lines = traceMagnetLines([barMagnet(0, 0, 0)]);
    expect(lines).toHaveLength(14);
    expect(lines.filter((l) => l.end === 'sink').length).toBeGreaterThan(6);
  });
  it('opposite poles attract, like poles repel, force capped at 5 N', () => {
    const a = barMagnet(0, 0, 0);
    const attract = magnetForce(a, barMagnet(0.15, 0, 0)); // N of a faces S of b
    expect(attract.x).toBeLessThan(0);
    const repel = magnetForce(a, barMagnet(0.15, 0, Math.PI));
    expect(repel.x).toBeGreaterThan(0);
    const touching = magnetForce(a, barMagnet(0.1005, 0, 0));
    expect(Math.hypot(touching.x, touching.y)).toBeLessThanOrEqual(5 + 1e-9);
  });
  it('compass follows critically damped (no overshoot)', () => {
    const c = createCompass(Math.PI / 2);
    let max = 0;
    for (let i = 0; i < 60; i++) max = Math.max(max, c.step(Math.PI, 1 / 30));
    expect(c.state.value).toBeCloseTo(Math.PI, 3);
    expect(max).toBeLessThanOrEqual(Math.PI + 1e-6);
  });
});

describe('М2 domains', () => {
  it('h = 0,35 → 50 % aligned, M ≈ 0,5; h = 1 → 1; back to 0 → ≈ 0,7; h = −0,35 → 0; h = −1 → −1', () => {
    const d = createDomains(5);
    expect(d.state.magnetization).toBeCloseTo(0, 9);
    d.update(0.35, 20);
    expect(Array.from(d.state.aligned).filter((a) => a !== 0)).toHaveLength(20);
    expect(d.state.magnetization).toBeCloseTo(0.5, 9);
    d.update(1, 20);
    expect(d.state.magnetization).toBeCloseTo(1, 12);
    d.update(0, 20);
    expect(d.state.magnetization).toBeCloseTo(0.7, 9);
    d.update(-0.35, 20);
    expect(d.state.magnetization).toBeCloseTo(0, 9);
    d.update(-1, 20);
    expect(d.state.magnetization).toBeCloseTo(-1, 12);
  });
  it('above 770 °C M = 0; after cooling the sample is demagnetised', () => {
    const d = createDomains(2);
    d.update(1, 20);
    d.update(1, 800);
    expect(d.state.magnetization).toBe(0);
    expect(d.state.aboveCurie).toBe(true);
    d.update(0, 20);
    expect(d.state.magnetization).toBeCloseTo(0, 9);
    expect(d.state.jitter).toBeCloseTo(20 / 770, 9);
  });
});

describe('М3 wire and solenoid; beam and swing', () => {
  it('probe: 10 A at 1 cm → 200 μT; 5 A at 2 cm → 50 μT, 68,2°; 1 A at 2 cm → 10 μT, 26,6°; 5 A at 1 cm → 100 μT, 78,7°', () => {
    expect(oerstedProbe(10, 0.01).fieldMicroT).toBeCloseTo(200, 9);
    expect(oerstedProbe(5, 0.02).fieldMicroT).toBeCloseTo(50, 9);
    expect(deg(oerstedProbe(5, 0.02).angleRad)).toBeCloseTo(68.2, 1);
    expect(deg(oerstedProbe(1, 0.02).angleRad)).toBeCloseTo(26.6, 1);
    expect(deg(oerstedProbe(5, 0.01).angleRad)).toBeCloseTo(78.7, 1);
    expect(deg(oerstedProbe(-5, 0.01).angleRad)).toBeCloseTo(-78.7, 1);
  });
  it('ring compass 6 cm west at 10 A: 33,3 μT > 20 μT → points south (180°); east → north (0°)', () => {
    expect(Math.abs(deg(compassAngleFromNorth(10, -0.06, 0)))).toBeCloseTo(180, 6);
    expect(deg(compassAngleFromNorth(10, 0.06, 0))).toBeCloseTo(0, 6);
  });
  it('solenoid N = 500: 1 A → 6,28 mT air, 1,049 T core; 2 A → 1,467 T; 0,2 A → 0,249 T; clips ∝ B²', () => {
    expect(solenoid(500, 1, false).fieldT * 1e3).toBeCloseTo(6.28, 2);
    expect(solenoid(500, 1, true).fieldT).toBeCloseTo(1.049, 3);
    expect(solenoid(500, 2, true).fieldT).toBeCloseTo(1.467, 3);
    expect(solenoid(500, 0.2, true).fieldT).toBeCloseTo(0.249, 3);
    expect(solenoid(500, 2, true).clips).toBe(Math.round(40 * (1.4674 / 1.6) ** 2));
    expect(solenoid(500, 1, true, true).fieldT).toBeLessThan(0);
  });
  it('beam: 100 V → 5,93×10⁶ m/s, 1 mT → 3,37 cm; 300 V, 2 mT → 2,92 cm; proton ×43', () => {
    const e = electronBeam(100, 1e-3);
    expect(e.speedMPerS / 5.93e6).toBeCloseTo(1, 3);
    expect(e.radiusM * 100).toBeCloseTo(3.37, 2);
    expect(e.closedCircle).toBe(true);
    expect(electronBeam(300, 2e-3).radiusM * 100).toBeCloseTo(2.92, 2);
    expect(electronBeam(100, 1e-3, 'proton').radiusM / e.radiusM).toBeCloseTo(42.85, 1);
    expect(electronBeam(100, 0).radiusM).toBe(Infinity);
  });
  it('Ampère swing: 5 A → 37,4°, 1 A → 8,7°; flipped magnet reverses', () => {
    expect(deg(ampereSwingAngle(5))).toBeCloseTo(37.4, 1);
    expect(deg(ampereSwingAngle(1))).toBeCloseTo(8.7, 1);
    expect(deg(ampereSwingAngle(5, true))).toBeCloseTo(-37.4, 1);
  });
});
