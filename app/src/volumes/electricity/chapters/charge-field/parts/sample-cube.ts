/**
 * Step 1 sample: a glass cube "made of atoms" — a 3×3×3 lattice of `coral` nuclei with `cyan` electrons
 * hovering around them. `setBalance(k)` shows k surplus (k > 0) or missing (k < 0) electrons: surplus ones roam
 * between the lattice sites, missing ones leave bare nuclei; a halo of the charge colour grows with |k|.
 * The drawn count is symbolic (chip in the step): one drawn electron stands for many orders of magnitude.
 */
import { Group, Mesh, Vector3 } from 'three';
import { damp } from '@/engine/api';
import { createHalo, createOrbs } from '@/fx';
import { G } from '@/kit';
import { col, K, SEMANTIC } from '@/style';
import { CUBES } from '../layout';

const SITES = 27;
/** At most this many electrons are added to / removed from the drawing. */
export const MAX_BALANCE = 18;

export interface SampleCube {
  group: Group;
  /** Pick / drag target: the glass body. */
  body: Mesh;
  hover: number;
  setBalance(k: number): void;
  /** World position of a lattice electron (start / end of the transfer arc). */
  port(out: Vector3): Vector3;
  update(dt: number, t: number): void;
}

export function createSampleCube(phase: number): SampleCube {
  const group = new Group();
  group.name = 'sample-cube';
  const s = CUBES.size;
  const glass = K.glass({ color: 'sky', opacity: 0.16, edgeOpacity: 0.7 });
  const body = new Mesh(G.rbox(s, s, s, 0.22, 3), glass);
  const pitch = s * 0.29;
  const nuclei = createOrbs({ kind: 'proton', count: SITES, radius: 0.15, glyph: 'none' });
  const sites: Vector3[] = [];
  for (let i = 0; i < SITES; i++) {
    const p = new Vector3((i % 3) - 1, (Math.floor(i / 3) % 3) - 1, Math.floor(i / 9) - 1).multiplyScalar(
      pitch,
    );
    sites.push(p);
    nuclei.setPosition(i, p.x, p.y, p.z);
  }
  nuclei.commit();
  const electrons = createOrbs({ kind: 'electron', count: SITES + MAX_BALANCE, radius: 0.085 });
  const halo = createHalo({ color: SEMANTIC.proton, size: s * 3.1, intensity: 0, amount: 0.25 });
  group.add(halo, nuclei, electrons, body);

  // order in which lattice electrons disappear: outer sites first (they are the ones a brush would reach)
  const order = sites
    .map((p, i) => ({ i, d: p.length() + ((i * 7) % 5) * 0.01 }))
    .sort((a, b) => b.d - a.d)
    .map((x) => x.i);
  const rank = new Array<number>(SITES);
  order.forEach((site, k) => (rank[site] = k));
  const scale = new Float32Array(SITES + MAX_BALANCE);
  let balance = 0;
  let glow = 0;
  const cube: SampleCube = {
    group,
    body,
    hover: 0,
    setBalance(k) {
      balance = Math.max(-MAX_BALANCE, Math.min(MAX_BALANCE, Math.round(k)));
    },
    port(out) {
      return group.localToWorld(out.set(0, s * 0.34, s * 0.3));
    },
    update(dt, t) {
      for (let i = 0; i < SITES + MAX_BALANCE; i++) {
        // lattice electron i is present unless it is one of the `-balance` removed ones; extra j shows for j < balance
        const present = i < SITES ? rank[i]! >= -balance : i - SITES < balance;
        scale[i] = damp(scale[i]!, present ? 1 : 0, 9, dt);
        const a = t * (1.3 + (i % 5) * 0.17) + i * 2.4 + phase;
        if (i < SITES) {
          const p = sites[i]!;
          electrons.setPosition(
            i,
            p.x + Math.cos(a) * 0.2,
            p.y + Math.sin(a * 1.3) * 0.2,
            p.z + Math.sin(a) * 0.2,
            scale[i]!,
          );
        } else {
          // surplus electrons wander through the gaps of the lattice
          const j = i - SITES;
          const w = t * 0.35 + j * 1.7 + phase;
          electrons.setPosition(
            i,
            Math.sin(w * 1.1 + j) * pitch * 1.25,
            Math.sin(w * 0.8 + j * 2.1) * pitch * 1.25,
            Math.cos(w * 0.93 + j * 0.7) * pitch * 1.25,
            scale[i]! * 1.15,
          );
        }
      }
      electrons.commit();
      // missing electrons → coral «+» halo, surplus → cyan «−» halo, brightness with the drawn imbalance
      glow = damp(glow, Math.abs(balance) / MAX_BALANCE, 4, dt);
      if (balance !== 0) halo.color.copy(col(balance > 0 ? SEMANTIC.electron : SEMANTIC.proton));
      halo.intensity = 0.25 * cube.hover + glow * (0.95 + 0.1 * Math.sin(t * 2.2 + phase));
      glass.opacity = 0.16 + 0.1 * cube.hover;
      group.position.y = CUBES.y + Math.sin(t * 0.9 + phase) * 0.07;
      group.rotation.y = Math.sin(t * 0.35 + phase) * 0.12;
    },
  };
  return cube;
}
