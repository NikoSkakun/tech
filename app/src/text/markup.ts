/**
 * The one text pipeline of both renderers (SDF `Label` and the DOM interface, docs/HUD_DOM.md §5):
 * document notation (`V_oc`, `A^(1/3)`) → rich markup → styled runs. Pure, unit-tested.
 */
import { NBSP, parseRich, type Run } from './rich';

/**
 * The chapter documents write indices the plain way — `V_oc`, `I_sc`, `U_L`, `A^(1/3)`, `10^-19`. Turn them
 * into the text markup's sub/superscript groups (`V_{oc}`, `A^{1/3}`) so they are typeset properly.
 * An underscore that opens or closes `_emphasis_` is never touched (it is not between two word characters).
 */
export function mathMarkup(text: string): string {
  return text
    .replace(/(?<=[\p{L}\p{N}])_([\p{L}\p{N}]{1,5})(?![\p{L}\p{N}_{])/gu, '_{$1}')
    .replace(/\^\(([^()]{1,10})\)/g, '^{$1}')
    .replace(/\^([−-]?\d{2,})/g, '^{$1}');
}

/** Formulas up to this many characters (markup included) never wrap (UI_API §2). */
export const NOWRAP_FORMULA = 28;

const SHORT_FORMULA = new RegExp(`\`[^\`\\n]{1,${NOWRAP_FORMULA}}\``, 'g');

/**
 * Source text as written in content and chapter code → runs. With `rich` (default): `mathMarkup`, short
 * formulas made unbreakable (their inner spaces become no-break spaces), then `parseRich`. Without: only the
 * character normalisation of `parseRich`.
 */
export function richRuns(source: string, rich = true): Run[] {
  if (!rich) return parseRich(source, false);
  return parseRich(
    mathMarkup(source).replace(SHORT_FORMULA, (m) => m.replace(/ /g, NBSP)),
    true,
  );
}
