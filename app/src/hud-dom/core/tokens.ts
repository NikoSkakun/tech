/**
 * Design tokens as CSS custom properties, generated from the one source of truth (`@/style` palette and
 * motion, the `UI` scale of `@/ui3d/theme`), so the DOM interface and the WebGL world can never drift apart.
 *
 *   --c-<token>        every palette token (hex): --c-cyan, --c-cyan-light, --c-bg-indigo, --c-wireBrown,
 *                      groups --c-ui-ok, --c-plantType-wind, --c-flow-active, --c-phase-L1 …
 *   --c-<token>-rgb    the same as "r g b" for `rgb(var(--c-cyan-rgb) / 40%)`
 *   --accent(-rgb)     chapter accent (set per chapter on the root; a subtree may override it)
 *   --u                CSS px per HUD unit (px-equivalent at 1080p; `HudMetrics.pxPerUnit`, set on layout)
 *   --t-<size>         type scale in units (hero, h1 … caption); --r-<kind> radii; --hit pointer target
 *   --dur-<motion>     durations of `MOTION` presets (ms); --ease-<motion> their easings as CSS `linear()`
 */
import { EASE } from '@/engine/tween';
import { MOTION } from '@/style/motion';
import {
  ACCENT,
  BG,
  FLOW,
  NEUTRAL,
  PLANT_TYPE,
  SEMANTIC,
  STANDARD,
  UI_STATUS,
  hex,
  type ColorLike,
} from '@/style/palette';
import { UI } from '@/ui3d/theme';

function rgbTriplet(hexColor: string): string {
  const n = parseInt(hexColor.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** Every palette colour as [CSS variable suffix, palette token]. */
export function colorTokens(): [string, string][] {
  const out: [string, string][] = [];
  for (const k of Object.keys(BG)) out.push([`bg-${k}`, `bg.${k}`]);
  for (const k of [...Object.keys(ACCENT), ...Object.keys(NEUTRAL)])
    out.push([k, k], [`${k}-light`, `${k}.light`], [`${k}-dark`, `${k}.dark`]);
  for (const k of Object.keys(STANDARD)) out.push([k, k]);
  for (const k of Object.keys(UI_STATUS)) out.push([`ui-${k}`, `ui.${k}`]);
  for (const k of Object.keys(PLANT_TYPE)) out.push([`plantType-${k}`, `plantType.${k}`]);
  for (const k of Object.keys(FLOW)) out.push([`flow-${k}`, `flow.${k}`]);
  // the three line conductors of a three-phase system (SEMANTIC.phaseL1…L3)
  for (const k of ['L1', 'L2', 'L3'] as const) out.push([`phase-${k}`, SEMANTIC[`phase${k}`]]);
  return out;
}

/** An engine easing sampled into a CSS `linear()` function (exact enough for ≤ 0.7 s micro-interactions). */
export function cssEase(fn: (t: number) => number, samples = 24): string {
  const pts: string[] = [];
  for (let i = 0; i <= samples; i++) pts.push(String(Math.round(fn(i / samples) * 1000) / 1000));
  return `linear(${pts.join(', ')})`;
}

/** Static tokens: written once on the DOM root. */
export function applyTokens(root: HTMLElement): void {
  const set = (name: string, value: string): void => root.style.setProperty(name, value);
  for (const [name, token] of colorTokens()) {
    const value = hex(token as ColorLike);
    set(`--c-${name}`, value);
    set(`--c-${name}-rgb`, rgbTriplet(value));
  }
  for (const [k, v] of Object.entries(UI.text)) set(`--t-${k}`, String(v));
  for (const [k, v] of Object.entries(UI.radius)) set(`--r-${k}`, String(v));
  set('--hit', String(UI.hit));
  set('--panel-opacity', String(UI.panelOpacity));
  for (const [k, preset] of Object.entries(MOTION)) {
    set(`--dur-${k}`, `${Math.round(preset.duration * 1000)}ms`);
    set(`--ease-${k}`, cssEase(EASE[preset.ease]));
  }
}

/** Chapter accent (any palette token or colour) on `el` and its subtree. */
export function applyAccent(el: HTMLElement, accent: ColorLike): void {
  const value = hex(accent);
  el.style.setProperty('--accent', value);
  el.style.setProperty('--accent-rgb', rgbTriplet(value));
}
