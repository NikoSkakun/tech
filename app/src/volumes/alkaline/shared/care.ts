/**
 * The things of the chapter `care` (VISUAL.md §4.4–4.6): four alkaline batteries of four sizes standing on the table,
 * a bare copper wire that lies across the stand battery's poles (a short circuit), the warm shell of the battery
 * heated from inside, and the white crust of dried lye growing at its minus end. Pure functions of their numbers.
 */
import {
  CatmullRomCurve3,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  TubeGeometry,
  Vector3,
  Euler,
} from 'three';
import { K } from '@/style';
import { BATTERY, GAUGE_HOME } from '@circuit/shared/stage';
import { seeded } from '@circuit/shared/stage/battery-grains';
import { smooth } from './scrub';

/** Stand units per millimetre (1 ≈ 26 mm). */
const MM = 1 / 26;
/** AAA, AA, C, D: length × diameter, mm (IEC LR03, LR6, LR14, LR20) and hours of our lamp (≈, from the stores). */
export const SIZES = [
  { length: 44.5, diameter: 10.5, hours: 3 },
  { length: 50.5, diameter: 14.5, hours: 8 },
  { length: 50.0, diameter: 26.2, hours: 25 },
  { length: 61.5, diameter: 34.2, hours: 60 },
] as const;

export interface Sizes {
  group: Group;
  /** Per battery: the body to touch and an anchor above its top. */
  items: { body: Group; top: Vector3 }[];
}

/** One upright battery: ink jacket, amber band toward the plus, steel caps and nub; `top` its plus end (local). */
function upright(length: number, radius: number): Group {
  const g = new Group();
  const jacket = new Mesh(
    new CylinderGeometry(radius, radius, length * 0.62, 40),
    K.toon({ color: 'ink', emissive: 'slate', emissiveIntensity: 0.15 }),
  );
  jacket.position.y = length * 0.31;
  const band = new Mesh(
    new CylinderGeometry(radius, radius, length * 0.34, 40),
    K.toon({ color: 'amber', emissive: 'amber', emissiveIntensity: 0.15 }),
  );
  band.position.y = length * 0.79;
  const cap = new Mesh(
    new CylinderGeometry(radius * 0.96, radius * 0.96, length * 0.04, 40),
    K.metal({ color: 'steel' }),
  );
  cap.position.y = length * 0.98;
  const nub = new Mesh(
    new CylinderGeometry(radius * 0.36, radius * 0.38, length * 0.04, 24),
    K.metal({ color: 'steel' }),
  );
  nub.position.y = length * 1.02;
  g.add(jacket, band, cap, nub);
  return g;
}

export function createSizes(): Sizes {
  const group = new Group();
  group.name = 'four-sizes';
  const items: Sizes['items'] = [];
  let x = BATTERY.x - 1.9;
  SIZES.forEach((s) => {
    const r = (s.diameter / 2) * MM;
    const len = s.length * MM;
    const body = upright(len, r);
    x += r + 0.25;
    body.position.set(x, 0, GAUGE_HOME.z + 0.15);
    x += r + 0.25;
    group.add(body);
    items.push({ body, top: new Vector3(body.position.x, len * 1.06, body.position.z) });
  });
  return { group, items };
}

export interface Jumper {
  group: Group;
  /** 0 lying on the table in front of the battery … 1 across the poles. */
  on: number;
  /** The wire's mesh (to touch). */
  readonly mesh: Mesh;
  update(): void;
}

/** A bare copper wire: its ends from the table (rest) to the battery's two poles (on), the arc over the battery. */
export function createJumper(minus: Vector3, plus: Vector3): Jumper {
  const group = new Group();
  const mat = K.metal({ color: 'wireBrown', emissive: 'amber', emissiveIntensity: 0.02, shininess: 80 });
  const mesh = new Mesh(new TubeGeometry(new CatmullRomCurve3([minus, plus]), 8, 0.03, 8), mat);
  mesh.name = 'jumper';
  group.add(mesh);
  // at rest it lies on the board in front of the battery, a little shorter than the battery
  const restA = minus.clone().add(new Vector3(0.3, -0.36, 0.62));
  const restB = plus.clone().add(new Vector3(-0.3, -0.36, 0.62));
  const a = new Vector3();
  const b = new Vector3();
  let last = -1;
  const jumper: Jumper = {
    group,
    on: 0,
    mesh,
    update() {
      if (Math.abs(jumper.on - last) < 1e-4) return;
      last = jumper.on;
      const k = smooth(0, 1, jumper.on);
      a.copy(restA).lerp(minus, k);
      b.copy(restB).lerp(plus, k);
      const lift = 0.08 + 0.55 * k;
      const mid1 = a
        .clone()
        .lerp(b, 0.25)
        .add(new Vector3(0, lift, 0.35 * k));
      const mid2 = a
        .clone()
        .lerp(b, 0.75)
        .add(new Vector3(0, lift, 0.35 * k));
      mesh.geometry.dispose();
      mesh.geometry = new TubeGeometry(new CatmullRomCurve3([a, mid1, mid2, b]), 48, 0.03, 8);
    },
  };
  jumper.update();
  return jumper;
}

export interface Crust {
  group: Group;
  /** 0 none … 1 the crust at its fullest. */
  amount: number;
  update(): void;
}

/** White crystals of dried lye round the minus end's seal: a ring of lumps that grow one after another. */
export function createCrust(minus: Vector3, axis: Vector3): Crust {
  const group = new Group();
  const rnd = seeded(77);
  const N = 70;
  const lumps = new InstancedMesh(
    new IcosahedronGeometry(1, 1),
    K.toon({ color: 'white', emissive: 'white', emissiveIntensity: 0.35, flatShading: true }),
    N,
  );
  lumps.frustumCulled = false;
  group.add(lumps);
  const q = new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), axis.clone().normalize());
  const items = Array.from({ length: N }, () => ({
    a: rnd() * Math.PI * 2,
    along: 0.02 + rnd() * 0.12,
    r: 0.02 + rnd() * 0.035,
    order: rnd(),
    e: new Euler(rnd() * 6, rnd() * 6, rnd() * 6),
  }));
  const m4 = new Matrix4();
  const p = new Vector3();
  const s = new Vector3();
  const qq = new Quaternion();
  const R = BATTERY.radius * 0.98;
  const crust: Crust = {
    group,
    amount: 0,
    update() {
      items.forEach((it, i) => {
        const k = smooth(it.order * 0.7, it.order * 0.7 + 0.3, crust.amount);
        p.set(it.along, Math.cos(it.a) * R, Math.sin(it.a) * R)
          .applyQuaternion(q)
          .add(minus);
        lumps.setMatrixAt(i, m4.compose(p, qq.setFromEuler(it.e), s.setScalar(it.r * k)));
      });
      lumps.instanceMatrix.needsUpdate = true;
    },
  };
  crust.update();
  return crust;
}
