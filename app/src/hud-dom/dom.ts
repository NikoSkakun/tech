/**
 * Tiny DOM helpers of the DOM interface (no framework, see docs/HUD_DOM.md §4): element factory and cached
 * setters, so per-frame code writes to the DOM only when a value really changed (no layout thrash).
 */

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
