/**
 * Shared world of the chapter: the round workbench every set stands on («стіл-майстерня»), the material
 * palette and small helpers. Units are toy units: an AA battery is ≈ 1.5 units long (×30 real size), the table
 * top has a radius of 4.6. `bench.top` puts its origin on the table surface.
 */
import {
  CircleGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';
import { toOverlay, type ChapterContext } from '@/engine/api';
import { K, SEMANTIC, col, type ColorLike, type KGlowMaterial } from '@/style';
import { Text3D } from '@/text';

/** Radius of the table top (sets stay inside ≈ 4.2). */
export const TABLE_R = 4.6;
/** Height of the table surface above the studio floor. */
export const TABLE_H = 0.5;

/** Materials shared by all sets (one program each; do not mutate — make your own for animated ones). */
export function createMats() {
  const copper = col('orange').lerp(col('wireBrown'), 0.45);
  return {
    steel: K.metal({ color: 'steel', specular: 0.7 }),
    chrome: K.metal({ color: 'mist', specular: 0.85, shininess: 60 }),
    dark: K.toon({ color: 'slate', rim: 0.8 }),
    ink: K.toon({ color: 'ink', rim: 1.1 }),
    light: K.toon({ color: 'mist', gloss: 0.35 }),
    white: K.toon({ color: 'white', highlight: 0.2 }),
    copper: K.metal({ color: copper, specular: 0.85, shininess: 60 }),
    brass: K.metal({ color: col('amber').lerp(col('wireBrown'), 0.35), specular: 0.8 }),
    teal: K.toon({ color: 'teal', gloss: 0.4 }),
    plus: K.toon({ color: SEMANTIC.dcPlus, gloss: 0.5 }),
    minus: K.toon({ color: SEMANTIC.dcMinus, gloss: 0.5 }),
    glass: K.glass({ color: 'sky', opacity: 0.12, edgeOpacity: 0.55 }),
    water: K.glass({ color: 'sky', opacity: 0.2, edgeOpacity: 0.5 }),
  } as const;
}
export type Mats = ReturnType<typeof createMats>;

/** A shadow-casting mesh at a position. */
export function mesh(geometry: BufferGeometry, material: Material, x = 0, y = 0, z = 0, shadow = true): Mesh {
  const m = new Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

/** A named group at a position. */
export function group(name: string, x = 0, y = 0, z = 0, children: Object3D[] = []): Group {
  const g = new Group();
  g.name = name;
  g.position.set(x, y, z);
  if (children.length) g.add(...children);
  return g;
}

/**
 * Small world tag for live numbers (meter readings, counters): billboard text with a constant on-screen size
 * on the overlay layer. Part names use the HUD's callouts instead (UI_API §5).
 */
export function tag(
  text: string,
  size = 22,
  color: ColorLike = 'white',
  font: 'display' | 'mono' = 'display',
): Text3D {
  const t = new Text3D(text, {
    font,
    size,
    color,
    anchorX: 'center',
    anchorY: 'middle',
    align: 'center',
    billboard: true,
    screenSpace: true,
    depthTest: false,
    depthWrite: false,
  });
  return toOverlay(t);
}

export interface Workbench {
  group: Group;
  ring: KGlowMaterial;
  update(t: number): void;
}

/** The round workbench: lathed slab with a steel rim, perforated top (breadboard-like holes), accent ring. */
export function createWorkbench(ctx: ChapterContext): Workbench {
  const g = group('workbench');
  const R = TABLE_R;
  const H = TABLE_H;
  const pts: [number, number][] = [
    [0, 0],
    [R - 1.5, 0],
    [R - 1.2, 0.06],
    [R - 0.3, 0.2],
    [R + 0.1, 0.24],
    [R + 0.18, 0.3],
    [R + 0.18, H - 0.06],
    [R + 0.12, H],
    [0, H],
  ];
  const slab = mesh(
    new LatheGeometry(
      pts.map(([x, y]) => new Vector2(x, y)),
      128,
    ),
    K.toon({ gradient: { bottom: 'bg.indigo', top: 'steel', range: [0, H] }, rim: 1.3 }),
  );
  const topColor = col('bg.indigo').lerp(col('slate'), 0.42);
  const top = mesh(
    new CircleGeometry(R - 0.06, 128),
    K.toon({ color: topColor, highlight: 0.05 }),
    0,
    H + 0.004,
    0,
    false,
  );
  top.rotation.x = -Math.PI / 2;
  // perforation: one instanced disc per hole on a square grid
  const pitch = 0.32;
  const spots: [number, number][] = [];
  const n = Math.floor((R - 0.35) / pitch);
  for (let i = -n; i <= n; i++)
    for (let j = -n; j <= n; j++) if (Math.hypot(i, j) * pitch < R - 0.35) spots.push([i * pitch, j * pitch]);
  const hole = new CircleGeometry(0.036, 10);
  hole.rotateX(-Math.PI / 2);
  const holes = new InstancedMesh(hole, K.flat(col('bg.indigo').lerp(col('bg.deep'), 0.5)), spots.length);
  const m4 = new Matrix4();
  spots.forEach(([x, z], k) => holes.setMatrixAt(k, m4.makeTranslation(x, H + 0.008, z)));
  holes.name = 'holes';
  const ring = K.glow({
    color: ctx.manifest.theme.accent,
    intensity: 1.4,
    falloff: 0,
    keepHue: true,
    whiten: 0,
  });
  const accent = new Mesh(new TorusGeometry(R + 0.02, 0.022, 8, 192), ring);
  accent.rotation.x = Math.PI / 2;
  accent.position.y = H + 0.012;
  // rim hardware: a ring of screws and four status LEDs that take turns to blink
  const screwGeo = new CylinderGeometry(0.05, 0.05, 0.03, 10);
  const screws = new InstancedMesh(screwGeo, K.metal({ color: 'mist', specular: 0.8 }), 24);
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    screws.setMatrixAt(k, m4.makeTranslation(Math.cos(a) * (R - 0.16), H + 0.02, Math.sin(a) * (R - 0.16)));
  }
  const ledMat = K.glow({ color: 'teal', intensity: 1.2, falloff: 0, whiten: 0, keepHue: true });
  const leds = [0.6, 2.2, 3.8, 5.4].map((a) => {
    const led = new Mesh(new SphereGeometry(0.045, 12, 8), ledMat);
    led.position.set(Math.cos(a) * (R + 0.19), H - 0.14, Math.sin(a) * (R + 0.19));
    return led;
  });
  g.add(slab, top, holes, accent, screws, ...leds);
  return {
    group: g,
    ring,
    update(t) {
      ring.intensity = 1.25 + Math.sin(t * 1.3) * 0.2;
      ledMat.intensity = 0.9 + 0.6 * Math.sin(t * 2.1);
      leds.forEach((led, k) => led.scale.setScalar(0.8 + 0.3 * Math.max(Math.sin(t * 1.7 + k * 1.6), 0)));
    },
  };
}
