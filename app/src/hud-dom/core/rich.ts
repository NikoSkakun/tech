/**
 * Rich text in the DOM (**term**, _emphasis_, `formula`, x^2, U_{rms}, V_oc, {cyan:text}): the runs come from
 * `richRuns` of `@/text`, the very function the SDF `Label` lays out, so both renderers agree on every run.
 * The result is selectable, copyable and readable by screen readers (sup/sub, em, strong are semantic).
 * Never `innerHTML`: content only ever becomes text nodes.
 */
import { hex } from '@/style/palette';
import { NOWRAP_FORMULA, richRuns, type Run } from '@/text';

function runNode(run: Run): Node {
  let node: Node = document.createTextNode(run.text);
  const wrap = (tag: string, cls?: string): void => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    el.append(node);
    node = el;
  };
  if (run.script === 1) wrap('sup');
  else if (run.script === -1) wrap('sub');
  if (run.mono) wrap('code', run.text.length <= NOWRAP_FORMULA ? 'f nowrap' : 'f');
  if (run.italic) wrap('em');
  if (run.bold) wrap('strong', run.color === 'accent' ? 'term' : undefined);
  if (run.color !== 'base' && run.color !== 'accent' && run.color !== 'formula') {
    const span = document.createElement('span');
    span.style.color = hex(run.color);
    span.append(node);
    node = span;
  }
  return node;
}

/** Rich text as a document fragment (for callers that assemble their own element). */
export function richFragment(source: string, rich = true): DocumentFragment {
  const frag = document.createDocumentFragment();
  for (const run of richRuns(source, rich)) frag.append(runNode(run));
  return frag;
}

const lastRich = new WeakMap<HTMLElement, string>();

/** Fill `el` with the rich text (replaces its children; no-op when the source did not change). */
export function setRich(el: HTMLElement, source: string, rich = true): void {
  const key = `${rich ? 1 : 0}${source}`;
  if (lastRich.get(el) === key) return;
  lastRich.set(el, key);
  el.replaceChildren(richFragment(source, rich));
}

/** A new element holding rich text. */
export function richEl(tag: string, cls: string, source: string): HTMLElement {
  const el = document.createElement(tag);
  el.className = cls;
  setRich(el, source);
  return el;
}
