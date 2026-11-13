/**
 * Shared world of the chapter: the materials every set uses and small scene helpers. Units: 1 world unit ≈
 * 25 cm of the toy generator (the horseshoe magnet is ≈ 3 units tall); kit machines authored in metres are
 * scaled per step. The turntable floor (`parts/turntable.ts`) has radius `FLOOR_R` at y = 0.
 */
import { BoxGeometry, Group, Mesh, type BufferGeometry, type Material, type Object3D } from 'three';
import { toOverlay } from '@/engine/api';
import { K, SEMANTIC, col, type ColorLike } from '@/style';
import { Text3D } from '@/text';

export const FLOOR_R = 5.2;
/** Copper of windings and busbars as a colour (for kit `Builder` shapes). */
export const COPPER = col('orange').lerp(col('wireBrown'), 0.3);
/** Phase colours L1 / L2 / L3 (yellow / green / red, STYLE_GUIDE §2.2). */
export const PHASE = [SEMANTIC.phaseL1, SEMANTIC.phaseL2, SEMANTIC.phaseL3] as const;

/** Materials shared by all sets (one program each; never mutate — make your own for animated ones). */
export function createMats() {
  return {
    steel: K.metal({ color: 'steel', specular: 0.7 }),
    dark: K.toon({ color: 'slate', rim: 0.8 }),
    ink: K.toon({ color: 'ink', rim: 1.1 }),
    light: K.toon({ color: 'mist', gloss: 0.35 }),
    white: K.toon({ color: 'white', highlight: 0.2 }),
    copper: K.metal({ color: COPPER, specular: 0.85, shininess: 60 }),
    north: K.toon({ color: SEMANTIC.poleN, gloss: 0.5 }),
    south: K.toon({ color: SEMANTIC.poleS, gloss: 0.5 }),
    phase: PHASE.map((c) => K.toon({ color: c, gloss: 0.45 })),
    neutral: K.toon({ color: 'blue', gloss: 0.45 }),
    glass: K.glass({ color: 'sky', opacity: 0.12, edgeOpacity: 0.5 }),
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

/** True when the window is tall enough for the secondary callouts of a crowded subject (720p thins them). */
export function roomy(hall: { ctx: { viewport: { height: number } } }): boolean {
  return hall.ctx.viewport.height >= 860;
}

/**
 * Invisible pick proxy (writes neither colour nor depth): a generous one-finger target (≥ 44 px on screen)
 * around a small or moving part. Register it with `ctx.input.register(proxy, …)`.
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
 * Small world tag for live numbers and short marks («230 V», «L1»): billboard text with a constant on-screen
 * size on the overlay layer (never blurred, ≥ 16 px). Names of parts are HUD callouts instead (UI_API §5).
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
