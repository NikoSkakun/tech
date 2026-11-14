/**
 * Label — a block of SDF text in the UI tree (rich mini-markup of `@/text`: **term**, _emphasis_,
 * `formula`, x^2, {token:colour}). Formula spans get a darker inset behind them (STYLE_GUIDE §6).
 */
import { fontData, layoutRuns, richRuns, type LayoutResult, type FaceId, type TextAlign } from '@/text';
import type { ColorLike } from '@/style';
import { UiNode, type NodeProps } from '../core/node';
import { rgba, type Painter } from '../core/painter';
import { accentOf, TEXT_COLOR, UI } from '../theme';

export interface LabelStyle {
  font?: FaceId;
  /** Font size in units (never below `UI.text.caption`). Default `UI.text.body`. */
  size?: number;
  color?: ColorLike;
  /** Colour of `**terms**`; default: the accent of the subtree. */
  accent?: ColorLike;
  formulaColor?: ColorLike;
  align?: TextAlign;
  lineHeight?: number;
  letterSpacing?: number;
  /** Wrap at this width even when the parent offers more. */
  maxWidth?: number;
  /** Single line: never wrap. */
  nowrap?: boolean;
  rich?: boolean;
  /** Brightness multiplier (> 1 blooms). */
  emissive?: number;
  /** Reserve room for this many glyphs so the text can change length without a rebuild (readouts). */
  reserve?: number;
  /** Draw the darker inset behind `formula` spans. Default true. */
  insets?: boolean;
  /** The box does not follow the text: changing the text only repaints (live readouts). */
  stable?: boolean;
  /** Vertical placement when the box is taller than the text. Default `middle`. */
  valign?: 'top' | 'middle' | 'bottom';
}

export class Label extends UiNode {
  style: LabelStyle;
  private content: string;
  private layout: LayoutResult | null = null;
  private layoutKey = '';

  constructor(text: string, style: LabelStyle = {}, props: NodeProps = {}) {
    super(props);
    this.content = text;
    this.style = style;
  }

  get text(): string {
    return this.content;
  }
  set text(value: string) {
    if (value === this.content) return;
    const before = this.layout;
    this.content = value;
    // a fixed-width single-line label (readout) only needs a repaint
    if (before && (this.style.stable || (typeof this.width === 'number' && typeof this.height === 'number')))
      this.repaint();
    else this.relayout();
  }

  /** Change style properties and re-lay out. */
  setStyle(style: Partial<LabelStyle>): void {
    Object.assign(this.style, style);
    this.layoutKey = '';
    this.relayout();
  }

  /** Change only the text colour (no re-layout). */
  recolor(color: ColorLike): void {
    if (this.style.color === color) return;
    this.style.color = color;
    this.repaint();
  }

  get fontSize(): number {
    return Math.max(this.style.size ?? UI.text.body, UI.text.caption - 1);
  }

  private compute(maxW: number): LayoutResult {
    const s = this.style;
    const limit = s.nowrap ? undefined : Math.min(maxW, s.maxWidth ?? Infinity);
    const wrap = limit !== undefined && Number.isFinite(limit) ? Math.max(limit, this.fontSize) : undefined;
    const key = `${this.content}\u0001${wrap ?? ''}\u0001${this.fontSize}`;
    if (this.layout && key === this.layoutKey) return this.layout;
    this.layoutKey = key;
    // one pipeline with the DOM interface (`richRuns` of `@/text`): short formulas stay on one line
    this.layout = layoutRuns(
      richRuns(this.content, s.rich ?? true),
      {
        font: s.font ?? 'body',
        size: this.fontSize,
        maxWidth: wrap,
        align: s.align ?? 'left',
        lineHeight: s.lineHeight ?? 1.42,
        letterSpacing: s.letterSpacing ?? 0,
        anchorX: 'left',
        anchorY: 'top',
        rich: s.rich ?? true,
      },
      fontData(),
    );
    return this.layout;
  }

  override measure(maxW: number): readonly [number, number] {
    const m = this.compute(maxW).metrics;
    return [Math.ceil(m.width), m.height];
  }

  override paint(p: Painter): void {
    const s = this.style;
    const iw = this.bw - this.padL - this.padR;
    const ih = this.bh - this.padT - this.padB;
    const layout = this.compute(iw + 0.5);
    const m = layout.metrics;
    const align = s.align ?? 'left';
    const ox =
      -this.bw / 2 +
      this.padL +
      (align === 'center' ? (iw - m.width) / 2 : align === 'right' ? iw - m.width : 0);
    const v = s.valign ?? 'middle';
    const oy =
      this.bh / 2 - this.padT - (v === 'top' ? 0 : v === 'bottom' ? ih - m.height : (ih - m.height) / 2);
    if (s.insets !== false) {
      for (const span of m.spans) {
        if (span.kind !== 'formula') continue;
        const w = span.x1 - span.x0 + 10;
        const h = (span.top - span.bottom) * 0.86;
        p.rect(ox + (span.x0 + span.x1) / 2, oy + (span.top + span.bottom) / 2, w, h, {
          r: UI.radius.inset * 0.7,
          fill: rgba('bg.void', 0.62),
        });
      }
    }
    const k = s.emissive ?? 1;
    const tint = (c: ColorLike): [number, number, number, number] => {
      const q = rgba(c);
      return [q[0] * k, q[1] * k, q[2] * k, 1];
    };
    p.text(
      layout,
      ox,
      oy,
      1,
      {
        base: tint(s.color ?? TEXT_COLOR.main),
        accent: tint(s.accent ?? accentOf(this)),
        formula: tint(s.formulaColor ?? 'yellow'),
      },
      1,
      s.reserve ?? 0,
    );
  }
}
