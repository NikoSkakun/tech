/**
 * Sandbox-local toy models for the diorama look-dev scene (production chapters use `@/kit`).
 * Shape language per STYLE_GUIDE §3: rounded, chunky, three levels of detail on hero objects.
 */
import {
  CapsuleGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  Quaternion,
  Shape,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Rng } from '@/engine/api';
import { K, col, type ColorLike, type KGlowMaterial, type KToonMaterial } from '@/style';

function mesh(geometry: BufferGeometry, material: Material, shadow = true): Mesh {
  const m = new Mesh(geometry, material);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

function at<T extends { position: Vector3 }>(o: T, x: number, y: number, z: number): T {
  o.position.set(x, y, z);
  return o;
}

/* ------------------------------------------------------------------------------------------------ trees */

export interface TreeSpot {
  x: number;
  y: number;
  z: number;
  scale: number;
  kind: 'round' | 'conifer' | 'bush';
}

export interface Trees {
  group: Group;
  /** Gentle sway; call every frame. */
  update(t: number): void;
}

export function createTrees(spots: readonly TreeSpot[], rng: Rng): Trees {
  const group = new Group();
  group.name = 'trees';
  const round = spots.filter((s) => s.kind !== 'conifer');
  const conifers = spots.filter((s) => s.kind === 'conifer');
  const trunkMaterial = K.toon({ color: col('wireBrown').lerp(col('ink'), 0.25), rim: 0.4 });
  const leafMaterial = K.toon({ color: 'white', highlight: 0.45, rim: 0.7 });
  const trunks = new InstancedMesh(new CylinderGeometry(0.07, 0.11, 1, 10), trunkMaterial, spots.length);
  // each round tree = 3 merged blobs, each bush = 2
  const blobCount = round.reduce((n, s) => n + (s.kind === 'bush' ? 2 : 3), 0);
  const blobs = new InstancedMesh(new SphereGeometry(1, 32, 20), leafMaterial, Math.max(blobCount, 1));
  // conifer: lathe profile with a rounded tip and a rounded skirt (no hard edges)
  // (profile runs bottom → top so that the lathe normals point outward)
  const profile = [
    new Vector2(0, 0),
    new Vector2(0.32, 0),
    new Vector2(0.42, 0.03),
    new Vector2(0.44, 0.1),
    new Vector2(0.36, 0.32),
    new Vector2(0.2, 0.7),
    new Vector2(0.07, 0.96),
    new Vector2(0, 1),
  ];
  const cones = new InstancedMesh(
    new LatheGeometry(profile, 40),
    leafMaterial,
    Math.max(conifers.length * 2, 1),
  );
  const greens = ['green', 'teal', 'lime', 'green.dark', 'teal.light'] as const;
  const m = new Matrix4();
  const q = new Quaternion();
  const p = new Vector3();
  const s = new Vector3();
  const c = new Color();
  interface Blob {
    index: number;
    base: Vector3;
    size: Vector3;
    phase: number;
    sway: number;
  }
  const blobData: Blob[] = [];
  let bi = 0;
  let ti = 0;
  let ci = 0;
  for (const spot of spots) {
    const k = spot.scale;
    const trunkH = spot.kind === 'bush' ? 0.12 : spot.kind === 'conifer' ? 0.35 * k : 0.62 * k;
    m.compose(p.set(spot.x, spot.y + trunkH / 2 - 0.04, spot.z), q.identity(), s.set(k, trunkH, k));
    trunks.setMatrixAt(ti++, m);
    const tint = col(rng.pick(greens));
    if (spot.kind === 'conifer') {
      for (let layer = 0; layer < 2; layer++) {
        m.compose(
          p.set(spot.x, spot.y + trunkH * 0.7 + layer * 0.5 * k, spot.z),
          q.identity(),
          s.set(k * (1.25 - layer * 0.3), k * (1.15 - layer * 0.15), k * (1.25 - layer * 0.3)),
        );
        cones.setMatrixAt(ci, m);
        cones.setColorAt(ci++, c.copy(tint).lerp(col('teal.dark'), 0.35 + layer * -0.2));
      }
      continue;
    }
    const n = spot.kind === 'bush' ? 2 : 3;
    for (let b = 0; b < n; b++) {
      const r = (spot.kind === 'bush' ? 0.26 : 0.42) * k * (1 - b * 0.16) * rng.range(0.9, 1.1);
      const a = rng.range(0, Math.PI * 2);
      const off = b === 0 ? 0 : r * 0.75;
      const base = new Vector3(
        spot.x + Math.cos(a) * off,
        spot.y + trunkH + r * 0.72 + (b === 2 ? r * 0.55 : 0),
        spot.z + Math.sin(a) * off,
      );
      blobData.push({
        index: bi,
        base,
        size: new Vector3(r, r * 0.88, r),
        phase: rng.range(0, 6.28),
        sway: 0.03 * k,
      });
      blobs.setColorAt(bi++, c.copy(tint).lerp(col('lime'), rng.range(0, 0.25)));
    }
  }
  for (const im of [trunks, blobs, cones]) {
    im.castShadow = true;
    im.receiveShadow = true;
    im.frustumCulled = false;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    group.add(im);
  }
  cones.count = ci;
  const update = (t: number): void => {
    for (const b of blobData) {
      p.copy(b.base);
      p.x += Math.sin(t * 0.9 + b.phase) * b.sway;
      p.z += Math.cos(t * 0.7 + b.phase * 1.3) * b.sway * 0.6;
      const breathe = 1 + Math.sin(t * 1.1 + b.phase) * 0.025;
      m.compose(p, q.identity(), s.copy(b.size).multiplyScalar(breathe));
      blobs.setMatrixAt(b.index, m);
    }
    blobs.instanceMatrix.needsUpdate = true;
  };
  update(0);
  return { group, update };
}

/* ----------------------------------------------------------------------------------------------- houses */

export interface HouseOptions {
  width: number;
  depth: number;
  height: number;
  wall: ColorLike;
  roof: ColorLike;
  door: ColorLike;
}

function roofGeometry(width: number, depth: number, rise: number): ExtrudeGeometry {
  // gable roof: a triangle with a rounded ridge and eaves, extruded with a bevel so no edge is sharp
  const w = width / 2 + 0.14;
  const shape = new Shape();
  shape.moveTo(-w, 0);
  shape.lineTo(w, 0);
  shape.quadraticCurveTo(w + 0.04, 0.06, w - 0.08, 0.12);
  shape.lineTo(0.1, rise - 0.03);
  shape.quadraticCurveTo(0, rise + 0.03, -0.1, rise - 0.03);
  shape.lineTo(-w + 0.08, 0.12);
  shape.quadraticCurveTo(-w - 0.04, 0.06, -w, 0);
  const g = new ExtrudeGeometry(shape, {
    depth: depth + 0.2,
    bevelEnabled: true,
    bevelSize: 0.035,
    bevelThickness: 0.035,
    bevelSegments: 3,
    curveSegments: 6,
  });
  g.translate(0, 0, -(depth + 0.2) / 2);
  return g;
}

/** A chunky little house. `windowMaterial` is shared so one tween lights every window at dusk. */
export function createHouse(o: HouseOptions, windowMaterial: KToonMaterial): Group {
  const g = new Group();
  g.name = 'house';
  const wallMat = K.toon({
    gradient: { bottom: col(o.wall).multiplyScalar(0.86), top: o.wall, range: [0, o.height] },
    rim: 0.6,
  });
  const trimMat = K.toon({ color: 'white', rim: 0.4 });
  const body = at(
    mesh(new RoundedBoxGeometry(o.width, o.height, o.depth, 4, 0.07), wallMat),
    0,
    o.height / 2,
    0,
  );
  const plinth = at(
    mesh(
      new RoundedBoxGeometry(o.width + 0.1, 0.12, o.depth + 0.1, 3, 0.04),
      K.toon({ color: 'slate', rim: 0.3 }),
    ),
    0,
    0.05,
    0,
  );
  const rise = o.width * 0.42;
  const roof = at(
    mesh(roofGeometry(o.width, o.depth, rise), K.toon({ color: o.roof, highlight: 0.4, rim: 0.8 })),
    0,
    o.height - 0.03,
    0,
  );
  const chimney = at(
    mesh(new RoundedBoxGeometry(0.18, 0.42, 0.18, 3, 0.04), trimMat),
    o.width * 0.22,
    o.height + rise * 0.62,
    -o.depth * 0.15,
  );
  const chimneyCap = at(
    mesh(new RoundedBoxGeometry(0.24, 0.07, 0.24, 2, 0.03), K.toon({ color: o.roof })),
    o.width * 0.22,
    o.height + rise * 0.62 + 0.22,
    -o.depth * 0.15,
  );
  g.add(plinth, body, roof, chimney, chimneyCap);
  // front (+Z): door with a step and a knob, two windows; sides: one window each
  const front = o.depth / 2;
  const door = at(
    mesh(new RoundedBoxGeometry(0.3, 0.52, 0.05, 3, 0.03), K.toon({ color: o.door, rim: 0.5 }), false),
    -o.width * 0.2,
    0.32,
    front + 0.012,
  );
  const step = at(
    mesh(new RoundedBoxGeometry(0.42, 0.07, 0.2, 2, 0.03), trimMat, false),
    -o.width * 0.2,
    0.05,
    front + 0.1,
  );
  const knob = at(
    mesh(new SphereGeometry(0.028, 10, 8), K.metal({ color: 'yellow' }), false),
    -o.width * 0.2 + 0.09,
    0.32,
    front + 0.045,
  );
  g.add(door, step, knob);
  const frameGeo = new RoundedBoxGeometry(0.36, 0.36, 0.05, 3, 0.03);
  const paneGeo = new RoundedBoxGeometry(0.27, 0.27, 0.05, 3, 0.025);
  const sillGeo = new RoundedBoxGeometry(0.42, 0.05, 0.1, 2, 0.02);
  const addWindow = (x: number, y: number, z: number, ry: number): void => {
    const w = new Group();
    w.add(
      mesh(frameGeo, trimMat, false),
      at(mesh(paneGeo, windowMaterial, false), 0, 0, 0.012),
      at(mesh(sillGeo, trimMat, false), 0, -0.2, 0.03),
    );
    w.position.set(x, y, z);
    w.rotation.y = ry;
    g.add(w);
  };
  addWindow(o.width * 0.22, o.height * 0.56, front + 0.005, 0);
  addWindow(o.width / 2 + 0.005, o.height * 0.56, 0, Math.PI / 2);
  addWindow(-o.width / 2 - 0.005, o.height * 0.56, 0, -Math.PI / 2);
  addWindow(0, o.height * 0.56, -front - 0.005, Math.PI);
  return g;
}

/* ------------------------------------------------------------------------------------------- water tank */

export function createTank(): Group {
  const g = new Group();
  g.name = 'tank';
  const steel = K.metal({ color: 'mist', specular: 0.6 });
  const dark = K.metal({ color: 'slate', specular: 0.4 });
  const legGeo = new CylinderGeometry(0.045, 0.055, 1.25, 10);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = at(mesh(legGeo, dark), Math.cos(a) * 0.42, 0.6, Math.sin(a) * 0.42);
    leg.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12);
    g.add(leg);
  }
  // tank body: lathe with rounded shoulders and a shallow dome
  const profile = [
    new Vector2(0, 0),
    new Vector2(0.5, 0),
    new Vector2(0.58, 0.05),
    new Vector2(0.6, 0.14),
    new Vector2(0.6, 0.8),
    new Vector2(0.57, 0.9),
    new Vector2(0.45, 1.0),
    new Vector2(0.24, 1.08),
    new Vector2(0, 1.1),
  ];
  const body = at(
    mesh(
      new LatheGeometry(profile, 36),
      K.toon({ gradient: { bottom: 'sky.dark', top: 'sky', range: [0, 1.1] }, highlight: 0.6 }),
    ),
    0,
    1.18,
    0,
  );
  g.add(body);
  const bandGeo = new TorusGeometry(0.605, 0.028, 8, 40);
  for (const y of [1.4, 1.92]) {
    const band = at(mesh(bandGeo, steel, false), 0, y, 0);
    band.rotation.x = Math.PI / 2;
    g.add(band);
  }
  g.add(at(mesh(new SphereGeometry(0.07, 12, 10), steel, false), 0, 2.31, 0));
  // ladder: two rails and rungs
  const rail = new CylinderGeometry(0.015, 0.015, 2.05, 6);
  const rung = new CylinderGeometry(0.012, 0.012, 0.2, 6);
  const ladder = new Group();
  ladder.add(at(mesh(rail, dark, false), -0.1, 1.03, 0), at(mesh(rail, dark, false), 0.1, 1.03, 0));
  for (let i = 0; i < 9; i++) {
    const r = at(mesh(rung, dark, false), 0, 0.2 + i * 0.22, 0);
    r.rotation.z = Math.PI / 2;
    ladder.add(r);
  }
  ladder.position.set(0, 0, 0.63);
  g.add(ladder);
  // down pipe with flanges
  const pipe = at(mesh(new CylinderGeometry(0.06, 0.06, 1.2, 12), steel), 0, 0.6, 0);
  g.add(
    pipe,
    at(mesh(new CylinderGeometry(0.09, 0.09, 0.05, 12), dark, false), 0, 0.03, 0),
    at(mesh(new CylinderGeometry(0.09, 0.09, 0.05, 12), dark, false), 0, 1.15, 0),
  );
  return g;
}

/* ---------------------------------------------------------------------------------------- wind turbine */

export interface Turbine {
  group: Group;
  rotor: Group;
  /** Pick target covering the swept area of the blades. */
  hit: Mesh;
  beacon: KGlowMaterial;
  /** World-space height of the hub above the base. */
  hubHeight: number;
}

export function createTurbine(): Turbine {
  const g = new Group();
  g.name = 'turbine';
  const white = K.toon({
    gradient: { bottom: 'mist', top: 'white', range: [0, 3.2] },
    highlight: 0.5,
  });
  const hubHeight = 3.25;
  const tower = mesh(
    new LatheGeometry(
      [
        new Vector2(0, 0),
        new Vector2(0.2, 0),
        new Vector2(0.21, 0.06),
        new Vector2(0.17, 0.5),
        new Vector2(0.1, hubHeight - 0.05),
        new Vector2(0.08, hubHeight),
        new Vector2(0, hubHeight),
      ],
      24,
    ),
    white,
  );
  const base = at(mesh(new CylinderGeometry(0.3, 0.34, 0.12, 24), K.toon({ color: 'slate' })), 0, 0.03, 0);
  const band = at(mesh(new TorusGeometry(0.168, 0.02, 8, 24), K.toon({ color: 'coral' }), false), 0, 0.55, 0);
  band.rotation.x = Math.PI / 2;
  const nacelle = at(mesh(new CapsuleGeometry(0.15, 0.42, 8, 16), white), 0, hubHeight + 0.06, 0.02);
  nacelle.rotation.x = Math.PI / 2;
  const beacon = K.glow({ color: 'red', intensity: 2.5 });
  const lamp = at(mesh(new SphereGeometry(0.035, 10, 8), beacon, false), 0, hubHeight + 0.23, -0.1);
  g.add(base, tower, band, nacelle, lamp);

  const rotor = new Group();
  rotor.position.set(0, hubHeight + 0.06, 0.4);
  const nose = mesh(
    new LatheGeometry(
      [
        new Vector2(0, 0),
        new Vector2(0.14, 0),
        new Vector2(0.12, 0.1),
        new Vector2(0.06, 0.19),
        new Vector2(0, 0.22),
      ],
      20,
    ),
    K.toon({ color: 'coral', highlight: 0.5 }),
  );
  nose.rotation.x = Math.PI / 2;
  rotor.add(nose);
  // blade: tapered outline with a rounded tip, thin extrusion with bevel; root at the hub
  const blade = new Shape();
  blade.moveTo(-0.05, 0.08);
  blade.quadraticCurveTo(-0.13, 0.3, -0.1, 0.55);
  blade.quadraticCurveTo(-0.05, 1.3, -0.02, 1.62);
  blade.quadraticCurveTo(0.01, 1.72, 0.04, 1.62);
  blade.quadraticCurveTo(0.07, 0.9, 0.06, 0.3);
  blade.quadraticCurveTo(0.06, 0.12, 0.03, 0.08);
  blade.lineTo(-0.05, 0.08);
  const bladeGeo = new ExtrudeGeometry(blade, {
    depth: 0.03,
    bevelEnabled: true,
    bevelSize: 0.012,
    bevelThickness: 0.012,
    bevelSegments: 2,
    curveSegments: 10,
  });
  bladeGeo.translate(0, 0, -0.015);
  const tipGeo = new CapsuleGeometry(0.034, 0.16, 4, 10);
  const tipMat = K.toon({ color: 'coral' });
  for (let i = 0; i < 3; i++) {
    const arm = new Group();
    arm.rotation.z = (i / 3) * Math.PI * 2;
    const b = mesh(bladeGeo, white);
    b.rotation.y = 0.18; // a little pitch catches the light
    arm.add(b, at(mesh(tipGeo, tipMat, false), 0.005, 1.5, 0.0));
    rotor.add(arm);
  }
  g.add(rotor);
  // invisible disc for picking the whole swept area (blades are thin and moving)
  const hit = new Mesh(new CylinderGeometry(1.75, 1.75, 0.3, 24), K.flat('white', { opacity: 0 }));
  hit.rotation.x = Math.PI / 2;
  hit.position.copy(rotor.position);
  hit.material.colorWrite = false;
  hit.material.depthWrite = false;
  g.add(hit);
  return { group: g, rotor, hit, beacon, hubHeight };
}

/* ----------------------------------------------------------------------------------- pylons and cable */

export function createPylon(): Group {
  const g = new Group();
  g.name = 'pylon';
  const wood = K.toon({ color: col('wireBrown').lerp(col('ink'), 0.15), rim: 0.4 });
  const pole = at(mesh(new CylinderGeometry(0.05, 0.075, 1.9, 10), wood), 0, 0.95, 0);
  const arm = at(mesh(new RoundedBoxGeometry(0.85, 0.07, 0.07, 2, 0.025), wood), 0, 1.72, 0);
  g.add(pole, arm, at(mesh(new SphereGeometry(0.055, 10, 8), wood, false), 0, 1.9, 0));
  const insulatorGeo = new LatheGeometry(
    [
      new Vector2(0, 0),
      new Vector2(0.045, 0.01),
      new Vector2(0.03, 0.04),
      new Vector2(0.05, 0.07),
      new Vector2(0.03, 0.1),
      new Vector2(0.04, 0.13),
      new Vector2(0, 0.15),
    ],
    12,
  );
  const insulatorMat = K.toon({ color: 'sky.light', highlight: 0.7 });
  for (const x of [-0.34, 0, 0.34]) g.add(at(mesh(insulatorGeo, insulatorMat, false), x, 1.755, 0));
  return g;
}

/** Sagging cable through the given support points (K.energy: uv.x runs along the cable). */
export function createCableGeometry(points: readonly Vector3[], sag: number, radius: number): TubeGeometry {
  const path: Vector3[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const n = 10;
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const p = a.clone().lerp(b, t);
      p.y -= Math.sin(t * Math.PI) * sag * a.distanceTo(b) * 0.12; // parabola-like sag ∝ span
      path.push(p);
    }
  }
  path.push(points[points.length - 1]!.clone());
  const curve = new CatmullRomCurve3(path, false, 'centripetal');
  const geometry = new TubeGeometry(curve, path.length * 4, radius, 8, false);
  // U in world units: K.energy's `repeat` then means "pulses per unit length" whatever the cable length is
  const uv = geometry.getAttribute('uv');
  const length = curve.getLength();
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * length);
  return geometry;
}

/** Pad-mounted transformer box with cooling fins and a status light. */
export function createTransformer(): { group: Group; light: KGlowMaterial } {
  const g = new Group();
  g.name = 'transformer';
  const body = at(
    mesh(new RoundedBoxGeometry(0.55, 0.5, 0.42, 3, 0.06), K.toon({ color: 'teal', highlight: 0.5 })),
    0,
    0.3,
    0,
  );
  const pad = at(
    mesh(new RoundedBoxGeometry(0.75, 0.08, 0.6, 2, 0.03), K.toon({ color: 'slate' })),
    0,
    0.03,
    0,
  );
  g.add(pad, body);
  const finGeo = new RoundedBoxGeometry(0.03, 0.34, 0.1, 2, 0.012);
  const finMat = K.metal({ color: 'steel' });
  for (let i = 0; i < 5; i++) g.add(at(mesh(finGeo, finMat, false), -0.2 + i * 0.1, 0.3, -0.25));
  const light = K.glow({ color: 'green', intensity: 2.2 });
  g.add(at(mesh(new SphereGeometry(0.03, 10, 8), light, false), 0.18, 0.44, 0.215));
  const bushingGeo = new CylinderGeometry(0.03, 0.04, 0.16, 10);
  for (const x of [-0.14, 0, 0.14])
    g.add(at(mesh(bushingGeo, K.toon({ color: 'sky.light' }), false), x, 0.62, 0));
  return { group: g, light };
}

/* ------------------------------------------------------------------------------------------------ clouds */

export interface Clouds {
  mesh: InstancedMesh;
  update(t: number): void;
}

/** Merged-sphere clouds drifting around the island (one instanced draw call). They cast moving soft shadows. */
export function createClouds(rng: Rng, count: number): Clouds {
  const blobsPer = 5;
  const material = K.toon({
    color: 'white',
    bands: 2,
    softness: 0.24,
    terminator: -0.15,
    highlight: 0.2,
    rim: 0.5,
    fog: false,
  });
  const im = new InstancedMesh(new SphereGeometry(1, 20, 14), material, count * blobsPer);
  im.castShadow = true;
  im.frustumCulled = false;
  interface Cloud {
    radius: number;
    height: number;
    phase: number;
    speed: number;
    scale: number;
    blobs: { offset: Vector3; size: number }[];
  }
  const clouds: Cloud[] = [];
  for (let i = 0; i < count; i++) {
    const blobs = [];
    for (let b = 0; b < blobsPer; b++) {
      blobs.push({
        offset: new Vector3(
          (b - (blobsPer - 1) / 2) * 0.62 + rng.signed(0.12),
          b % 2 === 0 ? 0 : 0.2 + rng.range(0, 0.15),
          rng.signed(0.25),
        ),
        size: (b === 0 || b === blobsPer - 1 ? 0.42 : 0.62) * rng.range(0.85, 1.15),
      });
    }
    clouds.push({
      radius: rng.range(9.5, 14),
      // keep clouds off the line of sight to the island top: low ones around the flank, high ones far above
      height: i % 2 === 0 ? rng.range(-4.2, -0.8) : rng.range(6.8, 9),
      phase: (i / count) * Math.PI * 2 + rng.range(-0.4, 0.4),
      speed: rng.range(0.012, 0.03) * (rng.next() < 0.5 ? 1 : -1),
      scale: rng.range(0.9, 1.7),
      blobs,
    });
  }
  const m = new Matrix4();
  const q = new Quaternion();
  const p = new Vector3();
  const s = new Vector3();
  const yAxis = new Vector3(0, 1, 0);
  const update = (t: number): void => {
    let k = 0;
    for (const c of clouds) {
      const a = c.phase + t * c.speed;
      const cx = Math.cos(a) * c.radius;
      const cz = Math.sin(a) * c.radius;
      const cy = c.height + Math.sin(t * 0.2 + c.phase) * 0.15;
      q.setFromAxisAngle(yAxis, -a + Math.PI / 2);
      for (const b of c.blobs) {
        p.copy(b.offset).multiplyScalar(c.scale).applyQuaternion(q);
        p.x += cx;
        p.y += cy;
        p.z += cz;
        const r = b.size * c.scale;
        m.compose(p, q, s.set(r, r * 0.78, r));
        im.setMatrixAt(k++, m);
      }
    }
    im.instanceMatrix.needsUpdate = true;
  };
  update(0);
  return { mesh: im, update };
}

/* --------------------------------------------------------------------------------------- small movers */

export interface Bird {
  group: Group;
  left: Mesh;
  right: Mesh;
}

export function createBird(): Bird {
  const group = new Group();
  const mat = K.toon({ color: 'white', rim: 0.4, fog: false });
  const body = mesh(new CapsuleGeometry(0.035, 0.1, 4, 8), mat);
  body.rotation.x = Math.PI / 2;
  const wingGeo = new RoundedBoxGeometry(0.2, 0.012, 0.08, 2, 0.006);
  wingGeo.translate(0.1, 0, 0);
  const left = mesh(wingGeo, mat);
  const right = mesh(wingGeo, mat);
  right.scale.x = -1;
  group.add(body, left, right);
  return { group, left, right };
}

export interface Cart {
  group: Group;
  wheels: Mesh[];
  headlight: KGlowMaterial;
}

export function createCart(): Cart {
  const group = new Group();
  group.name = 'cart';
  const body = at(
    mesh(new RoundedBoxGeometry(0.5, 0.2, 0.28, 3, 0.06), K.toon({ color: 'coral', highlight: 0.6 })),
    0,
    0.2,
    0,
  );
  const cabin = at(
    mesh(new RoundedBoxGeometry(0.24, 0.17, 0.25, 3, 0.05), K.toon({ color: 'sky.light', highlight: 0.8 })),
    -0.06,
    0.37,
    0,
  );
  const headlight = K.glow({ color: 'yellow', intensity: 0.8 });
  group.add(
    body,
    cabin,
    at(mesh(new SphereGeometry(0.03, 8, 6), headlight, false), 0.25, 0.22, 0.08),
    at(mesh(new SphereGeometry(0.03, 8, 6), headlight, false), 0.25, 0.22, -0.08),
  );
  const wheelGeo = new CylinderGeometry(0.075, 0.075, 0.06, 14);
  wheelGeo.rotateX(Math.PI / 2);
  const wheelMat = K.toon({ color: 'ink' });
  const wheels: Mesh[] = [];
  for (const [x, z] of [
    [0.16, 0.15],
    [0.16, -0.15],
    [-0.16, 0.15],
    [-0.16, -0.15],
  ] as const) {
    const w = at(mesh(wheelGeo, wheelMat), x, 0.075, z);
    wheels.push(w);
    group.add(w);
  }
  return { group, wheels, headlight };
}

/** Street lamp; `bulb` is shared so one tween switches every lamp on. */
export function createLamp(bulb: KGlowMaterial): Group {
  const g = new Group();
  g.name = 'lamp';
  const dark = K.metal({ color: 'slate', specular: 0.4 });
  g.add(at(mesh(new CylinderGeometry(0.025, 0.04, 0.95, 8), dark), 0, 0.47, 0));
  const armGeo = new CapsuleGeometry(0.02, 0.2, 4, 8);
  const arm = at(mesh(armGeo, dark, false), 0.1, 0.95, 0);
  arm.rotation.z = Math.PI / 2;
  g.add(arm, at(mesh(new SphereGeometry(0.06, 14, 10), bulb, false), 0.22, 0.92, 0));
  return g;
}

/** Low-poly rocks — one of the few places where flat facets are intentional. */
export function createRocks(spots: readonly [number, number, number, number][]): InstancedMesh {
  const im = new InstancedMesh(
    new IcosahedronGeometry(1, 0),
    K.toon({ color: 'steel', flatShading: true, rim: 0.3 }),
    spots.length,
  );
  const m = new Matrix4();
  const q = new Quaternion();
  const axis = new Vector3(0.3, 1, 0.2).normalize();
  spots.forEach(([x, y, z, s], i) => {
    q.setFromAxisAngle(axis, i * 1.7);
    m.compose(new Vector3(x, y, z), q, new Vector3(s, s * 0.7, s * 0.9));
    im.setMatrixAt(i, m);
  });
  im.castShadow = true;
  im.receiveShadow = true;
  return im;
}

/** Glowing crystals for the underside of the island: flat-shaded on purpose, emissive, bloom-driving. */
export function createCrystals(
  spots: readonly [number, number, number, number][],
  color: ColorLike,
): InstancedMesh {
  const geo = new IcosahedronGeometry(1, 0);
  geo.scale(0.45, 1.3, 0.45);
  const im = new InstancedMesh(
    geo,
    K.toon({ color, emissive: color, emissiveIntensity: 1.6, flatShading: true, fog: false }),
    spots.length,
  );
  const m = new Matrix4();
  const q = new Quaternion();
  const down = new Vector3(0, -1, 0);
  spots.forEach(([x, y, z, s], i) => {
    const dir = new Vector3(x, -Math.abs(y) * 0.2 - 2.5, z).normalize();
    q.setFromUnitVectors(down, dir);
    m.compose(new Vector3(x, y, z), q, new Vector3(s, s, s));
    im.setMatrixAt(i, m);
    void i;
  });
  return im;
}

/** Little greenhouse: K.glass dome over a planter — shows tinted glass with a fresnel edge. */
export function createGreenhouse(): Group {
  const g = new Group();
  g.name = 'greenhouse';
  const frame = K.metal({ color: 'white', specular: 0.5 });
  const base = at(mesh(new CylinderGeometry(0.62, 0.66, 0.16, 28), K.toon({ color: 'slate' })), 0, 0.07, 0);
  const soil = at(
    mesh(
      new CylinderGeometry(0.54, 0.54, 0.06, 24),
      K.toon({ color: col('wireBrown').lerp(col('ink'), 0.3) }),
      false,
    ),
    0,
    0.16,
    0,
  );
  g.add(base, soil);
  const dome = new Mesh(
    new SphereGeometry(0.6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    K.glass({ color: 'sky', opacity: 0.14, edgeOpacity: 0.62 }),
  );
  dome.position.y = 0.15;
  dome.renderOrder = 2;
  g.add(dome);
  const rib = new TorusGeometry(0.6, 0.016, 6, 24, Math.PI);
  for (let i = 0; i < 3; i++) {
    const r = at(mesh(rib, frame, false), 0, 0.15, 0);
    r.rotation.y = (i / 3) * Math.PI;
    g.add(r);
  }
  const ring = at(mesh(new TorusGeometry(0.6, 0.02, 6, 32), frame, false), 0, 0.16, 0);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  const leaf = K.toon({ color: 'green' });
  const sprout = new SphereGeometry(1, 12, 8);
  for (const [x, z, r] of [
    [0.18, 0.1, 0.13],
    [-0.2, 0.14, 0.11],
    [0.02, -0.22, 0.14],
    [-0.16, -0.12, 0.09],
    [0.26, -0.14, 0.09],
  ] as const) {
    const b = at(mesh(sprout, leaf, false), x, 0.2 + r * 0.7, z);
    b.scale.set(r, r * 1.25, r);
    g.add(b);
  }
  return g;
}
