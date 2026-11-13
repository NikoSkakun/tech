/**
 * The small «кристал-трансформер» of step 3, beside the band tower. It switches substance: copper (electrons
 * glide freely between the ions), semiconductors (electrons sit in their bonds; `release()` tears one out for a
 * few seconds — in sync with a hop across the gap in the tower), diamond and glass (bound and still; glass is
 * amorphous). Colours are illustrative per substance; electrons stay `cyan`.
 */
import { Group, Vector3 } from 'three';
import { createOrbs } from '@/fx';
import type { ColorToken } from '@/style';
import type { BandMaterialId } from '@electricity/sim/matter';
import { createFccBlock, type FccBlock } from './fcc-block';

const COUNT = 36;
const LOOK: Record<BandMaterialId, { color: ColorToken; disorder: number }> = {
  Cu: { color: 'coral.dark', disorder: 0 },
  Ge: { color: 'steel', disorder: 0 },
  Si: { color: 'slate', disorder: 0 },
  GaAs: { color: 'mist', disorder: 0 },
  diamond: { color: 'white', disorder: 0 },
  SiO2: { color: 'sky', disorder: 1 },
};

export interface MaterialCrystal {
  group: Group;
  block: FccBlock;
  setMaterial(id: BandMaterialId): void;
  /** Tear one bound electron out for a few seconds (semiconductors). */
  release(): void;
  /** Local position of the latest freed electron. */
  freed: Vector3;
  update(dt: number, t: number): void;
}

interface E {
  home: number;
  phase: number;
  free: number; // seconds of freedom left (∞ for a metal)
  pos: Vector3;
  vel: Vector3;
}

export function createMaterialCrystal(rand: () => number): MaterialCrystal {
  const group = new Group();
  const block = createFccBlock({ cells: 3, a: 0.66, radius: 0.14, glyph: 'none' });
  block.ions.setColor('coral.dark');
  const orbs = createOrbs({ kind: 'electron', count: COUNT, radius: 0.07 });
  group.add(block.group, orbs);
  const half = block.size / 2;
  let id: BandMaterialId = 'Cu';
  let disorder = 0;
  const es: E[] = Array.from({ length: COUNT }, (_, i) => ({
    home: Math.floor(rand() * block.sites.length),
    phase: rand() * 6.283,
    free: 0,
    pos: new Vector3(),
    vel: new Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize().multiplyScalar(1.3 + 0.002 * i),
  }));
  const p = new Vector3();
  const crystal: MaterialCrystal = {
    group,
    block,
    freed: new Vector3(),
    setMaterial(next) {
      id = next;
      block.ions.setColor(LOOK[next].color);
      for (const e of es) {
        e.free = next === 'Cu' ? Infinity : 0;
        e.pos.copy(block.sites[e.home]!);
      }
    },
    release() {
      const bound = es.filter((e) => e.free <= 0);
      const e = bound[Math.floor(rand() * bound.length)];
      if (!e) return;
      e.free = 2.8;
      e.pos.copy(block.sites[e.home]!);
      crystal.freed.copy(e.pos);
    },
    update(dt, t) {
      disorder += (LOOK[id].disorder - disorder) * Math.min(dt * 2, 1);
      block.disorder = disorder;
      block.jitter = 0.01;
      block.update(t);
      const still = id === 'diamond' || id === 'SiO2';
      for (let i = 0; i < COUNT; i++) {
        const e = es[i]!;
        const site = block.sites[e.home]!;
        if (e.free > 0) {
          e.free -= dt;
          e.pos.addScaledVector(e.vel, dt);
          for (const ax of ['x', 'y', 'z'] as const)
            if (Math.abs(e.pos[ax]) > half) {
              e.pos[ax] = Math.sign(e.pos[ax]) * half;
              e.vel[ax] *= -1;
            }
          if (e.free !== Infinity) crystal.freed.copy(e.pos);
          p.copy(e.pos);
        } else {
          // bound: a small orbit beside its atom; a freshly returned electron eases home
          const r = still ? 0.12 : 0.17;
          const w = still ? 0.8 : 2.6;
          p.set(
            site.x + r * Math.cos(t * w + e.phase),
            site.y + r * Math.sin(t * w * 1.3 + e.phase) * 0.6,
            site.z + r * Math.sin(t * w + e.phase),
          );
          e.pos.lerp(p, Math.min(dt * 4, 1));
          p.copy(e.pos);
        }
        orbs.setPosition(i, p.x, p.y, p.z, 1);
      }
      orbs.commit();
    },
  };
  crystal.setMaterial('Cu');
  return crystal;
}
