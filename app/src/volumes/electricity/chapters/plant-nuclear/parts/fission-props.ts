/**
 * Props of the fission set (step 2) around the hero nucleus: the «mass scales» (left pan — U-235 + n, right pan
 * — the products; the left one is a little heavier), the combustion comparison (C + O₂ → CO₂ molecules), a
 * sparse lattice of neighbouring atoms of the UO₂ crystal the fragments brake in, and a quiet U-238 nucleus.
 */
import { Group, Vector3 } from 'three';
import { createOrbs, type Orbs } from '@/fx';
import { Builder, type KitModel } from '@/kit';
import { createNucleus, type Nucleus } from './nucleus';

/** Balance: posts and beam; parts `beam`, `panL`, `panR` (the pans hang from the beam ends). */
export function buildBalance(): KitModel {
  const b = new Builder('mass-balance');
  b.cyl(2.2, 0.5, { seg: 32, slot: 'metal', c: 'slate' });
  b.cyl(0.25, 7, { seg: 16, slot: 'metal', c: 'steel', at: [0, 0.5, 0] });
  b.sphere(0.5, { seg: 16, slot: 'metal', c: 'violet', at: [0, 7.5, 0] });
  const beam = b.part('beam', { at: [0, 7.5, 0] });
  beam.capsule(0.18, 9, { axis: 'x', seg: 12, slot: 'metal', c: 'mist' });
  for (const [name, x] of [['panL', -4.5], ['panR', 4.5]] as const) {
    const pan = beam.part(name, { at: [x, 0, 0] });
    pan.rod([0, 0, 0], [-0.9, -3, 0], 0.04, { c: 'steel' });
    pan.rod([0, 0, 0], [0.9, -3, 0], 0.04, { c: 'steel' });
    pan.lathe([[0.02, -3.3], [1.5, -3.1], [1.6, -2.9], [1.45, -2.95], [0.02, -3.15]], { seg: 32, slot: 'metal', c: ['steel', 'mist'] });
    pan.anchor('cup', 0, -2.9, 0);
  }
  return b.build();
}

/** Two little clusters for the pans: before (U-235 + n) and after (two fragments + 3 n). */
export function panLoads(): { before: Group; after: Group } {
  const mk = (n: number, r: number, at: [number, number, number], kind: 'proton' | 'neutron'): Orbs => {
    const o = createOrbs({ kind, count: n, radius: r });
    for (let i = 0; i < n; i++) {
      const a = i * 2.4;
      const rad = r * 1.6 * Math.sqrt(i / n);
      o.setPosition(i, at[0] + Math.cos(a) * rad, at[1] + (i % 3) * r * 0.5, at[2] + Math.sin(a) * rad);
    }
    o.commit();
    return o;
  };
  const before = new Group();
  before.add(mk(9, 0.32, [0, 0.35, 0], 'proton'), mk(12, 0.32, [0.1, 0.4, 0.1], 'neutron'), mk(1, 0.32, [1.1, 0.3, 0], 'neutron'));
  const after = new Group();
  after.add(mk(6, 0.3, [-0.55, 0.3, 0], 'proton'), mk(7, 0.3, [-0.5, 0.35, 0.1], 'neutron'), mk(4, 0.3, [0.65, 0.3, 0], 'proton'), mk(5, 0.3, [0.7, 0.35, 0.1], 'neutron'), mk(3, 0.28, [0, 0.3, 0.9], 'neutron'));
  return { before, after };
}

/** C + O₂ → CO₂: carbon `slate`, oxygen `mist`; `set(p)` 0 = apart … 1 = one CO₂ molecule. */
export function buildMolecule(): { group: Group; set(p: number): void; centre: Vector3 } {
  const atoms = createOrbs({ kind: 'blob', count: 3, radius: 1, instanceColors: true });
  atoms.setInstanceColor(0, 'slate');
  atoms.setInstanceColor(1, 'mist');
  atoms.setInstanceColor(2, 'mist');
  const group = new Group();
  group.add(atoms);
  const set = (p: number): void => {
    const k = Math.min(1, Math.max(0, p));
    // O₂ (bond 1.5) flies in from the right and opens around the carbon: O–C–O, bonds 1.6
    const ox = 6 * (1 - k);
    atoms.setPosition(0, 0, 0, 0, 1.25);
    atoms.setPosition(1, ox - 1.6 * k + 0.75 * (1 - k), 0, 0, 1.05);
    atoms.setPosition(2, ox + 1.6 * k - 0.75 * (1 - k) + 1.5 * (1 - k), 0, 0, 1.05);
    atoms.commit();
  };
  set(0);
  return { group, set, centre: new Vector3() };
}

/** Neighbouring atoms of the UO₂ crystal (faint): uranium as small steel blobs, oxygen smaller and paler. */
export function buildLattice(spacing = 26, n = 2): Orbs {
  const pts: [number, number, number, number][] = [];
  for (let i = -n; i <= n; i++)
    for (let j = -1; j <= 1; j++)
      for (let k = -n; k <= 0; k++) {
        if (Math.abs(i) <= 1 && j === 0 && k === 0) continue; // the hero nucleus' own neighbourhood stays clear
        pts.push([i * spacing, j * spacing * 0.8, k * spacing - 14, 1]);
        pts.push([(i + 0.5) * spacing, (j + 0.5) * spacing * 0.8, (k + 0.5) * spacing - 14, 0.55]);
      }
  const orbs = createOrbs({ kind: 'blob', count: pts.length, radius: 0.7, instanceColors: true });
  pts.forEach(([x, y, z, s], i) => {
    orbs.setPosition(i, x, y, z, s);
    orbs.setInstanceColor(i, s > 0.9 ? 'slate' : 'bg.plum', 0.7);
  });
  orbs.commit();
  return orbs;
}

/** A calm U-238 nucleus (92 p + 146 n) in the background, slowly turning. */
export function buildU238(): Nucleus {
  return createNucleus(0.42, 92, 238, 56, 141);
}
