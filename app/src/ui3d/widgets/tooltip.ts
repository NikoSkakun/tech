/**
 * Tooltip — the name of whatever is under the pointer (STYLE_GUIDE §6: every interactive object has one).
 * The HUD owns a single instance and moves it with the pointer; it never leaves the screen.
 */
import { conceal, reveal } from '../core/anim';
import { UiNode } from '../core/node';
import { rgba, type Painter } from '../core/painter';
import { accentOf, UI } from '../theme';
import { Label } from './label';

export class Tooltip extends UiNode {
  private readonly text: Label;

  constructor() {
    super({ pad: [7, 14], visible: false, opacity: 0, layer: UI.layer.tip, float: { ax: 0.5, ay: 0.5 } });
    this.text = new Label('', { size: UI.text.small, maxWidth: 360, lineHeight: 1.32 });
    this.add(this.text);
  }

  /**
   * Show `text` near a point given in surface units from the surface centre (x right, y up). The bubble sits
   * above-right of the pointer and flips / clamps to stay inside `bounds` (half extents of the surface).
   */
  showAt(text: string, x: number, y: number, bounds: { hw: number; hh: number }): void {
    this.text.text = text;
    const w = this.text.measure(360)[0] + 28;
    const h = this.text.measure(360)[1] + 14;
    const margin = 12;
    let cx = x + 18 + w / 2;
    if (cx + w / 2 > bounds.hw - margin) cx = x - 18 - w / 2;
    let cy = y + 22 + h / 2;
    if (cy + h / 2 > bounds.hh - margin) cy = y - 26 - h / 2;
    cx = Math.min(Math.max(cx, -bounds.hw + margin + w / 2), bounds.hw - margin - w / 2);
    // float anchored at the parent's centre: offsets are in layout space (y down)
    this.float = { ax: 0.5, ay: 0.5, dx: cx, dy: -cy };
    this.relayout();
    reveal(this, { dy: -6, scale: 0.94, duration: 0.16 });
  }

  hide(): void {
    conceal(this, { dy: -4, duration: 0.1 });
  }

  override paint(p: Painter): void {
    const accent = rgba(accentOf(this));
    const r = Math.min(this.bh / 2, 14);
    p.rect(0, -2, this.bw, this.bh, { r, border: rgba('bg.void', 0), glow: 18, glowAlpha: 0.5 });
    p.rect(0, 0, this.bw, this.bh, {
      r,
      fill: rgba('bg.void', 0.985),
      border: [accent[0], accent[1], accent[2], 0.7],
      bw: 1.2,
    });
  }
}
