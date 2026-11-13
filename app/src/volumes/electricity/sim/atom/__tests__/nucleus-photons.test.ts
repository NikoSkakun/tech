import { describe, expect, it } from 'vitest';
import {
  createHydrogenAtom,
  FORCE_CROSSOVER_FM,
  GROUND_RESONANCES_EV,
  nucleonForces,
  photonOutcome,
  REFERENCE_LINES_NM,
  transitionEnergyEv,
} from '../index';
import { photonWavelengthNm } from '../../core/S1-sim/spectrum';

describe('atom §1 nucleon forces', () => {
  it.each([
    [1, 230.7, 25000, 108, 'strong'],
    [2, 57.7, 2709, 47, 'strong'],
    [3, 25.6, 293.6, 11, 'strong'],
    [4, 14.4, 31.8, 2.2, 'strong'],
    [5, 9.2, 3.4, 0.37, 'coulomb'],
  ] as const)('r = %d fm → F_C %f N, F_s %f N, ratio %f, %s', (r, fc, fs, ratio, dom) => {
    const f = nucleonForces(r);
    expect(f.coulombN / fc).toBeCloseTo(1, 2);
    expect(f.strongN / fs).toBeCloseTo(1, 1);
    expect(f.ratio / ratio).toBeCloseTo(1, 1);
    expect(f.dominant).toBe(dom);
  });
  it('crossover F_s = F_C at ≈ 4,45 fm; drag clamped to 1…6 fm', () => {
    expect(FORCE_CROSSOVER_FM).toBeCloseTo(4.45, 2);
    expect(nucleonForces(0.5).distanceFm).toBe(1);
    expect(nucleonForces(9).distanceFm).toBe(6);
    expect(nucleonForces(4.4).escapesOnRelease).toBe(false);
    expect(nucleonForces(4.5).escapesOnRelease).toBe(true);
  });
});

describe('atom §3 photon gun', () => {
  it('transition table: energies (±0,01 eV) and wavelengths (±0,3 nm visible, ±0,1 % otherwise)', () => {
    for (const [key, ref] of Object.entries(REFERENCE_LINES_NM)) {
      const [u, l] = key.split('→').map(Number);
      const wl = photonWavelengthNm(transitionEnergyEv(u, l));
      if (ref >= 380 && ref <= 750) expect(Math.abs(wl - ref)).toBeLessThanOrEqual(0.3);
      else expect(Math.abs(wl - ref) / ref).toBeLessThanOrEqual(0.001);
    }
    expect(GROUND_RESONANCES_EV.map((e) => Math.round(e * 100) / 100)).toEqual([10.2, 12.09, 12.75, 13.05, 13.22]);
  });
  it('control points from n = 1', () => {
    expect(photonOutcome(1, 10.2)).toMatchObject({ kind: 'absorbed', to: 2 });
    expect(photonOutcome(1, 12.09)).toMatchObject({ kind: 'absorbed', to: 3 });
    expect(photonOutcome(1, 13.22)).toMatchObject({ kind: 'absorbed', to: 6 });
    expect(photonOutcome(1, 11.0)).toEqual({ kind: 'passed' });
    const ion = photonOutcome(1, 15);
    expect(ion.kind).toBe('ionized');
    if (ion.kind === 'ionized') expect(ion.kineticEnergyEv).toBeCloseTo(1.402, 3);
    expect(photonOutcome(1, 13.598).kind).toBe('ionized');
    expect(photonOutcome(1, 10.2 + 0.06).kind).toBe('passed');
  });
  it('10,20 eV → n = 2, after 1,2 s a 121,6 nm UV photon, back to n = 1', () => {
    const a = createHydrogenAtom({ rng: 3 });
    a.fire(10.2);
    expect(a.state.level).toBe(2);
    expect(a.step(1.0)).toHaveLength(0);
    const ph = a.step(0.25);
    expect(ph).toHaveLength(1);
    expect(ph[0].wavelengthNm).toBeCloseTo(121.6, 0);
    expect(ph[0].band).toBe('uv');
    expect(a.state.level).toBe(1);
  });
  it('12,09 eV → cascade ends at n = 1 with energy conservation; 6→2 (410 nm) reachable from 13,22 eV', () => {
    let saw410 = false;
    for (let seed = 1; seed < 40; seed++) {
      const a = createHydrogenAtom({ rng: seed });
      a.fire(13.22);
      const photons = a.step(20);
      expect(a.state.level).toBe(1);
      const total = photons.reduce((s, p) => s + p.energyEv, 0);
      expect(total).toBeCloseTo(transitionEnergyEv(6, 1), 9);
      if (photons.some((p) => p.from === 6 && p.to === 2)) saw410 = true;
    }
    expect(saw410).toBe(true);
  });
  it('ionisation: recapture after 2 s, then cascade to the ground state; deterministic per seed', () => {
    const run = (): number[] => {
      const a = createHydrogenAtom({ rng: 11 });
      a.fire(15);
      expect(a.state.level).toBe('ionized');
      expect(a.step(1.9)).toHaveLength(0);
      const ph = a.step(30);
      expect(a.state.level).toBe(1);
      return ph.map((p) => p.energyEv);
    };
    expect(run()).toEqual(run());
  });
});
