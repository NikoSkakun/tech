/**
 * Chip — small pill for key terms, «Цифри і факти», scale labels, statuses and honesty notes.
 * Honesty chips are mandatory on every slowed-down, scaled or simplified visual (DECISIONS §5).
 */
import { fmtNumber, fmtSci } from '@/content/format';
import type { ColorLike } from '@/style';
import { sfx } from '../core/focus';
import type { IconName } from '../core/icons';
import type { NodeProps } from '../core/node';
import { rgba, type Painter } from '../core/painter';
import { accentOf, STATUS, UI } from '../theme';
import { Control } from './control';
import { Label } from './label';
import { Icon } from './panel';

export type ChipKind = 'term' | 'fact' | 'scale' | 'honesty' | 'status' | 'plain';

export interface ChipProps extends NodeProps {
  text: string;
  kind?: ChipKind;
  icon?: IconName;
  /** Overrides the kind's colour (e.g. a `plantType.*` or status colour). */
  color?: ColorLike;
  tooltip?: string;
  /** Max text width before wrapping (fact chips hold a sentence). */
  maxWidth?: number;
  onClick?: () => void;
}

const LOOK: Record<ChipKind, { icon?: IconName; font: 'body' | 'bodyBold' | 'mono'; color?: ColorLike }> = {
  term: { icon: 'book', font: 'bodyBold' },
  fact: { icon: 'lightning', font: 'body', color: 'yellow' },
  scale: { icon: 'ruler', font: 'mono', color: 'mist' },
  honesty: { icon: 'info', font: 'bodyBold', color: STATUS.warning },
  status: { font: 'bodyBold', color: STATUS.ok },
  plain: { font: 'body', color: 'mist' },
};

export class Chip extends Control {
  onClick: (() => void) | null;
  readonly kind: ChipKind;
  private tone: ColorLike | null;
  private readonly text: Label;
  private readonly glyph: Icon | null = null;

  constructor(props: ChipProps) {
    const kind = props.kind ?? 'plain';
    const look = LOOK[kind];
    const multiline = props.maxWidth !== undefined;
    super({
      dir: 'row',
      align: multiline ? 'start' : 'center',
      gap: 7,
      pad: multiline ? [8, 14, 8, 12] : [0, 13, 0, 11],
      minH: 32,
      ...props,
    });
    this.kind = kind;
    this.tone = props.color ?? look.color ?? null;
    this.onClick = props.onClick ?? null;
    this.lift = this.onClick ? 3 : 0;
    this.squash = this.onClick ? 0.95 : 1;
    this.minHit = this.onClick ? UI.hit : 0;
    this.clickable = this.onClick !== null;
    const icon = props.icon ?? look.icon;
    if (icon) {
      this.glyph = new Icon(
        icon,
        17,
        this.tone ?? accentOf(this),
        1,
        multiline ? { alignSelf: 'start' } : {},
      );
      this.add(this.glyph);
    }
    this.text = new Label(props.text, {
      font: look.font,
      size: UI.text.caption,
      color: 'white',
      maxWidth: props.maxWidth,
      nowrap: !multiline,
      lineHeight: 1.34,
    });
    this.add(this.text);
    if (props.tooltip) this.on({ tooltip: props.tooltip });
  }

  get label(): string {
    return this.text.text;
  }
  set label(v: string) {
    this.text.text = v;
  }

  /** Border and icon colour (status chips that change with the state: «норма» → «перегрів»). */
  get color(): ColorLike | null {
    return this.tone;
  }
  set color(c: ColorLike | null) {
    if (c === this.tone) return;
    this.tone = c;
    this.glyph?.set(this.glyph.icon, c ?? accentOf(this));
    this.repaint();
  }

  /** Change the icon (e.g. warning ↔ check). */
  setIcon(icon: IconName): void {
    this.glyph?.set(icon);
  }

  protected override activate(): void {
    if (!this.onClick) return;
    sfx('tap');
    this.onClick();
  }

  override paint(p: Painter): void {
    const tone = rgba(this.tone ?? accentOf(this));
    const r = Math.min(this.bh / 2, 16);
    const hov = this.onClick ? this.hoverT : 0;
    this.paintFocus(p, this.bw, this.bh, r);
    p.rect(0, 0, this.bw, this.bh, {
      r,
      fill: rgba('bg.indigo', 0.9),
      fill2: rgba('bg.deep', 0.94),
      border: [tone[0], tone[1], tone[2], 0.5 + 0.5 * hov],
      bw: 1.3,
      glow: 8,
      glowAlpha: 0.25 * hov,
    });
  }
}

/** «×1 000», but «×10⁹» for huge factors (a row of zeros is unreadable). */
function factor(n: number): string {
  return n >= 1e6 ? `×${fmtSci(n, 2)}` : `×${fmtNumber(n)}`;
}

const chip = (icon: IconName, text: string): Chip => new Chip({ kind: 'honesty', icon, text });

/**
 * Honesty chips with the course-wide wording (DECISIONS §5). Every factory takes an optional `text` for the
 * document's own wording («сповільнено ≈ у мільярд разів», «спрощена модель сліду»).
 */
export const honesty = {
  /** «сповільнено ×N» */
  slowed: (n: number, text?: string): Chip => chip('clock', text ?? `сповільнено ${factor(n)}`),
  /** «прискорено ×N» */
  sped: (n: number, text?: string): Chip => chip('clock', text ?? `прискорено ${factor(n)}`),
  /** «збільшено ×N» (exaggerated size / amplitude) */
  enlarged: (n: number, text?: string): Chip => chip('search', text ?? `збільшено ${factor(n)}`),
  /** «не в масштабі» */
  notToScale: (text?: string): Chip => chip('scale', text ?? 'не в масштабі'),
  /** «спрощена модель» */
  simplified: (text?: string): Chip => chip('layers', text ?? 'спрощена модель'),
  /** «ілюстративно» (qualitative picture, not a calculation) */
  illustrative: (text?: string): Chip => chip('eye', text ?? 'ілюстративно'),
  /** Any other model note of the document, same look. */
  note: (text: string): Chip => chip('info', text),
};
