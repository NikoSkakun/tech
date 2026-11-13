/**
 * Shared world of the chapter: the round «острів-стіл» of Faraday's workshop, the material palette and small
 * helpers. 1 world unit = 10 cm (`S`): the table top (Ø 1,2 m) has a radius of 6, a 10 cm bar magnet is one
 * unit long. `bench.top` puts its origin on the table surface; north (sim +y) is world −z.
 */
import {
  CircleGeometry,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  RingGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';
import { toOverlay, type ChapterContext } from '@/engine/api';
import { K, col, type ColorLike, type KGlowMaterial } from '@/style';
import { Text3D } from '@/text';

/** World units per metre. */
export const S = 10;
/** Radius of the table top. */
export const TABLE_R = 6;
/** Height of the table surface above the studio floor. */
export const TABLE_H = 0.6;

/** Simulation table point (x east, y north, metres) → world point on the table at height `h` (units). */
export function simToWorld(x: number, y: number, h = 0, out = new Vector3()): Vector3 {
  return out.set(x * S, h, -y * S);
}

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
    north: K.toon({ color: 'coral', gloss: 0.5 }),
    south: K.toon({ color: 'blue', gloss: 0.5 }),
    glass: K.glass({ color: 'sky', opacity: 0.12, edgeOpacity: 0.55 }),
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

/** Glow material for semantic colours (keeps its hue under bloom). */
export const glow = (color: ColorLike, intensity = 1.4): KGlowMaterial =>
  K.glow({ color, intensity, falloff: 0, whiten: 0, keepHue: true });

/**
 * Small world tag for live numbers (timers, counters): billboard text with a constant on-screen size on the
 * overlay layer. Part names use the HUD's callouts instead (UI_API §5).
 */
export function tag(text: string, size = 22, color: ColorLike = 'white'): Text3D {
  const t = new Text3D(text, {
    font: 'display',
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
  update(t: number): void;
}

/**
 * The round workshop table: lathed slab with a steel rim, a smooth top with faint polar marking rings (the
 * script's «тонке кільце-розмітка»), a north tick on the edge (compasses rest along it) and the accent ring.
 */
export function createWorkbench(ctx: ChapterContext): Workbench {
  const g = group('workbench');
  const R = TABLE_R;
  const H = TABLE_H;
  const pts: [number, number][] = [
    [0, 0],
    [R - 2, 0],
    [R - 1.5, 0.08],
    [R - 0.4, 0.26],
    [R + 0.12, 0.3],
    [R + 0.22, 0.36],
    [R + 0.22, H - 0.07],
    [R + 0.14, H],
    [0, H],
  ];
  const slab = mesh(
    new LatheGeometry(
      pts.map(([x, y]) => new Vector2(x, y)),
      128,
    ),
    K.toon({ gradient: { bottom: 'bg.indigo', top: 'steel', range: [0, H] }, rim: 1.3 }),
  );
  const topColor = col('bg.indigo').lerp(col('slate'), 0.5);
  const top = mesh(new CircleGeometry(R - 0.06, 128), K.toon({ color: topColor, highlight: 0.05 }), 0, H + 0.004, 0, false);
  top.rotation.x = -Math.PI / 2;
  // marking rings every 1 unit (10 cm) and a fine cross: a quiet "lab mat" that gives scale
  const lineMat = K.flat(col('bg.indigo').lerp(col('slate'), 0.75));
  const rings = [1.5, 3, 4.5].map((r) => {
    const m = new Mesh(new RingGeometry(r - 0.012, r + 0.012, 160), lineMat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = H + 0.006;
    return m;
  });
  const tick = new InstancedMesh(new CircleGeometry(0.03, 8).rotateX(-Math.PI / 2), lineMat, 72);
  const m4 = new Matrix4();
  for (let k = 0; k < 72; k++) {
    const a = (k / 72) * Math.PI * 2;
    tick.setMatrixAt(k, m4.makeTranslation(Math.cos(a) * (R - 0.35), H + 0.007, Math.sin(a) * (R - 0.35)));
  }
  // north marker: a coral chevron at the far edge (compasses at rest point at it)
  const north = new Mesh(new CircleGeometry(0.16, 3).rotateX(-Math.PI / 2).rotateY(Math.PI / 2), K.toon({ color: 'coral', gloss: 0.4 }));
  north.position.set(0, H + 0.008, -(R - 0.55));
  const ring: KGlowMaterial = glow(ctx.manifest.theme.accent, 1.4);
  const accent = new Mesh(new TorusGeometry(R + 0.03, 0.026, 8, 192), ring);
  accent.rotation.x = Math.PI / 2;
  accent.position.y = H + 0.012;
  g.add(slab, top, ...rings, tick, north, accent);
  return {
    group: g,
    update(t) {
      ring.intensity = 1.25 + Math.sin(t * 1.3) * 0.2;
    },
  };
}
