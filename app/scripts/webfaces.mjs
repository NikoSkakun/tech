// Web font faces of the DOM interface (docs/HUD_DOM.md §5): the same OFL families as the SDF atlases, subset to
// the course charset as WOFF2 in public/fonts/web/. Shared by build-webfonts.mjs and font-coverage.mjs; the
// runtime registers the same files in src/hud-dom/core/fonts.ts (keep the three in step).

/**
 * Code points the symbol faces are restricted to by `unicode-range` (combining marks for symbols, letterlike,
 * arrows, maths, shapes, dingbats): the browser fetches them only when such a glyph is on screen.
 */
export const SYMBOL_RANGES = [
  [0x20d0, 0x20ff],
  [0x2100, 0x214f],
  [0x2190, 0x21ff],
  [0x2200, 0x22ff],
  [0x2300, 0x23ff],
  [0x25a0, 0x25ff],
  [0x2600, 0x27bf],
  [0x27c0, 0x27ef],
  [0x29c8, 0x29c8],
];

/** file name (public/fonts/web/<file>.woff2) → source TTF under node_modules/@expo-google-fonts/. */
export const WEB_FACES = {
  'nunito-800': 'nunito/800ExtraBold/Nunito_800ExtraBold.ttf',
  'fira-400': 'fira-sans/400Regular/FiraSans_400Regular.ttf',
  'fira-400i': 'fira-sans/400Regular_Italic/FiraSans_400Regular_Italic.ttf',
  'fira-500': 'fira-sans/500Medium/FiraSans_500Medium.ttf',
  'fira-600': 'fira-sans/600SemiBold/FiraSans_600SemiBold.ttf',
  'fira-700': 'fira-sans/700Bold/FiraSans_700Bold.ttf',
  'jbmono-500': 'jetbrains-mono/500Medium/JetBrainsMono_500Medium.ttf',
  'noto-math': 'noto-sans-math/400Regular/NotoSansMath_400Regular.ttf',
  'noto-sym2': 'noto-sans-symbols-2/400Regular/NotoSansSymbols2_400Regular.ttf',
};

/**
 * Font stacks the DOM text is drawn with (base.css `--display`, `--body`, `--mono`): a character is covered when
 * some face of its stack has it (symbol faces only inside SYMBOL_RANGES).
 */
export const WEB_STACKS = {
  display: ['nunito-800', 'fira-700', 'noto-math', 'noto-sym2'],
  body: ['fira-400', 'noto-math', 'noto-sym2'],
  'body italic': ['fira-400i', 'noto-math', 'noto-sym2'],
  'body 500': ['fira-500', 'noto-math', 'noto-sym2'],
  'body 600': ['fira-600', 'noto-math', 'noto-sym2'],
  'body 700': ['fira-700', 'noto-math', 'noto-sym2'],
  mono: ['jbmono-500', 'fira-400', 'noto-math', 'noto-sym2'],
};

export const isSymbolFace = (file) => file.startsWith('noto-');
export const inSymbolRange = (cp) => SYMBOL_RANGES.some(([a, b]) => cp >= a && cp <= b);
