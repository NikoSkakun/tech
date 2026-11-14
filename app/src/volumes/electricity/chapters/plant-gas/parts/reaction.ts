/**
 * The «реакція» over the pipe (step 2): reactant molecules drift together, a `yellow` → `white` flash
 * (energy) and the products fly apart — on a 3.2 s loop. The fuel switch picks the reaction:
 * gas CH₄ + 2 O₂ → CO₂ + 2 H₂O · coal C + O₂ → CO₂ · hydrogen 2 H₂ + O₂ → 2 H₂O (no CO₂).
 * Local frame: X left → right, the flash at the origin; `group` is placed by the step.
 */
import { Group, Mesh } from 'three';
import { G } from '@/kit';
import { K } from '@/style';
import { buildMolecules, type MoleculeKind } from './molecules';

export type Fuel = 'gas' | 'coal' | 'h2';

const REACTIONS: Record<Fuel, { left: MoleculeKind[]; right: MoleculeKind[] }> = {
  gas: { left: ['CH4', 'O2', 'O2'], right: ['CO2', 'H2O', 'H2O'] },
  coal: { left: ['C', 'O2'], right: ['CO2'] },
  h2: { left: ['H2', 'H2', 'O2'], right: ['H2O', 'H2O'] },
};

/** Formula text of each reaction (chemical symbols — international). */
export const EQUATION: Record<Fuel, string> = {
  gas: 'CH₄ + 2 O₂ → CO₂ + 2 H₂O',
  coal: 'C + O₂ → CO₂',
  h2: '2 H₂ + O₂ → 2 H₂O',
};

export interface Reaction {
  group: Group;
  fuel: Fuel;
  /** Molecule size, metres per ångström-unit of the model. */
  size: number;
  update(dt: number): void;
}

export function buildReaction(size = 1): Reaction {
  const set = buildMolecules();
  const group = new Group();
  group.name = 'reaction';
  const pool = new Map<MoleculeKind, Mesh[]>();
  const take = (kind: MoleculeKind, i: number): Mesh => {
    const list = pool.get(kind) ?? [];
    pool.set(kind, list);
    while (list.length <= i) {
      const m = new Mesh(set.geometry[kind], set.material);
      m.castShadow = false;
      group.add(m);
      list.push(m);
    }
    return list[i]!;
  };
  const flash = new Mesh(G.sphere(0.5, 20), K.glow({ color: 'yellow', intensity: 2.4, whiten: 0.5 }));
  group.add(flash);
  let t = 0;
  const r: Reaction = {
    group,
    fuel: 'gas',
    size,
    update(dt) {
      t = (t + dt / 3.2) % 1;
      for (const list of pool.values()) for (const m of list) m.visible = false;
      const { left, right } = REACTIONS[r.fuel];
      const used = new Map<MoleculeKind, number>();
      const place = (kind: MoleculeKind, x: number, y: number, s: number, spin: number): void => {
        const i = used.get(kind) ?? 0;
        used.set(kind, i + 1);
        const m = take(kind, i);
        m.visible = s > 0.01;
        m.position.set(x * r.size, y * r.size, 0);
        m.scale.setScalar(Math.max(0.001, s) * r.size);
        m.rotation.set(spin * 0.7, spin, 0);
      };
      const ease = (u: number): number => u * u * (3 - 2 * u);
      // reactants: approach (0…0.4), vanish into the flash
      const a = ease(Math.min(1, t / 0.4));
      const sIn = t < 0.4 ? Math.min(1, t / 0.08) : Math.max(0, 1 - (t - 0.4) / 0.05);
      left.forEach((k, i) => place(k, -4.2 + 3.3 * a, (i - (left.length - 1) / 2) * 1.5 * (1 - 0.6 * a), sIn, t * 6 + i));
      // products: out of the flash (0.45…1), fading at the end
      const b = ease(Math.max(0, Math.min(1, (t - 0.45) / 0.45)));
      const sOut = t < 0.45 ? 0 : Math.min(1, (t - 0.45) / 0.05) * Math.min(1, (1 - t) / 0.08);
      right.forEach((k, i) => place(k, 0.9 + 3.3 * b, (i - (right.length - 1) / 2) * 1.5 * (0.4 + 0.6 * b), sOut, t * 5 + i));
      // the flash: grows, whitens, fades
      const f = t > 0.36 && t < 0.62 ? Math.sin(((t - 0.36) / 0.26) * Math.PI) : 0;
      flash.visible = f > 0.01;
      flash.scale.setScalar((0.4 + 1.6 * f) * r.size);
    },
  };
  r.update(0);
  return r;
}
