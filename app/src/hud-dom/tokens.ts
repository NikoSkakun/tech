/**
 * Design tokens as CSS custom properties, generated from the one source of truth (`@/style` palette and the
 * `UI` scale of `@/ui3d/theme`), so the DOM interface and the WebGL world can never drift apart.
 *
 *   --c-<token>      palette colours: --c-cyan, --c-bg-indigo, --c-mist … (hex)
 *   --c-<token>-rgb  the same as "r g b" for `rgb(var(--c-cyan-rgb) / 40%)`
 *   --accent(-rgb)   chapter accent (set per chapter on the root)
 *   --u              CSS px per HUD unit (px-equivalent at 1080p; `HudMetrics.pxPerUnit`)
 *   --t-<size>       type scale in units (hero, h1 … caption); --r-<kind> radii; --hit pointer target
 */
import { ACCENT, BG, NEUTRAL, hex, type ColorLike } from '@/style/palette';
import { UI } from '@/ui3d/theme';

function rgbTriplet(hexColor: string): string {
  const n = parseInt(hexColor.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** Static tokens: written once on the DOM root. */
export function applyTokens(root: HTMLElement): void {
  const set = (name: string, value: string): void => root.style.setProperty(name, value);
  const colour = (name: string, value: string): void => {
    set(`--c-${name}`, value);
    set(`--c-${name}-rgb`, rgbTriplet(value));
  };
  for (const [k, v] of Object.entries(BG)) colour(`bg-${k}`, v);
  for (const [k, v] of Object.entries(ACCENT)) colour(k, v);
  for (const [k, v] of Object.entries(NEUTRAL)) colour(k, v);
  for (const [k, v] of Object.entries(UI.text)) set(`--t-${k}`, String(v));
  for (const [k, v] of Object.entries(UI.radius)) set(`--r-${k}`, String(v));
  set('--hit', String(UI.hit));
  set('--panel-opacity', String(UI.panelOpacity));
}

/** Chapter accent (any palette token or colour). */
export function applyAccent(root: HTMLElement, accent: ColorLike): void {
  const value = hex(accent);
  root.style.setProperty('--accent', value);
  root.style.setProperty('--accent-rgb', rgbTriplet(value));
}
