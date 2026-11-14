/**
 * The «micro-macro» cut of a piece of the core for step 4: four fuel rods (glass cladding over a stack of dark
 * UO₂ pellets) with water between them (O `blue` + two H `coral` — the hydrogen nuclei are what the neutron hits),
 * a few boric-acid molecules with tiny «B» markers, and two steel absorber rods (B₄C) hanging in from the top.
 *
 * `path` is the hero neutron's walk: it leaves the left rod at 2 MeV, hits 19 hydrogen nuclei (on hydrogen a
 * neutron keeps on average 1/e of its energy per collision: ln(2 MeV / 0,025 eV) ≈ 18,2), and enters the right
 * rod as a thermal neutron. The water molecule of every collision is placed so that one of its H sits there.
 */
import { Group, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createOrbs } from '@/fx';
import { Builder, type KitModel } from '@/kit';
import { createLabel } from './label';

export const ROD_X = [-13, -4.5, 4.5, 13] as const;
export const COLLISIONS = 19;
const E0 = 2e6;
const E_TH = 0.025;

export interface Moderation {
  group: Group;
  rods: KitModel;
  absorbers: KitModel;
  /** Collision points (set-local), start (in the left rod) and end (in the right rod). */
  path: { start: Vector3; hits: Vector3[]; end: Vector3 };
  /** Neutron energy (eV) after collision i (index 0 = before the first). */
  energy: number[];
}

export function buildModeration(ctx: ChapterContext): Moderation {
  const rng = ctx.random.fork('moderation');
  const group = new Group();
  // fuel rods: pellet stack inside a glass cladding, end plugs
  const b = new Builder('fuel-rods');
  for (const x of ROD_X) {
    for (let k = 0; k < 14; k++) b.cyl(1.25, 1.95, { seg: 24, slot: 'matte', c: ['slate', 'slate.light'], at: [x, -14 + k * 2.05, 0] });
    b.cyl(1.45, 0.8, { seg: 24, slot: 'metal', c: 'steel', at: [x, -15, 0] });
    b.cyl(1.45, 0.8, { seg: 24, slot: 'metal', c: 'steel', at: [x, 14.6, 0] });
  }
  const rods = b.build();
  const clad = new Builder('cladding');
  for (const x of ROD_X) clad.cyl(1.5, 29.4, { seg: 32, slot: 'glass', c: 'mist', at: [x, -14.6, 0], open: true });
  const cladding = clad.build();
  group.add(rods.group, cladding.group);
  // absorber rods (B₄C in steel), hanging between the fuel rods from the top
  const ab = new Builder('absorbers');
  for (const x of [-8.75, 8.75]) {
    ab.cyl(1.1, 22, { seg: 24, slot: 'metal', c: ['slate', 'steel.light'], at: [x, 0, -4] });
    ab.cyl(1.25, 1.0, { seg: 24, slot: 'metal', c: 'slate.dark', at: [x, 21.6, -4] });
  }
  const absorbers = ab.build();
  absorbers.group.position.y = -2;
  group.add(absorbers.group);

  // the hero walk: random points in the water gap, drifting from the left rod to the right one
  const start = new Vector3(ROD_X[0] + 1.6, 2, 0.4);
  const end = new Vector3(ROD_X[3] - 1.6, -3, 0.2);
  const hits: Vector3[] = [];
  for (let i = 0; i < COLLISIONS; i++) {
    const t = (i + 1) / (COLLISIONS + 1);
    const base = start.clone().lerp(end, t);
    hits.push(new Vector3(base.x + rng.signed(3.2), base.y + rng.signed(8), 2 + rng.range(0, 6)));
  }
  // energies: factors around 1/e, normalised so that the walk ends exactly at 0,025 eV
  const raw = hits.map(() => Math.exp(-1 + rng.signed(0.45)));
  const norm = Math.pow(E_TH / E0 / raw.reduce((a, f) => a * f, 1), 1 / COLLISIONS);
  const energy = [E0];
  for (const f of raw) energy.push(energy[energy.length - 1]! * f * norm);

  // water molecules: one at every collision (an H on the hit point) + a cloud of others in the gaps
  const extra = ctx.quality.count(70, 40);
  const n = hits.length + extra;
  const oxy = createOrbs({ kind: 'blob', count: n, radius: 0.62, color: 'blue' });
  const hyd = createOrbs({ kind: 'proton', count: n * 2, radius: 0.36 });
  const bond = 0.85;
  for (let i = 0; i < n; i++) {
    const hit = hits[i];
    const o = hit
      ? hit.clone().add(new Vector3(-bond, 0.3, 0))
      : new Vector3(rng.signed(17), rng.signed(14), rng.range(-4, 7));
    if (!hit && ROD_X.some((x) => Math.abs(o.x - x) < 2.2 && Math.abs(o.z) < 2.2)) o.z += 4.5;
    const a = rng.next() * Math.PI * 2;
    oxy.setPosition(i, o.x, o.y, o.z);
    const h1 = hit ?? o.clone().add(new Vector3(Math.cos(a) * bond, Math.sin(a) * bond, 0.2));
    const h2 = o.clone().add(new Vector3(Math.cos(a + 1.82) * bond, Math.sin(a + 1.82) * bond, -0.2));
    hyd.setPosition(i * 2, h1.x, h1.y, h1.z);
    hyd.setPosition(i * 2 + 1, h2.x, h2.y, h2.z);
  }
  oxy.commit();
  hyd.commit();
  group.add(oxy, hyd);
  // boric acid: B (slate) + three O (mist), with a tiny «B» marker on a few of them
  const boron = createOrbs({ kind: 'blob', count: 24, radius: 0.5, instanceColors: true });
  for (let i = 0; i < 6; i++) {
    const c = new Vector3(rng.signed(16), rng.signed(12), rng.range(3, 8));
    boron.setPosition(i * 4, c.x, c.y, c.z, 1.1);
    boron.setInstanceColor(i * 4, 'slate.light');
    for (let k = 1; k < 4; k++) {
      const a = (k * Math.PI * 2) / 3;
      boron.setPosition(i * 4 + k, c.x + Math.cos(a) * 0.9, c.y + Math.sin(a) * 0.9, c.z, 0.8);
      boron.setInstanceColor(i * 4 + k, 'mist');
    }
    if (i < 3) {
      const tag = createLabel('B', 'mist', 16);
      tag.position.copy(c).add(new Vector3(0, 1.1, 0));
      group.add(tag);
    }
  }
  boron.commit();
  group.add(boron);
  return { group, rods, absorbers, path: { start, hits, end }, energy };
}
