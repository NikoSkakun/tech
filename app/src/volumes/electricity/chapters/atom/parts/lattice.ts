/**
 * CuLattice — a passing shot of the copper crystal at 10⁻⁹ m: face-centred cubic rows of ion cores with a
 * shimmering haze of free electrons between them (the full treatment is in chapter `matter`). Viewed along a
 * cube axis, so the atoms line up in regular rows; one ion sits exactly at the origin — the dive continues
 * into it.
 */
import { Group } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createGas, createOrbs, type OrbGas, type Orbs } from '@/fx';

/** FCC cube edge in world units (nearest neighbours are a/√2 apart; real copper: a = 0,3615 nm). */
const CELL = 3.3;
const ION_RADIUS = 0.62;

export interface CuLattice {
  group: Group;
  ions: Orbs;
  electrons: OrbGas;
  /** Dithered dissolve of the whole lattice, 0…1. */
  fade: number;
}

export function createCuLattice(ctx: ChapterContext): CuLattice {
  const group = new Group();
  group.name = 'cu-lattice';
  // FCC basis: cube corner + three face centres; keep two atomic planes: the one through the origin and one behind it
  const basis = [
    [0, 0, 0],
    [0.5, 0.5, 0],
    [0.5, 0, 0.5],
    [0, 0.5, 0.5],
  ] as const;
  const sites: [number, number, number][] = [];
  const reach = 5;
  for (let i = -reach; i <= reach; i++)
    for (let j = -reach; j <= reach; j++)
      for (let k = -1; k <= 0; k++)
        for (const [bx, by, bz] of basis) {
          const x = (i + bx) * CELL;
          const y = (j + by) * CELL;
          const z = (k + bz) * CELL;
          if (z > 0.1 || z < -CELL * 0.6 || Math.hypot(x, y) > 13) continue;
          sites.push([x, y, z]);
        }
  // Cu⁺ ion cores: the course's ion character in the lattice colour of chapter `matter`
  const ions = createOrbs({ kind: 'ion', color: 'coral.dark', count: sites.length, radius: ION_RADIUS });
  sites.forEach(([x, y, z], i) => ions.setPosition(i, x, y, z));
  ions.commit();
  const electrons = createGas(ctx, {
    kind: 'electron',
    count: 110,
    radius: 0.12,
    box: [22, 14, CELL * 0.9],
    wander: 0.7,
    thermal: 1.3,
    seed: 'cu-sea',
  });
  electrons.position.z = -CELL * 0.2;
  group.add(ions, electrons);
  let fade = 1;
  return {
    group,
    ions,
    electrons,
    get fade() {
      return fade;
    },
    set fade(v: number) {
      fade = v;
      ions.fade = v;
      electrons.fade = v;
      group.visible = v > 0.002;
    },
  };
}
