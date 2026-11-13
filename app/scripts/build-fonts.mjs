// Builds the SDF font atlases used by `src/text` from OFL fonts shipped as npm packages
// (@expo-google-fonts/*: the complete, unsubsetted static TTFs as published by Google Fonts).
//
//   pnpm fonts            → public/fonts/<face>.png (8-bit greyscale SDF) + public/fonts/fonts.json (metrics)
//
// Why offline atlases instead of runtime SDF generation: layout metrics are available synchronously (panels
// can size to content in the same frame), text never pops in late, and there is no font fetching/fallback
// logic at runtime at all (ARCHITECTURE §1: no runtime network dependencies).
//
// Method (robust against overlapping contours, which static instances of variable fonts are full of):
//   1. flatten the glyph outline, 2. scanline-fill it with the non-zero winding rule at SS× resolution,
//   3. exact Euclidean distance transform (Felzenszwalb–Huttenlocher) of the inside and the outside,
//   4. sample the signed distance at atlas-texel centres and map ±RANGE/2 px → 0…255 (0.5 = the outline).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const fontkit = require('fontkit');
const { PNG } = require('pngjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/fonts');
const FS = join(ROOT, 'node_modules/@expo-google-fonts');

const EM = 48; // atlas px per em
const RANGE = 12; // total distance range in atlas px (±6 px ⇒ ±0.125 em: enough for outline/glow/shadow)
const PAD = RANGE / 2 + 1; // texels around the glyph bbox
const SS = 8; // supersampling factor of the binary raster used for the distance transform
const ATLAS_W = 2048;

/** Unicode coverage required by the course (see brief §8). */
function charset() {
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

const SYMBOLS = [
  'noto-sans-math/400Regular/NotoSansMath_400Regular.ttf',
  'noto-sans-symbols-2/400Regular/NotoSansSymbols2_400Regular.ttf',
];

/**
 * Faces in atlas-layer order. `sources` is a fallback chain: the first font that has the glyph wins.
 * `embolden` (em) dilates glyphs taken from the regular-weight symbol fonts so they match a bold face.
 */
const FACES = [
  {
    id: 'display',
    embolden: 0.034,
    sources: [
      'nunito/800ExtraBold/Nunito_800ExtraBold.ttf',
      'fira-sans/700Bold/FiraSans_700Bold.ttf',
      ...SYMBOLS,
    ],
  },
  {
    id: 'body',
    embolden: 0,
    sources: ['fira-sans/400Regular/FiraSans_400Regular.ttf', ...SYMBOLS],
  },
  {
    id: 'bodyBold',
    embolden: 0.02,
    sources: ['fira-sans/600SemiBold/FiraSans_600SemiBold.ttf', ...SYMBOLS],
  },
  {
    id: 'mono',
    mono: true,
    embolden: 0.008,
    sources: [
      'jetbrains-mono/500Medium/JetBrainsMono_500Medium.ttf',
      'fira-sans/500Medium/FiraSans_500Medium.ttf',
      ...SYMBOLS,
    ],
  },
];

function loadFont(rel) {
  const p = join(FS, rel);
  if (!existsSync(p)) throw new Error(`font not found: ${p}`);
  const font = fontkit.create(readFileSync(p));
  return {
    rel,
    font,
    upm: font.unitsPerEm,
    cap: (font.capHeight || font.ascent * 0.7) / font.unitsPerEm,
    symbols: SYMBOLS.includes(rel),
  };
}

/** Flatten a fontkit glyph path (font units, y-up) into closed polylines in px, y-down. */
function flatten(path, k) {
  const contours = [];
  let cur = null;
  let x = 0;
  let y = 0;
  const close = () => {
    if (cur && cur.length >= 6) {
      if (cur[0] !== cur[cur.length - 2] || cur[1] !== cur[cur.length - 1]) cur.push(cur[0], cur[1]);
      contours.push(cur);
    }
    cur = null;
  };
  for (const c of path.commands) {
    const a = c.args;
    if (c.command === 'moveTo') {
      close();
      x = a[0] * k;
      y = -a[1] * k;
      cur = [x, y];
    } else if (c.command === 'lineTo') {
      x = a[0] * k;
      y = -a[1] * k;
      cur.push(x, y);
    } else if (c.command === 'quadraticCurveTo') {
      const x1 = a[0] * k;
      const y1 = -a[1] * k;
      const x2 = a[2] * k;
      const y2 = -a[3] * k;
      const n = 10;
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        const u = 1 - t;
        cur.push(u * u * x + 2 * u * t * x1 + t * t * x2, u * u * y + 2 * u * t * y1 + t * t * y2);
      }
      x = x2;
      y = y2;
    } else if (c.command === 'bezierCurveTo') {
      const x1 = a[0] * k;
      const y1 = -a[1] * k;
      const x2 = a[2] * k;
      const y2 = -a[3] * k;
      const x3 = a[4] * k;
      const y3 = -a[5] * k;
      const n = 14;
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        const u = 1 - t;
        cur.push(
          u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
          u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
        );
      }
      x = x3;
      y = y3;
    } else if (c.command === 'closePath') {
      close();
    }
  }
  close();
  return contours;
}

/** Non-zero-winding scanline fill into a W×H binary image; contours are in image px coordinates. */
function fill(contours, W, H) {
  const img = new Uint8Array(W * H);
  const xs = [];
  for (let row = 0; row < H; row++) {
    const yc = row + 0.5;
    xs.length = 0;
    for (const c of contours) {
      for (let i = 0; i + 3 < c.length; i += 2) {
        const x0 = c[i];
        const y0 = c[i + 1];
        const x1 = c[i + 2];
        const y1 = c[i + 3];
        if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) {
          const t = (yc - y0) / (y1 - y0);
          xs.push([x0 + t * (x1 - x0), y1 > y0 ? 1 : -1]);
        }
      }
    }
    if (xs.length === 0) continue;
    xs.sort((a, b) => a[0] - b[0]);
    let wind = 0;
    for (let k = 0; k < xs.length - 1; k++) {
      wind += xs[k][1];
      if (wind !== 0) {
        const a = Math.max(0, Math.ceil(xs[k][0] - 0.5));
        const b = Math.min(W - 1, Math.floor(xs[k + 1][0] - 0.5));
        for (let xx = a; xx <= b; xx++) img[row * W + xx] = 1;
      }
    }
  }
  return img;
}

const INF = 1e20;
/** 1-D squared Euclidean distance transform (Felzenszwalb & Huttenlocher 2012). */
function edt1d(f, n, d, v, z) {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s;
    do {
      const r = v[k];
      s = (f[q] + q * q - (f[r] + r * r)) / (2 * q - 2 * r);
    } while (s <= z[k] && --k > -1);
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const r = v[k];
    d[q] = (q - r) * (q - r) + f[r];
  }
}

/** Squared distance from every pixel to the nearest pixel where `img === target`. */
function edt(img, W, H, target) {
  const grid = new Float64Array(W * H);
  for (let i = 0; i < W * H; i++) grid[i] = img[i] === target ? 0 : INF;
  const n = Math.max(W, H);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) f[y] = grid[y * W + x];
    edt1d(f, H, d, v, z);
    for (let y = 0; y < H; y++) grid[y * W + x] = d[y];
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) f[x] = grid[y * W + x];
    edt1d(f, W, d, v, z);
    for (let x = 0; x < W; x++) grid[y * W + x] = d[x];
  }
  return grid;
}

/** Render one glyph to an SDF cell. Returns null for empty glyphs (space). */
function renderGlyph(glyph, pxPerUnit, emboldenPx) {
  const contours = flatten(glyph.path, pxPerUnit);
  if (contours.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of contours) {
    for (let i = 0; i < c.length; i += 2) {
      minX = Math.min(minX, c[i]);
      maxX = Math.max(maxX, c[i]);
      minY = Math.min(minY, c[i + 1]);
      maxY = Math.max(maxY, c[i + 1]);
    }
  }
  if (!(maxX > minX) || !(maxY > minY)) return null;
  const pad = PAD + Math.ceil(emboldenPx);
  const x0 = Math.floor(minX) - pad;
  const y0 = Math.floor(minY) - pad;
  const w = Math.ceil(maxX) + pad - x0;
  const h = Math.ceil(maxY) + pad - y0;
  const W = w * SS;
  const H = h * SS;
  const hi = contours.map((c) => {
    const o = new Float64Array(c.length);
    for (let i = 0; i < c.length; i += 2) {
      o[i] = (c[i] - x0) * SS;
      o[i + 1] = (c[i + 1] - y0) * SS;
    }
    return o;
  });
  const img = fill(hi, W, H);
  const dIn = edt(img, W, H, 1); // distance to the shape (0 inside)
  const dOut = edt(img, W, H, 0); // distance to the background (0 outside)
  const out = new Uint8Array(w * h);
  const sd = (ix, iy) => {
    const i = iy * W + ix;
    // signed distance in atlas px, negative inside; ±0.5 hi-res px centres the zero level on the pixel edge
    return img[i] ? -(Math.sqrt(dOut[i]) - 0.5) / SS : (Math.sqrt(dIn[i]) - 0.5) / SS;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cx = x * SS + SS / 2;
      const cy = y * SS + SS / 2;
      const dist = (sd(cx - 1, cy - 1) + sd(cx, cy - 1) + sd(cx - 1, cy) + sd(cx, cy)) / 4 - emboldenPx;
      out[y * w + x] = Math.max(0, Math.min(255, Math.round((0.5 - dist / RANGE) * 255)));
    }
  }
  return { x0, y0, w, h, data: out };
}

/** Characters between which kerning is worth storing (letters, digits, common punctuation). */
function kernable(cp) {
  return (
    (cp >= 0x21 && cp <= 0x7e) ||
    (cp >= 0x391 && cp <= 0x3c9) ||
    (cp >= 0x404 && cp <= 0x407) ||
    (cp >= 0x410 && cp <= 0x44f) ||
    (cp >= 0x454 && cp <= 0x457) ||
    cp === 0x490 ||
    cp === 0x491 ||
    [0xab, 0xbb, 0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x201e, 0x2026].includes(cp)
  );
}

/**
 * Characters that none of the bundled fonts has, composed from glyphs that they do have (same face, so weight
 * and style match): `[component cp, kind]` where kind `sup` / `sub` reuses the font's own superscript /
 * subscript geometry (measured on ⁿ vs n and ₀ vs 0), `same` copies the glyph.
 */
const SYNTH = {
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

/** ⎓ (direct current): the upper bar of '=' full width over its lower bar cut into three dashes. */
function dcSymbol(src, f) {
  const eq = src.font.glyphForCodePoint(0x3d);
  const { minX, maxX, minY, maxY } = eq.bbox;
  const t = (maxY - minY) * 0.3; // bar thickness of '=' is ~30 % of its height in Fira
  const rect = (x0, y0, x1, y1) => [
    { command: 'moveTo', args: [x0 * f, y0 * f] },
    { command: 'lineTo', args: [x1 * f, y0 * f] },
    { command: 'lineTo', args: [x1 * f, y1 * f] },
    { command: 'lineTo', args: [x0 * f, y1 * f] },
    { command: 'closePath', args: [] },
  ];
  const gap = (maxX - minX) * 0.12;
  const dash = (maxX - minX - 2 * gap) / 3;
  const commands = rect(minX, maxY - t, maxX, maxY);
  for (let i = 0; i < 3; i++) {
    const x = minX + i * (dash + gap);
    commands.push(...rect(x, minY, x + dash, minY + t));
  }
  return { path: { commands }, advanceWidth: eq.advanceWidth * f };
}

/** A synthetic fontkit-like glyph `{ path.commands, advanceWidth }` in primary font units, or null. */
function synthGlyph(cp, sources) {
  const primary = sources[0];
  const srcOf = (c) => sources.find((s) => s.font.hasGlyphForCodePoint(c));
  const toPrimary = (s) =>
    (s === primary ? 1 : Math.min(1.15, Math.max(0.85, primary.cap / s.cap))) * (primary.upm / s.upm);
  if (cp === 0x2393) {
    const s = srcOf(0x3d);
    return s ? dcSymbol(s, toPrimary(s)) : null;
  }
  const parts = SYNTH[cp];
  if (!parts || parts.some(([c]) => !srcOf(c))) return null;
  /** scale and baseline offset (font units) of the font's own super/subscripts */
  const script = (kind) => {
    const [small, big] = kind === 'sup' ? [0x207f, 0x6e] : [0x2080, 0x30];
    const s = srcOf(small);
    if (!s || !s.font.hasGlyphForCodePoint(big)) return { scale: 0.62, dy: kind === 'sup' ? 0.4 : -0.16 };
    const a = s.font.glyphForCodePoint(small).bbox;
    const b = s.font.glyphForCodePoint(big).bbox;
    const scale = (a.maxY - a.minY) / (b.maxY - b.minY);
    return { scale, dy: (a.minY - b.minY * scale) / s.upm };
  };
  const commands = [];
  let pen = 0;
  for (const [c, kind] of parts) {
    const s = srcOf(c);
    const g = s.font.glyphForCodePoint(c);
    const f = toPrimary(s);
    const { scale, dy } = kind === 'same' ? { scale: 1, dy: 0 } : script(kind);
    const ox = pen + (kind === 'same' ? 0 : 0.03 * primary.upm);
    const oy = dy * primary.upm;
    for (const cmd of g.path.commands)
      commands.push({
        command: cmd.command,
        args: cmd.args.map((v, i) => (i % 2 === 0 ? ox + v * f * scale : oy + v * f * scale)),
      });
    pen = ox + g.advanceWidth * f * scale + (kind === 'same' ? 0 : 0.03 * primary.upm);
  }
  return { path: { commands }, advanceWidth: pen };
}

function buildFace(face, cps) {
  const sources = face.sources.map(loadFont);
  const primary = sources[0];
  const pf = primary.font;
  const monoAdvance = face.mono ? pf.glyphForCodePoint(0x30).advanceWidth / primary.upm : 0;
  const glyphs = [];
  const missing = [];
  const fromPrimary = [];
  for (const cp of cps) {
    const found = sources.find((s) => s.font.hasGlyphForCodePoint(cp));
    if (!found) {
      const synth = synthGlyph(cp, sources);
      if (!synth) {
        missing.push(cp);
        continue;
      }
      const cell = renderGlyph(synth, EM / primary.upm, 0);
      let advance = synth.advanceWidth / primary.upm;
      let shift = 0;
      if (face.mono) {
        shift = (monoAdvance - advance) / 2;
        advance = monoAdvance;
      }
      glyphs.push({ cp, cell, advance, shift, fallback: true });
      continue;
    }
    const g = found.font.glyphForCodePoint(cp);
    // Fallback fonts are scaled so their cap height matches the primary face.
    const k = found === primary ? 1 : Math.min(1.15, Math.max(0.85, primary.cap / found.cap));
    const cell = renderGlyph(g, (EM * k) / found.upm, found.symbols ? face.embolden * EM : 0);
    let advance = (g.advanceWidth / found.upm) * k;
    let shift = 0;
    if (face.mono && Math.abs(advance - monoAdvance) > 1e-4) {
      shift = (monoAdvance - advance) / 2; // centre fallback glyphs in the mono cell
      advance = monoAdvance;
    }
    glyphs.push({ cp, cell, advance, shift, fallback: found !== primary });
    if (found === primary && kernable(cp)) fromPrimary.push({ cp, advance: g.advanceWidth });
  }
  // Kerning pairs via the shaping engine (handles GPOS class kerning and extension lookups), in 1/1000 em.
  const kerning = [];
  if (!face.mono) {
    const features = { kern: true, liga: false, clig: false, calt: false, dlig: false };
    for (const a of fromPrimary) {
      for (const b of fromPrimary) {
        const run = pf.layout(String.fromCodePoint(a.cp, b.cp), features);
        if (run.glyphs.length !== 2) continue;
        const kv = run.positions[0].xAdvance - a.advance;
        const em = Math.round((kv / primary.upm) * 1000);
        // < 0.018 em is below a third of a pixel at body sizes — not worth the bytes
        if (Math.abs(em) >= 18) kerning.push(a.cp, b.cp, em);
      }
    }
  }
  return {
    id: face.id,
    glyphs,
    kerning,
    missing,
    fallbacks: glyphs.filter((g) => g.fallback).length,
    metrics: {
      ascender: pf.ascent / primary.upm,
      descender: pf.descent / primary.upm,
      lineGap: pf.lineGap / primary.upm,
      capHeight: (pf.capHeight || pf.ascent * 0.7) / primary.upm,
      xHeight: (pf.xHeight || pf.ascent * 0.5) / primary.upm,
    },
  };
}

function pack(glyphs) {
  const cells = glyphs.filter((g) => g.cell).sort((a, b) => b.cell.h - a.cell.h || b.cell.w - a.cell.w);
  let x = 1;
  let y = 1;
  let shelf = 0;
  for (const g of cells) {
    if (x + g.cell.w + 1 > ATLAS_W) {
      x = 1;
      y += shelf + 1;
      shelf = 0;
    }
    g.ax = x;
    g.ay = y;
    x += g.cell.w + 1;
    shelf = Math.max(shelf, g.cell.h);
  }
  return y + shelf + 1;
}

const t0 = Date.now();
const cps = charset();
const built = FACES.map((f) => {
  const b = buildFace(f, cps);
  b.height = pack(b.glyphs);
  console.info(
    `${b.id}: ${b.glyphs.length} glyphs (${b.fallbacks} from fallback fonts), ${b.kerning.length / 3} kerning pairs, packed height ${b.height}` +
      (b.missing.length ? `, MISSING: ${b.missing.map((c) => 'U+' + c.toString(16)).join(' ')}` : ''),
  );
  return b;
});
const ATLAS_H = Math.ceil(Math.max(...built.map((b) => b.height)) / 64) * 64;
mkdirSync(OUT, { recursive: true });
const r4 = (v) => Math.round(v * 10000) / 10000;
const json = { version: 1, em: EM, range: RANGE, width: ATLAS_W, height: ATLAS_H, faces: {} };
built.forEach((b, layer) => {
  const pix = Buffer.alloc(ATLAS_W * ATLAS_H);
  const table = [];
  for (const g of b.glyphs) {
    if (g.cell) {
      for (let row = 0; row < g.cell.h; row++) {
        pix.set(g.cell.data.subarray(row * g.cell.w, (row + 1) * g.cell.w), (g.ay + row) * ATLAS_W + g.ax);
      }
      // [cp, advance, quadLeft, quadTop (y-up, above baseline), quadW, quadH (em), atlasX, atlasY, atlasW, atlasH (px)]
      table.push([
        g.cp,
        r4(g.advance),
        r4(g.cell.x0 / EM + g.shift),
        r4(-g.cell.y0 / EM),
        r4(g.cell.w / EM),
        r4(g.cell.h / EM),
        g.ax,
        g.ay,
        g.cell.w,
        g.cell.h,
      ]);
    } else {
      table.push([g.cp, r4(g.advance)]);
    }
  }
  const png = new PNG({
    width: ATLAS_W,
    height: ATLAS_H,
    colorType: 0,
    inputColorType: 0,
    inputHasAlpha: false,
  });
  png.data = pix;
  const bytes = PNG.sync.write(png, {
    colorType: 0,
    inputColorType: 0,
    inputHasAlpha: false,
    deflateLevel: 9,
  });
  writeFileSync(join(OUT, `${b.id}.png`), bytes);
  // files in public/ are not content-hashed by the bundler: the query string busts HTTP caches when an atlas changes
  const file = `${b.id}.png?v=${createHash('sha1').update(bytes).digest('hex').slice(0, 10)}`;

  json.faces[b.id] = {
    layer,
    file,
    ...Object.fromEntries(Object.entries(b.metrics).map(([k, v]) => [k, r4(v)])),
    glyphs: table,
    kerning: b.kerning,
  };
});
writeFileSync(join(OUT, 'fonts.json'), JSON.stringify(json));
console.info(
  `atlas ${ATLAS_W}×${ATLAS_H} × ${built.length} layers → ${OUT} in ${((Date.now() - t0) / 1000).toFixed(1)} s`,
);
