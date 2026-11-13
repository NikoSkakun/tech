/**
 * Text layout (pure, synchronous, unit-tested): styled runs → positioned glyph quads + metrics.
 * Units: everything is expressed in the caller's units via `size` (= 1 em).
 */
import type { Face, FaceId, FontData, Glyph } from './fonts';
import { NBSP, parseRich, type Run, type RunColor } from './rich';

export type TextAlign = 'left' | 'center' | 'right';
export type AnchorX = 'left' | 'center' | 'right';
export type AnchorY = 'top' | 'middle' | 'bottom' | 'baseline';

export interface LayoutOptions {
  /** Base face. `**bold**` switches body → bodyBold, `` `formula` `` switches to mono. Default `body`. */
  font?: FaceId;
  /** Font size = 1 em, in your units. Default 1. */
  size?: number;
  /** Wrap lines at this width (same units as `size`). No wrapping when undefined. */
  maxWidth?: number;
  /** Horizontal alignment of lines inside the text block. Default `left`. */
  align?: TextAlign;
  /** Line height as a multiple of `size`. Default 1.4 (STYLE_GUIDE §6: 1.35–1.5). */
  lineHeight?: number;
  /** Extra tracking in em. Default 0. */
  letterSpacing?: number;
  /** Which point of the text block sits at the local origin. Defaults: `left` / `top`. */
  anchorX?: AnchorX;
  anchorY?: AnchorY;
  /** Interpret the mini-markup (see `rich.ts`). Default true. */
  rich?: boolean;
}

export interface LaidGlyph {
  /** Quad in block coordinates (y up): left, bottom, right, top. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  layer: number;
  color: RunColor;
  /** Horizontal shear per unit of height above `baseline` (italic). */
  skew: number;
  baseline: number;
}

export interface TextSpan {
  /** `formula` spans get a darker inset behind them in panels (STYLE_GUIDE §6); `term` spans are key terms. */
  kind: 'formula' | 'term';
  line: number;
  x0: number;
  x1: number;
  /** Line box of the span (y up). */
  top: number;
  bottom: number;
}

export interface TextMetrics {
  /** Width of the widest line. */
  width: number;
  /** Height of all line boxes: `lineCount × lineHeight`. */
  height: number;
  lineCount: number;
  /** Line height in units. */
  lineHeight: number;
  /** Y of the first baseline relative to the local origin (y up). */
  baseline: number;
  /** Box of the text block (line boxes) relative to the local origin: left, bottom, right, top. */
  left: number;
  bottom: number;
  right: number;
  top: number;
  /** Width of each line. */
  lineWidths: number[];
  spans: TextSpan[];
}

export interface LayoutResult {
  glyphs: LaidGlyph[];
  metrics: TextMetrics;
}

const SCRIPT_SCALE = 0.62;
const SUPER_SHIFT = 0.4; // em of the base size
const SUB_SHIFT = -0.16;
const ITALIC_SKEW = 0.2;
const HYPHEN = 0x2d;
const SPACE = 0x20;
const NBSP_CP = NBSP.codePointAt(0)!;
const NEWLINE = 0x0a;
const ZWSP = 0x200b;
/** Combining diacritics (ν̄, V̇) and combining marks for symbols (E⃗): zero advance, centred over the base. */
const isMark = (cp: number): boolean => (cp >= 0x300 && cp <= 0x36f) || (cp >= 0x20d0 && cp <= 0x20ff);

interface Item {
  cp: number;
  glyph: Glyph | null;
  face: Face;
  scale: number;
  shift: number;
  italic: boolean;
  color: RunColor;
  /** Advance including kerning against the previous item and tracking, in em of the base size. */
  advance: number;
  kern: number;
  span: 'formula' | 'term' | null;
}

const warned = new Set<number>();

function faceFor(run: Run, base: FaceId, fonts: FontData): Face {
  if (run.mono) return fonts.faces.mono;
  if (run.bold && base === 'body') return fonts.faces.bodyBold;
  return fonts.faces[base];
}

const isLetter = (cp: number): boolean => /\p{L}/u.test(String.fromCodePoint(cp));

export function layoutText(text: string, options: LayoutOptions, fonts: FontData): LayoutResult {
  return layoutRuns(parseRich(text, options.rich ?? true), options, fonts);
}

export function layoutRuns(runs: readonly Run[], options: LayoutOptions, fonts: FontData): LayoutResult {
  const baseFace = options.font ?? 'body';
  const size = options.size ?? 1;
  const lineHeightEm = options.lineHeight ?? 1.4;
  const tracking = options.letterSpacing ?? 0;
  const maxWidthEm = options.maxWidth !== undefined ? options.maxWidth / size : Infinity;
  const primary = fonts.faces[baseFace];

  // 1. runs → items (one per code point) with kerning
  const items: Item[] = [];
  for (const run of runs) {
    const face = faceFor(run, baseFace, fonts);
    const scale = run.script === 0 ? 1 : SCRIPT_SCALE;
    const shift = run.script === 1 ? SUPER_SHIFT : run.script === -1 ? SUB_SHIFT : 0;
    const span =
      run.mono && run.color === 'formula' ? 'formula' : run.bold && run.color === 'accent' ? 'term' : null;
    for (const ch of run.text) {
      const cp = ch.codePointAt(0)!;
      let glyph: Glyph | null = null;
      if (cp !== NEWLINE && cp !== ZWSP) {
        glyph = face.glyphs.get(cp === NBSP_CP ? SPACE : cp) ?? null;
        if (!glyph) {
          if (!warned.has(cp)) {
            warned.add(cp);
            console.warn(
              `text: no glyph for U+${cp.toString(16).toUpperCase().padStart(4, '0')} '${ch}' — add it to scripts/build-fonts.mjs`,
            );
          }
          glyph = face.glyphs.get(0x3f) ?? null; // '?'
        }
      }
      const prev = items[items.length - 1];
      const mark = isMark(cp);
      let kern = 0;
      if (!mark && glyph && prev && prev.glyph && prev.face === face && prev.scale === scale && scale === 1) {
        kern = face.kerning.get(prev.cp * 65536 + cp) ?? 0;
      }
      items.push({
        cp,
        glyph,
        face,
        scale,
        shift,
        italic: run.italic,
        color: run.color,
        // a full mono cell between a number and its unit reads as a hole: use a thin no-break space there
        advance:
          glyph && !mark ? (glyph.advance * (run.mono && cp === NBSP_CP ? 0.5 : 1) + tracking) * scale : 0,
        kern,
        span,
      });
    }
  }

  // 2. greedy line breaking
  interface Line {
    start: number;
    end: number; // exclusive
    width: number;
  }
  const lines: Line[] = [];
  const measure = (start: number, end: number): number => {
    // width of items[start, end) without trailing spaces
    let last = end;
    while (last > start && items[last - 1]!.cp === SPACE) last--;
    let w = 0;
    for (let i = start; i < last; i++) w += (i > start ? items[i]!.kern : 0) + items[i]!.advance;
    return w;
  };
  let start = 0;
  let x = 0;
  let breakAt = -1; // index where the next line would start if we break at the last opportunity
  const n = items.length;
  for (let i = 0; i < n; i++) {
    const it = items[i]!;
    if (it.cp === NEWLINE) {
      lines.push({ start, end: i, width: measure(start, i) });
      start = i + 1;
      x = 0;
      breakAt = -1;
      continue;
    }
    const adv = (i > start ? it.kern : 0) + it.advance;
    if (x + adv > maxWidthEm + 1e-6 && it.cp !== SPACE && !isMark(it.cp) && i > start) {
      const next = breakAt > start ? breakAt : i;
      lines.push({ start, end: next, width: measure(start, next) });
      start = next;
      // skip spaces that would begin the new line
      while (start < n && items[start]!.cp === SPACE) start++;
      x = 0;
      for (let j = start; j < i; j++) x += (j > start ? items[j]!.kern : 0) + items[j]!.advance;
      breakAt = -1;
      if (i < start) continue;
      x += (i > start ? it.kern : 0) + it.advance;
    } else {
      x += adv;
    }
    if (it.cp === SPACE || it.cp === ZWSP) breakAt = i + 1;
    else if (
      it.cp === HYPHEN &&
      i > start &&
      i + 1 < n &&
      isLetter(items[i - 1]!.cp) &&
      isLetter(items[i + 1]!.cp)
    )
      breakAt = i + 1;
  }
  lines.push({ start, end: n, width: measure(start, n) });

  // 3. positions
  const blockWidth = Math.max(0, ...lines.map((l) => l.width));
  const lineCount = lines.length;
  const blockHeight = lineCount * lineHeightEm;
  const anchorX = options.anchorX ?? 'left';
  const anchorY = options.anchorY ?? 'top';
  const align = options.align ?? 'left';
  const originX = anchorX === 'left' ? 0 : anchorX === 'center' ? -blockWidth / 2 : -blockWidth;
  // the ascent/descent box of the base face is centred in the line box
  const contentHeight = primary.ascender - primary.descender;
  const firstBaselineFromTop = (lineHeightEm - contentHeight) / 2 + primary.ascender;
  const topY =
    anchorY === 'top'
      ? 0
      : anchorY === 'middle'
        ? blockHeight / 2
        : anchorY === 'bottom'
          ? blockHeight
          : firstBaselineFromTop;
  const glyphs: LaidGlyph[] = [];
  const spans: TextSpan[] = [];
  lines.forEach((line, li) => {
    const lineX =
      originX +
      (align === 'left' ? 0 : align === 'center' ? (blockWidth - line.width) / 2 : blockWidth - line.width);
    const baseline = topY - li * lineHeightEm - firstBaselineFromTop;
    let pen = lineX;
    let open: TextSpan | null = null;
    let base: LaidGlyph | null = null; // last laid glyph that a combining mark sits on
    for (let i = line.start; i < line.end; i++) {
      const it = items[i]!;
      if (i > line.start) pen += it.kern;
      const g = it.glyph;
      if (it.span && it.cp !== SPACE) {
        if (!open || open.kind !== it.span) {
          open = {
            kind: it.span,
            line: li,
            x0: pen * size,
            x1: pen * size,
            top: (topY - li * lineHeightEm) * size,
            bottom: (topY - (li + 1) * lineHeightEm) * size,
          };
          spans.push(open);
        }
        open.x1 = (pen + it.advance) * size;
      } else if (!it.span) {
        open = null;
      }
      if (g && g.visible) {
        const s = it.scale;
        const by = baseline + it.shift;
        let dx = 0;
        let dy = 0;
        if (isMark(it.cp) && base) {
          // fonts draw marks for an x-height letter at a zero-advance origin: centre the ink over the base glyph
          // and lift it by how much the base rises above x-height (capitals, ascenders)
          dx = (base.x0 + base.x1) / 2 / size - (pen + (g.left + g.width / 2) * s);
          dy = Math.max(0, (base.y1 - base.baseline) / size - it.face.xHeight * s);
        }
        const laid: LaidGlyph = {
          x0: (pen + dx + g.left * s) * size,
          x1: (pen + dx + (g.left + g.width) * s) * size,
          y1: (by + dy + g.top * s) * size,
          y0: (by + dy + (g.top - g.height) * s) * size,
          u0: g.u0,
          v0: g.v0,
          u1: g.u1,
          v1: g.v1,
          layer: it.face.layer,
          color: it.color,
          skew: it.italic ? ITALIC_SKEW : 0,
          baseline: by * size,
        };
        glyphs.push(laid);
        if (!isMark(it.cp)) base = laid;
      } else if (it.cp === SPACE) {
        base = null;
      }
      pen += it.advance;
    }
  });

  const metrics: TextMetrics = {
    width: blockWidth * size,
    height: blockHeight * size,
    lineCount,
    lineHeight: lineHeightEm * size,
    baseline: (topY - firstBaselineFromTop) * size,
    left: originX * size,
    right: (originX + blockWidth) * size,
    top: topY * size,
    bottom: (topY - blockHeight) * size,
    lineWidths: lines.map((l) => l.width * size),
    spans,
  };
  return { glyphs, metrics };
}
