/**
 * AnnotationLayer — keeps callouts and hotspot markers glued to their world anchors in screen space:
 * projects the anchors every frame, places the tags so they do not overlap each other or leave the free
 * area, eases them (no jitter), and fades annotations whose anchor is off-screen or hidden behind geometry.
 */
import type { ColorLike } from '@/style';
import { UiNode } from '../core/node';
import { uiPointer } from '../core/surface';
import { Callout, worldLabelSize } from './callout';
import { HotspotMarker } from './hotspot';

/** Screen position of an anchor in surface units from the centre (y up); `visible` false when behind the camera. */
export interface Projected {
  x: number;
  y: number;
  visible: boolean;
}

export interface CalloutDef {
  /** Returns the anchor's current screen position. */
  project(): Projected;
  text: string;
  color?: ColorLike;
  side?: 'left' | 'right' | 'up' | 'down';
  /** True while the anchor is hidden behind something (the owner raycasts; may be throttled). */
  occluded?(): boolean;
  /** True while the callout is switched off by state (it fades out in place). */
  hidden?(): boolean;
  /** Live text, read every frame (the tag re-lays out only when it changed). */
  label?(): string;
}

export interface HotspotDef {
  project(): Projected;
  title: string;
  occluded?(): boolean;
  /** True while the hotspot is switched off by state (it fades out in place and cannot be clicked). */
  hidden?(): boolean;
  onPick(marker: HotspotMarker): void;
}

/** Free rectangle of the surface (units from the centre) the annotations must stay in. */
export interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const REACH = 74; // distance of a tag from its anchor
const DIRS: Record<string, [number, number]> = {
  right: [1, 0.55],
  left: [-1, 0.55],
  up: [0, 1.25],
  down: [0, -1.25],
};
const ORDER = ['right', 'left', 'up', 'down'] as const;

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export class AnnotationLayer extends UiNode {
  private callouts: { def: CalloutDef; node: Callout }[] = [];
  private hotspots: { def: HotspotDef; node: HotspotMarker }[] = [];
  private time = 0;

  constructor() {
    super({ dir: 'stack', width: 'fill', height: 'fill' });
  }

  /** Replace all annotations. */
  set(callouts: readonly CalloutDef[], hotspots: readonly HotspotDef[], cssPxPerUnit: number): void {
    this.clear();
    const size = worldLabelSize(cssPxPerUnit);
    this.callouts = callouts.map((def) => ({ def, node: new Callout(def.text, def.color ?? null, size) }));
    this.hotspots = hotspots.map((def) => {
      const node: HotspotMarker = new HotspotMarker(def.title, () => def.onPick(node));
      return { def, node };
    });
    // named for QA (`__ui.locate('hotspot-0')`): declaration order
    this.callouts.forEach((c, i) => (c.node.name = `callout-${i}`));
    this.hotspots.forEach((h, i) => (h.node.name = `hotspot-${i}`));
    for (const c of this.callouts) this.add(c.node);
    for (const h of this.hotspots) this.add(h.node);
  }

  get markers(): readonly HotspotMarker[] {
    return this.hotspots.map((h) => h.node);
  }

  /** Per-frame placement. `dt` in seconds. */
  update(dt: number, bounds: Bounds): void {
    this.time += dt;
    const k = 1 - Math.exp(-12 * dt);
    const fade = 1 - Math.exp(-9 * dt);
    const taken: Rect[] = [];
    const inside = (p: Projected): boolean =>
      p.visible && p.x > bounds.left && p.x < bounds.right && p.y > bounds.bottom && p.y < bounds.top;

    for (const { def, node } of this.hotspots) {
      const p = def.project();
      const on = inside(p) && !(def.occluded?.() ?? false) && !(def.hidden?.() ?? false);
      node.shown += ((on ? 1 : 0) - node.shown) * fade;
      node.opacity = node.shown;
      node.enabled = node.shown > 0.5;
      node.x = p.x;
      node.y = p.y;
      node.phase = (this.time * 0.7 + node.title.length * 0.13) % 1;
      if (node.shown > 0.01) node.repaint();
      if (on) taken.push({ x0: p.x - 24, y0: p.y - 24, x1: p.x + 24, y1: p.y + 24 });
    }

    for (const { def, node } of this.callouts) {
      const p = def.project();
      const on = inside(p) && !(def.occluded?.() ?? false) && !(def.hidden?.() ?? false);
      node.shown += ((on ? 1 : 0) - node.shown) * fade;
      node.opacity = node.shown;
      if (def.label) node.text.text = def.label();
      if (!p.visible) continue;
      const hw = node.bw / 2;
      const hh = node.bh / 2;
      // try the preferred side first, then the others; keep the first spot that is free and inside
      const sides = def.side ? [def.side, ...ORDER.filter((s) => s !== def.side)] : ORDER;
      let best: Rect | null = null;
      let bx = p.x;
      let by = p.y;
      for (const side of sides) {
        const d = DIRS[side]!;
        const cx = p.x + d[0] * (REACH + hw * Math.abs(d[0]));
        const cy = p.y + d[1] * (REACH * 0.62 + hh);
        const r = { x0: cx - hw - 6, y0: cy - hh - 6, x1: cx + hw + 6, y1: cy + hh + 6 };
        const fits = r.x0 > bounds.left && r.x1 < bounds.right && r.y0 > bounds.bottom && r.y1 < bounds.top;
        const free = !taken.some((t) => r.x0 < t.x1 && r.x1 > t.x0 && r.y0 < t.y1 && r.y1 > t.y0);
        if (!best || (fits && free)) {
          best = r;
          bx = cx;
          by = cy;
          if (fits && free) break;
        }
      }
      // touch screens are narrow: a tag that fits on no side is pulled back inside the free area instead of
      // leaving the screen (desktops keep the first side, as before)
      if (uiPointer.coarse && best) {
        const minX = bounds.left + hw + 6;
        const maxX = bounds.right - hw - 6;
        bx = minX <= maxX ? Math.min(Math.max(bx, minX), maxX) : (bounds.left + bounds.right) / 2;
        const minY = bounds.bottom + hh + 6;
        const maxY = bounds.top - hh - 6;
        if (minY <= maxY) by = Math.min(Math.max(by, minY), maxY);
        best = { x0: bx - hw - 6, y0: by - hh - 6, x1: bx + hw + 6, y1: by + hh + 6 };
      }
      if (best && on) taken.push(best);
      node.tx = bx;
      node.ty = by;
      if (!node.placed || node.shown < 0.02) {
        node.x = bx;
        node.y = by;
        node.placed = node.bw > 0;
      } else {
        node.x += (bx - node.x) * k;
        node.y += (by - node.y) * k;
      }
      node.ax = p.x - node.x;
      node.ay = p.y - node.y;
      if (node.shown > 0.01) node.repaint();
    }
  }
}
