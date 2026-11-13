/**
 * Energy ribbon (Sankey diagram) of step 8 on the HUD board: the ribbon's width is power. The source's output
 * enters on the left; the `orange`/`red` branch that peels off downward is the heat lost in the cord, the
 * `yellow` remainder reaches the cottage. Widths are true to scale against `fullW` (the rated 2 kW).
 * Each stream carries its number (sent, arrived, heat), so the ribbon reads without the stats below it.
 */
import { fmtUnit } from '@/content';
import type { ColorLike } from '@/style';
import { fontData, layoutText } from '@/text';
import { UI, UiNode, lit, rgba, type Painter } from '@/ui3d';

export class Sankey extends UiNode {
  private loadW = 0;
  private lossW = 0;
  private key = '';

  constructor(
    private readonly fullW: number,
    height = 150,
  ) {
    super({ width: 'fill', height });
  }

  set(loadW: number, lossW: number): void {
    const key = `${Math.round(loadW)}|${Math.round(lossW)}`;
    if (key === this.key) return;
    this.key = key;
    this.loadW = loadW;
    this.lossW = lossW;
    this.repaint();
  }

  override paint(p: Painter): void {
    const W = Math.min(this.w - 40, 440);
    const x0 = -W / 2;
    const x1 = W / 2;
    const xs = x0 + W * 0.42; // where the loss branch leaves
    const MAXT = this.h * 0.46; // ribbon thickness of the full rated power
    const scale = MAXT / this.fullW;
    const tLoad = Math.max(this.loadW * scale, 1.5);
    const tLoss = Math.max(this.lossW * scale, this.lossW > 0.5 ? 1.5 : 0);
    const tAll = tLoad + tLoss;
    const top = this.h / 2 - 34; // upper edge of the ribbon (the numbers sit above it)
    const yellow = lit(rgba('yellow'), 1.25);
    const loss = lit(rgba('orange'), 1.2);
    const red = lit(rgba('red'), 1.2);
    // trunk: both shares side by side (load on top, loss below), then the load runs on to the right
    p.rect((x0 + xs) / 2, top - tLoad / 2, xs - x0, tLoad, { fill: yellow });
    p.rect((xs + x1 - 12) / 2, top - tLoad / 2, x1 - 12 - xs, tLoad, { fill: yellow });
    // arrow head of the delivered power
    p.line(x1 - 14, top - tLoad / 2, x1 - 4, top - tLoad / 2, Math.max(tLoad * 0.55, 3), { fill: yellow });
    if (tLoss > 0) {
      p.rect((x0 + xs) / 2, top - tLoad - tLoss / 2, xs - x0, tLoss, { fill: loss });
      // the loss branch bends down in three strokes of the same thickness
      const y0 = top - tLoad - tLoss / 2;
      const bottom = -this.h / 2 + 10;
      const xm = xs + Math.min(46, (y0 - bottom) * 0.8);
      p.line(xs - 1, y0, xm, (y0 + bottom) / 2, tLoss, { fill: loss });
      p.line(xm, (y0 + bottom) / 2, xm + 6, bottom, tLoss, { fill: red });
    }
    // the input edge
    p.rect(x0 - 3, top - tAll / 2, 4, tAll + 6, { fill: rgba('white', 0.9), r: 2 });
    const label = (w: number, x: number, y: number, side: 'left' | 'right', color: ColorLike): void => {
      const l = layoutText(
        fmtUnit(w, 'W', { maxDigits: w < 10 ? 1 : 0 }), // as in the stats below
        { font: 'mono', size: UI.text.body, anchorX: side, anchorY: 'middle' },
        fontData(),
      );
      const c = rgba(color);
      p.text(l, x, y, 1, { base: c, accent: c, formula: c }, 1, 12);
    };
    const yText = this.h / 2 - 14;
    label(this.loadW + this.lossW, x0 - 3, yText, 'left', 'white');
    label(this.loadW, x1 - 4, yText, 'right', 'yellow');
    if (tLoss > 0) label(this.lossW, xs + 70, -this.h / 2 + 22, 'left', 'orange');
  }
}
