/**
 * DOM backend of the QA hook `window.__ui` (docs/HUD_DOM.md §12; facade in `hud/debug.ts`): answers from the
 * `[data-ui]` elements of `#kd-hud` with the same numbers the WebGL backend reports — CSS px boxes (centre +
 * size) from `getBoundingClientRect()`. Visible = rendered box, no `hidden` / `inert` ancestor, opacity
 * product along the chain > 0.5. QA only: every call reads layout, nothing runs per frame.
 */
import type { ChromeRegion, OffscreenNode, UiBackend, UiBox, UiTextSize } from '@/hud/debug';
import type { Hud } from '@/hud/shell';
import { setClass } from './dom';

/** Interactive elements (HUD_DOM §12). */
const TARGETS = 'button, input, select, textarea, a[href], [role="slider"], [role="radio"], [role="switch"], [role="tab"], [tabindex]';

function shown(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement) || !el.isConnected || el.closest('[hidden], [inert], .kd-off')) return false;
  if (el.getClientRects().length === 0) return false;
  let opacity = 1;
  for (let p: Element | null = el; p && p !== document.body; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (cs.visibility === 'hidden' || cs.display === 'none') return false;
    opacity *= Number(cs.opacity);
  }
  return opacity > 0.5;
}

function box(el: Element): UiBox {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
}

/**
 * Pointer target size (CSS px): the box, enlarged by the invisible hit extension of base.css (an absolutely
 * placed `::before` with negative offsets) — the DOM counterpart of the WebGL `minHit`.
 */
function hitSize(el: Element): { w: number; h: number } {
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el, '::before');
  if (cs.content === 'none' || cs.position !== 'absolute' || cs.pointerEvents === 'none') return { w: r.width, h: r.height };
  const out = (v: string): number => Math.max(0, -(parseFloat(v) || 0));
  return { w: r.width + out(cs.left) + out(cs.right), h: r.height + out(cs.top) + out(cs.bottom) };
}

/** QA name of an element: its own `data-ui`, else `<owner>>tag` of the nearest named ancestor. */
function nameOf(el: Element): string {
  const own = el.getAttribute('data-ui');
  if (own) return own;
  const owner = el.parentElement?.closest('[data-ui]')?.getAttribute('data-ui');
  const tag = el.tagName.toLowerCase();
  return owner ? `${owner}>${tag}` : `${tag}?`;
}

const isDisabled = (el: HTMLElement): boolean =>
  (el as HTMLButtonElement).disabled === true || el.getAttribute('aria-disabled') === 'true';

/** Scroll containers between an element and the layer root. */
function scrollers(el: Element, root: Element): Element[] {
  const out: Element[] = [];
  for (let p = el.parentElement; p && p !== root; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') out.push(p);
  }
  return out;
}

export function domBackend(hud: Hud, root: HTMLElement): UiBackend & { setVisible(on: boolean): void } {
  const all = (selector: string): HTMLElement[] => [...root.querySelectorAll(selector)].filter(shown);
  const unitPx = (): number => hud.metrics.pxPerUnit;

  const textSizes = (): UiTextSize[] => {
    const out: UiTextSize[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const seen = new Map<Element, boolean>();
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      const text = t.textContent?.trim() ?? '';
      const parent = t.parentElement;
      if (text === '' || !parent) continue;
      let visible = seen.get(parent);
      if (visible === undefined) seen.set(parent, (visible = shown(parent)));
      if (!visible) continue;
      // an index (sup / sub) belongs to its base glyph's size, as in the SDF layout of a run
      const sized = parent.closest('sup, sub')?.parentElement ?? parent;
      const px = parseFloat(getComputedStyle(sized).fontSize);
      out.push({ name: nameOf(parent.closest('[data-ui]') ?? parent), text: text.slice(0, 24), units: px / unitPx(), px });
    }
    return out;
  };

  return {
    locate(name) {
      const el = [...root.querySelectorAll(`[data-ui="${CSS.escape(name)}"]`)].find(shown);
      return el ? box(el) : null;
    },
    names: () => all('[data-ui]').map((el) => el.getAttribute('data-ui') ?? ''),
    offscreen(opts) {
      const margin = opts.margin ?? 0;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const out: OffscreenNode[] = [];
      for (const el of all(TARGETS)) {
        if (isDisabled(el)) continue;
        const b = box(el);
        // the part its scroll containers leave visible: scrolled out is not off-screen (the user scrolls to it)
        let y0 = b.y - b.h / 2;
        let y1 = b.y + b.h / 2;
        for (const c of scrollers(el, root)) {
          const r = c.getBoundingClientRect();
          y0 = Math.max(y0, r.top);
          y1 = Math.min(y1, r.bottom);
        }
        const name = nameOf(el);
        if (y1 - y0 < (opts.partial ? b.h - 1 : 1)) {
          if (opts.clipped) out.push({ name, ...b, reason: 'clipped' });
        } else if (b.x - b.w / 2 < -margin || b.x + b.w / 2 > vw + margin || y0 < -margin || y1 > vh + margin)
          out.push({ name, ...b, reason: 'viewport' });
      }
      return out;
    },
    smallTargets(minCssPx) {
      const k = unitPx();
      const out: string[] = [];
      for (const el of all(TARGETS)) {
        if (isDisabled(el) || el.matches('[tabindex="-1"]')) continue;
        const b = hitSize(el);
        const w = minCssPx === undefined ? b.w / k : b.w;
        const h = minCssPx === undefined ? b.h / k : b.h;
        const limit = minCssPx === undefined ? 43.5 : minCssPx - 0.5;
        if (w < limit || h < limit) out.push(`${el.tagName.toLowerCase()}:${nameOf(el)} ${w.toFixed(0)}x${h.toFixed(0)}`);
      }
      return out;
    },
    smallText: (minCssPx) =>
      textSizes()
        .filter((t) => t.px < minCssPx - 0.05)
        .map((t) => `${t.name}: ${t.px.toFixed(1)} «${t.text}»`),
    textSizes,
    region(name: ChromeRegion) {
      const el = [...root.querySelectorAll(`[data-region="${name}"]`)].find(shown);
      return el ? box(el) : null;
    },
    setVisible: (on) => setClass(root, 'kd-off', !on),
  };
}
