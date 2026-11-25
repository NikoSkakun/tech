/**
 * The field of the micro world (VISUAL.md §4.3, floor «зернятка»): silver zinc grains touching each other in the lye,
 * the separator's pale fibres, the black crumbs of manganese oxide with graphite flakes, a dark backdrop around it
 * all, slow lye ions drifting, and — with `flow` > 0 (the circuit closed) — the two streams that close the loop
 * inside: lye ions swimming through the separator toward the zinc, electrons running over the zinc toward the nail.
 */
import {
  BackSide,
  BoxGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  SphereGeometry,
  Vector3,
  Euler,
} from 'three';
import { K } from '@/style';
import { seeded } from '@circuit/shared/stage/battery-grains';
import { EDGE_GRAIN, SEP, fibres, oxideCrumbs, zincGrains } from './layout';
import { electrons, minusIons, type ParticleSet } from './particles';

/** A lumpy grain: an icosphere pushed in and out a little (one shape, every instance turned differently). */
function lumpy(detail: number, amount: number, seed: number): IcosahedronGeometry {
  const g = new IcosahedronGeometry(1, detail);
  const pos = g.getAttribute('position');
  const rnd = seeded(seed);
  const bumps = Array.from({ length: 6 }, () =>
    new Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(),
  );
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    let k = 1;
    for (const b of bumps) k += amount * Math.max(0, v.dot(b)) ** 3;
    pos.setXYZ(i, v.x * k, v.y * k, v.z * k);
  }
  g.computeVertexNormals();
  return g;
}

export interface Field {
  group: Group;
  /** The grain whose edge the atoms floor shows (fades out as the atoms come in). */
  edgeGrain: Mesh;
  /** 0 … 1: the streams of a closed circuit. */
  flow: number;
  /** 0 … 1: how much of the separator and the oxide shows (the atoms floor hides them: at that scale they are far). */
  far: number;
  /** Ions that crossed the separator / electrons that left over the zinc, since `resetCount()` (whole ones). */
  readonly crossed: number;
  resetCount(): void;
  update(dt: number, t: number): void;
}

const STREAM = 14;
const AMBIENT = 16;

export function createField(): Field {
  const group = new Group();
  group.name = 'micro-field';
  const m4 = new Matrix4();
  const q = new Quaternion();
  const s = new Vector3();
  const p = new Vector3();
  const e = new Euler();
  const rnd = seeded(404);

  const zincMat = K.metal({
    color: 'mist',
    emissive: 'white',
    emissiveIntensity: 0.22,
    shininess: 80,
    specular: 0.9,
  });
  const grains = zincGrains();
  const zinc = new InstancedMesh(lumpy(4, 0.14, 5), zincMat, grains.length - 1);
  grains.slice(1).forEach((g, i) => {
    q.setFromEuler(e.set(rnd() * 6, rnd() * 6, rnd() * 6));
    zinc.setMatrixAt(i, m4.compose(p.set(g.x, g.y, g.z), q, s.set(g.r, g.r * (0.85 + rnd() * 0.2), g.r)));
  });
  const edgeGrain = new Mesh(lumpy(4, 0.1, 9), zincMat.clone());
  edgeGrain.position.set(EDGE_GRAIN.x, EDGE_GRAIN.y, EDGE_GRAIN.z);
  edgeGrain.scale.setScalar(EDGE_GRAIN.r);

  const crumbs = oxideCrumbs();
  const oxide = new InstancedMesh(
    new DodecahedronGeometry(1, 0),
    K.toon({ color: 'ink', emissive: 'slate', emissiveIntensity: 0.18, flatShading: true }),
    crumbs.length,
  );
  const flakes = new InstancedMesh(
    new BoxGeometry(1, 0.12, 0.7),
    K.metal({ color: 'slate', emissive: 'steel', emissiveIntensity: 0.25 }),
    crumbs.length,
  );
  crumbs.forEach((c, i) => {
    q.setFromEuler(e.set(rnd() * 6, rnd() * 6, rnd() * 6));
    oxide.setMatrixAt(i, m4.compose(p.set(c.x, c.y, c.z), q, s.setScalar(c.r)));
    q.setFromEuler(e.set(rnd() * 6, rnd() * 6, rnd() * 6));
    flakes.setMatrixAt(
      i,
      m4.compose(p.set(c.x + c.r * 0.6, c.y - c.r * 0.5, c.z + c.r * 0.7), q, s.setScalar(0.5 + rnd() * 0.3)),
    );
  });

  const fib = fibres();
  const strands = new InstancedMesh(
    new CylinderGeometry(0.045, 0.045, 20, 6, 1),
    K.toon({ color: 'white', emissive: 'mist', emissiveIntensity: 0.4 }),
    fib.length,
  );
  fib.forEach((f, i) => {
    q.setFromEuler(e.set(0, 0, f.tilt));
    strands.setMatrixAt(i, m4.compose(p.set(f.x, f.y, f.z), q, s.setScalar(1)));
  });

  // the lye around everything: the inside of a large dark sphere, a little violet
  const backdrop = new Mesh(
    new SphereGeometry(48, 32, 16),
    K.toon({ color: 'bg.indigo', emissive: 'bg.violet', emissiveIntensity: 0.35 }),
  );
  (backdrop.material as { side: number }).side = BackSide;
  backdrop.name = 'micro-backdrop';
  for (const m of [zinc, oxide, flakes, strands]) m.frustumCulled = false;
  group.add(zinc, edgeGrain, oxide, flakes, strands, backdrop);

  // drifting lye ions (always) and the two streams (with `flow`)
  const ambient = minusIons(group, AMBIENT);
  const amb = Array.from({ length: AMBIENT }, () => ({
    x: -6 + rnd() * 15,
    y: -4.5 + rnd() * 9,
    z: 0.6 + rnd() * 1.2,
    ph: rnd() * 6.28,
  }));
  const ions: ParticleSet = minusIons(group, STREAM);
  const elec: ParticleSet = electrons(group, STREAM * 2, 0.12);
  const lane = Array.from({ length: STREAM }, (_, i) => ({
    y: -4 + (8 * (i + 0.5)) / STREAM + (rnd() - 0.5) * 0.4,
    z: 0.9 + rnd() * 0.5,
  }));

  /** The front face (largest z) of the zinc grains over a point, or null over a gap. */
  const frontZ = (x: number, y: number): number | null => {
    let best: number | null = null;
    for (const g of grains) {
      const d2 = g.r * g.r * 0.92 - (x - g.x) ** 2 - (y - g.y) ** 2;
      if (d2 > 0) {
        const z = g.z + Math.sqrt(d2);
        if (best === null || z > best) best = z;
      }
    }
    return best;
  };
  let phase = 0;
  let crossed = 0;
  let counted = 0;
  const field: Field = {
    group,
    edgeGrain,
    flow: 0,
    far: 1,
    get crossed() {
      return Math.floor(crossed - counted);
    },
    resetCount() {
      counted = crossed;
    },
    update(dt, t) {
      strands.visible = oxide.visible = flakes.visible = field.far > 0.01;
      for (const m of [strands.material, oxide.material, flakes.material] as { fade: number }[])
        m.fade = field.far;
      amb.forEach((a, i) => {
        ambient.put(i, a.x + Math.sin(t * 0.3 + a.ph) * 0.4, a.y + Math.cos(t * 0.23 + a.ph) * 0.5, a.z, 1);
      });
      ambient.commit();
      // one slot per lane: an ion swims from the oxide (x 7.5) through the separator to the zinc (x 1.5);
      // the speed and the count of crossings follow `flow`; two electrons per lane run left over the zinc
      const rate = 0.16 * field.flow;
      phase += rate * dt;
      crossed += rate * dt * STREAM;
      lane.forEach((l, i) => {
        const k = (phase + i / STREAM) % 1;
        const x = 7.5 - k * 6;
        const shown = field.flow > 0.01 ? Math.min(1, k * 8, (1 - k) * 8) : 0;
        ions.put(i, x, l.y + Math.sin(k * 9 + i) * 0.25, l.z, shown);
        for (let j = 0; j < 2; j++) {
          const ke = (phase * 2.2 + i / STREAM + j * 0.5) % 1;
          const xe = 2.6 - ke * 10;
          const ye = l.y + Math.sin(ke * 13 + j) * 0.5;
          // electrons keep to the metal: they slide over the grains' faces, never through the lye between them
          const z = frontZ(xe, ye);
          const on = field.flow > 0.01 && z !== null ? Math.min(1, (1 - ke) * 6) : 0;
          elec.put(i * 2 + j, xe, ye, (z ?? 0) + 0.06, on);
        }
      });
      ions.commit();
      elec.commit();
    },
  };
  return field;
}

/** The separator's middle (micro units). */
export const SEP_MID = (SEP.from + SEP.to) / 2;
