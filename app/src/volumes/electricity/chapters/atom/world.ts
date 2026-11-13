/**
 * The shared world of the chapter: the hero copper atom Cu-63 (nucleus cluster + electron cloud) that the
 * camera dives into and returns to, and the scale ruler. Step-specific objects live in the step modules.
 *
 * Shared stage handles (use them in `stage.define`):
 *   actors  `world.nucleusActor`, `world.cloudActor`
 *   pose    `nucleus`            (scale / position of the nucleus cluster; default = «×1000» size)
 *   params  `cloudSpread` (1), `cloudGlow` (0.22), `scaleExp` (−10: what the ruler shows)
 */
import { Group } from 'three';
import { damp, toOverlay, type Actor, type ChapterContext, type Param } from '@/engine/api';
import { ProbabilityCloud } from './parts/cloud';
import { Nucleus } from './parts/nucleus';
import { createScaleRuler, type ScaleRuler } from './parts/ruler';

/** Radius of the copper atom's cloud, world units (the chapter's unit scale: subject radius ≈ 6). */
export const ATOM_RADIUS = 5;
/** Scale of the nucleus group in the default «×1000» presentation (cluster radius ≈ 0.55 units). */
export const NUCLEUS_SHOWN = 0.24;

export interface World {
  atom: Group;
  nucleus: Nucleus;
  nucleusActor: Actor;
  cloud: ProbabilityCloud;
  cloudActor: Actor;
  ruler: ScaleRuler;
  scaleExp: Param;
  /**
   * Scale of the whole atom wanted this frame. The scene resets it to 1 before the step's `update`; a step
   * that zooms through the atom (dive-in) writes it every frame. The world eases toward it.
   */
  atomZoom: number;
  /** Extra scale of the nucleus cluster this frame (reset to 1 like `atomZoom`): «Справжні пропорції». */
  nucleusShrink: number;
  /** Tumbling speed factor of the nucleus this frame (reset to 1; 0 holds it still for dragging). */
  nucleusSpin: number;
  /** Apply `atomZoom` without easing on the next update (deep links). */
  snap(): void;
  update(dt: number, t: number): void;
}

export function createWorld(ctx: ChapterContext): World {
  const { stage, root } = ctx;
  const atom = new Group();
  atom.name = 'copper-atom';
  root.add(atom);

  const nucleus = new Nucleus(ctx.random.fork('nucleus'), {
    maxProtons: 29,
    maxNeutrons: 34,
    protons: 29,
    neutrons: 34,
  });
  // holder = stage actor (pop in / out) › pose group (`nucleus` pose, «×1000» size) › cluster (free for steps)
  const nucleusHolder = new Group();
  const nucleusPose = new Group();
  nucleusPose.scale.setScalar(NUCLEUS_SHOWN);
  nucleusPose.add(nucleus.group);
  nucleusHolder.add(nucleusPose);
  atom.add(nucleusHolder);

  // 29 electrons as a fuzzy cloud: four radial shells (K, L, M, N) with soft gaussian spread
  const count = ctx.quality.count(9000, 2500);
  const cloud = new ProbabilityCloud({ capacity: count, size: 0.11, intensity: 0.22 });
  const rng = ctx.random.fork('cu-cloud');
  const shells = [
    { r: 0.14, sigma: 0.035, weight: 2 },
    { r: 0.3, sigma: 0.06, weight: 8 },
    { r: 0.55, sigma: 0.09, weight: 18 },
    { r: 0.86, sigma: 0.1, weight: 7 },
  ];
  const total = shells.reduce((s, x) => s + x.weight, 0);
  const points = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    let pick = rng.next() * total;
    let shell = shells[0]!;
    for (const s of shells) {
      shell = s;
      pick -= s.weight;
      if (pick <= 0) break;
    }
    const r = Math.max(0.05, shell.r + rng.gauss() * shell.sigma) * ATOM_RADIUS;
    const [x, y, z] = rng.onSphere();
    points.set([x * r, y * r, z * r], i * 3);
  }
  cloud.setPoints(points);
  cloud.swirl = 0.12;
  atom.add(cloud);
  // overlay layer: drawn after depth of field, so the dots stay crisp at every quality tier (ENGINE_API §14)
  toOverlay(cloud);

  const ruler = createScaleRuler(ctx);
  stage.pose('nucleus', nucleusPose);
  stage.param('cloudSpread', 1, { duration: 1.6, ease: 'power2.inOut', onChange: (v) => (cloud.spread = v) });
  stage.param('cloudGlow', 0.22, { onChange: (v) => (cloud.intensity = v) });
  const scaleExp = stage.param('scaleExp', -10, { duration: 1.8, ease: 'power2.inOut' });

  let zoom = 1;
  let spin = 0;
  let snapNext = true;
  return {
    atomZoom: 1,
    nucleusShrink: 1,
    nucleusSpin: 1,
    snap: () => (snapNext = true),
    atom,
    nucleus,
    nucleusActor: stage.actor(nucleusHolder),
    cloud,
    cloudActor: stage.actor(cloud, { appear: 'fade' }),
    ruler,
    scaleExp,
    update(dt, t) {
      zoom = snapNext ? this.atomZoom : damp(zoom, this.atomZoom, 9, dt);
      snapNext = false;
      atom.visible = zoom > 0.02;
      atom.scale.setScalar(Math.max(zoom, 1e-3));
      nucleus.group.scale.setScalar(this.nucleusShrink);
      if (atom.visible && nucleusHolder.visible) {
        spin += dt * this.nucleusSpin;
        nucleus.group.rotation.y = spin * 0.16;
        nucleus.group.rotation.x = Math.sin(spin * 0.11) * 0.2;
        nucleus.update(dt, t);
      }
    },
  };
}
