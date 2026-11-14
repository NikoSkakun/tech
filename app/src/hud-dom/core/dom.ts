/**
 * Tiny DOM helpers of the DOM interface (no framework, see docs/HUD_DOM.md §4): element factory and cached
 * setters, so per-frame code writes to the DOM only when a value really changed (no layout thrash).
 * Also: `bindVisible` (per-frame predicate → fade + room give-back) and `scrollArea` (native scroll plate).
 */

import { presence } from './motion';

type Attrs = Record<string, string | number | boolean | null | undefined>;
type Child = Node | string | null | undefined | false;

/** `h('div.panel.glass', { 'data-ui': 'step-panel' }, child, …)` — tag with optional `.class` suffixes. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K | `${K}.${string}`,
  attrs: Attrs | null = null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name as K);
  if (classes.length) el.className = classes.join(' ');
  if (attrs)
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      el.setAttribute(k, v === true ? '' : String(v));
    }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

const lastText = new WeakMap<Node, string>();
/** Set `textContent` only when it differs from what this helper wrote last. */
export function setText(el: HTMLElement, text: string): void {
  if (lastText.get(el) === text) return;
  lastText.set(el, text);
  el.textContent = text;
}

const lastStyle = new WeakMap<HTMLElement, Map<string, string>>();
/** Set a style property (or `--custom` property) only when it changed. */
export function setStyle(el: HTMLElement, prop: string, value: string): void {
  let m = lastStyle.get(el);
  if (!m) lastStyle.set(el, (m = new Map()));
  if (m.get(prop) === value) return;
  m.set(prop, value);
  el.style.setProperty(prop, value);
}

/** Toggle a class only when the state changes (the DOM call itself is cheap, this keeps call sites terse). */
export function setClass(el: HTMLElement, name: string, on: boolean): void {
  if (el.classList.contains(name) !== on) el.classList.toggle(name, on);
}

/** A `When` of the step UI: a constant or a per-frame predicate. */
export type When = boolean | (() => boolean);

const holds = (w: When): boolean => (typeof w === 'function' ? w() : w);

/**
 * Animated show / hide of an element bound to a per-frame predicate, with the WebGL HUD's semantics
 * (`hud/dock-build.ts bindVisible`): it fades out with a short drop and then leaves the layout (`hidden`), so
 * its room is given back; it comes back with a short rise. Returns the per-frame tick (null for `undefined`).
 * The element's region notices the size change through its `ResizeObserver` (no layout read here).
 */
export function bindVisible(el: HTMLElement, when: When | undefined, opts: { dy?: number } = {}): (() => void) | null {
  if (when === undefined) return null;
  const p = presence(el);
  if (!holds(when)) p.conceal({ instant: true });
  return () => {
    const on = holds(when);
    if (on === p.shown) return;
    if (on) p.reveal({ dy: opts.dy ?? -6, scale: 0.98 });
    else p.conceal({ dy: opts.dy ?? -6, scale: 0.98 });
  };
}

/**
 * Make `el` a native vertical scroll area (HUD_DOM §3): wheel and vertical swipes scroll the plate (never the
 * page, never the camera), horizontal drags stay free for sliders inside. Class `kd-scroll` in base.css.
 */
export function scrollArea<T extends HTMLElement>(el: T): T {
  el.classList.add('kd-scroll');
  return el;
}
