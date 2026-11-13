/**
 * Painter — what `UiNode.paint()` draws with. Calls append primitives of the current node to the layer's
 * shape / glyph batches. Coordinates are node-local: origin at the box centre, x right, y up, units = px-eq.
 */
import { Color } from 'three';
import { col, type ColorLike } from '@/style';
import type { LayoutResult } from '@/text';
import { KIND, SHAPE_STRIDE, type GlyphBatch, type ShapeBatch } from './batch';
import { iconIndex, type IconName } from './icons';
import type { UiNode } from './node';

/** Linear RGBA. */
export type Rgba = readonly [number, number, number, number];

const cache = new Map<string, Color>();
const scratch = new Color();

function resolve(c: ColorLike): Color {
  if (typeof c === 'string') {
    let hit = cache.get(c);
    if (!hit) {
      hit = col(c);
      cache.set(c, hit);
    }
    return hit;
  }
  return col(c, scratch);
}

/** Palette colour (token, `Color` or hex) with alpha → linear RGBA tuple. */
export function rgba(c: ColorLike, alpha = 1): Rgba {
  const k = resolve(c);
  return [k.r, k.g, k.b, alpha];
}

/** Blend two colours (`t` = 0 → a, 1 → b), alpha included. */
export function mixRgba(a: Rgba, b: Rgba, t: number): Rgba {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    a[3] + (b[3] - a[3]) * t,
  ];
}

/** Same colour, different alpha. */
export function withAlpha(c: Rgba, alpha: number): Rgba {
  return [c[0], c[1], c[2], alpha];
}

/** Scale brightness (values above 1 make the colour emissive, i.e. it blooms). */
export function lit(c: Rgba, k: number): Rgba {
  return [c[0] * k, c[1] * k, c[2] * k, c[3]];
}

const NONE: Rgba = [0, 0, 0, 0];

export interface ShapeStyle {
  /** Depth offset above the node plane, units. */
  z?: number;
  /** Corner radius. */
  r?: number;
  fill?: Rgba;
  /** Bottom colour of a vertical gradient (top = `fill`). */
  fill2?: Rgba;
  /** Inner border colour and width. */
  border?: Rgba;
  bw?: number;
  /** Outer glow reach in units and its peak alpha; the glow takes the border colour. */
  glow?: number;
  glowAlpha?: number;
  /** Brightness multiplier (> 1 blooms). */
  emissive?: number;
  /** Rotation around the shape centre, radians (counter-clockwise). */
  rot?: number;
  /** Dash period in units along the shape's local x (0 = solid). */
  dash?: number;
}

export interface TextColors {
  base: Rgba;
  accent: Rgba;
  formula: Rgba;
}

export class Painter {
  private shapes!: ShapeBatch;
  private glyphs!: GlyphBatch;
  private node!: UiNode;
  private shapeAt = 0;
  private glyphAt = 0;
  private shapeEnd = Infinity;
  private glyphEnd = Infinity;
  /** Set when an in-place repaint produced more primitives than the node's reserved range. */
  overflow = false;

  /** @internal Begin painting `node`; with limits the painter rewrites an existing range in place. */
  begin(
    node: UiNode,
    shapes: ShapeBatch,
    glyphs: GlyphBatch,
    shapeEnd = Infinity,
    glyphEnd = Infinity,
  ): void {
    this.node = node;
    this.shapes = shapes;
    this.glyphs = glyphs;
    this.shapeAt = node.shapeStart;
    this.glyphAt = node.glyphStart;
    this.shapeEnd = shapeEnd;
    this.glyphEnd = glyphEnd;
    this.overflow = false;
  }

  /** @internal Number of primitives emitted since `begin`. */
  get shapesEmitted(): number {
    return this.shapeAt - this.node.shapeStart;
  }
  get glyphsEmitted(): number {
    return this.glyphAt - this.node.glyphStart;
  }

  private shape(
    kind: number,
    cx: number,
    cy: number,
    w: number,
    h: number,
    s: ShapeStyle,
    p0 = 0,
    p1 = 0,
    p2 = 0,
  ): void {
    if (this.shapeAt >= this.shapeEnd) {
      this.overflow = true;
      return;
    }
    this.shapes.ensure(this.shapeAt + 1);
    const d = this.shapes.data;
    const o = this.shapeAt * SHAPE_STRIDE;
    const fill = s.fill ?? NONE;
    const fill2 = s.fill2 ?? fill;
    const border = s.border ?? NONE;
    d[o] = cx;
    d[o + 1] = cy;
    d[o + 2] = w;
    d[o + 3] = h;
    d[o + 4] = s.z ?? 0;
    d[o + 5] = s.r ?? 0;
    d[o + 6] = this.node.slot;
    d[o + 7] = kind;
    d[o + 8] = fill[0];
    d[o + 9] = fill[1];
    d[o + 10] = fill[2];
    d[o + 11] = fill[3];
    d[o + 12] = fill2[0];
    d[o + 13] = fill2[1];
    d[o + 14] = fill2[2];
    d[o + 15] = fill2[3];
    d[o + 16] = border[0];
    d[o + 17] = border[1];
    d[o + 18] = border[2];
    d[o + 19] = border[3];
    d[o + 20] = s.bw ?? 0;
    d[o + 21] = s.glow ?? 0;
    d[o + 22] = s.glowAlpha ?? (s.glow ? 0.35 : 0);
    d[o + 23] = s.emissive ?? 1;
    d[o + 24] = p0;
    d[o + 25] = p1;
    d[o + 26] = p2;
    d[o + 27] = s.rot ?? 0;
    d[o + 28] = this.node.clipIndex;
    d[o + 29] = s.dash ?? 0;
    d[o + 30] = s.fill2 ? 1 : 0;
    d[o + 31] = 0;
    this.shapeAt++;
  }

  /** Rounded rectangle centred at (cx, cy). */
  rect(cx: number, cy: number, w: number, h: number, style: ShapeStyle): void {
    this.shape(KIND.rect, cx, cy, w, h, style);
  }

  /** Hologlass panel: rounded rectangle with sheen, scan band, grain and a swept accent border. */
  panel(cx: number, cy: number, w: number, h: number, style: ShapeStyle): void {
    this.shape(KIND.panel, cx, cy, w, h, style);
  }

  /** Disc. */
  circle(cx: number, cy: number, diameter: number, style: ShapeStyle): void {
    this.shape(KIND.rect, cx, cy, diameter, diameter, { ...style, r: diameter / 2 });
  }

  /**
   * Arc with round caps. Angles in radians, clockwise from 12 o'clock; `sweep` ≥ 2π draws a full ring.
   * `diameter` is the outer diameter.
   */
  arc(
    cx: number,
    cy: number,
    diameter: number,
    start: number,
    sweep: number,
    thickness: number,
    style: ShapeStyle,
  ): void {
    this.shape(KIND.arc, cx, cy, diameter, diameter, style, start, sweep, thickness);
  }

  /** Straight line with round caps. */
  line(x0: number, y0: number, x1: number, y1: number, width: number, style: ShapeStyle): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    this.shape(KIND.rect, (x0 + x1) / 2, (y0 + y1) / 2, len + width, width, {
      ...style,
      r: width / 2,
      rot: Math.atan2(dy, dx),
    });
  }

  /** Icon from the procedural set, `size` units square. */
  icon(
    name: IconName,
    cx: number,
    cy: number,
    size: number,
    color: Rgba,
    style: Omit<ShapeStyle, 'fill'> = {},
  ): void {
    this.shape(KIND.icon, cx, cy, size, size, { ...style, fill: color }, iconIndex(name));
  }

  /**
   * Laid-out text. (ox, oy) is where the layout's origin goes (its anchor decides what that origin is).
   * `reserve` pads the node's glyph range so later in-place updates with more glyphs still fit.
   */
  text(
    layout: LayoutResult,
    ox: number,
    oy: number,
    z: number,
    colors: TextColors,
    alpha = 1,
    reserve = 0,
  ): void {
    const list = layout.glyphs;
    const want = Math.max(list.length, reserve);
    if (this.glyphAt + want > this.glyphEnd) {
      this.overflow = true;
      return;
    }
    const g = this.glyphs;
    g.ensure(this.glyphAt + want);
    const { position, uv, color, meta } = g;
    const node = this.node.slot;
    const clip = this.node.clipIndex;
    for (let i = 0; i < want; i++) {
      const at = this.glyphAt + i;
      const p = at * 12;
      const item = list[i];
      if (!item) {
        // unused reserved slot: degenerate quad
        position.fill(0, p, p + 12);
        color.fill(0, at * 16, at * 16 + 16);
        for (let k = 0; k < 4; k++) {
          meta[p + k * 3] = 0;
          meta[p + k * 3 + 1] = node;
          meta[p + k * 3 + 2] = clip;
        }
        continue;
      }
      const top = item.skew * (item.y1 - item.baseline);
      const bottom = item.skew * (item.y0 - item.baseline);
      position[p] = ox + item.x0 + bottom;
      position[p + 1] = oy + item.y0;
      position[p + 2] = z;
      position[p + 3] = ox + item.x1 + bottom;
      position[p + 4] = oy + item.y0;
      position[p + 5] = z;
      position[p + 6] = ox + item.x0 + top;
      position[p + 7] = oy + item.y1;
      position[p + 8] = z;
      position[p + 9] = ox + item.x1 + top;
      position[p + 10] = oy + item.y1;
      position[p + 11] = z;
      const u = at * 8;
      // atlas rows run top-down
      uv[u] = item.u0;
      uv[u + 1] = item.v1;
      uv[u + 2] = item.u1;
      uv[u + 3] = item.v1;
      uv[u + 4] = item.u0;
      uv[u + 5] = item.v0;
      uv[u + 6] = item.u1;
      uv[u + 7] = item.v0;
      const c =
        item.color === 'base'
          ? colors.base
          : item.color === 'accent'
            ? colors.accent
            : item.color === 'formula'
              ? colors.formula
              : rgba(item.color, colors.base[3]);
      for (let k = 0; k < 4; k++) {
        const q = at * 16 + k * 4;
        color[q] = c[0];
        color[q + 1] = c[1];
        color[q + 2] = c[2];
        color[q + 3] = c[3] * alpha;
        meta[p + k * 3] = item.layer;
        meta[p + k * 3 + 1] = node;
        meta[p + k * 3 + 2] = clip;
      }
    }
    this.glyphAt += want;
  }
}
