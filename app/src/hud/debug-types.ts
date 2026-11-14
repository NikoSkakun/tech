/**
 * Types of the QA hook `window.__ui` (`debug.ts`): the facade asks the DOM backend (`@/hud-dom` core/qa.ts)
 * first and falls back to the WebGL backend (`debug-gl.ts`), so a half-ported HUD answers every name
 * (docs/HUD_DOM.md §12). Boxes are CSS px: centre + size.
 */

export interface UiBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface OffscreenNode extends UiBox {
  name: string;
  reason: 'viewport' | 'clipped';
}

/** One visible piece of interface text: its size in HUD units (px-eq at 1080p) and in real CSS px. */
export interface UiTextSize {
  /** QA name of the nearest named element / node (or `?`). */
  name: string;
  /** The first characters of the text. */
  text: string;
  units: number;
  px: number;
}

/** Two chrome regions whose boxes intersect (`w`, `h`: size of the intersection, CSS px). */
export interface UiOverlap {
  a: string;
  b: string;
  w: number;
  h: number;
}

/** Chrome regions `overlaps()` compares (HUD_DOM §12). */
export const CHROME_REGIONS = ['header', 'spine', 'system', 'column', 'board', 'navigator', 'sheet'] as const;
export type ChromeRegion = (typeof CHROME_REGIONS)[number];

/** What a renderer of the interface answers for `__ui`; every member reports only what that renderer draws. */
export interface UiBackend {
  /** Centre and size of the first visible element / node with this QA name, or null. */
  locate(name: string): UiBox | null;
  /** QA names of everything visible. */
  names(): string[];
  /** Interactive targets whose visible part leaves the viewport (or, with `clipped`, their scroll view). */
  offscreen(opts: { clipped?: boolean; partial?: boolean; margin?: number }): OffscreenNode[];
  /** Interactive targets below 44 px-eq (or below `minCssPx` real CSS px) in either direction. */
  smallTargets(minCssPx?: number): string[];
  /** Visible text below `minCssPx` real CSS px: `"<name>: <px> «text»"`. */
  smallText(minCssPx: number): string[];
  /** Every visible piece of interface text with its size. */
  textSizes(): UiTextSize[];
  /** Box of a chrome region this renderer draws (null when it does not draw it or it is hidden). */
  region(name: ChromeRegion): UiBox | null;
}
