// The one Unicode coverage of the course text, shared by the SDF atlas builder (build-fonts.mjs) and the
// WOFF2 subsetter of the DOM interface (build-webfonts.mjs): both renderers can draw the same characters.
// Keep `pnpm fonts:check` green when adding text (it checks the atlases and the web fonts).

/** Code points every face must cover (`pnpm fonts:check` finds characters the copy needs beyond it). */
export function charset() {
  const cps = new Set();
  const range = (a, b) => {
    for (let c = a; c <= b; c++) cps.add(c);
  };
  range(0x20, 0x7e); // Basic Latin
  range(0xa0, 0xff); // Latin-1 (× · ± ° µ ² ³ ¹ « » …)
  range(0x100, 0x17f); // Latin Extended-A (names: Ørsted, Ampère, Schrödinger…)
  range(0x391, 0x3a1);
  range(0x3a3, 0x3a9); // Greek capitals
  range(0x3b1, 0x3c9); // Greek small
  [0x3d1, 0x3d5, 0x3f5].forEach((c) => cps.add(c)); // ϑ ϕ ϵ
  range(0x400, 0x45f); // Cyrillic
  [0x490, 0x491].forEach((c) => cps.add(c)); // Ґ ґ
  // General punctuation, currency, letterlike
  [
    0x2009, 0x200a, 0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2015, 0x2018, 0x2019, 0x201a, 0x201c, 0x201d,
    0x201e, 0x2020, 0x2021, 0x2022, 0x2026, 0x202f, 0x2030, 0x2032, 0x2033, 0x2039, 0x203a, 0x2044, 0x20ac,
    0x20b4, 0x2103, 0x210e, 0x210f, 0x2113, 0x2116, 0x2122, 0x2126, 0x2127, 0x212b,
  ].forEach((c) => cps.add(c));
  range(0x2070, 0x2071);
  range(0x2074, 0x207f); // superscripts (¹²³ are in Latin-1)
  range(0x2080, 0x208e); // subscripts
  range(0x2090, 0x209c); // subscript letters
  range(0x2190, 0x2199); // arrows ← ↑ → ↓ ↔ ↕ ↖ ↗ ↘ ↙
  [0x21ba, 0x21bb, 0x21c4, 0x21c5, 0x21c6, 0x21cb, 0x21cc, 0x21d0, 0x21d1, 0x21d2, 0x21d3, 0x21d4].forEach(
    (c) => cps.add(c),
  );
  // Mathematical operators
  [
    0x2202, 0x2205, 0x2206, 0x2207, 0x2208, 0x220f, 0x2211, 0x2212, 0x2213, 0x2215, 0x2217, 0x2218, 0x2219,
    0x221a, 0x221d, 0x221e, 0x2220, 0x2225, 0x2229, 0x222a, 0x222b, 0x2234, 0x223c, 0x2245, 0x2248, 0x2260,
    0x2261, 0x2264, 0x2265, 0x226a, 0x226b, 0x2272, 0x2273, 0x22a5, 0x22c5, 0x2300,
  ].forEach((c) => cps.add(c));
  // Geometric shapes & dingbats used as bullets / status marks
  [
    0x25a0, 0x25a1, 0x25b2, 0x25b3, 0x25b6, 0x25bc, 0x25c0, 0x25c6, 0x25cb, 0x25cf, 0x2605, 0x2606, 0x2713,
    0x2717, 0x26a1, 0x2600,
  ].forEach((c) => cps.add(c));
  // Found in the chapter copy by `scripts/font-coverage.mjs` (keep that check green when adding text):
  // combining macron / dot above / vector arrow (ν̄, V̇, E⃗ — positioned over the previous glyph by the layout),
  // ᴬ ᵢ ₓ (isotope / index letters), ṁ ṅ (mass / molar flow), ἤ (ἤλεκτρον), ℰ (EMF, DECISIONS §1),
  // ⅓ ⅔ ⅛, ↩, ⌈ ⌉ (ceiling), ⎓ (DC symbol), ⟂ ⟨ ⟩, ⧈ (double insulation).
  [
    0x0304, 0x0307, 0x20d7, 0x1d2c, 0x1d62, 0x2093, 0x1e41, 0x1e45, 0x1f24, 0x2130, 0x2153, 0x2154, 0x215b,
    0x21a9, 0x2308, 0x2309, 0x2393, 0x27c2, 0x27e8, 0x27e9, 0x29c8,
  ].forEach((c) => cps.add(c));
  return [...cps].sort((a, b) => a - b);
}

/**
 * Characters that none of the bundled fonts has, composed from glyphs that they do have (same face, so weight
 * and style match): `[component cp, kind]` where kind `sup` / `sub` reuses the font's own superscript /
 * subscript geometry (measured on ⁿ vs n and ₀ vs 0), `same` copies the glyph.
 */
export const SYNTH = {
  0x2011: [[0x2010, 'same']], // non-breaking hyphen
  0x2071: [[0x69, 'sup']], // ⁱ
  0x1d2c: [[0x41, 'sup']], // ᴬ
  0x1d62: [[0x69, 'sub']], // ᵢ
  ...Object.fromEntries(
    [...'aeoxəhklmnpst'].map((ch, i) => [
      [
        0x2090, 0x2091, 0x2092, 0x2093, 0x2094, 0x2095, 0x2096, 0x2097, 0x2098, 0x2099, 0x209a, 0x209b,
        0x209c,
      ][i],
      [[ch.codePointAt(0), 'sub']],
    ]),
  ),
  0x2103: [
    [0xb0, 'same'],
    [0x43, 'same'],
  ], // ℃ = ° C
};

/** ⎓ (direct current): drawn from the bars of \x27=\x27 (build-fonts.mjs dcSymbol, build-webfonts.py dc_symbol). */
export const DC_SYMBOL = 0x2393;
