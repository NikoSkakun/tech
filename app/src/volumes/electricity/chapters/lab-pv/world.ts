/**
 * Shared world of the lab: the podium every studio set stands on, the chapter's material palette and small
 * helpers. Units: the look presets are tuned for a ≈ 3.4-unit subject; kit models (metres) are placed with a
 * uniform scale — the hero module ЛМ-440 at ×`MODULE_SCALE`, the house at ×`HOUSE_SCALE`.
 */
import { Group, type BufferGeometry, type Material, Mesh, type Object3D } from 'three';
import { toOverlay, type ChapterContext } from '@/engine/api';
import { Builder, type KitModel } from '@/kit';
import { K, SEMANTIC, col, type ColorLike, type KGlowMaterial } from '@/style';
import { Text3D } from '@/text';

/** Radius of the podium top (sets stay inside ≈ 3.9). */
export const PODIUM_R = 4.3;
/** Height of the podium top above the studio floor. */
export const PODIUM_H = 0.26;
/** World units per metre of the hero module (1.72 m → 3.6 units). */
export const MODULE_SCALE = 2.1;
/** World units per metre of the house diorama (12 m → 5.4 units). */
export const HOUSE_SCALE = 0.45;

/** Materials shared by all sets (one program each; do not mutate — make your own for animated ones). */
export function createMats() {
  return {
    steel: K.metal({ color: 'steel', specular: 0.7 }),
    alu: K.metal({ color: col('mist').lerp(col('steel'), 0.3), specular: 0.8 }),
    dark: K.toon({ color: 'slate', rim: 0.8 }),
    ink: K.toon({ color: 'ink', rim: 1.1 }),
    light: K.toon({ color: 'mist', gloss: 0.35 }),
    white: K.toon({ color: 'white', highlight: 0.2 }),
    silver: K.metal({ color: 'mist', specular: 0.9, shininess: 70 }),
    plus: K.toon({ color: SEMANTIC.dcPlus, gloss: 0.5 }),
    minus: K.toon({ color: SEMANTIC.dcMinus, gloss: 0.5 }),
    nRegion: K.toon({ color: SEMANTIC.nRegion, gloss: 0.3 }),
    pRegion: K.toon({ color: SEMANTIC.pRegion, gloss: 0.3 }),
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

/** Let every mesh of a kit model cast and receive shadows (kit models leave that to the scene). */
export function shadows<T extends Object3D>(object: T, cast = true): T {
  object.traverse((o) => {
    if ((o as Mesh).isMesh) {
      o.castShadow = cast;
      o.receiveShadow = true;
    }
  });
  return object;
}

export interface Podium {
  model: KitModel;
  ring: KGlowMaterial;
  update(t: number): void;
}

/** The round studio podium: lathe profile with fillets, darker top inset and a breathing accent ring. */
export function createPodium(ctx: ChapterContext): Podium {
  const R = PODIUM_R;
  const H = PODIUM_H;
  const b = new Builder('podium');
  b.lathe(
    [[0, 0], [R + 0.1, 0], [R + 0.18, 0.04], [R + 0.2, 0.12], [R + 0.14, H - 0.03], [R + 0.02, H], [0, H]],
    { seg: 128, slot: 'toon', c: ['bg.indigo', 'slate'] },
  );
  b.cyl(R - 0.12, 0.02, { seg: 128, slot: 'matte', c: col('bg.indigo').lerp(col('slate'), 0.32), at: [0, H - 0.008, 0] });
  const model = b.build();
  shadows(model.group, false);
  const ring = K.glow({ color: ctx.manifest.theme.accent, intensity: 1.5, falloff: 0, keepHue: true, whiten: 0 });
  const accent = new Mesh(new Builder('ring').ring(R - 0.05, 0.02, { seg: 192, tubeSeg: 8 }).geometry('toon'), ring);
  accent.position.y = H + 0.016;
  model.group.add(accent);
  return { model, ring, update: (t) => (ring.intensity = 1.35 + Math.sin(t * 1.3) * 0.2) };
}

/**
 * Small world tag for live numbers (a counter over the 1 m² frame, volts on a string): billboard text with a
 * constant on-screen size on the overlay layer. Part names use the HUD's callouts instead (UI_API §5).
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
