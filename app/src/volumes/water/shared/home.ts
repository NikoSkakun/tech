/**
 * The home of the volume (VISUAL.md §2): the night table of the library, and on it one glass of water with an ice
 * cube, standing on a pad that can both warm and cool, a thermometer in the water, a magnifying lens beside it.
 * For the riddle of the prologue a candle in a jar stands next to the glass.
 *
 * `pad` (0 … 1) is the pad's knob: 0 = frost (the water is a block of ice, the glass is frosted), 0.5 = the room
 * (water with a floating cube), 1 = heat (the cube is gone, the water boils, steam rises). This is an illustration
 * of what everybody has seen, not a simulation; the physics lives on the floor «молекули» (`sample.ts`).
 */
import { CircleGeometry, CylinderGeometry, Group, InstancedMesh, Mesh, Object3D, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createBubbles, createFlame, createSteam } from '@/fx';
import { G } from '@/kit';
import { col, K, type EnvOverrides } from '@/style';
import { createThermometer, type Thermometer } from './thermometer';

/** Sizes, world units (the glass is 2.9 high: ≈ 1 unit = 4 cm). */
export const GLASS = { bottom: 1.05, top: 1.3, height: 2.9, wall: 0.07, water: 2.05 } as const;
export const PAD = { radius: 1.75, height: 0.3 } as const;
const CUBE = 0.78;
/** Where the candle jar stands, and the hero drop on the glass (the dive enters it). */
export const CANDLE_AT = [3.1, 0, 0.5] as const;
const DROP_ANGLE = 0.5; // around the glass from +z toward +x
const DROP_Y = 1.25;
export const DROP_R = 0.085;
/** Share of the cube's height above the water when it floats (ice: 1 − 0.917). */
const AFLOAT = 0.083;

/** The dark room: `studio` backdrop without its floor, a cold moon from the upper left (as in `circuit`). */
export const ROOM_ENV: EnvOverrides = {
  top: 'bg.void',
  mid: 'bg.deep',
  bottom: 'bg.void',
  horizon: 0.02,
  horizonWidth: 0.34,
  bokeh: 0.25,
  motes: 0.2,
  floor: 0,
  sunDir: [-0.62, 0.72, 0.3],
  keyColor: col('sky').lerp(col('white'), 0.35),
  keyIntensity: 1.05,
  fillIntensity: 0.75,
  rimColor: 'blue',
  rimDir: [-0.5, 0.45, -0.74],
  fogColor: 'bg.void',
  fogDensity: 0,
};

export interface Home {
  readonly group: Group;
  readonly thermometer: Thermometer;
  readonly candle: Group;
  readonly lens: Group;
  /** Anchors for captions. */
  readonly cube: Object3D;
  readonly wax: Object3D;
  /** World centre of the hero drop and the outward direction of the glass wall there. */
  readonly dropAt: Vector3;
  readonly dropOut: Vector3;
  /** The knob of the pad, 0 … 1 (see the file header). */
  pad: number;
  /** 0 … 1: the hero drop and its small neighbours on the glass. */
  dew: number;
  /** Push the cube under water and let go; drop a piece of wax into the candle. */
  dunk(): void;
  dropWax(): void;
  readonly dunked: boolean;
  readonly waxSunk: boolean;
  /** Degrees Celsius the thermometer shows for the knob now. */
  readonly celsius: number;
  update(dt: number, t: number): void;
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function createHome(ctx: ChapterContext): Home {
  const group = new Group();
  group.name = 'water-home';
  // table
  // (a plain cylinder: its flat cap takes light evenly; a bevelled one shades the cap's fan of triangles in rays)
  const table = new Mesh(
    new CylinderGeometry(9, 9, 0.34, 96),
    // a wide matte plane: two soft bands, no highlight — a hard cel edge would flicker across the flat top
    K.toon({ color: col('bg.indigo').lerp(col('bg.deep'), 0.3), bands: 2, softness: 0.32, terminator: 0.3, highlight: 0, rim: 0 }),
  );
  table.position.y = -0.17;
  table.receiveShadow = true;
  // the pad: a dark puck with a ring of light (sky = it cools, orange = it warms) and a knob
  const pad = new Group();
  const puck = new Mesh(G.cyl(PAD.radius, PAD.height, { seg: 64, bevel: 0.07 }), K.toon({ color: 'ink', gloss: 0.45, rim: 0.4 }));
  puck.castShadow = puck.receiveShadow = true;
  const ringGeometry = new TorusGeometry(PAD.radius - 0.02, 0.05, 10, 96);
  const hot = K.glow({ color: 'orange', intensity: 0, whiten: 0.2, keepHue: true, falloff: 1.1 });
  const cold = K.glow({ color: 'sky', intensity: 0, whiten: 0.2, keepHue: true, falloff: 1.1 });
  const rings = [hot, cold].map((m) => {
    const ring = new Mesh(ringGeometry, m);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = PAD.height * 0.55;
    return ring;
  });
  const knob = new Mesh(G.cyl(0.2, 0.16, { seg: 24, bevel: 0.04 }), K.metal({ color: 'steel', gloss: 0.8 }));
  knob.rotation.x = Math.PI / 2;
  knob.position.set(0, PAD.height * 0.5, PAD.radius - 0.02);
  const pointer = new Mesh(G.rbox(0.05, 0.02, 0.2, 0.01), K.flat('white'));
  pointer.position.set(0, 0.17, 0.05);
  knob.add(pointer);
  pad.add(puck, ...rings, knob);

  // the glass: one lathe, outside and inside
  const glassBody = new Group();
  glassBody.position.y = PAD.height;
  const inner = (y: number): number => GLASS.bottom - GLASS.wall + ((GLASS.top - GLASS.bottom) * y) / GLASS.height;
  const glassMat = K.glass({ color: 'sky', opacity: 0.1, edgeOpacity: 0.6, specular: 0.9, doubleSided: true });
  const glass = new Mesh(
    G.lathe(
      [[0, 0], [GLASS.bottom, 0], [GLASS.top, GLASS.height], [GLASS.top - GLASS.wall, GLASS.height], [inner(0.22), 0.22], [0, 0.22]],
      { seg: 72 },
    ),
    glassMat,
  );
  glass.renderOrder = 6;
  const waterH = GLASS.water - 0.22;
  const waterGeometry = G.cyl(inner(0.22) - 0.01, waterH, { rTop: inner(GLASS.water) - 0.01, seg: 56, bevel: 0 });
  const water = new Mesh(waterGeometry, K.glass({ color: 'blue', opacity: 0.4, edgeOpacity: 0.72, specular: 0.4 }));
  water.position.y = 0.22;
  water.renderOrder = 3;
  const surface = new Mesh(new CircleGeometry(inner(GLASS.water) - 0.02, 56), K.water({ shape: 'disc', scale: 0.45 }));
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = GLASS.water + 0.005;
  surface.renderOrder = 4;
  // the same volume as a block of ice, and frost on the outside of the glass — both dissolve in with the frost
  const block = new Mesh(
    waterGeometry,
    K.toon({ gradient: { bottom: 'sky', top: 'white', range: [0, waterH] }, gloss: 0.6, rim: 0.5, emissive: 'sky', emissiveIntensity: 0.12 }),
  );
  block.position.y = 0.22;
  const frostMat = K.toon({ color: 'white', gloss: 0.1, emissive: 'white', emissiveIntensity: 0.15 });
  const frost = new Mesh(G.lathe([[GLASS.bottom + 0.012, 0.02], [GLASS.top + 0.012, GLASS.height - 0.02]], { seg: 72 }), frostMat);
  // the cube: clear ice with a cloudy heart
  const cube = new Group();
  const cubeShell = new Mesh(G.rbox(CUBE, CUBE, CUBE, 0.13, 3), K.glass({ color: 'white', opacity: 0.5, edgeOpacity: 0.95, specular: 1 }));
  cubeShell.renderOrder = 5;
  const cubeHeart = new Mesh(G.rbox(CUBE * 0.62, CUBE * 0.62, CUBE * 0.62, 0.1, 2), K.toon({ color: 'white', gloss: 0.3, emissive: 'sky', emissiveIntensity: 0.25 }));
  cube.add(cubeHeart, cubeShell);
  cube.rotation.set(0.12, 0.5, -0.08);
  const thermometer = createThermometer(2.5, 0.06);
  thermometer.group.position.set(-0.52, 0.48, -0.3);
  thermometer.group.rotation.z = 0.2;
  thermometer.range(-20, 100);
  const steam = createSteam(ctx, { radius: 0.3, height: 1.5, count: 34, opacity: 0.36 });
  steam.position.y = GLASS.water + 0.2;
  const bubbles = createBubbles(ctx, { size: [1.5, waterH - 0.1, 1.5], radius: 0.06, rise: 1.1, count: 60 });
  bubbles.position.y = 0.22 + waterH / 2;
  glassBody.add(block, water, surface, cube, thermometer.group, bubbles, glass, frost, steam);

  // dew on the cold glass: the hero drop (the dive enters it) and a handful of smaller ones
  const out = new Vector3(Math.sin(DROP_ANGLE), 0, Math.cos(DROP_ANGLE));
  const outer = (y: number): number => GLASS.bottom + ((GLASS.top - GLASS.bottom) * y) / GLASS.height;
  const dropAt = out.clone().multiplyScalar(outer(DROP_Y) + DROP_R * 0.35).setY(PAD.height + DROP_Y);
  const dropMat = K.glass({ color: 'sky', opacity: 0.34, edgeOpacity: 0.95, specular: 1 });
  const dropGeometry = new SphereGeometry(1, 24, 16);
  const drop = new Mesh(dropGeometry, dropMat);
  drop.position.copy(dropAt);
  drop.lookAt(dropAt.clone().add(out));
  drop.renderOrder = 7;
  const SMALL = 18;
  const dewDrops = new InstancedMesh(dropGeometry, dropMat, SMALL);
  dewDrops.renderOrder = 7;
  const dummy = new Object3D();
  const dewSpots: { a: number; y: number; r: number }[] = [];
  for (let i = 0; i < SMALL; i++)
    dewSpots.push({ a: DROP_ANGLE + (ctx.random.range(-1.1, 1.1)), y: ctx.random.range(0.5, 2.4), r: ctx.random.range(0.025, 0.06) });
  const layDew = (k: number): void => {
    drop.scale.set(DROP_R * k, DROP_R * k * 1.12, DROP_R * 0.6 * k);
    dewSpots.forEach((s, i) => {
      // keep clear of the hero drop
      const far = Math.hypot((s.a - DROP_ANGLE) * 1.1, s.y - DROP_Y) > 0.3 ? 1 : 0;
      dummy.position.set(Math.sin(s.a), 0, Math.cos(s.a)).multiplyScalar(outer(s.y) + s.r * 0.3).setY(PAD.height + s.y);
      dummy.lookAt(dummy.position.x * 2, dummy.position.y, dummy.position.z * 2);
      dummy.scale.set(s.r * k * far, s.r * k * far * 1.15, s.r * 0.55 * k * far);
      dummy.updateMatrix();
      dewDrops.setMatrixAt(i, dummy.matrix);
    });
    dewDrops.instanceMatrix.needsUpdate = true;
  };

  // the lens: stands before the hero drop, looking at it
  const lens = new Group();
  const rimGeometry = G.ring(0.46, 0.05, 48, 10);
  rimGeometry.rotateX(Math.PI / 2); // stand it up: the lens looks along its local z
  const rim = new Mesh(rimGeometry, K.metal({ color: 'amber', gloss: 0.8 }));
  const pane = new Mesh(new CircleGeometry(0.44, 40), K.glass({ color: 'sky', opacity: 0.08, edgeOpacity: 0.5, specular: 1, doubleSided: true }));
  pane.renderOrder = 8;
  const handle = new Mesh(G.capsule(0.06, 0.75, 12), K.toon({ color: 'slate', gloss: 0.4 }));
  handle.position.set(0.42, -0.72, 0);
  handle.rotation.z = 0.52;
  lens.add(rim, pane, handle);
  lens.position.copy(dropAt).addScaledVector(out, 0.62);
  lens.lookAt(dropAt.clone().addScaledVector(out, 3));

  // the candle in a jar: solid wax below, a pool of melted wax above it, a flame
  const candle = new Group();
  candle.position.set(...CANDLE_AT);
  const jar = new Mesh(
    G.lathe([[0, 0], [0.66, 0], [0.66, 1.3], [0.6, 1.3], [0.6, 0.08], [0, 0.08]], { seg: 48 }),
    K.glass({ color: 'sky', opacity: 0.1, edgeOpacity: 0.55, specular: 0.8, doubleSided: true }),
  );
  jar.renderOrder = 6;
  const cream = col('yellow').lerp(col('white'), 0.72);
  const solid = new Mesh(G.cyl(0.585, 0.5, { seg: 40, bevel: 0.02 }), K.toon({ color: cream, gloss: 0.25 }));
  solid.position.y = 0.08;
  const POOL = { bottom: 0.58, top: 1.02 };
  const pool = new Mesh(
    G.cyl(0.585, POOL.top - POOL.bottom, { seg: 40, bevel: 0 }),
    K.glass({ color: 'amber', opacity: 0.42, edgeOpacity: 0.75, specular: 0.6 }),
  );
  pool.position.y = POOL.bottom;
  pool.renderOrder = 3;
  const wick = new Mesh(G.capsule(0.018, 0.34, 6), K.toon({ color: 'ink' }));
  wick.position.set(-0.18, POOL.top + 0.02, -0.1);
  const flame = createFlame({ height: 0.5, width: 0.2, intensity: 1.7 });
  flame.position.set(-0.18, POOL.top + 0.18, -0.1);
  const wax = new Mesh(G.rbox(0.24, 0.18, 0.2, 0.05, 2), K.toon({ color: cream, gloss: 0.3 }));
  wax.castShadow = true;
  candle.add(solid, pool, wick, flame, wax, jar);
  for (const m of [solid, cubeHeart]) m.castShadow = true;

  group.add(table, pad, glassBody, drop, dewDrops, lens, candle);

  // the cube's bobbing: displacement from its floating height and its speed; a dunk pushes it down, then lets go
  const bob = { y: 0, v: 0, push: 0, dunked: false };
  // the piece of wax: null = not dropped yet; else its height above the jar's floor and whether it has sunk
  const fall = { y: 2.6, on: false, sunk: false };
  wax.visible = false;
  let shownDew = -1;
  const home: Home = {
    group,
    thermometer,
    candle,
    lens,
    cube,
    wax,
    dropAt,
    dropOut: out,
    pad: 0.5,
    dew: 1,
    dunk() {
      bob.push = 0.55;
    },
    dropWax() {
      fall.y = 2.6;
      fall.on = true;
      fall.sunk = false;
      wax.visible = true;
    },
    get dunked() {
      return bob.dunked;
    },
    get waxSunk() {
      return fall.sunk;
    },
    get celsius() {
      const p = home.pad;
      return p < 0.5 ? -18 + (38 * p) / 0.5 : 20 + 80 * Math.min(1, (p - 0.5) / 0.4);
    },
    update(dt, t) {
      const p = home.pad;
      const frozen = 1 - smooth(0.12, 0.34, p);
      const melted = smooth(0.58, 0.78, p);
      const boil = smooth(0.84, 0.97, p);
      hot.intensity = 0.15 + 1.6 * Math.max(0, (p - 0.5) * 2);
      cold.intensity = 0.15 + 1.6 * Math.max(0, (0.5 - p) * 2);
      rings[0]!.visible = p >= 0.5;
      rings[1]!.visible = p < 0.5;
      knob.rotation.z = (0.5 - p) * 2.4;
      block.material.fade = frozen;
      block.visible = frozen > 0.01;
      frostMat.fade = 0.5 * frozen;
      frost.visible = frozen > 0.02;
      water.visible = surface.visible = frozen < 0.985;
      thermometer.set(home.celsius);
      steam.rate = boil;
      steam.setEmitting(boil > 0.03);
      bubbles.rate = boil;
      bubbles.setEmitting(boil > 0.03);
      bubbles.visible = boil > 0.02;
      steam.visible = boil > 0.02;
      // the cube: floats with a twelfth above the water, shrinks as it melts, sits still in the frozen block
      if (bob.push > 0) {
        bob.push -= dt;
        bob.v += (-0.8 - bob.y) * 60 * dt - bob.v * 9 * dt;
        if (bob.push <= 0) bob.dunked = true;
      } else bob.v += -bob.y * 42 * dt - bob.v * 2.6 * dt;
      bob.y += bob.v * dt;
      const size = 1 - melted;
      const idle = (1 - frozen) * 0.018 * Math.sin(t * 1.7);
      cube.scale.setScalar(Math.max(0.001, size));
      cube.visible = size > 0.02;
      cube.position.set(0.28, GLASS.water + CUBE * size * (AFLOAT - 0.5) + (bob.y + idle) * (1 - frozen), 0.14);
      cube.rotation.z = -0.08 + (1 - frozen) * (0.05 * Math.sin(t * 1.1) + bob.v * 0.05);
      // the wax: falls into the pool and sinks through it to the solid wax
      if (fall.on) {
        const inPool = fall.y < POOL.top;
        const floor = POOL.bottom + 0.09;
        fall.y = Math.max(floor, fall.y - (inPool ? 0.16 : 3.2) * dt);
        if (fall.y <= floor + 1e-4) fall.sunk = true;
        wax.position.set(0.16, fall.y, 0.12);
        wax.rotation.set(fall.y * 2.1, 0.4, fall.y * 1.3);
      }
      flame.power = 0.92 + 0.08 * Math.sin(t * 7.3);
      const dew = home.dew * (1 - boil) * (1 - 0.6 * frozen);
      if (Math.abs(dew - shownDew) > 0.004) layDew((shownDew = dew));
      drop.visible = dewDrops.visible = dew > 0.01;
    },
  };
  layDew(1);
  return home;
}
