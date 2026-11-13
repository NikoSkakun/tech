/**
 * Capsule people (STYLE_GUIDE §3: very simple figures, never faces) for scale and charm: standing with a
 * gentle idle sway, walking along a path, or doing a work gesture. Any number of people costs four draw calls
 * (bodies, heads, limbs, hats) — everything is instanced and animated in `update`. Units: metres (adult 1.75 m).
 */
import { Euler, Group, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import type { Rng } from '@/engine/api';
import { col, type ColorLike } from '@/style';
import { KitModel, MatSet, type V3 } from '../core/builder';
import * as G from '../core/geo';
import { samplePath, type PathSampler } from './motion';

export interface PersonSpec {
  /** Standing position (ignored when `path` is given). */
  at?: V3;
  /** Facing direction (rotation around Y) when standing. */
  ry?: number;
  /** Walk along this polyline, there and back (or round a closed loop with `loop`). */
  path?: readonly Vector3[];
  loop?: boolean;
  /** Walking speed, m/s. Default 1.2. */
  speed?: number;
  /** `idle` (default when standing), `walk` (default with a path), `work` (one arm hammering / waving). */
  action?: 'idle' | 'walk' | 'work';
  /** Clothing colour (default: random from a friendly set). */
  color?: ColorLike;
  /** Hard hat colour for workers (e.g. `yellow`), none by default. */
  hat?: ColorLike;
  /** 1 = adult, ~0.62 = child, ~0.25 = cat-sized. */
  scale?: number;
}

const CLOTHES = ['coral', 'teal', 'yellow', 'violet', 'sky', 'pink', 'orange', 'lime'] as const;
const SKIN = [col('orange.light').lerp(col('white'), 0.35), col('wireBrown').lerp(col('orange.light'), 0.55), col('orange.light').lerp(col('wireBrown'), 0.3)];

export function people(specs: readonly PersonSpec[], rng: Rng): KitModel {
  const n = specs.length;
  const mats = new MatSet();
  const mat = mats.get('soft');
  const group = new Group();
  group.name = 'people';
  const body = new InstancedMesh(G.capsule(0.21, 0.72, 12), mat, n);
  const head = new InstancedMesh(G.sphere(0.165, 12), mat, n);
  const limbGeo = G.capsule(0.075, 0.62, 8);
  limbGeo.translate(0, -0.24, 0); // pivot at the shoulder / hip
  const limb = new InstancedMesh(limbGeo, mat, n * 4);
  const hatted = specs.map((s, i) => (s.hat !== undefined ? i : -1)).filter((i) => i >= 0);
  const hat = new InstancedMesh(G.dome(0.19, 0.13, 10), mat, Math.max(hatted.length, 1));
  hat.count = hatted.length;
  for (const im of [body, head, limb, hat]) {
    im.castShadow = true;
    im.frustumCulled = false;
    group.add(im);
  }
  interface State {
    sampler: PathSampler | null;
    phase: number;
    k: number;
    action: 'idle' | 'walk' | 'work';
    speed: number;
    base: Vector3;
    ry: number;
  }
  const states: State[] = specs.map((s, i) => {
    const cloth = col(s.color ?? rng.pick(CLOTHES));
    body.setColorAt(i, cloth);
    head.setColorAt(i, rng.pick(SKIN));
    for (let l = 0; l < 4; l++) limb.setColorAt(i * 4 + l, l < 2 ? cloth.clone().multiplyScalar(0.9) : col('slate').lerp(col('blue.dark'), rng.next() * 0.6));
    return {
      sampler: s.path ? samplePath(s.path, s.loop ? 'loop' : 'pingpong') : null,
      phase: rng.range(0, 30),
      k: s.scale ?? rng.range(0.93, 1.06),
      action: s.action ?? (s.path ? 'walk' : 'idle'),
      speed: s.speed ?? 1.2,
      base: new Vector3(...(s.at ?? [0, 0, 0])),
      ry: s.ry ?? 0,
    };
  });
  hatted.forEach((i, j) => hat.setColorAt(j, col(specs[i]!.hat!)));
  const m = new Matrix4();
  const root = new Matrix4();
  const local = new Matrix4();
  const q = new Quaternion();
  const e = new Euler();
  const p = new Vector3();
  const t = new Vector3();
  const one = new Vector3(1, 1, 1);
  const model = new KitModel(group, {}, {}, mats, n * 700);
  model.update = (_dt, time) => {
    states.forEach((s, i) => {
      let heading = s.ry;
      let stride = 0;
      if (s.sampler) {
        s.sampler.at(s.phase + time * s.speed, p, t);
        heading = Math.atan2(t.x, t.z);
        stride = Math.sin((s.phase + time * s.speed) * 5.2 / s.k);
      } else p.copy(s.base);
      const bob = s.action === 'walk' ? Math.abs(stride) * 0.03 : Math.sin(time * 1.7 + s.phase) * 0.012;
      root.compose(p, q.setFromEuler(e.set(0, heading + (s.action === 'idle' ? Math.sin(time * 0.6 + s.phase) * 0.15 : 0), 0)), one.setScalar(s.k));
      body.setMatrixAt(i, m.multiplyMatrices(root, local.makeTranslation(0, 1.14 + bob, 0)));
      head.setMatrixAt(i, m.multiplyMatrices(root, local.makeTranslation(0, 1.63 + bob, 0)));
      const hi = hatted.indexOf(i);
      if (hi >= 0) hat.setMatrixAt(hi, m.multiplyMatrices(root, local.makeTranslation(0, 1.7 + bob, 0)));
      for (let l = 0; l < 4; l++) {
        const side = l % 2 ? 1 : -1;
        const arm = l < 2;
        let swing = s.action === 'walk' ? stride * 0.55 * (arm ? -side : side) : 0;
        if (s.action === 'work' && arm && side > 0) swing = -1.5 + Math.sin(time * 6 + s.phase) * 0.6;
        local.makeRotationFromEuler(e.set(swing, 0, arm ? side * 0.12 : 0)).setPosition(side * (arm ? 0.27 : 0.1), (arm ? 1.38 : 0.74) + bob, 0);
        limb.setMatrixAt(i * 4 + l, m.multiplyMatrices(root, local));
      }
    });
    for (const im of [body, head, limb, hat]) im.instanceMatrix.needsUpdate = true;
  };
  model.update(0, 0);
  return model;
}
