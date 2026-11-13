/**
 * Shared world of the chapter: the materials every set uses and small scene helpers. Units: the studio floor is
 * the diorama table, 1 world unit ≈ 1 m of the stylised dioramas (the teaching transformer of steps 1–2 is drawn
 * at ×10, the 8 m power transformer at ×0,5 — every set is its own model on the disc, sized to the frame).
 */
import { BoxGeometry, Group, Mesh, type BufferGeometry, type Material, type Object3D } from 'three';
import { toOverlay } from '@/engine/api';
import { K, col, type ColorLike } from '@/style';
import { Text3D } from '@/text';

/**
 * Copper of the two sides (DECISIONS §8): primary winding `coral`-tinted copper, secondary `sky`-tinted copper.
 * Plain copper (busbars, leads) sits between orange and wire brown.
 */
export const COPPER = col('orange').lerp(col('wireBrown'), 0.35);
export const COPPER_PRIMARY = col('coral').lerp(col('orange'), 0.35);
export const COPPER_SECONDARY = col('sky').lerp(col('orange'), 0.18);
/** Tank paint of the power transformer (`slate` toward green-grey, «Бачимо» step 4). */
export const TANK = col('slate').lerp(col('teal'), 0.14).lerp(col('steel'), 0.35);

/** Materials shared by all sets (one program each; never mutate — make your own for animated ones). */
export function createMats() {
  return {
    steel: K.metal({ color: 'steel', specular: 0.7 }),
    dark: K.toon({ color: 'slate', rim: 0.8 }),
    ink: K.toon({ color: 'ink', rim: 1.1 }),
    light: K.toon({ color: 'mist', gloss: 0.35 }),
    white: K.toon({ color: 'white', highlight: 0.2 }),
    copper: K.metal({ color: COPPER, specular: 0.85, shininess: 60 }),
    primary: K.metal({ color: COPPER_PRIMARY, specular: 0.8, shininess: 50 }),
    secondary: K.metal({ color: COPPER_SECONDARY, specular: 0.8, shininess: 50 }),
    glass: K.glass({ color: 'sky', opacity: 0.12, edgeOpacity: 0.5 }),
    plinth: K.toon({ gradient: { bottom: 'bg.indigo', top: 'slate', range: [0, 0.5] }, rim: 1.2 }),
  } as const;
}
export type Mats = ReturnType<typeof createMats>;

/** A shadow-casting mesh at a position. */
export function mesh(geometry: BufferGeometry, material: Material, x = 0, y = 0, z = 0, shadow = true): Mesh {
  const m = new Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = shadow;
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
 * Invisible pick proxy (writes neither colour nor depth): a generous one-finger target (≥ 44 px on screen) around
 * a small or composite part. Register it with `ctx.input.register(proxy, …)`.
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
 * Small world tag for live numbers and short part marks («N₁ = 500», «1U»): billboard text with a constant
 * on-screen size on the overlay layer (never blurred by depth of field, ≥ 16 px). Names of parts are HUD
 * callouts instead (UI_API §5).
 */
export function tag(text: string, size = 22, color: ColorLike = 'white', font: 'display' | 'mono' = 'display'): Text3D {
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
