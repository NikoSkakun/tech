/**
 * The iron «crystal» of step `domains`: a slab whose surface is broken into 40 irregular magnetic domains.
 * The cells are a weighted Voronoi diagram drawn as a grid of small tiles (one instanced mesh): a domain whose
 * magnetisation points along the applied field gains weight, so its walls *slide* outward — the growth the
 * script asks for — while the others shrink. Tiles next to another domain are drawn smaller, which leaves dark
 * gaps: the domain walls. Each domain carries a `magenta` arrow (its magnetisation); above the Curie point the
 * order dissolves into a chaos of small arrows that tremble on their own.
 */
import { Color, InstancedMesh, Matrix4, Quaternion, Vector3, type Group } from 'three';
import { Builder } from '@/kit';
import type { Rng } from '@/engine/api';
import { col } from '@/style';
import { group } from '../world';

export interface DomainSlab {
  group: Group;
  /** Seed positions (world, slab-local x/z), for anchors. */
  seeds: { x: number; z: number }[];
  /** Feed the model: arrow angles (rad from +x, in the slab plane), field h (−1…1), jitter, heat 0…1. */
  update(dt: number, t: number, angles: ArrayLike<number>, h: number, jitter: number, chaos: number): void;
  /** Point on a wall between two domains near the slab centre (hotspot). */
  wallPoint: Vector3;
}

const NX = 72;
const NZ = 44;

function arrowBuilder(len: number, w: number): Builder {
  const b = new Builder('domain-arrow');
  b.box(len * 0.62, w * 0.5, w, { at: [-len * 0.19, 0, 0], r: w * 0.2, mid: true, slot: 'glow', c: 'magenta' });
  b.cone(w * 1.5, len * 0.38, { axis: 'x', seg: 4, at: [len * 0.12, 0, 0], s: [1, 0.4, 1], slot: 'glow', c: 'magenta' });
  return b;
}

export function createDomainSlab(rng: Rng, width: number, depth: number, count: number): DomainSlab {
  const g = group('domain-slab');
  // seeds on a jittered grid → irregular but evenly spread cells
  const cols = 8;
  const rows = Math.ceil(count / cols);
  const seeds: { x: number; z: number }[] = [];
  for (let i = 0; i < count; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    seeds.push({
      x: -width / 2 + ((c + 0.5 + (rng.next() - 0.5) * 0.8) / cols) * width,
      z: -depth / 2 + ((r + 0.5 + (rng.next() - 0.5) * 0.8) / rows) * depth,
    });
  }
  const pitchX = width / NX;
  const pitchZ = depth / NZ;
  const tb = new Builder('domain-tile');
  tb.box(pitchX, 0.04, pitchZ, { r: 0, mid: true });
  const tiles = new InstancedMesh(tb.geometry('toon'), tb.mats.get('toon'), NX * NZ);
  tiles.frustumCulled = false;
  const ab = arrowBuilder(0.36, 0.05);
  const arrows = new InstancedMesh(ab.geometry('glow'), ab.mats.get('glow'), count);
  arrows.frustumCulled = false;
  const CHAOS = 12 * 7;
  const cb = arrowBuilder(0.2, 0.03);
  const small = new InstancedMesh(cb.geometry('glow'), cb.mats.get('glow'), CHAOS);
  small.frustumCulled = false;
  g.add(tiles, arrows, small);
  const owner = new Int16Array(NX * NZ);
  const weight = new Float32Array(count);
  const cx = new Float32Array(count);
  const cz = new Float32Array(count);
  const area = new Float32Array(count);
  const m4 = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const p = new Vector3();
  const sc = new Vector3();
  const c = new Color();
  const hi = col('magenta');
  const mid = col('violet');
  const lo = col('bg.indigo').lerp(col('blue'), 0.35);
  const self: DomainSlab = {
    group: g,
    seeds,
    wallPoint: new Vector3(),
    update(dt, t, angles, h, jitter, chaos) {
      const ease = Math.min(dt * 5, 1);
      for (let i = 0; i < count; i++) {
        const a = angles[i]!;
        // domains pointing along the field grow: weight ∝ projection × |h| (walls slide, eased)
        const target = Math.cos(a) * h * pitchX * 9;
        weight[i] = weight[i]! + (target - weight[i]!) * ease;
        cx[i] = 0;
        cz[i] = 0;
        area[i] = 0;
      }
      for (let iz = 0; iz < NZ; iz++)
        for (let ix = 0; ix < NX; ix++) {
          const x = -width / 2 + (ix + 0.5) * pitchX;
          const z = -depth / 2 + (iz + 0.5) * pitchZ;
          let best = 0;
          let bd = Infinity;
          for (let i = 0; i < count; i++) {
            const d = Math.hypot(x - seeds[i]!.x, z - seeds[i]!.z) - weight[i]!;
            if (d < bd) [bd, best] = [d, i];
          }
          const k = iz * NX + ix;
          owner[k] = best;
          cx[best] = cx[best]! + x;
          cz[best] = cz[best]! + z;
          area[best] = area[best]! + 1;
        }
      for (let iz = 0; iz < NZ; iz++)
        for (let ix = 0; ix < NX; ix++) {
          const k = iz * NX + ix;
          const o = owner[k]!;
          const wall =
            (ix > 0 && owner[k - 1] !== o) || (ix < NX - 1 && owner[k + 1] !== o) || (iz > 0 && owner[k - NX] !== o) || (iz < NZ - 1 && owner[k + NX] !== o);
          // above T_C every tile has its own trembling direction: no domains, no walls worth the name
          const own = angles[o]! + jitter * Math.sin(t * 9 + o * 2.3);
          const noisy = own + chaos * (Math.sin(ix * 12.9898 + iz * 78.233 + t * 0.4) * 43758.5453 % (2 * Math.PI));
          const proj = Math.cos(noisy);
          if (proj >= 0) c.copy(mid).lerp(hi, proj);
          else c.copy(mid).lerp(lo, -proj);
          tiles.setColorAt(k, c);
          const s = wall && chaos < 0.5 ? 0.72 : 0.97;
          tiles.setMatrixAt(k, m4.compose(p.set(-width / 2 + (ix + 0.5) * pitchX, 0, -depth / 2 + (iz + 0.5) * pitchZ), q.identity(), sc.set(s, 1, s)));
          if (wall && ix === NX >> 1 && self.wallPoint.lengthSq() === 0) self.wallPoint.copy(p);
        }
      tiles.instanceMatrix.needsUpdate = true;
      if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
      for (let i = 0; i < count; i++) {
        const n = area[i]!;
        const a = angles[i]! + jitter * Math.sin(t * 9 + i * 2.3);
        const s = n > 6 ? Math.min(Math.sqrt(n) / 7, 1.25) * (1 - chaos) : 0;
        q.setFromAxisAngle(up, a);
        arrows.setMatrixAt(i, m4.compose(p.set(n ? cx[i]! / n : 0, 0.05, n ? cz[i]! / n : 0), q, sc.set(s, s, s)));
      }
      arrows.instanceMatrix.needsUpdate = true;
      for (let k = 0; k < CHAOS; k++) {
        const x = -width / 2 + ((k % 12) + 0.5) * (width / 12);
        const z = -depth / 2 + (Math.floor(k / 12) + 0.5) * (depth / 7);
        const a = Math.sin(k * 91.7) * 10 + Math.sin(t * (2 + (k % 5)) + k) * 2.5;
        q.setFromAxisAngle(up, a);
        small.setMatrixAt(k, m4.compose(p.set(x, 0.05, z), q, sc.setScalar(chaos)));
      }
      small.instanceMatrix.needsUpdate = true;
    },
  };
  return self;
}
