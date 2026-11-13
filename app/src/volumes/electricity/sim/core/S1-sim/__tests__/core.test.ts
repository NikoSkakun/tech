import { describe, expect, it } from 'vitest';
import { amplitudeSpectrum, fft, thd } from '../fft';
import {
  dipoleField,
  dipoleFluxThroughLoop,
  electricField,
  electricPotential,
  loopAxisField,
  poleField,
  solenoidAxisField,
  solenoidFieldAir,
  traceStreamline,
  vec3,
  vLength,
  wireField,
  wireFieldMagnitude,
} from '../field';
import { siPrefix, durationParts, scientific } from '../format';
import { bisect, argmax, subStepCount, wrapDeg180 } from '../math';
import { createFollower, criticalFollowerParams } from '../oscillator';
import { capacitorReactivePower, powerTriangle, seriesRlc } from '../phasor';
import { createRng } from '../rng';
import { createRotatingCoil, rotatingCoilReadouts } from '../rotating-coil';
import { emBand, photonBand, photonWavelengthNm, wavelengthToRgb } from '../spectrum';
import { rcDischarge, rlDecay, rlRise, seriesRlcStep } from '../transient';
import { mean, rms, sampleWave, threePhase } from '../waveform';

describe('math helpers', () => {
  it('bisect / argmax / subStepCount / wrap', () => {
    expect(bisect((x) => x * x - 2, 0, 2)).toBeCloseTo(Math.SQRT2, 12);
    expect(argmax((x) => -((x - 3) ** 2), 0, 10)).toBeCloseTo(3, 6);
    expect(subStepCount(1 / 30, 1e-3)).toBe(34);
    expect(subStepCount(0, 1e-3)).toBe(0);
    expect(wrapDeg180(190)).toBe(-170);
    expect(wrapDeg180(-180)).toBe(180);
  });
  it('rng is deterministic per seed and in [0,1)', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) {
      const x = a.next();
      expect(x).toBe(b.next());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe('transients', () => {
  it('RC discharge U₀·e^(−t/RC): 2,7 V, 2 Ω × 10 F → 0,993 V at 20 s (charge-field §7)', () => {
    expect(rcDischarge(2.7, 2, 10, 20)).toBeCloseTo(0.9933, 4);
    expect(rcDischarge(2.7, 2, 10, 46)).toBeCloseTo(0.2707, 4);
  });
  it('RL rise/decay (magnetism М7: τ = 0,1 s, I₀ = 1,2 A)', () => {
    expect(rlRise(12, 10, 1, 0.1)).toBeCloseTo(0.7585, 4);
    expect(rlDecay(1.2, 20, 1, 0.05)).toBeCloseTo(0.4415, 4);
  });
  it('series RLC step matches RK4 integration in all three regimes', () => {
    for (const R of [10, 2 * Math.sqrt(0.1 / 1e-4), 200]) {
      const L = 0.1;
      const C = 1e-4;
      const U = 10;
      let i = 0;
      let uc = 0;
      const h = 1e-6;
      const f = (ii: number, u: number): [number, number] => [(U - R * ii - u) / L, ii / C];
      for (let k = 0; k < 20000; k++) {
        const [a1, b1] = f(i, uc);
        const [a2, b2] = f(i + (h / 2) * a1, uc + (h / 2) * b1);
        const [a3, b3] = f(i + (h / 2) * a2, uc + (h / 2) * b2);
        const [a4, b4] = f(i + h * a3, uc + h * b3);
        i += (h / 6) * (a1 + 2 * a2 + 2 * a3 + a4);
        uc += (h / 6) * (b1 + 2 * b2 + 2 * b3 + b4);
      }
      const exact = seriesRlcStep({ resistanceOhm: R, inductanceH: L, capacitanceF: C, stepV: U }, 0.02);
      expect(exact.currentA).toBeCloseTo(i, 6);
      expect(exact.capacitorV).toBeCloseTo(uc, 6);
    }
    expect(seriesRlcStep({ resistanceOhm: 10, inductanceH: 0.1, capacitanceF: 1e-4, stepV: 1 }, 0).regime).toBe('underdamped');
    expect(seriesRlcStep({ resistanceOhm: 200, inductanceH: 0.1, capacitanceF: 1e-4, stepV: 1 }, 0).regime).toBe('overdamped');
  });
});

describe('phasors — generator-ac Г6/Г7 control points', () => {
  const base = { voltageV: 230, resistanceOhm: 50, inductanceH: 0.3, capacitanceF: 30e-6 };
  it('25 Hz → Z 172,5 Ω, I 1,333 A, φ −73,1°', () => {
    const r = seriesRlc({ ...base, frequencyHz: 25 });
    expect(r.impedanceOhm).toBeCloseTo(172.5, 1);
    expect(r.currentA).toBeCloseTo(1.333, 3);
    expect(r.phaseDeg).toBeCloseTo(-73.1, 1);
  });
  it('50 Hz → X_L 94,25, X_C 106,10, Z 51,39, I 4,476, φ −13,34°, U_L 421,8, U_C 474,9, P 1001,7', () => {
    const r = seriesRlc({ ...base, frequencyHz: 50 });
    expect(r.reactanceLOhm).toBeCloseTo(94.25, 2);
    expect(r.reactanceCOhm).toBeCloseTo(106.1, 2);
    expect(r.impedanceOhm).toBeCloseTo(51.39, 2);
    expect(r.currentA).toBeCloseTo(4.476, 3);
    expect(r.phaseDeg).toBeCloseTo(-13.34, 2);
    expect(r.voltageLV).toBeCloseTo(421.8, 1);
    expect(r.voltageCV).toBeCloseTo(474.9, 1);
    expect(r.activePowerW).toBeCloseTo(1001.7, 1);
  });
  it('resonance f₀ = 53,05 Hz → I 4,600 A, U_L = U_C = 460 V, φ = 0; 100 Hz → Z 144,4, φ +69,74°', () => {
    const f0 = seriesRlc({ ...base, frequencyHz: 50 }).resonanceHz;
    expect(f0).toBeCloseTo(53.05, 2);
    const r = seriesRlc({ ...base, frequencyHz: f0 });
    expect(r.currentA).toBeCloseTo(4.6, 6);
    expect(r.voltageLV).toBeCloseTo(460, 6);
    expect(r.voltageCV).toBeCloseTo(460, 6);
    expect(r.phaseDeg).toBeCloseTo(0, 6);
    const r100 = seriesRlc({ ...base, frequencyHz: 100 });
    expect(r100.impedanceOhm).toBeCloseTo(144.4, 1);
    expect(r100.currentA).toBeCloseTo(1.593, 3);
    expect(r100.phaseDeg).toBeCloseTo(69.74, 2);
  });
  it('without capacitor / inductor the phase is pure ±90° or 0', () => {
    expect(seriesRlc({ voltageV: 230, frequencyHz: 50, resistanceOhm: 0, inductanceH: 0.3, capacitanceF: Infinity }).phaseDeg).toBeCloseTo(90, 9);
    expect(seriesRlc({ voltageV: 230, frequencyHz: 50, resistanceOhm: 0, inductanceH: 0, capacitanceF: 30e-6 }).phaseDeg).toBeCloseTo(-90, 9);
    expect(seriesRlc({ voltageV: 230, frequencyHz: 50, resistanceOhm: 50, inductanceH: 0, capacitanceF: Infinity }).phaseDeg).toBe(0);
  });
  it('power triangle and capacitor Q', () => {
    const t = powerTriangle(1500, 0.8);
    expect(t.apparentPowerVA).toBeCloseTo(1875, 9);
    expect(t.reactivePowerVar).toBeCloseTo(1125, 9);
    expect(capacitorReactivePower(38e-6, 230, 50)).toBeCloseTo(631.5, 1);
  });
});

describe('field math', () => {
  const nC = 1e-9;
  it('single +1 nC at 5 cm → |E| = 3,60×10³ V/m, φ = 179,8 V (charge-field §3/§4)', () => {
    const q = [{ position: vec3(), chargeC: nC }];
    expect(vLength(electricField(q, vec3(0.05)))).toBeCloseTo(3595, 0);
    expect(electricPotential(q, vec3(0.05))).toBeCloseTo(179.75, 2);
  });
  it('dipole ±1 nC 4 cm apart: midpoint |E| = 4,49×10⁴ V/m from + to −; like charges → 0', () => {
    const d = [
      { position: vec3(-0.02), chargeC: nC },
      { position: vec3(0.02), chargeC: -nC },
    ];
    const e = electricField(d, vec3());
    expect(e.x).toBeCloseTo(44938, 0);
    const same = [
      { position: vec3(-0.02), chargeC: nC },
      { position: vec3(0.02), chargeC: nC },
    ];
    expect(vLength(electricField(same, vec3()))).toBeLessThan(1e-9);
  });
  it('softening reduces the field near the charge but not far away', () => {
    const q = [{ position: vec3(), chargeC: nC }];
    expect(vLength(electricField(q, vec3(0.001), 0.002))).toBeLessThan(vLength(electricField(q, vec3(0.001))));
    expect(vLength(electricField(q, vec3(0.15), 0.002)) / vLength(electricField(q, vec3(0.15)))).toBeCloseTo(1, 3);
  });
  it('wire: B = μ₀I/(2πr) = 200 μT at 10 A, 1 cm; direction counter-clockwise seen from +z', () => {
    expect(wireFieldMagnitude(10, 0.01)).toBeCloseTo(2e-4, 12);
    const b = wireField(10, vec3(), vec3(0, 0, 1), vec3(0, 0.01, 0));
    expect(b.x).toBeCloseTo(-2e-4, 12);
    expect(b.y).toBeCloseTo(0, 15);
  });
  it('solenoid / loop / dipole consistency', () => {
    expect(solenoidFieldAir(500, 0.1, 1)).toBeCloseTo(6.2832e-3, 7);
    // a very long finite solenoid → interior value
    expect(solenoidAxisField(5000, 1, 0.01, 1, 0) / solenoidFieldAir(5000, 1, 1)).toBeCloseTo(1, 3);
    // far field of a loop equals dipole field with m = I·πa²
    const a = 0.01;
    const z = 1;
    const dip = dipoleField(vec3(0, 0, Math.PI * a * a), vec3(), vec3(0, 0, z));
    expect(loopAxisField(1, a, z) / dip.z).toBeCloseTo(1, 3);
    // Gilbert pair approximates the dipole far away
    const poles = [
      { position: vec3(0, 0, 0.005), strengthAm: 1 / 0.01 },
      { position: vec3(0, 0, -0.005), strengthAm: -1 / 0.01 },
    ];
    expect(poleField(poles, vec3(0, 0, 1)).z / dipoleField(vec3(0, 0, 1), vec3(), vec3(0, 0, 1)).z).toBeCloseTo(1, 3);
    expect(dipoleFluxThroughLoop(0.875, 0.015, 0)).toBeCloseTo(3.665e-5, 8);
  });
  it('RK4 streamline from a single charge is radial and stops at the boundary', () => {
    const q = [{ position: vec3(), chargeC: nC }];
    const line = traceStreamline((p) => electricField(q, p), vec3(0.006, 0.006), {
      stepM: 0.0015,
      maxSteps: 400,
      stop: (p) => (vLength(p) > 0.2 ? 'boundary' : null),
    });
    expect(line.end).toBe('boundary');
    const last = line.points[line.points.length - 1];
    expect(last.x / last.y).toBeCloseTo(1, 9);
  });
});

describe('waveforms / FFT / THD', () => {
  it('RMS of a sine = U_max/√2; three-phase set sums to zero', () => {
    const s = sampleWave((t) => 325 * Math.sin(2 * Math.PI * 50 * t), 0, 0.02, 1000);
    expect(rms(s)).toBeCloseTo(325 / Math.SQRT2, 6);
    expect(mean(s)).toBeCloseTo(0, 9);
    for (const t of [0, 0.0013, 0.007]) {
      const [a, b, c] = threePhase(230, 50, t);
      expect(a + b + c).toBeCloseTo(0, 9);
    }
  });
  it('FFT radix-2 matches the DFT; amplitude spectrum recovers sinusoids', () => {
    const n = 64;
    const x = Array.from({ length: n }, (_, i) => 3 + 2 * Math.cos((2 * Math.PI * 5 * i) / n) + Math.sin((2 * Math.PI * 9 * i) / n));
    const a = amplitudeSpectrum(x);
    expect(a[0]).toBeCloseTo(3, 9);
    expect(a[5]).toBeCloseTo(2, 9);
    expect(a[9]).toBeCloseTo(1, 9);
    const odd = fft(x.slice(0, 63));
    expect(odd.re.length).toBe(63);
  });
  it('THD of a square wave (40 harmonics) = √(Σ 1/h², h = 3,5…39); pure sine → 0', () => {
    const n = 4096;
    const sq = Array.from({ length: n }, (_, i) => (i < n / 2 ? 1 : -1));
    let s = 0;
    for (let h = 3; h <= 39; h += 2) s += 1 / (h * h);
    expect(thd(sq).thd).toBeCloseTo(Math.sqrt(s), 3);
    const sine = Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 3 * i) / n));
    expect(thd(sine, 3).thd).toBeLessThan(1e-9);
  });
});

describe('format / spectrum', () => {
  it('SI prefixes', () => {
    expect(siPrefix(2.03e-3)).toMatchObject({ prefix: 'm', exponent: -3 });
    expect(siPrefix(1e-12).prefix).toBe('p');
    expect(siPrefix(1.6e-19 * 5).prefix).toBe('a');
    expect(siPrefix(3.3e-7, ['p', 'n', 'μ', 'm', '']).prefix).toBe('n');
    expect(durationParts(40800)).toEqual({ value: 40800 / 3600, unit: 'h' });
    expect(scientific(0.000735)).toEqual({ mantissa: expect.closeTo(7.35, 9) as number, exponent: -4 });
  });
  it('photons: 656 nm visible red, 121,6 nm UV, 1875 nm IR; EM bands', () => {
    expect(photonWavelengthNm(1.889)).toBeCloseTo(656.35, 1);
    expect(photonBand(121.6)).toBe('uv');
    expect(photonBand(1875)).toBe('ir');
    const [r, g, b] = wavelengthToRgb(656);
    expect(r).toBeGreaterThan(0.9);
    expect(g + b).toBe(0);
    expect(wavelengthToRgb(300)).toEqual([0, 0, 0]);
    expect(emBand(1e8)).toBe('radio');
    expect(emBand(2.4e9)).toBe('microwave');
    expect(emBand(5e14)).toBe('visible');
    expect(emBand(1e18)).toBe('xray');
  });
});

describe('instrument follower', () => {
  it('critical follower with τ settles without overshoot; ζ < 1 overshoots', () => {
    const f = createFollower(criticalFollowerParams(0.12));
    let max = 0;
    for (let i = 0; i < 60; i++) max = Math.max(max, f.step(1, 1 / 30));
    expect(f.state.value).toBeCloseTo(1, 3);
    expect(max).toBeLessThanOrEqual(1 + 1e-6);
    const g = createFollower({ omegaN: 2 * Math.PI * 2, zeta: 0.3 });
    let m2 = 0;
    for (let i = 0; i < 60; i++) m2 = Math.max(m2, g.step(1, 1 / 30));
    expect(m2).toBeGreaterThan(1.1);
  });
  it('angular mode takes the short way round', () => {
    const f = createFollower({ omegaN: 20, zeta: 1, angular: true }, 3);
    for (let i = 0; i < 90; i++) f.step(-3, 1 / 30);
    expect(Math.abs(Math.atan2(Math.sin(f.state.value + 3), Math.cos(f.state.value + 3)))).toBeLessThan(1e-3);
    expect(f.state.value).toBeGreaterThan(3); // went through π, not back through 0
  });
});

describe('rotating coil — magnetism М8 / generator-ac Г1', () => {
  it('3000 rpm → ω = 314,16 rad/s, ℰ_max = 157,08 V, 50 Hz; 600 rpm → 31,42 V, 10 Hz; 120 rpm → 6,3 V', () => {
    const p = { turns: 100, fieldT: 0.5, areaM2: 0.01 };
    const r = rotatingCoilReadouts(p, 3000);
    expect(r.omegaRadPerS).toBeCloseTo(314.16, 2);
    expect(r.emfMaxV).toBeCloseTo(157.08, 2);
    expect(r.frequencyHz).toBe(50);
    expect(rotatingCoilReadouts(p, 600).emfMaxV).toBeCloseTo(31.42, 2);
    expect(rotatingCoilReadouts(p, 600).frequencyHz).toBe(10);
    expect(rotatingCoilReadouts(p, 120).emfMaxV).toBeCloseTo(6.28, 2);
  });
  it('speed drive: e(t) = NBAω·sin θ, commutator rectifies', () => {
    const c = createRotatingCoil({ speedRpm: 3000 });
    let max = 0;
    let min = 0;
    for (let i = 0; i < 120; i++) {
      const s = c.step(1 / 240);
      max = Math.max(max, s.emfV);
      min = Math.min(min, s.emfV);
      expect(s.emfV).toBeCloseTo(s.emfMaxV * Math.sin(s.angleRad), 9);
    }
    expect(max).toBeGreaterThan(150);
    expect(min).toBeLessThan(-150);
    c.set({ output: 'commutator' });
    for (let i = 0; i < 50; i++) expect(c.step(1 / 240).emfV).toBeGreaterThanOrEqual(0);
  });
  it('hand drive: follows cursor, capped at 600 rpm, coasts down under Lenz braking after release', () => {
    const c = createRotatingCoil({ drive: 'hand', handRpm: 2000 });
    for (let i = 0; i < 60; i++) c.step(1 / 30);
    expect(c.state.speedRpm).toBeCloseTo(600, 1);
    c.set({ handRpm: null });
    let prev = c.state.speedRpm;
    for (let i = 0; i < 300; i++) {
      const s = c.step(1 / 30);
      expect(s.speedRpm).toBeLessThanOrEqual(prev + 1e-9);
      expect(Number.isFinite(s.emfV)).toBe(true);
      prev = s.speedRpm;
    }
    expect(prev).toBeLessThan(60);
  });
});
