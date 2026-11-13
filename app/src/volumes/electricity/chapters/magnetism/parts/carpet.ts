/**
 * «Килим компасів» — the live layer of the chapter (script, «Наскрізна візуальна ідея»): a 24×24 grid of tiny
 * compass needles lying on the table. Every frame each needle turns toward the horizontal projection of the
 * total field the step on screen supplies (`field`), with the critically damped turn of model М1 (τ = 0,12 s).
 * With no field but the Earth's they rest on north and tremble a little. One instanced draw call.
 */
import { InstancedMesh, Matrix4, Quaternion, Vector3, type Group } from 'three';
import { Builder } from '@/kit';
import { MAGNETS } from '@electricity/sim/magnetism';
import { S, group } from '../world';

/** Horizontal field at a world point of the table (x, z units) → sim components (east, north), T. */
export type CarpetField = (x: number, z: number, out: { x: number; y: number }) => void;

export interface CompassCarpet {
  group: Group;
  /** The step's field (Earth included); set by the step in `enter`. */
  field: CarpetField;
  /** Hide needles under objects (true = hidden); evaluated every frame, so it may follow moving objects. */
  mask: (x: number, z: number) => boolean;
  /** Lay the grid out: centre (world x, z) and side length, units. */
  layout(cx: number, cz: number, side: number): void;
  /** Snap every needle to its target (deep links). */
  settle(): void;
  update(dt: number, t: number): void;
  /** Needle heading of the needle nearest to a point, rad from east (QA). */
  headingAt(x: number, z: number): number;
}

const N = 24;
const LEN = 0.13;
const EARTH = (_x: number, _z: number, out: { x: number; y: number }): void => {
  out.x = 0;
  out.y = MAGNETS.earthT;
};

function needleModel(): Builder {
  const b = new Builder('carpet-needle');
  // flat four-sided pyramids: N half coral toward +x, tail mist toward −x; a brass pivot dot
  b.cone(0.024, LEN / 2, { axis: 'x', seg: 4, c: 'coral', s: [1, 0.35, 1] });
  b.frame({ rot: [0, Math.PI, 0] }, () => b.cone(0.024, LEN / 2, { axis: 'x', seg: 4, c: 'mist', s: [1, 0.35, 1] }));
  b.cyl(0.012, 0.016, { seg: 8, c: 'amber', at: [0, -0.006, 0] });
  return b;
}

export function createCarpet(): CompassCarpet {
  const g = group('compass-carpet');
  const b = needleModel();
  const count = N * N;
  const inst = new InstancedMesh(b.geometry('toon'), b.mats.get('toon'), count);
  inst.castShadow = false;
  inst.receiveShadow = true;
  inst.frustumCulled = false;
  g.add(inst);
  const xs = new Float32Array(count);
  const zs = new Float32Array(count);
  const shown = new Uint8Array(count);
  const angle = new Float32Array(count).fill(Math.PI / 2);
  const vel = new Float32Array(count);
  const b2 = { x: 0, y: 0 };
  const m4 = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const pos = new Vector3();
  const one = new Vector3(1, 1, 1);
  const zero = new Vector3(0, 0, 0);
  const omega = 1 / MAGNETS.compassTauS;

  const target = (k: number): number => {
    self.field(xs[k]!, zs[k]!, b2);
    return Math.atan2(b2.y, b2.x);
  };
  const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

  const self: CompassCarpet = {
    group: g,
    field: EARTH,
    mask: () => false,
    layout(cx, cz, side) {
      const pitch = side / (N - 1);
      for (let i = 0; i < N; i++)
        for (let j = 0; j < N; j++) {
          const k = i * N + j;
          xs[k] = cx - side / 2 + j * pitch;
          zs[k] = cz - side / 2 + i * pitch;
          shown[k] = Math.hypot(xs[k]!, zs[k]!) < 5.6 ? 1 : 0;
        }
    },
    settle() {
      for (let k = 0; k < count; k++) {
        angle[k] = target(k);
        vel[k] = 0;
      }
    },
    update(dt, t) {
      const h = Math.min(dt, 0.05);
      for (let k = 0; k < count; k++) {
        if (!shown[k] || self.mask(xs[k]!, zs[k]!)) {
          inst.setMatrixAt(k, m4.compose(pos.set(xs[k]!, 0, zs[k]!), q.identity(), zero));
          continue;
        }
        // critically damped turn toward the field (shortest way round), plus a faint tremble
        const err = wrap(target(k) - angle[k]!);
        vel[k] = vel[k]! + (omega * omega * err - 2 * omega * vel[k]!) * h;
        angle[k] = angle[k]! + vel[k]! * h;
        const tremble = 0.03 * Math.sin(t * 7.3 + k * 1.7) * Math.sin(t * 2.1 + k * 0.37);
        q.setFromAxisAngle(up, angle[k]! + tremble);
        inst.setMatrixAt(k, m4.compose(pos.set(xs[k]!, 0.012, zs[k]!), q, one));
      }
      inst.instanceMatrix.needsUpdate = true;
    },
    headingAt(x, z) {
      let best = 0;
      let d = Infinity;
      for (let k = 0; k < count; k++) {
        const e = (xs[k]! - x) ** 2 + (zs[k]! - z) ** 2;
        if (e < d) [d, best] = [e, k];
      }
      return angle[best]!;
    },
  };
  self.layout(0, 0, 4.6);
  return self;
}

/** Earth only — the resting field of the carpet. */
export const earthField: CarpetField = EARTH;
/** World units → sim metres along one axis. */
export const toSim = (u: number): number => u / S;
