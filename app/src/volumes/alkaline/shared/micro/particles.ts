/**
 * The two carriers of this volume, drawn so they can never be confused (VISUAL.md §2):
 * - an electron: a small `cyan` spark that glows (K.glow), fast;
 * - an ion: a ball three times larger, matte (K.toon) with a soft halo and a «−» on its face (`violet`, a particle of
 *   the lye), or a grey zinc ball with a `coral` ring (a zinc ion, «+»). Ions move slowly.
 * Both are instanced sets; `put(i, x, y, z, s)` places one (s = 0 hides it), `commit()` once per frame.
 */
import {
  BoxGeometry,
  type Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Quaternion,
  TorusGeometry,
  Vector3,
} from 'three';
import { K } from '@/style';

export const ELECTRON_R = 0.07;
export const ION_R = 0.22;

export interface ParticleSet {
  count: number;
  put(i: number, x: number, y: number, z: number, s?: number): void;
  commit(): void;
}

const m4 = new Matrix4();
const q = new Quaternion();
const p = new Vector3();
const sc = new Vector3();

function sets(
  parent: Group,
  meshes: InstancedMesh[],
  place: (i: number, x: number, y: number, z: number, s: number) => void,
  count: number,
): ParticleSet {
  for (const m of meshes) {
    m.frustumCulled = false;
    m.castShadow = m.receiveShadow = false;
    parent.add(m);
  }
  for (let i = 0; i < count; i++) place(i, 0, 0, 0, 0);
  return {
    count,
    put: (i, x, y, z, s = 1) => place(i, x, y, z, s),
    commit: () => {
      for (const m of meshes) m.instanceMatrix.needsUpdate = true;
    },
  };
}

export function electrons(parent: Group, count: number, radius = ELECTRON_R): ParticleSet {
  const ball = new IcosahedronGeometry(1, 2);
  const core = new InstancedMesh(
    ball,
    K.glow({ color: 'cyan', intensity: 1.7, whiten: 0.15, keepHue: true }),
    count,
  );
  const halo = new InstancedMesh(
    ball,
    K.glow({ color: 'cyan', intensity: 0.9, additive: true, opacity: 0.35 }),
    count,
  );
  return sets(
    parent,
    [core, halo],
    (i, x, y, z, s) => {
      core.setMatrixAt(i, m4.compose(p.set(x, y, z), q, sc.setScalar(radius * s)));
      halo.setMatrixAt(i, m4.compose(p, q, sc.setScalar(radius * 2.6 * s)));
    },
    count,
  );
}

/** Particles of the lye with a minus: violet balls, halo, a white «−» toward the camera (+z). */
export function minusIons(parent: Group, count: number, radius = ION_R): ParticleSet {
  const ball = new IcosahedronGeometry(1, 3);
  const body = new InstancedMesh(
    ball,
    K.toon({ color: 'violet', emissive: 'violet', emissiveIntensity: 0.45, highlight: 0.7 }),
    count,
  );
  const halo = new InstancedMesh(
    ball,
    K.glow({ color: 'violet', intensity: 0.8, additive: true, opacity: 0.22, whiten: 0 }),
    count,
  );
  const bar = new InstancedMesh(
    new BoxGeometry(0.9, 0.22, 0.1),
    K.glow({ color: 'white', intensity: 1.1, whiten: 0 }),
    count,
  );
  return sets(
    parent,
    [body, halo, bar],
    (i, x, y, z, s) => {
      body.setMatrixAt(i, m4.compose(p.set(x, y, z), q, sc.setScalar(radius * s)));
      halo.setMatrixAt(i, m4.compose(p, q, sc.setScalar(radius * 1.55 * s)));
      bar.setMatrixAt(i, m4.compose(p.set(x, y, z + radius * 0.98 * s), q, sc.setScalar(radius * 0.8 * s)));
    },
    count,
  );
}

/** Zinc ions: a grey zinc ball with a coral ring round it (a plus). */
export function zincIons(parent: Group, count: number, radius = ION_R * 0.95): ParticleSet {
  const body = new InstancedMesh(
    new IcosahedronGeometry(1, 3),
    K.metal({ color: 'white', emissive: 'mist', emissiveIntensity: 0.3, shininess: 80 }),
    count,
  );
  const ring = new InstancedMesh(
    new TorusGeometry(1.35, 0.12, 8, 32),
    K.glow({ color: 'coral', intensity: 1.5, whiten: 0, keepHue: true }),
    count,
  );
  return sets(
    parent,
    [body, ring],
    (i, x, y, z, s) => {
      body.setMatrixAt(i, m4.compose(p.set(x, y, z), q, sc.setScalar(radius * s)));
      ring.setMatrixAt(i, m4.compose(p, q, sc.setScalar(radius * s)));
    },
    count,
  );
}
