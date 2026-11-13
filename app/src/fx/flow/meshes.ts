/**
 * MeshFlow — any geometry + material instanced along paths on the CPU (coal lumps on a conveyor, crates,
 * fuel pellets, toon water blobs that must cast shadows). For up to a few hundred items; thousands of
 * glowing particles belong to `Flow` (GPU).
 */
import {
  type BufferGeometry,
  InstancedMesh,
  type Material,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';
import type { FxEnv } from '../core/env';
import { onTick } from '../core/tick';
import { bakePath, samplePath, tangentPath, type BakedPath, type PathInput } from './paths';

export interface MeshFlowOptions {
  geometry: BufferGeometry;
  material: Material;
  path: PathInput;
  closed?: boolean;
  /** Number of items (not scaled by quality: usually a visible, countable quantity). */
  count: number;
  /** Units/s. Default 1. */
  speed?: number;
  /** Random scale range. Default [1, 1]. */
  scale?: readonly [number, number];
  /** Random sideways / vertical offset, units. Default 0. */
  jitter?: number;
  /** Align the item's +X with the direction of travel. Default true. */
  align?: boolean;
  /** Tumble speed, rad/s (random axis per item). Default 0. */
  tumble?: number;
  /** Share of an open path used for growing in / shrinking out. Default 0.05. */
  endFade?: number;
  castShadow?: boolean;
  seed?: string;
}

const _p = new Vector3();
const _t = new Vector3();
const _q = new Quaternion();
const _q2 = new Quaternion();
const _s = new Vector3();
const _m = new Matrix4();
const X = new Vector3(1, 0, 0);

/** Instanced meshes travelling along a path. Create through `createMeshFlow()`. */
export class MeshFlow extends InstancedMesh {
  /** Units/s (tweenable; negative reverses). */
  speed: number;
  /** 0…1 share of items shown (tweenable). */
  density = 1;
  readonly path: BakedPath;
  private phase = 0;

  constructor(env: FxEnv, opts: MeshFlowOptions) {
    super(opts.geometry, opts.material, opts.count);
    this.name = 'mesh-flow';
    this.frustumCulled = false;
    this.castShadow = opts.castShadow ?? true;
    this.receiveShadow = true;
    this.speed = opts.speed ?? 1;
    this.path = bakePath(opts.path, 256, opts.closed ?? false);
    const rng = env.random.fork(opts.seed ?? 'mesh-flow');
    const scale = opts.scale ?? [1, 1];
    const jitter = opts.jitter ?? 0;
    const items = Array.from({ length: opts.count }, (_, i) => ({
      offset: (i + rng.signed(0.3)) / opts.count,
      scale: rng.range(scale[0], scale[1]),
      side: new Vector3(rng.signed(jitter), rng.signed(jitter * 0.4), rng.signed(jitter)),
      axis: new Vector3(...rng.onSphere()),
      spin: rng.range(0.5, 1),
      seed: rng.next(),
    }));
    const align = opts.align ?? true;
    const tumble = opts.tumble ?? 0;
    const endFade = opts.endFade ?? 0.05;
    onTick(this, (t, dt) => {
      this.phase = (this.phase + (this.speed * dt) / this.path.length) % 1;
      items.forEach((it, i) => {
        let u = it.offset + this.phase;
        u -= Math.floor(u);
        samplePath(this.path, u, _p).add(it.side);
        _q.identity();
        if (align) _q.setFromUnitVectors(X, tangentPath(this.path, u, _t));
        if (tumble > 0) _q.multiply(_q2.setFromAxisAngle(it.axis, t * tumble * it.spin + it.seed * 6.28));
        let k = it.seed <= this.density ? it.scale : 0;
        if (!this.path.closed) k *= Math.min(1, u / endFade, (1 - u) / endFade);
        this.setMatrixAt(i, _m.compose(_p, _q, _s.setScalar(Math.max(k, 1e-5))));
      });
      this.instanceMatrix.needsUpdate = true;
    });
  }
}

/** Meshes travelling along a path (see `MeshFlowOptions`). */
export function createMeshFlow(env: FxEnv, opts: MeshFlowOptions): MeshFlow {
  return new MeshFlow(env, opts);
}
