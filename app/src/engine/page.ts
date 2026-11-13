/**
 * Page plumbing for touch browsers (F5, `docs/MOBILE.md`): the page must never zoom, scroll, bounce, pull to
 * refresh or select text — every gesture belongs to the canvas. The CSS in `index.html`
 * (`overscroll-behavior`, `touch-action`) covers current browsers; the listeners here cover the rest
 * (Safari's proprietary gesture events, older iOS without `overscroll-behavior`, double-tap zoom, focus theft).
 * Nothing here needs a secure context, and nothing changes for mouse input.
 */

export function installPagePlumbing(canvas: HTMLCanvasElement, doc: Document = document): () => void {
  const offs: (() => void)[] = [];
  const on = (target: EventTarget, type: string, fn: (e: Event) => void, opts?: AddEventListenerOptions): void => {
    target.addEventListener(type, fn, opts);
    offs.push(() => target.removeEventListener(type, fn, opts));
  };
  const prevent = (e: Event): void => {
    if (e.cancelable) e.preventDefault();
  };
  /** A real text field (the hidden search input of the glossary) keeps its native behaviour. */
  const editable = (t: EventTarget | null): boolean => {
    const el = t as HTMLElement | null;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable === true);
  };

  // Safari (iOS and macOS trackpads): page pinch-zoom
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) on(doc, type, prevent, { passive: false });
  // rubber-band scrolling / pull-to-refresh where `overscroll-behavior` is not supported (iOS < 16)
  on(doc, 'touchmove', (e) => !editable(e.target) && prevent(e), { passive: false });
  // A finished touch on the canvas has no default action we want: no synthetic mouse events, no double-tap
  // zoom, and above all no focus change — the browser would move the focus to the canvas right after our
  // pointer handlers ran and take it away from the hidden text field a tap has just opened (`touch/text-entry`).
  on(canvas, 'touchend', prevent, { passive: false });
  // long-press must not start text selection, a drag ghost or the callout menu
  on(canvas, 'selectstart', prevent);
  on(canvas, 'dragstart', prevent);
  return () => {
    for (const off of offs) off();
    offs.length = 0;
  };
}
