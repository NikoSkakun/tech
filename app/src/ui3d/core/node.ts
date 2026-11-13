/**
 * UiNode — the retained element tree of the widget kit, with a small flex-like layout.
 *
 * A node has a layout box (computed by `layoutTree`), a presentation transform that animations drive
 * (offset, depth, scale, rotation, opacity — never part of layout), an optional `paint()` that emits batched
 * primitives, and optional pointer handlers. Units are px-equivalent (1 unit = 1 px at 1080p) everywhere.
 *
 * Layout model (deliberately small): `dir` row / col / stack, `gap`, `pad`, cross-axis `align`, main-axis
 * `justify`, `wrap` for rows; sizes are a number, `'hug'` (fit content) or `'fill'` (take what the parent
 * offers; several `fill` children share by `grow`), clamped by min/max. `float` takes a child out of the
 * flow and anchors it to a point of the parent's box (badges, bubbles, close buttons).
 */
import type { PointerInfo, DragInfo } from '@/engine/api';
import type { Painter } from './painter';
import type { UiSurface } from './surface';

export type Size = number | 'hug' | 'fill';
export type Dir = 'row' | 'col' | 'stack';
export type Align = 'start' | 'center' | 'end' | 'stretch';
export type Justify = 'start' | 'center' | 'end' | 'between';
export type Pad = number | readonly [number, number] | readonly [number, number, number, number];

export interface FloatSpec {
  /** Anchor on the parent's box, 0…1 from left / top. Default 0.5. */
  ax?: number;
  ay?: number;
  /** Pivot on this node, 0…1 (default: same as the anchor, i.e. aligned inside the parent). */
  px?: number;
  py?: number;
  /** Extra offset in units (y down). */
  dx?: number;
  dy?: number;
}

export interface UiHandlers {
  /** CSS cursor while hovering. */
  cursor?: string;
  /** Name shown in the hover tooltip. */
  tooltip?: string | (() => string);
  hover?(over: boolean, e: PointerInfo): void;
  press?(e: PointerInfo): void;
  release?(e: PointerInfo): void;
  click?(e: PointerInfo): void;
  dragStart?(e: DragInfo): void;
  drag?(e: DragInfo): void;
  dragEnd?(e: DragInfo): void;
  /** Return true to consume the wheel event. */
  wheel?(deltaY: number, e: PointerInfo): boolean | void;
}

export interface NodeProps {
  name?: string;
  width?: Size;
  height?: Size;
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
  /** Share of the free space among `fill` siblings. Default 1. */
  grow?: number;
  dir?: Dir;
  gap?: number;
  /** Padding: all sides, `[vertical, horizontal]` or `[top, right, bottom, left]`. */
  pad?: Pad;
  align?: Align;
  justify?: Justify;
  /** Overrides the parent's `align` for this child. */
  alignSelf?: Align;
  wrap?: boolean;
  float?: FloatSpec;
  /** Paint layer of this subtree (inherited). Higher layers draw over all text of lower ones. */
  layer?: number;
  /** Raise this subtree by N layers relative to where it would paint (popups, bubbles). */
  layerUp?: number;
  /** Clip descendants to this node's box; `clipFeather` fades the top/bottom edge by that many units. */
  clip?: boolean;
  clipFeather?: number;
  visible?: boolean;
  opacity?: number;
  z?: number;
  children?: readonly (UiNode | null | undefined | false)[];
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

export class UiNode {
  name = '';
  parent: UiNode | null = null;
  readonly children: UiNode[] = [];
  /** Surface this node is attached to (null while detached). */
  surface: UiSurface | null = null;

  /* ---- layout input ---- */
  width: Size = 'hug';
  height: Size = 'hug';
  minW = 0;
  maxW = Infinity;
  minH = 0;
  maxH = Infinity;
  grow = 1;
  dir: Dir = 'col';
  gap = 0;
  padT = 0;
  padR = 0;
  padB = 0;
  padL = 0;
  align: Align = 'start';
  justify: Justify = 'start';
  alignSelf: Align | null = null;
  wrap = false;
  float: FloatSpec | null = null;
  layer: number | null = null;
  layerUp = 0;
  clip = false;
  clipFeather = 0;

  /* ---- layout output: box relative to the parent's top-left corner (y down) ---- */
  bx = 0;
  by = 0;
  bw = 0;
  bh = 0;

  /* ---- presentation (animate freely; not part of layout) ---- */
  /** Offset from the laid-out position, units (x right, y up, z toward the viewer). */
  x = 0;
  y = 0;
  z = 0;
  scale = 1;
  scaleX = 1;
  scaleY = 1;
  rotX = 0;
  rotY = 0;
  rotZ = 0;
  /** Pivot of scale / rotation relative to the box centre, in box fractions (−0.5…0.5, y up). */
  originX = 0;
  originY = 0;
  opacity = 1;

  /* ---- set by the surface ---- */
  /** @internal index into the transform texture (−1 = not painted). */
  slot = -1;
  /** @internal surface-space affine matrix, row-major 3×4. */
  readonly world = new Float64Array(12);
  /** @internal */
  worldOpacity = 1;
  /** @internal batch bookkeeping */
  paintLayer = 0;
  clipIndex = -1;
  shapeStart = 0;
  shapeCount = 0;
  glyphStart = 0;
  glyphCount = 0;
  glyphCap = 0;
  paintOrder = 0;
  paintDirty = false;

  handlers: UiHandlers | null = null;
  /** False makes the node (and its handlers) inert without changing its look. */
  enabled = true;
  /** Hit rectangle is at least this big (STYLE_GUIDE §6: 44 px-eq targets). 0 = exactly the box. */
  minHit = 0;

  #shown = true;

  constructor(props: NodeProps = {}) {
    this.apply(props);
  }

  /** Apply layout / presentation props (any subset). */
  apply(props: NodeProps): this {
    if (props.name !== undefined) this.name = props.name;
    if (props.width !== undefined) this.width = props.width;
    if (props.height !== undefined) this.height = props.height;
    if (props.minW !== undefined) this.minW = props.minW;
    if (props.maxW !== undefined) this.maxW = props.maxW;
    if (props.minH !== undefined) this.minH = props.minH;
    if (props.maxH !== undefined) this.maxH = props.maxH;
    if (props.grow !== undefined) this.grow = props.grow;
    if (props.dir !== undefined) this.dir = props.dir;
    if (props.gap !== undefined) this.gap = props.gap;
    if (props.pad !== undefined) this.pad = props.pad;
    if (props.align !== undefined) this.align = props.align;
    if (props.justify !== undefined) this.justify = props.justify;
    if (props.alignSelf !== undefined) this.alignSelf = props.alignSelf;
    if (props.wrap !== undefined) this.wrap = props.wrap;
    if (props.float !== undefined) this.float = props.float;
    if (props.layer !== undefined) this.layer = props.layer;
    if (props.layerUp !== undefined) this.layerUp = props.layerUp;
    if (props.clip !== undefined) this.clip = props.clip;
    if (props.clipFeather !== undefined) this.clipFeather = props.clipFeather;
    if (props.visible !== undefined) this.#shown = props.visible;
    if (props.opacity !== undefined) this.opacity = props.opacity;
    if (props.z !== undefined) this.z = props.z;
    if (props.children) for (const c of props.children) if (c) this.add(c);
    this.relayout();
    return this;
  }

  set pad(p: Pad) {
    if (typeof p === 'number') this.padT = this.padR = this.padB = this.padL = p;
    else if (p.length === 2) {
      this.padT = this.padB = p[0];
      this.padR = this.padL = p[1];
    } else [this.padT, this.padR, this.padB, this.padL] = p;
  }

  /** Hidden nodes take no space and are not painted (animate `opacity` for fades). */
  get visible(): boolean {
    return this.#shown;
  }
  set visible(v: boolean) {
    if (v === this.#shown) return;
    this.#shown = v;
    this.relayout();
  }

  /** Computed size (valid after layout). */
  get w(): number {
    return this.bw;
  }
  get h(): number {
    return this.bh;
  }

  add(...nodes: UiNode[]): this {
    for (const n of nodes) {
      n.parent?.remove(n);
      n.parent = this;
      this.children.push(n);
      n.attach(this.surface);
    }
    this.relayout();
    return this;
  }

  insert(node: UiNode, at: number): this {
    node.parent?.remove(node);
    node.parent = this;
    this.children.splice(Math.max(0, Math.min(at, this.children.length)), 0, node);
    node.attach(this.surface);
    this.relayout();
    return this;
  }

  remove(node: UiNode): this {
    const i = this.children.indexOf(node);
    if (i >= 0) {
      this.children.splice(i, 1);
      node.parent = null;
      const s = this.surface;
      node.attach(null);
      s?.invalidateLayout();
    }
    return this;
  }

  /** Remove from the parent. */
  detach(): void {
    this.parent?.remove(this);
  }

  clear(): this {
    for (const c of [...this.children]) this.remove(c);
    return this;
  }

  /** Register pointer handlers (merged with existing ones). */
  on(handlers: UiHandlers): this {
    this.handlers = { ...(this.handlers ?? {}), ...handlers };
    this.surface?.invalidateStructure();
    return this;
  }

  /** Layout-affecting change: the surface re-lays out before the next frame. */
  relayout(): void {
    this.surface?.invalidateLayout();
  }

  /** Look-only change (colours, values): this node is re-painted before the next frame. */
  repaint(): void {
    if (this.paintDirty) return;
    this.paintDirty = true;
    this.surface?.invalidatePaint(this);
  }

  /** Intrinsic content size of a leaf for the given inner limits. Containers ignore it. */
  measure(_maxW: number, _maxH: number): readonly [number, number] {
    return [0, 0];
  }

  /** Emit this node's primitives (node-local coordinates: origin at the box centre, y up). */
  paint(_p: Painter): void {
    // containers paint nothing by default
  }

  /** Called when the node joins / leaves a surface (subclasses start or stop animations here). */
  protected onAttach(_surface: UiSurface | null): void {
    // optional
  }

  /** @internal */
  attach(surface: UiSurface | null): void {
    if (this.surface === surface) return;
    this.surface = surface;
    this.slot = -1;
    this.onAttach(surface);
    for (const c of this.children) c.attach(surface);
  }

  /** True when this node and all ancestors are visible and effectively opaque enough to interact with. */
  get interactive(): boolean {
    if (!this.#shown || !this.enabled || this.opacity < 0.05) return false;
    for (let n = this.parent; n; n = n.parent) {
      if (!n.#shown || !n.enabled || n.opacity < 0.05) return false;
    }
    return this.surface !== null;
  }

  /**
   * Convert a pick ray (in the space the surface is registered in — see `PointerInfo.ray`) to this node's
   * local coordinates (origin at the box centre, x right, y up). Null if the ray misses the node's plane.
   */
  localPoint(e: PointerInfo): { x: number; y: number } | null {
    return this.surface?.rayToLocal(this, e.ray) ?? null;
  }

  /** Offer a wheel event to this node and then its ancestors (so a scroll view scrolls under its buttons). */
  bubbleWheel(deltaY: number, e: PointerInfo): boolean {
    if (this.handlers?.wheel?.(deltaY, e)) return true;
    return this.parent?.bubbleWheel(deltaY, e) ?? false;
  }

  /** Walk this subtree (pre-order). */
  walk(fn: (n: UiNode) => void): void {
    fn(this);
    for (const c of this.children) c.walk(fn);
  }
}

/* ------------------------------------------------------------------------------------------- layout */

function layoutNode(n: UiNode, aw: number, ah: number, forceW?: number, forceH?: number): void {
  const padX = n.padL + n.padR;
  const padY = n.padT + n.padB;
  let w =
    forceW ?? (typeof n.width === 'number' ? n.width : n.width === 'fill' && Number.isFinite(aw) ? aw : NaN);
  let h =
    forceH ??
    (typeof n.height === 'number' ? n.height : n.height === 'fill' && Number.isFinite(ah) ? ah : NaN);
  if (!Number.isNaN(w)) w = clamp(w, n.minW, n.maxW);
  if (!Number.isNaN(h)) h = clamp(h, n.minH, n.maxH);
  const cw = (Number.isNaN(w) ? Math.min(aw, n.maxW) : w) - padX;
  const ch = (Number.isNaN(h) ? Math.min(ah, n.maxH) : h) - padY;
  const flow: UiNode[] = [];
  for (const c of n.children) if (c.visible && !c.float) flow.push(c);
  const gap = n.gap;
  let contentW = 0;
  let contentH = 0;
  let wrapped = false;

  if (flow.length === 0) {
    const m = n.measure(Math.max(cw, 0), Math.max(ch, 0));
    contentW = m[0];
    contentH = m[1];
  } else if (n.dir === 'stack') {
    for (const c of flow) {
      layoutNode(c, cw, ch);
      contentW = Math.max(contentW, c.bw);
      contentH = Math.max(contentH, c.bh);
    }
  } else if (n.dir === 'col') {
    let used = gap * (flow.length - 1);
    let growSum = 0;
    for (const c of flow) {
      if (c.height === 'fill' && Number.isFinite(ch)) growSum += c.grow;
      else {
        layoutNode(c, cw, Infinity);
        used += c.bh;
      }
    }
    if (growSum > 0) {
      const left = Math.max(ch - used, 0);
      for (const c of flow) {
        if (c.height !== 'fill') continue;
        layoutNode(c, cw, Infinity, undefined, (left * c.grow) / growSum);
        used += c.bh;
      }
    }
    contentH = used;
    for (const c of flow) contentW = Math.max(contentW, c.bw);
  } else if (n.wrap && Number.isFinite(cw)) {
    // wrapping row: greedy lines, positions are final here
    wrapped = true;
    let x = 0;
    let y = 0;
    let lineH = 0;
    let lineStart = 0;
    const finishLine = (end: number): void => {
      for (let i = lineStart; i < end; i++) {
        const c = flow[i]!;
        const a = c.alignSelf ?? n.align;
        c.by = n.padT + y + (a === 'center' ? (lineH - c.bh) / 2 : a === 'end' ? lineH - c.bh : 0);
      }
    };
    flow.forEach((c, i) => {
      layoutNode(c, cw, Infinity);
      if (x > 0 && x + c.bw > cw + 0.01) {
        finishLine(i);
        y += lineH + gap;
        x = 0;
        lineH = 0;
        lineStart = i;
      }
      c.bx = n.padL + x;
      x += c.bw + gap;
      lineH = Math.max(lineH, c.bh);
      contentW = Math.max(contentW, x - gap);
    });
    finishLine(flow.length);
    contentH = y + lineH;
  } else {
    let used = gap * (flow.length - 1);
    let growSum = 0;
    for (const c of flow) {
      if (c.width === 'fill' && Number.isFinite(cw)) growSum += c.grow;
      else {
        layoutNode(c, Math.max(cw - used, 0), ch);
        used += c.bw;
      }
    }
    if (growSum > 0) {
      const left = Math.max(cw - used, 0);
      for (const c of flow) {
        if (c.width !== 'fill') continue;
        layoutNode(c, Infinity, ch, (left * c.grow) / growSum);
        used += c.bw;
      }
    }
    contentW = used;
    for (const c of flow) contentH = Math.max(contentH, c.bh);
  }

  n.bw = Number.isNaN(w) ? clamp(contentW + padX, n.minW, n.maxW) : w;
  n.bh = Number.isNaN(h) ? clamp(contentH + padY, n.minH, n.maxH) : h;
  const iw = n.bw - padX;
  const ih = n.bh - padY;

  if (flow.length > 0 && !wrapped) {
    if (n.dir === 'stack') {
      for (const c of flow) {
        const a = c.alignSelf ?? n.align;
        const fw = (c.width === 'fill' || a === 'stretch') && typeof c.width !== 'number';
        const fh = c.height === 'fill' && typeof c.height !== 'number';
        if ((fw && Math.abs(c.bw - iw) > 0.01) || (fh && Math.abs(c.bh - ih) > 0.01))
          layoutNode(c, iw, ih, fw ? iw : undefined, fh ? ih : undefined);
        c.bx = n.padL + (a === 'center' ? (iw - c.bw) / 2 : a === 'end' ? iw - c.bw : 0);
        c.by = n.padT + (n.justify === 'center' ? (ih - c.bh) / 2 : n.justify === 'end' ? ih - c.bh : 0);
      }
    } else if (n.dir === 'col') {
      const free = Math.max(ih - contentH, 0);
      let y = n.justify === 'center' ? free / 2 : n.justify === 'end' ? free : 0;
      const extra = n.justify === 'between' && flow.length > 1 ? free / (flow.length - 1) : 0;
      for (const c of flow) {
        const a = c.alignSelf ?? n.align;
        if (
          (c.width === 'fill' || a === 'stretch') &&
          typeof c.width !== 'number' &&
          Math.abs(c.bw - iw) > 0.01
        )
          layoutNode(c, iw, Infinity, iw, c.height === 'fill' ? c.bh : undefined);
        c.bx = n.padL + (a === 'center' ? (iw - c.bw) / 2 : a === 'end' ? iw - c.bw : 0);
        c.by = n.padT + y;
        y += c.bh + gap + extra;
      }
    } else {
      const free = Math.max(iw - contentW, 0);
      let x = n.justify === 'center' ? free / 2 : n.justify === 'end' ? free : 0;
      const extra = n.justify === 'between' && flow.length > 1 ? free / (flow.length - 1) : 0;
      for (const c of flow) {
        const a = c.alignSelf ?? n.align;
        if (
          (c.height === 'fill' || a === 'stretch') &&
          typeof c.height !== 'number' &&
          Math.abs(c.bh - ih) > 0.01
        )
          layoutNode(c, c.bw, ih, c.bw, ih);
        c.bx = n.padL + x;
        c.by = n.padT + (a === 'center' ? (ih - c.bh) / 2 : a === 'end' ? ih - c.bh : 0);
        x += c.bw + gap + extra;
      }
    }
  }

  for (const c of n.children) {
    const f = c.float;
    if (!f || !c.visible) continue;
    layoutNode(c, n.bw, n.bh);
    const ax = f.ax ?? 0.5;
    const ay = f.ay ?? 0.5;
    c.bx = n.bw * ax - c.bw * (f.px ?? ax) + (f.dx ?? 0);
    c.by = n.bh * ay - c.bh * (f.py ?? ay) + (f.dy ?? 0);
  }
}

/** Lay out a tree whose root occupies `width × height` units. */
export function layoutTree(root: UiNode, width: number, height: number): void {
  layoutNode(root, width, height, width, height);
  root.bx = 0;
  root.by = 0;
}
