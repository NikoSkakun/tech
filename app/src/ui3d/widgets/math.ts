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
