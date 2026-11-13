/**
 * Callout — a world-anchored label drawn in screen space: a dot on the subject, a leader line and a small
 * hologlass tag with the text. Constant size on screen, never blurred by depth of field, legible over any
 * backdrop (the tag has its own dark plate). Positioned every frame by `AnnotationLayer`.
 */
import type { ColorLike } from '@/style';
import { UiNode } from '../core/node';
import { lit, rgba, type Painter } from '../core/painter';
import { accentOf, UI } from '../theme';
import { Label } from '../widgets/label';

export class Callout extends UiNode {
  /** Anchor position relative to the tag centre, units (set by the layer before each repaint). */
  ax = 0;
  ay = 0;
  /** Target and current tag centre in surface units (the layer eases one toward the other). */
  tx = 0;
  ty = 0;
  placed = false;
  /** 0…1 fade target (off-screen / occluded anchors fade out). */
  shown = 0;
  readonly text: Label;

  constructor(
    text: string,
    readonly tone: ColorLike | null,
    fontSize: number,
  ) {
    super({ float: { ax: 0.5, ay: 0.5 }, pad: [5, 12], opacity: 0 });
    this.text = new Label(text, { font: 'bodyBold', size: fontSize, nowrap: true, lineHeight: 1.25 });
    this.add(this.text);
  }

  override paint(p: Painter): void {
    const tone = rgba(this.tone ?? accentOf(this));
    const hw = this.bw / 2;
    const hh = this.bh / 2;
    // leader: from the anchor to the nearest point of the tag's outline
    const ex = Math.min(Math.max(this.ax, -hw), hw);
    const ey = Math.min(Math.max(this.ay, -hh), hh);
    const len = Math.hypot(this.ax - ex, this.ay - ey);
    if (len > 6) {
      p.line(this.ax, this.ay, ex, ey, 4.5, { fill: rgba('bg.void', 0.55) });
      p.line(this.ax, this.ay, ex, ey, 2, { fill: lit(tone, 1.2) });
    }
    p.circle(this.ax, this.ay, 13, { fill: rgba('bg.void', 0.6) });
    p.circle(this.ax, this.ay, 8, {
      fill: rgba('white'),
      border: lit(tone, 1.3),
      bw: 2.4,
      glow: 7,
      glowAlpha: 0.5,
    });
    p.rect(0, 0, this.bw, this.bh, {
      r: Math.min(hh, 14),
      fill: rgba('bg.void', 0.93),
      border: [tone[0], tone[1], tone[2], 0.8],
      bw: 1.4,
      glow: 10,
      glowAlpha: 0.22,
    });
  }
}

/** Font size of world labels: the body size, but never under `UI.minWorldLabelPx` real CSS pixels. */
export function worldLabelSize(cssPxPerUnit: number, size = UI.text.small): number {
  return Math.max(size, UI.minWorldLabelPx / Math.max(cssPxPerUnit, 0.01));
}
