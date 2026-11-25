/**
 * The slice («скибочка», docs/volumes/alkaline/VISUAL.md §4.1): a thin disc cut across the stand battery — the
 * same radii as the lengthwise section of `circuit` (`SEC`) — lifted out of the battery, turned to the reader and
 * grown ×5. Each ring is its own short tube (a front face, a back face and both walls), so the slice reads as a piece
 * with an edge, and `spread` can slide the inner rings toward the viewer like a telescope.
 *
 * Numbers, all pure functions of the fields (both ways): `out` (the way out of the battery), `spread`, `lye` (the
 * wet front running out of the separator), `life` (zinc grains → white zinc oxide from the separator toward the
 * axis, the oxide ring paling), `heat` (orange glow from inside), `highlight` (one ring lifts).
 */
import {
  CylinderGeometry,
  type BufferGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  Object3D,
  Quaternion,
  RingGeometry,
  Vector3,
  CircleGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { K, col } from '@/style';
import { BATTERY } from '@circuit/shared/stage';
import { SEC } from '@circuit/shared/stage/battery-section';
import { seeded } from '@circuit/shared/stage/battery-grains';
import { smooth } from './scrub';

export type SliceRing = 'can' | 'cathode' | 'separator' | 'zinc' | 'pin';
/** Outside in: the order of the telescope. */
export const SLICE_RINGS: readonly SliceRing[] = ['can', 'cathode', 'separator', 'zinc', 'pin'];

/** Radii in battery units (1 ≈ 26 mm), from the lengthwise section of `circuit` so both cuts agree. */
export const SLICE_R = {
  outer: BATTERY.radius,
  canIn: SEC.canIn,
  cathodeIn: SEC.cathodeIn,
  sepIn: SEC.sepIn,
  pin: SEC.pin * 1.6,
} as const;
/** Inner / outer radius of each ring (the label film belongs to the can). */
const RING_R: Record<SliceRing, [number, number]> = {
  can: [SLICE_R.canIn, SLICE_R.outer],
  cathode: [SLICE_R.cathodeIn, SLICE_R.canIn],
  separator: [SLICE_R.sepIn, SLICE_R.cathodeIn],
  zinc: [SLICE_R.pin, SLICE_R.sepIn],
  pin: [0, SLICE_R.pin],
};
/** Thickness of the slice (battery units) and its display scale. */
export const SLICE_DEPTH = 0.05;
export const SLICE_SCALE = 5;
/** How far each inner ring slides forward per step of the telescope at `spread` 1 (battery units). */
const SPREAD_STEP = 0.045;

/** A ring as a closed tube between two radii (front at +depth/2, back at −depth/2), axis +z. */
function tube(r0: number, r1: number, depth: number, segs = 96): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const front = r0 > 0 ? new RingGeometry(r0, r1, segs, 1) : new CircleGeometry(r1, segs);
  front.translate(0, 0, depth / 2);
  const back = front.clone().rotateY(Math.PI);
  const outer = new CylinderGeometry(r1, r1, depth, segs, 1, true).rotateX(Math.PI / 2);
  parts.push(front, back, outer);
  if (r0 > 0) {
    // the inner wall faces the axis: flip the cylinder's normals by scaling it inside out
    const inner = new CylinderGeometry(r0, r0, depth, segs, 1, true).rotateX(Math.PI / 2);
    const n = inner.getAttribute('normal');
    for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
    const idx = inner.getIndex();
    if (idx)
      for (let i = 0; i < idx.count; i += 3) {
        const a = idx.getX(i + 1);
        idx.setX(i + 1, idx.getX(i + 2));
        idx.setX(i + 2, a);
      }
    parts.push(inner);
  }
  for (const p of parts) p.deleteAttribute('uv');
  const merged = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
  for (const p of parts) p.dispose();
  return merged;
}

export interface Grain {
  x: number;
  y: number;
  r: number;
  /** 0 … 1: where the grain sits between the pin (0) and the separator (1). */
  depth: number;
}

/** Zinc grains on the face of the paste: round, packed, touching (a dart-throwing fill, seeded). */
export function placeSliceGrains(count = 230): Grain[] {
  const rnd = seeded(41);
  const out: Grain[] = [];
  const r0 = SLICE_R.pin + 0.006;
  const r1 = SLICE_R.sepIn - 0.005;
  for (let tries = 0; out.length < count && tries < 40000; tries++) {
    const rad = Math.sqrt(r0 * r0 + rnd() * (r1 * r1 - r0 * r0));
    const a = rnd() * Math.PI * 2;
    const r = 0.0055 + rnd() * 0.0045;
    const x = Math.cos(a) * rad;
    const y = Math.sin(a) * rad;
    if (rad - r < r0 - 0.002 || rad + r > r1 + 0.002) continue;
    if (out.some((g) => (g.x - x) ** 2 + (g.y - y) ** 2 < (g.r + r) * (g.r + r) * 0.8)) continue;
    out.push({ x, y, r, depth: (rad - r0) / (r1 - r0) });
  }
  return out;
}

/** Spent share of a zinc grain at `depth` (0 pin … 1 separator) for a `life`: the front walks from the separator in. */
export function grainSpent(depth: number, life: number): number {
  const front = 1.08 - life * 1.18;
  return smooth(front - 0.06, front + 0.06, depth);
}

export interface Slice {
  /** Placed in the world by `place()`; already holds every mesh. */
  group: Group;
  /** 0 inside the battery (hidden) … 1 in front of the reader, ×5. */
  out: number;
  /** 0 … 1: the inner rings slide toward the viewer, step by step. */
  spread: number;
  /** 0 … 1: the lye soaks out of the separator into both sides. */
  lye: number;
  /** 0 fresh … 1 dead. */
  life: number;
  /** 0 … 1: glow of heat from the paste and the separator. */
  heat: number;
  highlight: SliceRing | null;
  /** Per ring: the mesh to pick (the whole tube) and a callout anchor on its front face. */
  rings: Readonly<Record<SliceRing, { mesh: Mesh; anchor: Object3D }>>;
  /** The ring under a picked object (one of `rings[*].mesh`), else null. */
  ringOf(object: Object3D | null): SliceRing | null;
  /**
   * Where the slice comes from and where it goes: `from` = the battery's centre (world), `axis` its direction;
   * `to` = the slice's centre at `out` 1, `face` = the direction it faces then (toward the camera).
   */
  place(from: Vector3, axis: Vector3, to: Vector3, face: Vector3): void;
  /** The slice's pose at `out` 1 (world): centre and orientation (+z toward the reader); scale is `SLICE_SCALE`. */
  readonly rest: { position: Vector3; quaternion: Quaternion };
  update(dt: number, t: number): void;
}

const Z = new Vector3(0, 0, 1);
/** Each ring's own emissive share at rest (see the materials); a highlighted ring adds 0.3. */
const BASE_GLOW: Record<SliceRing, number> = { can: 0.35, cathode: 0, separator: 0.45, zinc: 0.3, pin: 0.45 };

export function createSlice(): Slice {
  const group = new Group();
  group.name = 'alkaline-slice';
  const body = new Group(); // scaled by the way out; the rings live in it, in battery units
  group.add(body);
  // every ring carries a share of its own colour as emissive, so the face reads its true colours in the night
  // room whichever way the key light falls (the slice is a diagram held up to the reader, lit like the cut's island)
  const steel = K.metal({ color: 'steel', shininess: 60, emissive: 'steel', emissiveIntensity: 0.35 });
  const film = K.toon({ color: 'ink', emissive: 'amber', emissiveIntensity: 0.12 });
  const cathode = K.toon({ color: 'ink', emissive: 'white', emissiveIntensity: 0 });
  const separator = K.toon({ color: 'white', emissive: 'white', emissiveIntensity: 0.45 });
  const gel = K.toon({ color: 'slate', emissive: 'steel', emissiveIntensity: 0.3 });
  const brass = K.metal({ color: 'amber', shininess: 70, emissive: 'amber', emissiveIntensity: 0.45 });
  const mats: Record<SliceRing, ReturnType<typeof K.toon>> = {
    can: steel,
    cathode,
    separator,
    zinc: gel,
    pin: brass,
  };
  const rings = {} as Record<SliceRing, { mesh: Mesh; anchor: Object3D }>;
  const holders = {} as Record<SliceRing, Group>;
  // where each ring's callout sits on its front face (angle from +x, counter-clockwise)
  const ANGLE: Record<SliceRing, number> = { can: 0.55, cathode: 2.4, separator: -0.6, zinc: 3.6, pin: 0.9 };
  for (const id of SLICE_RINGS) {
    const [r0, r1] = RING_R[id];
    const holder = new Group();
    holder.name = `slice-${id}`;
    const mesh = new Mesh(tube(r0, id === 'can' ? r1 - 0.007 : r1, SLICE_DEPTH), mats[id]);
    mesh.name = `slice-ring-${id}`;
    holder.add(mesh);
    const anchor = new Object3D();
    const rm = id === 'pin' ? 0 : (r0 + r1) / 2;
    anchor.position.set(Math.cos(ANGLE[id]) * rm, Math.sin(ANGLE[id]) * rm, SLICE_DEPTH / 2 + 0.002);
    holder.add(anchor);
    body.add(holder);
    rings[id] = { mesh, anchor };
    holders[id] = holder;
  }
  // the label film round the steel (part of the can's holder: it is the can's outside)
  holders.can.add(new Mesh(tube(SLICE_R.outer - 0.007, SLICE_R.outer, SLICE_DEPTH * 0.98), film));

  // zinc grains on the paste's face: silver while alive, white and smaller when spent (two instanced sets)
  const grains = placeSliceGrains();
  const ball = new IcosahedronGeometry(1, 2);
  const zinc = new InstancedMesh(
    ball,
    K.metal({ color: 'steel', shininess: 90, emissive: 'mist', emissiveIntensity: 0.22 }),
    grains.length,
  );
  const oxide = new InstancedMesh(
    ball,
    K.toon({ color: 'white', highlight: 0.1, emissive: 'white', emissiveIntensity: 0.85 }),
    grains.length,
  );
  for (const m of [zinc, oxide]) {
    m.frustumCulled = false;
    holders.zinc.add(m);
  }
  // dark crumbs and flakes of graphite on the oxide ring's face
  const crumbs = placeCrumbs(150);
  const flake = new InstancedMesh(
    new CircleGeometry(1, 6),
    K.toon({ color: 'slate', highlight: 0.8, emissive: 'steel', emissiveIntensity: 0.15 }),
    crumbs.length,
  );
  flake.frustumCulled = false;
  const m4 = new Matrix4();
  const q = new Quaternion();
  const s = new Vector3();
  const p = new Vector3();
  crumbs.forEach((c, i) => {
    q.setFromAxisAngle(Z, c.a);
    flake.setMatrixAt(i, m4.compose(p.set(c.x, c.y, SLICE_DEPTH / 2 + 0.0008), q, s.set(c.r, c.r * 0.6, 1)));
  });
  holders.cathode.add(flake);

  // the wet front of the lye and the heat: additive discs over the face
  const wet = new Mesh(
    new RingGeometry(SLICE_R.pin, SLICE_R.canIn, 96, 1),
    K.glow({ color: 'sky', intensity: 0, additive: true, whiten: 0, falloff: 0 }),
  );
  wet.position.z = SLICE_DEPTH / 2 + 0.004;
  const wetFront = new Mesh(
    new RingGeometry(0.975, 1.025, 96, 1),
    K.glow({ color: 'sky', intensity: 0, additive: true, whiten: 0.3, falloff: 0 }),
  );
  const wetBack = wetFront.clone();
  wetBack.material = (wetFront.material as ReturnType<typeof K.glow>).clone();
  for (const w of [wetFront, wetBack]) w.position.z = SLICE_DEPTH / 2 + 0.005;
  const glowMat = K.glow({ color: 'orange', intensity: 0, additive: true, whiten: 0.1, falloff: 0 });
  const hot = new Mesh(new CircleGeometry(SLICE_R.cathodeIn, 96), glowMat);
  hot.position.z = SLICE_DEPTH / 2 + 0.006;
  body.add(wet, wetFront, wetBack, hot);

  const ringOf = (object: Object3D | null): SliceRing | null => {
    for (let o = object; o; o = o.parent) {
      const id = SLICE_RINGS.find((r) => rings[r].mesh === o);
      if (id) return id;
    }
    return null;
  };

  const from = new Vector3();
  const axis = new Vector3(1, 0, 0);
  const to = new Vector3(0, 1, 0);
  const face = new Vector3(0, 0, 1);
  const qFrom = new Quaternion();
  const qTo = new Quaternion();
  const lift = new Vector3();
  const lit = { highlight: {} as Record<SliceRing, number> };
  for (const id of SLICE_RINGS) lit.highlight[id] = 0;
  const ink = col('ink');
  const slate = col('slate');
  const gelFresh = col('slate').lerp(col('steel'), 0.35);
  const gelDead = col('mist').lerp(col('slate'), 0.45);
  const sky = col('sky');
  const white = col('white');
  let lastLife = -1;
  const wetMat = wet.material as ReturnType<typeof K.glow>;
  const frontMat = wetFront.material as ReturnType<typeof K.glow>;
  const backMat = wetBack.material as ReturnType<typeof K.glow>;

  function layGrains(life: number): void {
    grains.forEach((g, i) => {
      const spent = grainSpent(g.depth, life);
      const rz = g.r * (1 - 0.8 * spent);
      zinc.setMatrixAt(
        i,
        m4.compose(p.set(g.x, g.y, SLICE_DEPTH / 2 - 0.2 * rz), q.identity(), s.setScalar(rz)),
      );
      const ro = g.r * 1.05 * spent;
      oxide.setMatrixAt(
        i,
        m4.compose(p.set(g.x, g.y, SLICE_DEPTH / 2 - 0.35 * ro), q, s.set(ro, ro, ro * 0.6)),
      );
    });
    zinc.instanceMatrix.needsUpdate = true;
    oxide.instanceMatrix.needsUpdate = true;
  }

  const slice: Slice = {
    group,
    out: 0,
    spread: 0,
    lye: 1,
    life: 0,
    heat: 0,
    highlight: null,
    rings,
    ringOf,
    rest: { position: to, quaternion: qTo },
    place(f, a, t2, fc) {
      from.copy(f);
      axis.copy(a).normalize();
      to.copy(t2);
      face.copy(fc).normalize();
      qFrom.setFromUnitVectors(Z, axis);
      // face the reader with the slice's +y kept as close to world up as possible
      const look = new Matrix4().lookAt(new Vector3(), face.clone().negate(), new Vector3(0, 1, 0));
      qTo.setFromRotationMatrix(look);
    },
    update(dt) {
      const out = slice.out;
      group.visible = out > 0.002;
      if (!group.visible) return;
      // the way out: straight up out of the battery in its own size, then turn to the reader and grow
      const a = smooth(0, 0.35, out);
      const b = smooth(0.2, 1, out);
      lift.copy(from).addScaledVector(new Vector3(0, 1, 0), 0.6 * a);
      group.position.copy(lift).lerp(to, b);
      group.quaternion.copy(qFrom).slerp(qTo, b);
      group.scale.setScalar(Math.exp(Math.log(SLICE_SCALE) * b));
      // the telescope and the lifted ring
      SLICE_RINGS.forEach((id, i) => {
        const want = slice.highlight === id ? 1 : 0;
        const h = (lit.highlight[id] += (want - lit.highlight[id]) * Math.min(1, dt * 8));
        holders[id].position.z = slice.spread * i * SPREAD_STEP + 0.012 * h;
        mats[id].emissiveIntensity = BASE_GLOW[id] + 0.3 * h;
      });
      // the life of the substances
      if (Math.abs(slice.life - lastLife) > 1e-4) {
        lastLife = slice.life;
        layGrains(slice.life);
        cathode.color.copy(ink).lerp(slate, 0.85 * smooth(0.05, 0.95, slice.life));
        gel.color.copy(gelFresh).lerp(gelDead, smooth(0.1, 1, slice.life));
      }
      // the lye: the separator darkens with wet first, then the fronts run out into both sides
      const lye = slice.lye;
      const wave = Math.sin(Math.PI * Math.min(Math.max(lye, 0), 1));
      separator.color.copy(white).lerp(sky, 0.25 * smooth(0, 0.25, lye));
      const rOut = SLICE_R.cathodeIn + (SLICE_R.canIn - SLICE_R.cathodeIn) * smooth(0.1, 0.9, lye);
      const rIn = SLICE_R.sepIn - (SLICE_R.sepIn - SLICE_R.pin) * smooth(0.1, 1, lye);
      wetFront.scale.setScalar(rOut);
      wetBack.scale.setScalar(rIn);
      // additive glows: the contribution is the intensity (the material's `opacity` is fixed at creation)
      frontMat.intensity = backMat.intensity = 1.5 * wave * smooth(0.05, 0.2, lye);
      wetMat.intensity = 0.12 * smooth(0.5, 1, lye);
      wetMat.color.copy(sky).lerp(white, 0.1);
      // heat from inside
      glowMat.intensity = 0.9 * slice.heat;
    },
  };
  return slice;
}

/** Graphite flakes on the oxide ring's face. */
function placeCrumbs(count: number): { x: number; y: number; r: number; a: number }[] {
  const rnd = seeded(7);
  const out: { x: number; y: number; r: number; a: number }[] = [];
  for (let i = 0; i < count; i++) {
    const rad = SLICE_R.cathodeIn + 0.008 + rnd() * (SLICE_R.canIn - SLICE_R.cathodeIn - 0.016);
    const a = rnd() * Math.PI * 2;
    out.push({ x: Math.cos(a) * rad, y: Math.sin(a) * rad, r: 0.003 + rnd() * 0.004, a: rnd() * 3 });
  }
  return out;
}
