import { describe, expect, it } from 'vitest';
import {
  buildAtom,
  configurationText,
  createOrbitalCloud,
  electronBalance,
  hadronCharge,
  ionConfiguration,
  mostProbableRadiusA0,
  NEUTRON_QUARKS,
  orbitalDensity,
  orbitalDensityMax,
  ORBITAL_IDS,
  PROTON_QUARKS,
  protonMassBudget,
  quarkPull,
  sampleOrbital,
  scaleAtWheel,
  STABLE_A,
  STANDARD_MODEL,
  valenceElectrons,
  neutralConfiguration,
  shellCounts,
} from '../index';

describe('atom §2 orbitals', () => {
  it('most probable radius: 1s → 1 a₀, 2p → 4 a₀, 3d → 9 a₀', () => {
    expect(mostProbableRadiusA0('1s')).toBeCloseTo(1, 4);
    expect(mostProbableRadiusA0('2p_z')).toBeCloseTo(4, 4);
    expect(mostProbableRadiusA0('3d_xy')).toBeCloseTo(9, 4);
  });
  it('1s sample mean ⟨r⟩ ≈ 1,5 a₀ (20 000 points, seeded)', () => {
    const pts = sampleOrbital('1s', 20000, 5);
    let s = 0;
    for (let i = 0; i < 20000; i++) s += Math.hypot(pts[3 * i], pts[3 * i + 1], pts[3 * i + 2]);
    expect(s / 20000).toBeCloseTo(1.5, 1);
    expect(sampleOrbital('1s', 10, 5)).toEqual(sampleOrbital('1s', 10, 5));
  });
  it('2p_z has a nodal plane z = 0 and is symmetric; ρ_max bounds the density everywhere on a grid', () => {
    expect(orbitalDensity('2p_z', 1, 2, 0)).toBe(0);
    expect(orbitalDensity('2p_z', 0, 0, 3)).toBeCloseTo(orbitalDensity('2p_z', 0, 0, -3), 12);
    for (const id of ORBITAL_IDS) {
      const max = orbitalDensityMax(id);
      for (let k = 0; k < 2000; k++) {
        const x = Math.sin(k * 1.3) * 10;
        const y = Math.cos(k * 0.7) * 10;
        const z = Math.sin(k * 0.31) * 10;
        expect(orbitalDensity(id, x, y, z)).toBeLessThanOrEqual(max);
      }
    }
  });
  it('cloud keeps ≈ N live points', () => {
    const c = createOrbitalCloud({ orbital: '2s', targetCount: 600, seed: 2 });
    for (let i = 0; i < 300; i++) c.step(1 / 30);
    expect(c.count()).toBeGreaterThan(570);
    expect(c.count()).toBeLessThan(630);
  });
});

describe('atom §4 builder', () => {
  it('70 stable nuclides including Ca-48', () => {
    expect(Object.values(STABLE_A).reduce((s, l) => s + l.length, 0)).toBe(70);
  });
  it('Cu-63 neutral: stable, [Ar] 3d¹⁰ 4s¹, 2–8–18–1', () => {
    const r = buildAtom({ protons: 29, neutrons: 34, electrons: 29 });
    expect(r.massNumber).toBe(63);
    expect(r.element?.symbol).toBe('Cu');
    expect(r.element?.substanceUk).toBe('мідь');
    expect(r.status).toBe('stable');
    expect(r.ionKind).toBe('neutral');
    expect(r.configurationText).toBe('[Ar] 3d¹⁰ 4s¹');
    expect(r.shells).toEqual([2, 8, 18, 1]);
  });
  it('Cu⁺ → [Ar] 3d¹⁰; Fe²⁺ → [Ar] 3d⁶; Cr → [Ar] 3d⁵ 4s¹', () => {
    const cu = buildAtom({ protons: 29, neutrons: 34, electrons: 28 });
    expect(cu.ionLabel).toBe('Cu⁺');
    expect(cu.configurationText).toBe('[Ar] 3d¹⁰');
    expect(configurationText(ionConfiguration(26, 24))).toBe('[Ar] 3d⁶');
    expect(buildAtom({ protons: 26, neutrons: 30, electrons: 24 }).ionLabel).toBe('Fe²⁺');
    expect(configurationText(neutralConfiguration(24))).toBe('[Ar] 3d⁵ 4s¹');
  });
  it('C-14 radioactive T½ ≈ 5 700 y; Be-8 instant; N⁻ anion unstable', () => {
    const c = buildAtom({ protons: 6, neutrons: 8, electrons: 6 });
    expect(c.status).toBe('radioactive');
    expect(c.halfLife).toEqual({ value: 5700, unit: 'y', approx: true });
    expect(buildAtom({ protons: 4, neutrons: 4, electrons: 4 }).status).toBe('instant');
    const n = buildAtom({ protons: 7, neutrons: 7, electrons: 8 });
    expect(n.ionKind).toBe('anion');
    expect(n.anionUnstable).toBe(true);
    expect(buildAtom({ protons: 8, neutrons: 8, electrons: 9 }).anionUnstable).toBe(false);
  });
  it('Ca-48 practically stable, V-50 radioactive, Z = 0 no atom, protium, valley rule', () => {
    expect(buildAtom({ protons: 20, neutrons: 28, electrons: 20 }).status).toBe('practicallyStable');
    expect(buildAtom({ protons: 23, neutrons: 27, electrons: 23 }).halfLife?.value).toBe(2.7e17);
    expect(buildAtom({ protons: 0, neutrons: 3, electrons: 0 }).status).toBe('noAtom');
    expect(buildAtom({ protons: 1, neutrons: 0, electrons: 0 }).isProtium).toBe(true);
    expect(buildAtom({ protons: 26, neutrons: 33, electrons: 26 }).status).toBe('radioactive'); // Fe-59
    expect(buildAtom({ protons: 29, neutrons: 33, electrons: 29 }).status).toBe('fastDecay'); // Cu-62: |33 − 35| ≤ 3
    expect(buildAtom({ protons: 26, neutrons: 26, electrons: 26 }).status).toBe('unbound'); // Fe-52: |26 − 30,25| > 3
    expect(buildAtom({ protons: 26, neutrons: 40, electrons: 26 }).status).toBe('unbound');
    expect(buildAtom({ protons: 3, neutrons: 6, electrons: 3 }).status).toBe('unbound'); // Li-9: |6 − 3,5| > 1,5
  });
  it('inputs are clamped (Ne ≤ Z + 1)', () => {
    const r = buildAtom({ protons: 40, neutrons: 50, electrons: 99 });
    expect([r.protons, r.neutrons, r.electrons]).toEqual([29, 40, 30]);
  });
});

describe('atom shells / quarks / cards / helpers', () => {
  it('Zn…Kr configurations [Ar] 3d¹⁰ 4s² 4pᵏ, shells 2–8–18–2 … 2–8–18–8; valence counts', () => {
    expect(configurationText(neutralConfiguration(30))).toBe('[Ar] 3d¹⁰ 4s²');
    expect(configurationText(neutralConfiguration(33))).toBe('[Ar] 3d¹⁰ 4s² 4p³');
    expect(shellCounts(neutralConfiguration(36))).toEqual([2, 8, 18, 8]);
    expect(valenceElectrons(29)).toEqual({ count: 1, kind: 'outerS' });
    expect(valenceElectrons(14)).toEqual({ count: 4, kind: 'group' });
    expect(valenceElectrons(2)).toEqual({ count: 2, kind: 'group' });
  });
  it('string energy σ·d, breaks at d = 1,2 fm (≈ 1,1 GeV)', () => {
    expect(quarkPull(1.0).energyGeV).toBeCloseTo(0.54, 9);
    expect(quarkPull(1.5).broken).toBe(false);
    const b = quarkPull(1.6);
    expect(b.broken).toBe(true);
    expect(b.energyGeV).toBeCloseTo(1.08, 9);
    expect(hadronCharge(PROTON_QUARKS)).toBe(1);
    expect(hadronCharge(NEUTRON_QUARKS)).toBe(0);
    expect(protonMassBudget().quarkShare).toBeCloseTo(0.01, 2);
  });
  it('17 Standard-Model cards; ordinary matter u, d, e, γ, g', () => {
    expect(STANDARD_MODEL).toHaveLength(17);
    expect(STANDARD_MODEL.filter((p) => p.ordinaryMatter).map((p) => p.symbol).sort()).toEqual(['d', 'e', 'g', 'u', 'γ'].sort());
  });
  it('scale wheel stops and log interpolation; electron balance', () => {
    expect(scaleAtWheel(0)).toBeCloseTo(1e-2, 15);
    expect(scaleAtWheel(4)).toBeCloseTo(1e-10, 20);
    expect(Math.log10(scaleAtWheel(1.5))).toBeCloseTo(-4, 9);
    expect(electronBalance(1836, 0.3).balanced).toBe(true);
    expect(electronBalance(0, 0.3).tiltRad).toBeCloseTo(-0.3, 12);
    expect(electronBalance(10000, 0.3).tiltRad).toBeCloseTo(0.3, 12);
  });
});
