/**
 * Rich-text mini-markup (`@/text/rich`: **term**, _emphasis_, `formula`, x^2, U_{rms}, {cyan:text}) → real DOM
 * text: the same parser as the SDF labels, so both renderers agree on every run; the result is selectable,
 * copyable and readable by screen readers (sup/sub, em, strong are semantic).
 */
import { hex } from '@/style/palette';
import { parseRich, type Run } from '@/text/rich';
import { mathMarkup } from '@/ui3d/widgets/math';

/** Formulas up to this length never wrap (UI_API §2). */
const NOWRAP_FORMULA = 28;

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

/** Fill `el` with the rich text (replaces its children). */
export function setRich(el: HTMLElement, source: string, rich = true): void {
  const frag = document.createDocumentFragment();
  // the same pre-pass as the SDF Label (V_oc → V_{oc}); D1 moves `mathMarkup` into `@/text`
  for (const run of parseRich(rich ? mathMarkup(source) : source, rich)) frag.append(runNode(run));
  el.replaceChildren(frag);
}

/** A new element holding rich text. */
export function richEl(tag: string, cls: string, source: string): HTMLElement {
  const el = document.createElement(tag);
  el.className = cls;
  setRich(el, source);
  return el;
}
