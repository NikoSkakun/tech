/**
 * Web fonts of the DOM interface: the same families as the SDF atlases (THIRD_PARTY.md), subset to the
 * course's Unicode coverage as WOFF2 in `public/fonts/web/` (no network beyond the app's own origin).
 *
 * Families (CSS names are private to the app, so a system font of the same name can never take over):
 *   'K Display' — Nunito 800 (headings, numbers), falls back to Fira Sans 700 for glyphs Nunito lacks
 *   'K Body'    — Fira Sans 400 / 400 italic / 500 / 600 / 700
 *   'K Mono'    — JetBrains Mono 500 (formulas, units, counters)
 *   'K Symbols' — Noto Sans Math + Noto Sans Symbols 2, restricted by `unicode-range` to arrows, maths and
 *                 shapes, so the browser fetches them only when such a glyph is on screen
 */

interface Face {
  family: string;
  file: string;
  weight: string;
  style?: string;
  range?: string;
}

const SYMBOL_RANGE = 'U+2190-21FF, U+2200-22FF, U+2300-23FF, U+25A0-25FF, U+2600-27BF, U+27C0-27EF, U+29C8';

const FACES: readonly Face[] = [
  { family: 'K Display', file: 'nunito-800', weight: '800' },
  { family: 'K Display Fallback', file: 'fira-700', weight: '800' },
  { family: 'K Body', file: 'fira-400', weight: '400' },
  { family: 'K Body', file: 'fira-400i', weight: '400', style: 'italic' },
  { family: 'K Body', file: 'fira-500', weight: '500' },
  { family: 'K Body', file: 'fira-600', weight: '600' },
  { family: 'K Body', file: 'fira-700', weight: '700' },
  { family: 'K Mono', file: 'jbmono-500', weight: '500' },
  { family: 'K Symbols', file: 'noto-math', weight: '100 900', range: SYMBOL_RANGE },
  { family: 'K Symbols 2', file: 'noto-sym2', weight: '100 900', range: SYMBOL_RANGE },
];

/** Faces every first screen needs: loaded before the DOM interface is shown (no flash of fallback text). */
const FIRST: readonly string[] = ['nunito-800', 'fira-400', 'fira-600', 'jbmono-500'];

let ready: Promise<void> | null = null;

/** Register all faces and wait for the first-screen ones. Idempotent. */
export function loadWebFonts(baseUrl: string = document.baseURI): Promise<void> {
  if (ready) return ready;
  const base = new URL('fonts/web/', baseUrl);
  const waits: Promise<unknown>[] = [];
  for (const f of FACES) {
    const face = new FontFace(f.family, `url(${new URL(`${f.file}.woff2`, base).href}) format('woff2')`, {
      weight: f.weight,
      style: f.style ?? 'normal',
      unicodeRange: f.range ?? 'U+0-10FFFF',
      display: 'block',
    });
    document.fonts.add(face);
    if (FIRST.includes(f.file)) waits.push(face.load());
  }
  ready = Promise.all(waits).then(() => undefined);
  return ready;
}
