/**
 * Step 5's copper close-up: a 4×4×4-cell block whose ions tremble with √T and glow `orange` where a lattice
 * ripple (phonon) passes, `violet` impurity atoms (larger), one vacancy with a dashed outline, and `cyan`
 * electrons that drift against the field and, at a rate ∝ ρ, scatter — a flash, and the gained drift is lost.
 */
import { Group, Mesh, TorusGeometry, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createOrbs, createSparks } from '@/fx';
import { G } from '@/kit';
import { col, heatRamp, K } from '@/style';
import { createFccBlock, type FccBlock } from './fcc-block';

const E_COUNT = 36;
/** Mean free time on stage for pure copper at 20 °C, s (illustrative; scales with 1/ρ). */
const TAU0 = 1.6;
/** Drift acceleration, units/s². */
const PULL = 0.9;

export interface ScatterCrystal {
  group: Group;
  block: FccBlock;
  /** √T_K / √293 (ion trembling, ripple glow). */
  jitter: number;
  /** ρ / ρ_Cu,20 (scattering rate). */
  scattering: number;
  /** Impurity share, 0…2 %. */
  impurity: number;
  /** Nichrome: half the sites are another metal. */
  alloy: boolean;
  vacancy: Vector3;
  impurityAt: Vector3;
  update(dt: number, t: number): void;
}

export function createScatterCrystal(ctx: ChapterContext): ScatterCrystal {
  const group = new Group();
  const block = createFccBlock({ cells: 4, a: 0.8, radius: 0.15, instanceColors: true });
  const n = block.sites.length;
  const half = block.size / 2;
  // impurity order: spread over the block (a fixed shuffle), vacancy = a face site near the front
  const order = Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => Math.sin(a * 91.3) - Math.sin(b * 91.3),
  );
  const rank = new Int32Array(n);
  order.forEach((site, k) => (rank[site] = k));
  const vacancyIndex = block.sites.findIndex(
    (s) => s.z > half - 0.01 && Math.abs(s.x) < 0.5 && Math.abs(s.y - 0.4) < 0.5,
  );
  block.scales[vacancyIndex] = 0;
  const vacancy = block.sites[vacancyIndex]!.clone();
  // dashed outline of the empty site: 10 short arcs
  const ring = new Mesh(
    G.mergeGeometries(
      Array.from({ length: 10 }, (_, k) =>
        new TorusGeometry(0.2, 0.014, 6, 6, (Math.PI * 2) / 20).rotateZ((k * Math.PI * 2) / 10),
      ),
    ),
    K.glow({ color: 'mist', whiten: 0, keepHue: true, intensity: 1.2 }),
  );
  ring.position.copy(vacancy);
  const electrons = createOrbs({ kind: 'electron', count: E_COUNT, radius: 0.08 });
  const sparks = createSparks(ctx, { color: 'cyan', size: 0.04 });
  group.add(block.group, ring, electrons, sparks);
  const pos = Array.from({ length: E_COUNT }, () => new Vector3());
  const vel = Array.from({ length: E_COUNT }, () => new Vector3());
  const next = new Float32Array(E_COUNT);
  for (let i = 0; i < E_COUNT; i++) {
    pos[i]!.set(
      (ctx.random.next() - 0.5) * block.size,
      (ctx.random.next() - 0.5) * block.size,
      (ctx.random.next() - 0.5) * block.size,
    );
    next[i] = ctx.random.next() * TAU0;
  }
  const base = col('coral.dark');
  const other = col('steel');
  const tint = col('coral.dark');
  const crystal: ScatterCrystal = {
    group,
    block,
    jitter: 1,
    scattering: 1,
    impurity: 0,
    alloy: false,
    vacancy,
    impurityAt: block.sites[order[0]!]!.clone(),
    update(dt, t) {
      block.jitter = 0.018 * crystal.jitter;
      const impurities = Math.round(crystal.impurity * 7);
      const hot = Math.max(crystal.jitter - 0.75, 0) * 1.6;
      for (let i = 0; i < n; i++) {
        const k = rank[i]!;
        const s = block.sites[i]!;
        if (k < impurities && i !== vacancyIndex) {
          block.ions.setInstanceColor(i, 'violet');
          block.scales[i] = 1.35;
          continue;
        }
        if (i !== vacancyIndex) block.scales[i] = 1;
        // a lattice ripple running along the block: hot crests glow orange (stronger when hot)
        const wave = 0.5 + 0.5 * Math.sin(s.x * 2.2 + s.y * 0.8 - t * 3.1);
        tint
          .copy(crystal.alloy && i % 2 === 1 ? other : base)
          .lerp(heatRamp(0.55 + 0.4 * wave), Math.min(hot * wave * wave, 0.7));
        block.ions.setInstanceColor(i, tint);
      }
      block.update(t);
      // electrons: accelerate against the field (−x), lose the drift at each scattering
      const tau = TAU0 / Math.max(crystal.scattering, 0.05);
      for (let i = 0; i < E_COUNT; i++) {
        const p = pos[i]!;
        const v = vel[i]!;
        next[i] = next[i]! - dt;
        if (next[i]! <= 0) {
          next[i] = tau * (0.3 + 1.4 * ctx.random.next());
          sparks.burst(p.toArray(), 5);
          v.set(ctx.random.next() - 0.5, ctx.random.next() - 0.5, ctx.random.next() - 0.5).multiplyScalar(
            0.5,
          );
        }
        v.x -= PULL * dt;
        p.addScaledVector(v, dt);
        if (p.x < -half) p.x += block.size;
        for (const ax of ['y', 'z'] as const)
          if (Math.abs(p[ax]) > half) {
            p[ax] = Math.sign(p[ax]) * half;
            v[ax] *= -1;
          }
        electrons.setPosition(i, p.x, p.y, p.z);
      }
      electrons.commit();
      ring.lookAt(ctx.camera.camera.position);
    },
  };
  return crystal;
}
