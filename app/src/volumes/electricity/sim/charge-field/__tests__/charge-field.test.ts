import { describe, expect, it } from 'vitest';
import {
  BALL_DEFAULTS,
  balloonCapacitanceF,
  chargeTransfer,
  coulombPair,
  createBalloon,
  createDischarge,
  createMovingCharge,
  FIELD_PRESETS,
  gravityComparison,
  inducedSurfaceDensity,
  landscapeHeight,
  parallelPlateCapacitor,
  POTENTIAL_PRESETS,
  probeField,
  probePotential,
  RELEASE_DEFAULTS,
  sphereInUniformField,
  toPointCharges,
  traceFieldLines,
  voltmeter,
} from '../index';
import { vec3, vLength } from '../../core/S1-sim/field';

describe('step charge — transfer and conservation', () => {
  it('q = n·e, total always 0', () => {
    const t = chargeTransfer(1e9);
    expect(t.leftChargeC).toBeCloseTo(1.602e-10, 13);
    expect(t.totalChargeC).toBe(0);
    expect(chargeTransfer(-3).rightChargeC).toBeCloseTo(3 * 1.602176634e-19, 30);
  });
});

describe('§2 Coulomb', () => {
  it('control points', () => {
    const a = coulombPair(10, 10, 0.03);
    expect(a.forceN).toBeCloseTo(9.99e-4, 6);
    expect(a.kind).toBe('repulsion');
    const b = coulombPair(20, -20, 0.05);
    expect(b.forceN).toBeCloseTo(1.44e-3, 5);
    expect(b.kind).toBe('attraction');
    expect(b.arrowLengthL0).toBeCloseTo(2.0, 1);
    expect(coulombPair(20, -20, 0.1).forceN).toBeCloseTo(3.6e-4, 6);
  });
  it('arrow length spans 0,35…3 L₀ over the scene range; 0 when a charge is zero', () => {
    expect(coulombPair(1, 1, 0.2).arrowLengthL0).toBeCloseTo(0.355, 2);
    expect(coulombPair(50, 50, 0.01).arrowLengthL0).toBeLessThanOrEqual(3);
    expect(coulombPair(50, 50, 0.01).arrowLengthL0).toBeGreaterThan(2.99);
    expect(coulombPair(0, 20, 0.05)).toMatchObject({ forceN: 0, kind: 'none', arrowLengthL0: 0 });
  });
  it('gravity comparison F_e 8,24×10⁻⁸, F_g 3,63×10⁻⁴⁷, ratio 2,27×10³⁹', () => {
    const g = gravityComparison();
    expect(g.electricN / 8.24e-8).toBeCloseTo(1, 2);
    expect(g.gravityN / 3.63e-47).toBeCloseTo(1, 2);
    expect(g.ratio / 2.27e39).toBeCloseTo(1, 2);
  });
});

describe('§3 field', () => {
  it('probe control points', () => {
    expect(probeField(FIELD_PRESETS.single, 0.05, 0).magnitudeVPerM).toBeCloseTo(3595, 0);
    const mid = probeField(FIELD_PRESETS.dipole, 0, 0);
    expect(mid.magnitudeVPerM / 4.49e4).toBeCloseTo(1, 2);
    expect(mid.field.x).toBeGreaterThan(0); // from + (x = −2 cm) to − (x = +2 cm)
    expect(probeField(FIELD_PRESETS.likeCharges, 0, 0).magnitudeVPerM).toBeLessThan(1e-6);
    expect(probeField(FIELD_PRESETS.single, 0.001, 0).x).toBeCloseTo(0.006, 9);
  });
  it('line count 8·|q| per positive charge; dipole lines end in the negative charge', () => {
    const lines = traceFieldLines(FIELD_PRESETS.dipole);
    expect(lines).toHaveLength(8);
    expect(lines.filter((l) => l.end === 'sink').length).toBeGreaterThanOrEqual(6);
    expect(traceFieldLines([{ x: 0, z: 0, chargeNC: 2 }])).toHaveLength(16);
    const neg = traceFieldLines([{ x: 0, z: 0, chargeNC: -1 }]);
    expect(neg).toHaveLength(8);
    expect(neg.every((l) => l.end === 'boundary')).toBe(true);
    for (const l of lines) for (const p of l.points) expect(Number.isFinite(p.x + p.z)).toBe(true);
  });
  it('released charge (frictionless) ends in 1,5–4,5 s by capture/escape or times out at 4 s', () => {
    for (const [x, z] of [[-0.05, 0.02], [0.05, 0.05], [-0.1, 0], [0, 0.03]]) {
      const m = createMovingCharge({ ...RELEASE_DEFAULTS, charges: toPointCharges(FIELD_PRESETS.dipole) }, { x, z });
      for (let i = 0; i < 300 && m.state.status === 'moving'; i++) m.step(1 / 30);
      expect(m.state.status).not.toBe('moving');
      expect(m.state.timeS).toBeLessThan(4.5);
    }
  });
  it('energy is conserved in frictionless motion (before capture)', () => {
    const ch = toPointCharges(FIELD_PRESETS.dipole);
    const m = createMovingCharge({ ...RELEASE_DEFAULTS, charges: ch }, { x: -0.1, z: 0 });
    const phi0 = probePotential(FIELD_PRESETS.dipole, -0.1, 0);
    for (let i = 0; i < 30; i++) m.step(1 / 30);
    const ke = 0.5 * (m.state.vx ** 2 + m.state.vz ** 2);
    const pe = RELEASE_DEFAULTS.chargePerMassCPerKg * (probePotential(FIELD_PRESETS.dipole, m.state.x, m.state.z) - phi0);
    expect(ke + pe).toBeCloseTo(0, 6);
  });
});

describe('§4 potential', () => {
  it('φ(5 cm from +1 nC) = 179,8 V; «Горб і яма» midpoint 0 V', () => {
    expect(probePotential(FIELD_PRESETS.single, 0.05, 0)).toBeCloseTo(179.75, 1);
    expect(probePotential(POTENTIAL_PRESETS.hillAndWell, 0, 0)).toBeCloseTo(0, 9);
    expect(voltmeter(POTENTIAL_PRESETS.hillAndWell, { x: 0, z: 0.03 }, { x: 0, z: -0.05 }).sameIsoline).toBe(true);
  });
  it('height bounded by H = 6 cm, keeps sign, inverts for a negative ball', () => {
    const h = landscapeHeight(POTENTIAL_PRESETS.hillAndWell, -0.06, 0);
    expect(h).toBeGreaterThan(0.05);
    expect(h).toBeLessThanOrEqual(0.06);
    expect(landscapeHeight(POTENTIAL_PRESETS.hillAndWell, -0.06, 0, -1)).toBeCloseTo(-h, 12);
  });
  it('ball rolls into the well and stops within ~3 s', () => {
    const m = createMovingCharge({ ...BALL_DEFAULTS, charges: toPointCharges(POTENTIAL_PRESETS.hillAndWell) }, { x: 0, z: 0.05 });
    let t = 0;
    while (m.state.status === 'moving' && t < 10) {
      m.step(1 / 30);
      t += 1 / 30;
    }
    expect(m.state.status).toBe('captured');
    expect(t).toBeGreaterThan(2);
    expect(t).toBeLessThan(4);
    expect(m.state.x).toBeGreaterThan(0.05); // near the −2 nC well at x = +6 cm
  });
});

describe('conductor in field', () => {
  it('E = 0 inside, 3E₀ at the pole, E₀ far away; σ = 3ε₀E₀cosθ', () => {
    const R = 0.05;
    expect(vLength(sphereInUniformField(5e4, R, vec3(0, 0, 0.01)))).toBe(0);
    expect(sphereInUniformField(5e4, R, vec3(0, 0, R)).z).toBeCloseTo(1.5e5, 6);
    expect(sphereInUniformField(5e4, R, vec3(0, 0, 10)).z / 5e4).toBeCloseTo(1, 5);
    expect(inducedSurfaceDensity(5e4, 0)).toBeCloseTo(3 * 8.8541878188e-12 * 5e4, 18);
  });
});

describe('§5 balloon', () => {
  it('C = 1,34×10⁻¹¹ F; −300 nC → −22,5 kV, spark gap ≈ 7,5 mm; sticks from 60 nC; spark discharges', () => {
    expect(balloonCapacitanceF()).toBeCloseTo(1.335e-11, 13);
    const b = createBalloon();
    for (let i = 0; i < 25; i++) b.rub();
    expect(b.state.chargeC).toBeCloseTo(-300e-9, 15);
    expect(b.state.voltageV / -22.5e3).toBeCloseTo(1, 2);
    expect(b.state.sparkGapM * 1000).toBeCloseTo(7.5, 1);
    expect(b.fingerAt(0.008)).toBe(false);
    expect(b.fingerAt(0.007)).toBe(true);
    expect(b.state.chargeC).toBe(0);
    for (let i = 0; i < 3; i++) b.rub();
    expect(b.state.sticksToWall).toBe(false);
    b.rub();
    expect(b.state.sticksToWall).toBe(true);
  });
  it('drag reversals count passes only after ≥ 4 cm strokes', () => {
    const b = createBalloon();
    const path = [0, 0.02, 0.05, 0.03, 0.0, 0.02, 0.03, 0.01];
    let passes = 0;
    for (const x of path) if (b.dragTo(x)) passes++;
    // strokes: 0→0,05 (5 cm, reversal → pass), 0,05→0 (5 cm, reversal → pass), 0→0,03 (3 cm → no)
    expect(passes).toBe(2);
    expect(b.state.chargeC).toBeCloseTo(-30e-9, 15);
  });
});

describe('§6 capacitor, §7 discharge', () => {
  it('air, 100 cm², 1 mm, 100 V → 88,5 pF, 8,85 nC (5,5×10¹⁰ e), 0,1 kV/mm, 0,443 μJ', () => {
    const c = parallelPlateCapacitor({ voltageV: 100, areaM2: 100e-4, gapM: 1e-3, dielectric: 'air' });
    // doc rounds to 88,5 pF; with ε_r(air) = 1,0006 the exact value is 88,60 pF (audit C1)
    expect(c.capacitanceF * 1e12 / 88.5).toBeCloseTo(1, 2);
    expect(c.chargeC * 1e9).toBeCloseTo(8.86, 2);
    expect(c.electrons / 5.5e10).toBeCloseTo(1, 1);
    expect(c.fieldVPerM).toBeCloseTo(1e5, 6);
    expect(c.energyJ * 1e6).toBeCloseTo(0.443, 3);
    expect(c.lampVisible).toBe(false);
  });
  it('glass → 531 pF, 2,66 μJ; ceramic 400 cm², 0,1 mm, 1000 V → 10 kV/mm (edge, no breakdown), 7,08 μF, 3,54 J', () => {
    const g = parallelPlateCapacitor({ voltageV: 100, areaM2: 100e-4, gapM: 1e-3, dielectric: 'glass' });
    expect(g.capacitanceF * 1e12).toBeCloseTo(531, 0);
    expect(g.energyJ * 1e6).toBeCloseTo(2.66, 2);
    const k = parallelPlateCapacitor({ voltageV: 1000, areaM2: 400e-4, gapM: 0.1e-3, dielectric: 'ceramic' });
    expect(k.fieldVPerM).toBeCloseTo(1e7, 0);
    expect(k.breakdown).toBe(false);
    expect(k.capacitanceF * 1e6).toBeCloseTo(7.08, 2);
    expect(k.energyJ).toBeCloseTo(3.54, 2);
  });
  it('air, 0,1 mm, 400 V → 4 kV/mm > 3 → breakdown, rebound to 0,9·E_b·d = 270 V', () => {
    const a = parallelPlateCapacitor({ voltageV: 400, areaM2: 100e-4, gapM: 0.1e-3, dielectric: 'air' });
    expect(a.breakdown).toBe(true);
    expect(a.reboundVoltageV).toBeCloseTo(270, 9);
  });
  it('supercap discharge: 20 s → 0,993 V, 46 s → 0,27 V; ×4 scene time; lamp off below 0,03', () => {
    const d = createDischarge();
    d.setClosed(true);
    for (let i = 0; i < 150; i++) d.step(1 / 30); // 5 s scene = 20 s model
    expect(d.state.modelTimeS).toBeCloseTo(20, 6);
    expect(d.state.voltageV).toBeCloseTo(0.993, 3);
    for (let i = 0; i < 195; i++) d.step(1 / 30);
    expect(d.state.voltageV).toBeCloseTo(0.27, 2);
    // (U/U₀)² = 0,01 < 0,03 → visually off (off from t = τ·ln(1/√0,03) ≈ 35 s)
    expect(d.state.lampOn).toBe(false);
    d.recharge();
    expect(d.state.voltageV).toBe(2.7);
  });
});
