/**
 * Shared world of the lab: the materials every set uses and small scene helpers. The workbench itself is
 * `parts/bench.ts`. Units: 1 world unit ≈ 10 cm of the opened inverter «ЛІ-6» (it is ≈ 6 units wide on the
 * bench); kit models authored in metres are scaled by `KIT_SCALE`.
 */
import { BoxGeometry, Group, Mesh, type BufferGeometry, type Material, type Object3D } from 'three';
import { toOverlay } from '@/engine/api';
import { K, SEMANTIC, col, type ColorLike } from '@/style';
import { Text3D } from '@/text';

/** Bench top, world units (x × z), and its height above the studio floor. */
export const BENCH_W = 11.6;
export const BENCH_D = 6.6;
export const BENCH_H = 0.55;
/** Scale of metre-sized kit models standing on the bench (a 0,62 m inverter becomes 1,3 units). */
export const KIT_SCALE = 2.1;

/** Materials shared by all sets (one program each; never mutate — make your own for animated ones). */
export function createMats() {
  const copper = col('orange').lerp(col('wireBrown'), 0.35);
  return {
    steel: K.metal({ color: 'steel', specular: 0.7 }),
    dark: K.toon({ color: 'slate', rim: 0.8 }),
    ink: K.toon({ color: 'ink', rim: 1.1 }),
    light: K.toon({ color: 'mist', gloss: 0.35 }),
    white: K.toon({ color: 'white', highlight: 0.2 }),
    copper: K.metal({ color: copper, specular: 0.85, shininess: 60 }),
    pcb: K.toon({ color: col('teal').lerp(col('bg.indigo'), 0.55), gloss: 0.25 }),
    plus: K.toon({ color: SEMANTIC.dcPlus, gloss: 0.5 }),
    minus: K.toon({ color: SEMANTIC.dcMinus, gloss: 0.5 }),
    glass: K.glass({ color: 'sky', opacity: 0.12, edgeOpacity: 0.5 }),
    plinth: K.toon({ gradient: { bottom: 'bg.indigo', top: 'slate', range: [0, 0.5] }, rim: 1.2 }),
  } as const;
}
export type Mats = ReturnType<typeof createMats>;

/** Copper of windings and busbars as a colour (for kit `Builder` shapes). */
export const COPPER = col('orange').lerp(col('wireBrown'), 0.35);

/** A shadow-casting mesh at a position. */
export function mesh(geometry: BufferGeometry, material: Material, x = 0, y = 0, z = 0, shadow = true): Mesh {
  const m = new Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = shadow;
  return m;
}

/**
 * True when the window is tall enough for the secondary callouts of a crowded subject. Callout plates keep a
 * minimum real size, so on a 720p-class screen they take a much larger share of a small subject (the scope of
 * steps 4–5) and the lower-priority ones are better left out.
 */
export function roomy(lab: { ctx: { viewport: { height: number } } }): boolean {
  return lab.ctx.viewport.height >= 860;
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
 * Invisible pick proxy (a box that writes neither colour nor depth): a generous one-finger target (≥ 44 px on
 * screen) around a small or composite part. Register it with `ctx.input.register(proxy, …)`.
 */
export function pickBox(w: number, h: number, d: number, x = 0, y = 0, z = 0): Mesh {
  const material = K.flat('cyan');
  material.colorWrite = false;
  material.depthWrite = false;
  const m = new Mesh(new BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.name = 'pick-proxy';
  return m;
}

/**
 * Small world tag for live numbers and short part marks («S1», «400 V»): billboard text with a constant
 * on-screen size on the overlay layer (never blurred by depth of field, ≥ 16 px). Names of parts are HUD
 * callouts instead (UI_API §5).
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
    billboard: true,
    screenSpace: true,
    depthTest: false,
    depthWrite: false,
  });
  return toOverlay(t);
}
