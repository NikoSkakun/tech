/**
 * Arrows: a single 3D vector arrow (force, velocity, field at a probe, phasor…) with a label hook at its
 * tip, and an instanced grid of arrows sampling a vector field.
 */
import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  Object3D,
  Quaternion,
  Vector2,
  Vector3,
} from 'three';
import { col, K, type ColorLike, type KGlowMaterial } from '@/style';
import type { VectorField } from './sources';

const Y = new Vector3(0, 1, 0);
const _q = new Quaternion();
const _v = new Vector3();
const _p = new Vector3();
const _s = new Vector3();
const _m = new Matrix4();
const _c = new Color();

export interface VectorArrowOptions {
  color?: ColorLike;
  /** Shaft radius, units. Default 0.035. */
  radius?: number;
  /** Head length / radius, units. Defaults 0.24 / 0.1. */
  headLength?: number;
  headRadius?: number;
  /** Emissive brightness (> ~1.2 blooms). Default 1.25. */
  intensity?: number;
}

/** A 3D arrow from `origin` along a vector. Create through `createVectorArrow()`. */
export class VectorArrow extends Group {
  /** Empty object at the arrow tip — parent a label to it. */
  readonly tip = new Object3D();
  readonly material: KGlowMaterial;
  private readonly shaft: Mesh;
  private readonly head: Mesh;
  private readonly headLength: number;

  constructor(o: VectorArrowOptions = {}) {
    super();
    this.name = 'vector-arrow';
    const r = o.radius ?? 0.035;
    this.headLength = o.headLength ?? 0.24;
    const color = o.color ?? 'white';
    // whiten 0 + keepHue: the arrow keeps its semantic hue at the core and under bloom (no bleach toward white)
    this.material = K.glow({ color, whiten: 0, keepHue: true, intensity: o.intensity ?? 1.25, falloff: 0.8, edge: 0.75 });
    this.shaft = new Mesh(new CylinderGeometry(r, r, 1, 16, 1).translate(0, 0.5, 0), this.material);
    this.head = new Mesh(new ConeGeometry(o.headRadius ?? 0.1, this.headLength, 24).translate(0, this.headLength / 2, 0), this.material);
    this.add(this.shaft, this.head, this.tip);
    this.set([0, 0, 0], [0, 1, 0]);
  }

  /** Place the arrow: it starts at `origin` and spans `vector` (local units of the parent). */
  set(origin: Vector3 | readonly [number, number, number], vector: Vector3 | readonly [number, number, number]): this {
    if (Array.isArray(origin)) this.position.set(origin[0], origin[1], origin[2]);
    else this.position.copy(origin as Vector3);
    if (Array.isArray(vector)) _v.set(vector[0], vector[1], vector[2]);
    else _v.copy(vector as Vector3);
    const length = _v.length();
    this.visible = length > 1e-4;
    if (!this.visible) return this;
    this.quaternion.setFromUnitVectors(Y, _v.divideScalar(length));
    // a short vector shrinks the head instead of letting it poke out behind the origin
    const head = Math.min(this.headLength, length * 0.6);
    const k = head / this.headLength;
    this.shaft.scale.set(1, Math.max(length - head, 1e-4), 1);
    this.head.position.y = length - head;
    this.head.scale.setScalar(k);
    this.tip.position.y = length;
    return this;
  }

  setColor(color: ColorLike): this {
    this.material.setColor(color);
    (this.material.uniforms.uCore!.value as Color).copy(this.material.color);
    return this;
  }
}

export function createVectorArrow(o: VectorArrowOptions = {}): VectorArrow {
  return new VectorArrow(o);
}

export interface ArrowFieldOptions {
  /** Sample points (local space). */
  points: readonly Vector3[];
  color?: ColorLike;
  /** Arrow length at (and above) the reference magnitude, units. Default 0.5. */
  length?: number;
  /** Field magnitude that maps to full length. Default: the 90th percentile of the first sampling. */
  reference?: number;
  /** 0 = all arrows equally long (direction only) … 1 = length ∝ magnitude. Default 0.6. */
  magnitudeScale?: number;
  intensity?: number;
}

/** Instanced arrows showing a vector field at fixed points. Create through `createArrowField()`. */
export class ArrowField extends InstancedMesh {
  private readonly points: readonly Vector3[];
  private readonly base: Color;
  private readonly o: ArrowFieldOptions;
  private reference: number;

  constructor(field: VectorField, o: ArrowFieldOptions) {
    // unit arrow along +Y, centred on its middle: bottom → top lathe profile
    const profile = [[0, -0.5], [0.045, -0.5], [0.045, 0.12], [0.13, 0.12], [0, 0.5]].map(([x, y]) => new Vector2(x, y));
    // white × per-instance tint (the semantic colour scaled by magnitude); keepHue holds the hue under bloom
    const material = K.glow({ color: 'white', keepHue: true, intensity: o.intensity ?? 1.2, falloff: 0.7, edge: 0.8 });
    super(new LatheGeometry(profile, 16), material, o.points.length);
    this.name = 'arrow-field';
    this.frustumCulled = false;
    this.points = o.points;
    this.o = o;
    this.base = col(o.color ?? 'amber');
    this.reference = o.reference ?? 0;
    this.sample(field);
  }

  /** Re-evaluate the field at every point (call when sources move). */
  sample(field: VectorField): void {
    const mags: number[] = [];
    const dirs = this.points.map((p) => {
      const v = field(p, new Vector3());
      mags.push(v.length());
      return v;
    });
    if (this.reference <= 0) {
      const sorted = [...mags].sort((a, b) => a - b);
      this.reference = sorted[Math.floor(sorted.length * 0.9)] || 1;
    }
    const length = this.o.length ?? 0.5;
    const ms = this.o.magnitudeScale ?? 0.6;
    this.points.forEach((p, i) => {
      const m = mags[i]!;
      const rel = Math.min(m / this.reference, 1);
      // square root compresses the huge dynamic range near sources
      const k = length * (1 - ms + ms * Math.sqrt(rel));
      if (m > 1e-9) _q.setFromUnitVectors(Y, _v.copy(dirs[i]!).divideScalar(m));
      this.setMatrixAt(i, _m.compose(_p.copy(p), _q, _s.setScalar(m > 1e-9 ? k : 1e-5)));
      this.setColorAt(i, _c.copy(this.base).multiplyScalar(0.45 + 0.55 * Math.sqrt(rel)));
    });
    this.instanceMatrix.needsUpdate = true;
    if (this.instanceColor) this.instanceColor.needsUpdate = true;
  }
}

export function createArrowField(field: VectorField, o: ArrowFieldOptions): ArrowField {
  return new ArrowField(field, o);
}

/** Regular grid of points in a box (centre, size, counts per axis) for `createArrowField`. */
export function gridPoints(center: Vector3, size: readonly [number, number, number], counts: readonly [number, number, number]): Vector3[] {
  const out: Vector3[] = [];
  const at = (i: number, n: number, s: number): number => (n === 1 ? 0 : (i / (n - 1) - 0.5) * s);
  for (let x = 0; x < counts[0]; x++)
    for (let y = 0; y < counts[1]; y++)
      for (let z = 0; z < counts[2]; z++)
        out.push(new Vector3(at(x, counts[0], size[0]), at(y, counts[1], size[1]), at(z, counts[2], size[2])).add(center));
  return out;
}
