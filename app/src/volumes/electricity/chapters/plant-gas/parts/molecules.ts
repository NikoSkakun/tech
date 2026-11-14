/**
 * Ball models of the molecules of step 2 (not to scale — atoms drawn ≈ 10¹⁰ × larger): carbon `ink`,
 * hydrogen `white`, oxygen `coral`. Each molecule is one geometry with vertex colours (one draw call per
 * mesh, all sharing the builder's gloss material); `size` = scale of the whole model in metres per «Å-unit».
 */
import { Vector3, type BufferGeometry, type Material } from 'three';
import { Builder } from '@/kit';
import type { ColorToken } from '@/style';

export type MoleculeKind = 'CH4' | 'O2' | 'CO2' | 'H2O' | 'H2' | 'C';

const ATOM: Record<'C' | 'H' | 'O', { r: number; c: ColorToken }> = {
  C: { r: 0.36, c: 'ink' },
  H: { r: 0.22, c: 'white' },
  O: { r: 0.33, c: 'coral' },
};

/** Atom positions per molecule (unit-less, ≈ ångström). */
const SHAPES: Record<MoleculeKind, readonly ['C' | 'H' | 'O', number, number, number][]> = {
  // tetrahedral methane
  CH4: [['C', 0, 0, 0], ['H', 0.36, 0.36, 0.36], ['H', -0.36, -0.36, 0.36], ['H', -0.36, 0.36, -0.36], ['H', 0.36, -0.36, -0.36]],
  O2: [['O', -0.3, 0, 0], ['O', 0.3, 0, 0]],
  CO2: [['O', -0.58, 0, 0], ['C', 0, 0, 0], ['O', 0.58, 0, 0]],
  H2O: [['O', 0, 0, 0], ['H', 0.38, 0.3, 0], ['H', -0.38, 0.3, 0]],
  H2: [['H', -0.2, 0, 0], ['H', 0.2, 0, 0]],
  // a lump of coal: a cluster of carbon
  C: [['C', 0, 0, 0], ['C', 0.3, 0.15, 0.1], ['C', -0.2, 0.25, -0.15], ['C', 0.05, -0.28, 0.2]],
};

export interface MoleculeSet {
  geometry: Record<MoleculeKind, BufferGeometry>;
  material: Material;
}

export function buildMolecules(): MoleculeSet {
  const geometry = {} as Record<MoleculeKind, BufferGeometry>;
  let material: Material | null = null;
  for (const kind of Object.keys(SHAPES) as MoleculeKind[]) {
    const b = new Builder(`molecule-${kind}`);
    for (const [el, x, y, z] of SHAPES[kind]) b.sphere(ATOM[el].r, { seg: 18, slot: 'gloss', c: ATOM[el].c, at: [x, y, z] });
    // bonds: thin sticks between neighbours closer than 0.75
    const atoms = SHAPES[kind];
    for (let i = 0; i < atoms.length; i++)
      for (let j = i + 1; j < atoms.length; j++) {
        const a = new Vector3(atoms[i]![1], atoms[i]![2], atoms[i]![3]);
        const c = new Vector3(atoms[j]![1], atoms[j]![2], atoms[j]![3]);
        if (a.distanceTo(c) < 0.75) b.rod([a.x, a.y, a.z], [c.x, c.y, c.z], 0.06, { slot: 'gloss', c: 'mist' });
      }
    geometry[kind] = b.geometry('gloss');
    material ??= b.mats.get('gloss');
  }
  return { geometry, material: material! };
}
