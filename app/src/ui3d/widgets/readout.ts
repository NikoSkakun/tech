/**
 * Readout — a labelled number that counts up to its new value (STYLE_GUIDE §5), with the unit bound by a
 * no-break space. `FormulaBlock` — a formula on a dark inset with an optional note.
 */
import { fmtUnit } from '@/content/format';
import type { ColorLike } from '@/style';
import type { FaceId } from '@/text';
import { UiNode, type NodeProps } from '../core/node';
import { rgba, type Painter } from '../core/painter';
import { TEXT_COLOR, UI } from '../theme';
import { Label } from './label';

export interface ReadoutProps extends NodeProps {
  label?: string;
  value?: number;
  unit?: string;
  digits?: number;
  /** Custom text for a value (overrides unit / digits). */
  format?: (value: number) => string;
  /** Value colour (e.g. a status colour). Default white. */
  color?: ColorLike;
  size?: 'md' | 'lg';
  /** Seconds of the count-up; 0 = jump. Default 0.45. */
  duration?: number;
  /** Text value instead of a number («LFP», «з втратами»); change it later with `setText()`. */
  text?: string;
  /** Characters to reserve for text values (default: the initial text, at least 8). */
  chars?: number;
}

export class Readout extends UiNode {
  /** Number currently displayed (animated toward the target). */
  num: number;
  private target: number;
  private readonly text: Label;
  private readonly format: (v: number) => string;
  private readonly duration: number;

  constructor(props: ReadoutProps = {}) {
    super({ dir: 'col', gap: 0, minW: 96, align: 'stretch', ...props });
    const lg = props.size === 'lg';
    this.target = this.num = props.value ?? 0;
    this.duration = props.duration ?? 0.45;
    this.format =
      props.format ??
      ((v) =>
        fmtUnit(
          v,
          props.unit ?? '',
          props.digits !== undefined ? { digits: props.digits } : { maxDigits: 2 },
        ));
    if (props.label)
      this.add(new Label(props.label, { size: UI.text.caption, color: TEXT_COLOR.dim, nowrap: true }));
    // fixed box sized for the initial text plus one more digit: live updates only repaint
    const font: { font: FaceId; size: number; nowrap: true } = {
      font: 'mono',
      size: lg ? UI.text.h1 : UI.text.h2,
      nowrap: true,
    };
    const textual = props.text !== undefined;
    if (textual) font.font = 'bodyBold';
    const sample = textual
      ? props.chars !== undefined
        ? 'о'.repeat(props.chars)
        : `${props.text}оо`
      : `8${this.format(this.num).replace(/\d/g, '8')}`;
    const room = Math.ceil(new Label(sample, font).measure(Infinity)[0]);
    this.text = new Label(
      props.text ?? this.format(this.num),
      {
        font: font.font,
        size: lg ? UI.text.h1 : UI.text.h2,
        color: props.color ?? 'white',
        nowrap: true,
        reserve: Math.max(14, props.chars ?? props.text?.length ?? 0),
        valign: 'middle',
        stable: true,
      },
      { height: lg ? 46 : 34, width: typeof props.width === 'number' ? 'fill' : room },
    );
    this.add(this.text);
  }

  get value(): number {
    return this.target;
  }
  set value(v: number) {
    if (v === this.target) return;
    this.target = v;
    const host = this.surface?.host;
    if (!host || this.duration <= 0 || host.reducedMotion()) {
      this.num = v;
      this.text.text = this.format(v);
      return;
    }
    host.tweens.to(
      this as Readout,
      { num: v },
      {
        duration: this.duration,
        ease: 'power2.out',
        onUpdate: () => (this.text.text = this.format(this.num)),
      },
    );
  }

  /** Set without animation (values driven every frame by a simulation). */
  setNow(v: number): void {
    this.target = this.num = v;
    this.text.text = this.format(v);
  }

  /** Show a text value (no count-up). */
  setText(text: string): void {
    this.text.text = text;
  }

  set color(c: ColorLike) {
    this.text.recolor(c);
  }
}

export interface FormulaProps extends NodeProps {
  /** The formula in the text mini-markup (without backticks), e.g. `P = U·I·cos φ`. */
  formula: string;
  /** Short explanation under the formula. */
  note?: string;
  size?: number;
}

export class FormulaBlock extends UiNode {
  constructor(props: FormulaProps) {
    super({ dir: 'col', gap: 6, width: 'fill', pad: [14, 16], align: 'center', ...props });
    this.add(
      new Label(
        `\`${props.formula}\``,
        { size: props.size ?? UI.text.h3, align: 'center', insets: false, lineHeight: 1.5 },
        { width: 'fill' },
      ),
    );
    if (props.note)
      this.add(
        new Label(
          props.note,
          { size: UI.text.caption, color: TEXT_COLOR.dim, align: 'center' },
          { width: 'fill' },
        ),
      );
  }

  override paint(p: Painter): void {
    p.rect(0, 0, this.bw, this.bh, {
      r: UI.radius.control,
      fill: rgba('bg.void', 0.7),
      border: rgba('yellow', 0.28),
      bw: 1,
    });
    p.rect(-this.bw / 2 + 2.5, 0, 3, this.bh - 18, { r: 1.5, fill: rgba('yellow', 0.85) });
  }
}
