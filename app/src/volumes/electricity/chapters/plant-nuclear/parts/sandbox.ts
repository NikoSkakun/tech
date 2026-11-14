/**
 * The k_eff «sandbox» of step 3: a glass cube — the toy active zone — holding a lattice of uranium nuclei
 * (small coral/steel clusters), water molecules between them (the moderator, can be switched off), nine
 * absorber rods that slide in from the top, up to `CAP` flying neutrons with short tails, flashes where a
 * neutron ends (orange: fission; steel: absorbed or leaked) and a soft «density» glow when there are more
 * neutrons than can be drawn. Three lattice sizes (4³, 5³, 6³ nuclei) share one set of draw calls.
 */
import { BoxGeometry, Group, Mesh, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import type { CoreSize } from '@electricity/sim/plant-nuclear';
import { RibbonLines, createHalo, createOrbs, createParticles, pointEmitter, type Orbs } from '@/fx';
import { Builder, type KitModel } from '@/kit';
import { K } from '@/style';
import { CAP } from '../sim-bindings/sandbox-run';
import { packCluster } from './nucleus';

export const SPACING = 7;
export const PER_AXIS: Record<CoreSize, number> = { small: 4, medium: 5, large: 6 };
const SIZES: CoreSize[] = ['small', 'medium', 'large'];

export interface Sandbox {
  group: Group;
  /** Nucleus centres (set-local), all sizes; `members[size]` = indices of that size's lattice. */
  centres: Vector3[];
  members: Record<CoreSize, number[]>;
  near(i: number): number[];
  neutrons: Orbs;
  tails: RibbonLines;
  rods: KitModel;
  water: Orbs;
  flash(at: Vector3, kind: 'fission' | 'loss'): void;
  density: ReturnType<typeof createHalo>;
  /** Rods inserted 0…1 (both rod sets slide; the one that fits the lattice is shown). */
  setRods(a: number, size: CoreSize): void;
  /** Show one lattice size (nuclei, glass cube, water inside). */
  setSize(size: CoreSize): void;
  half(size: CoreSize): number;
  cube: Mesh;
}

export function buildSandbox(ctx: ChapterContext): Sandbox {
  const group = new Group();
  const centres: Vector3[] = [];
  const members = { small: [], medium: [], large: [] } as Record<CoreSize, number[]>;
  for (const s of SIZES) {
    const n = PER_AXIS[s];
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        for (let k = 0; k < n; k++) {
          members[s].push(centres.length);
          centres.push(new Vector3(i - (n - 1) / 2, j - (n - 1) / 2, k - (n - 1) / 2).multiplyScalar(SPACING));
        }
  }
  const mini = packCluster(19, 0.42);
  const protons = createOrbs({ kind: 'proton', count: centres.length * 9, radius: 0.42 });
  const neutronsN = createOrbs({ kind: 'neutron', count: centres.length * 10, radius: 0.42 });
  group.add(protons, neutronsN);
  const show = (size: CoreSize): void => {
    const on = new Set(members[size]);
    centres.forEach((c, i) => {
      const s = on.has(i) ? 1 : 0;
      mini.forEach((m, j) => {
        if (j < 9) protons.setPosition(i * 9 + j, c.x + m.x, c.y + m.y, c.z + m.z, s);
        else neutronsN.setPosition(i * 10 + j - 9, c.x + m.x, c.y + m.y, c.z + m.z, s);
      });
    });
    protons.commit();
    neutronsN.commit();
  };
  // glass cube (scaled to the size) and a thin frame
  const cube = new Mesh(new BoxGeometry(1, 1, 1), K.glass({ color: 'violet.light', opacity: 0.08, edgeOpacity: 0.5 }));
  group.add(cube);
  // water: blue molecules scattered through the largest cube; hidden ones outside the current size
  const rng = ctx.random.fork('sandbox-water');
  const water = createOrbs({ kind: 'blob', count: 360, radius: 0.55, color: 'blue' });
  const waterPts = Array.from({ length: 360 }, () => new Vector3(rng.signed(21), rng.signed(21), rng.signed(21)));
  group.add(water);
  // absorber rods between the lattice columns: one set for even lattices (4³, 6³), one for the odd 5³
  const rb = new Builder('sandbox-rods');
  const rodAt = (p: Builder, x: number, z: number): void => {
    p.cyl(0.85, 44, { seg: 16, slot: 'metal', c: ['slate', 'steel'], at: [x, 0, z] });
    p.cyl(1.0, 1.2, { seg: 16, slot: 'metal', c: 'slate.dark', at: [x, 43.4, z] });
  };
  const even = rb.part('even');
  for (const x of [-14, 0, 14]) for (const z of [-14, 0, 14]) rodAt(even, x, z);
  const odd = rb.part('odd');
  for (const v of [3.5, 10.5]) for (const sx of [-1, 1]) for (const sz of [-1, 1]) rodAt(odd, sx * v, sz * v);
  const rods = rb.build();
  group.add(rods.group);
  const neutrons = createOrbs({ kind: 'neutron', count: CAP, radius: 0.72 });
  const tails = new RibbonLines({ capacity: CAP * 2 + 8, color: 'white', width: 0.36, intensity: 1.2, blend: 'normal', endFade: [0.9, 0] });
  group.add(neutrons, tails);
  const fissionFlash = createParticles(ctx, { count: 400, loop: false, emitter: pointEmitter(), sprite: 'soft', color: ['yellow', 'orange', 'red'], life: [0.5, 0.8], speed: [0, 0.4], size: [3.2, 1.2], intensity: 1.6 });
  const lossFlash = createParticles(ctx, { count: 400, loop: false, emitter: pointEmitter(), sprite: 'soft', color: ['white', 'steel'], life: [0.35, 0.6], speed: [0, 0.3], size: [2.2, 0.6], intensity: 1.1 });
  const density = createHalo({ color: 'mist', size: 60, intensity: 0.7 });
  density.fade = 0;
  group.add(fissionFlash, lossFlash, density);
  let current: CoreSize = 'large';
  const half = (s: CoreSize): number => (PER_AXIS[s] * SPACING) / 2;
  const setSize = (s: CoreSize): void => {
    current = s;
    show(s);
    const h = half(s);
    cube.scale.setScalar(2 * h);
    rods.part('even').visible = PER_AXIS[s] % 2 === 0;
    rods.part('odd').visible = PER_AXIS[s] % 2 === 1;
    waterPts.forEach((p, i) => water.setPosition(i, p.x, p.y, p.z, Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)) < h - 0.6 ? 1 : 0));
    water.commit();
  };
  setSize('large');
  const near = (i: number): number[] => {
    const c = centres[i]!;
    return members[current].filter((j) => j !== i && centres[j]!.distanceTo(c) < SPACING * 1.9);
  };
  return {
    group,
    centres,
    members,
    near,
    neutrons,
    tails,
    rods,
    water,
    density,
    cube,
    half,
    setSize,
    setRods(a, size) {
      const h = half(size);
      for (const name of ['even', 'odd']) rods.part(name).position.y = h + 2 - a * (2 * h + 2);
    },
    flash(at, kind) {
      (kind === 'fission' ? fissionFlash : lossFlash).emit(1, { position: [at.x, at.y, at.z] });
    },
  };
}
