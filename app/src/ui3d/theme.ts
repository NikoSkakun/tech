/**
 * UI design tokens (STYLE_GUIDE §6): type scale, radii, spacing, hit sizes, panel look, paint layers.
 * All sizes are px-equivalent units (px at 1080p).
 */
import {
  FLOW,
  PLANT_TYPE as STYLE_PLANT_TYPE,
  UI_STATUS,
  type AccentName,
  type ColorLike,
  type ColorToken,
  type PlantTypeName,
} from '@/style';
import type { UiNode } from './core/node';

export const UI = {
  /** Type scale. `caption` is the smallest text the kit ever draws. */
  text: { hero: 66, h1: 36, h2: 26, h3: 21, body: 19, small: 17, caption: 15 },
  /** World-anchored labels must stay at least this many real CSS px tall (audit of the engine look-dev). */
  minWorldLabelPx: 16,
  radius: { panel: 22, card: 16, control: 12, inset: 8 },
  /** Minimum pointer target (STYLE_GUIDE §6). */
  hit: 44,
  pad: { panel: 26, card: 18 },
  gap: { xs: 4, sm: 8, md: 12, lg: 18, xl: 26 },
  /**
   * Hologlass body opacity. Blending happens in linear light, where the style guide's 78–88 % would let a
   * bright diorama show through at about half its display brightness (the audit's complaint). At 0.985 a pure
   * white backdrop lifts the panel to ≈ 13 % display grey: white text keeps a contrast above 13:1, and a
   * trace of the scene still reads as glass.
   */
  panelOpacity: 0.985,
  /** Paint layers of a surface (text of a lower layer never draws over a higher layer's shapes). */
  layer: { world: 0, base: 1, popup: 2, modal: 3, tip: 4 },
} as const;

export const TEXT_COLOR = { main: 'white', dim: 'mist', mute: 'steel' } as const satisfies Record<
  string,
  ColorToken
>;

/**
 * Plant-type palette (STYLE_GUIDE §2.2, DECISIONS §29) — the `@/style` map (`plantType.*` tokens), constant across
 * charts, chips and the journey map. Prefer importing `PLANT_TYPE` from `@/style`; this re-export additionally keeps
 * the early keys `pumped` / `geo` as deprecated aliases of `pumpedStorage` / `geothermal`.
 */
export const PLANT_TYPE = {
  ...STYLE_PLANT_TYPE,
  /** @deprecated use `pumpedStorage` */
  pumped: STYLE_PLANT_TYPE.pumpedStorage,
  /** @deprecated use `geothermal` */
  geo: STYLE_PLANT_TYPE.geothermal,
} as const satisfies Record<string, ColorToken>;

/** Plant-type key incl. the deprecated aliases (`PlantTypeName` from `@/style` has only the canonical keys). */
export type PlantType = PlantTypeName | 'pumped' | 'geo';

/** Status colours of gauges and chips (STYLE_GUIDE §2.2: `ui.warning` = amber) — `UI_STATUS` from `@/style`. */
export const STATUS = UI_STATUS;

export { FLOW, UI_STATUS };

const accents = new WeakMap<UiNode, ColorLike>();

/** Theme a subtree with an accent colour (normally the chapter accent). */
export function setAccent(node: UiNode, accent: ColorLike): void {
  accents.set(node, accent);
  node.surface?.invalidateStructure();
}

/** Accent in effect for a node: its own, or the nearest ancestor's; `cyan` (affordance colour) by default. */
export function accentOf(node: UiNode | null): ColorLike {
  for (let n = node; n; n = n.parent) {
    const a = accents.get(n);
    if (a !== undefined) return a;
  }
  return 'cyan' satisfies AccentName;
}
