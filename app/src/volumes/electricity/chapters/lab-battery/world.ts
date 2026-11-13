/**
 * Shared world of the lab: the podium every set stands on, the chapter's material palette and small helpers.
 * Units: 1 world unit ≈ "one hand" of the giant models — the hero 21700 cell is 2.8 units tall (×40 real size).
 */
import {
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  TorusGeometry,
  Vector2,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';
import { toOverlay, type ChapterContext } from '@/engine/api';
import { K, SEMANTIC, col, type ColorLike, type KGlowMaterial } from '@/style';
import { Text3D } from '@/text';

/** Radius of the podium top (sets stay inside ≈ 3.9). */
export const PODIUM_R = 4.3;
/** Height of the podium top above the studio floor. */
export const PODIUM_H = 0.26;

/** Materials shared by all sets (one program each; do not mutate — make your own for animated ones). */
export function createMats() {
  const copper = col('orange').lerp(col('wireBrown'), 0.4);
  return {
    steel: K.metal({ color: 'steel', specular: 0.7 }),
    dark: K.toon({ color: 'slate', rim: 0.8 }),
    ink: K.toon({ color: 'ink', rim: 1.1 }),
    light: K.toon({ color: 'mist', gloss: 0.35 }),
    white: K.toon({ color: 'white', highlight: 0.2 }),
    copper: K.metal({ color: copper, specular: 0.85, shininess: 60 }),
    alu: K.metal({ color: 'mist', specular: 0.8 }),
    graphite: K.toon({ color: col('ink').lerp(col('slate'), 0.35), rim: 1.2 }),
    cathode: K.toon({ color: 'violet', gloss: 0.3 }),
    teal: K.toon({ color: 'teal', gloss: 0.4 }),
    plus: K.toon({ color: SEMANTIC.dcPlus, gloss: 0.5 }),
    minus: K.toon({ color: SEMANTIC.dcMinus, gloss: 0.5 }),
    glass: K.glass({ color: 'sky', opacity: 0.1, edgeOpacity: 0.5 }),
    electrolyte: K.glass({ color: 'sky', opacity: 0.22, edgeOpacity: 0.35 }),
    plinth: K.toon({ gradient: { bottom: 'bg.indigo', top: 'slate', range: [0, 0.5] }, rim: 1.2 }),
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

export interface Podium {
  group: Group;
  /** Glowing accent ring (its intensity "breathes" in `update`). */
  ring: KGlowMaterial;
  update(t: number): void;
}

/** The round studio podium (lathe profile with fillets, darker top inset, lime accent ring). */
export function createPodium(ctx: ChapterContext): Podium {
  const g = group('podium');
  const R = PODIUM_R;
  const H = PODIUM_H;
  const profile = [
    new Vector2(0, 0),
    new Vector2(R + 0.1, 0),
    new Vector2(R + 0.18, 0.04),
    new Vector2(R + 0.2, 0.12),
    new Vector2(R + 0.14, H - 0.03),
    new Vector2(R + 0.02, H),
    new Vector2(0, H),
  ];
  const plate = mesh(
    new LatheGeometry(profile, 128),
    K.toon({ gradient: { bottom: 'bg.indigo', top: 'slate', range: [0, H] }, rim: 1.4 }),
  );
  const top = mesh(
    new CylinderGeometry(R - 0.12, R - 0.12, 0.02, 128),
    K.toon({ color: col('bg.indigo').lerp(col('slate'), 0.32), highlight: 0.06 }),
    0,
    H + 0.004,
    0,
    false,
  );
  const ring = K.glow({
    color: ctx.manifest.theme.accent,
    intensity: 1.5,
    falloff: 0,
    keepHue: true,
    whiten: 0,
  });
  const accent = new Mesh(new TorusGeometry(R - 0.05, 0.02, 8, 192), ring);
  accent.rotation.x = Math.PI / 2;
  accent.position.y = H + 0.012;
  g.add(plate, top, accent);
  return { group: g, ring, update: (t) => (ring.intensity = 1.35 + Math.sin(t * 1.3) * 0.2) };
}

/**
 * Small world tag for live numbers (voltages on electrodes, masses on scales): billboard text with a constant
 * on-screen size on the overlay layer. Part names use the HUD's callouts instead (UI_API §5).
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
