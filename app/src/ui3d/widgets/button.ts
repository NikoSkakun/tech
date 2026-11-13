/**
 * Button — pill / ghost / round icon button (STYLE_GUIDE §6: big, tactile, toy-like).
 *   primary    filled with the accent, dark label — the one main action of a panel
 *   secondary  dark body, accent border
 *   ghost      no body until hovered — low-emphasis actions inside text
 *   icon       round, icon only
 */
import type { ColorLike } from '@/style';
import { sfx } from '../core/focus';
import type { IconName } from '../core/icons';
import type { NodeProps } from '../core/node';
import { lit, mixRgba, rgba, type Painter } from '../core/painter';
import { accentOf, UI } from '../theme';
import { Control } from './control';
import { Label } from './label';
import { Icon } from './panel';

export interface ButtonProps extends NodeProps {
  label?: string;
  icon?: IconName;
  /** Icon after the label instead of before it. */
  iconRight?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  accent?: ColorLike;
  tooltip?: string;
  /** Toggle-style buttons draw as selected. */
  selected?: boolean;
  onClick?: () => void;
}

const HEIGHT = { sm: 36, md: 46, lg: 58 } as const;
const FONT = { sm: UI.text.caption, md: UI.text.small, lg: UI.text.h3 } as const;

export class Button extends Control {
  onClick: (() => void) | null;
  readonly variant: NonNullable<ButtonProps['variant']>;
  accent: ColorLike | null;
  private readonly size: 'sm' | 'md' | 'lg';
  private readonly text: Label | null = null;
  private readonly glyph: Icon | null = null;
  private on_ = false;

  constructor(props: ButtonProps = {}) {
    const size = props.size ?? 'md';
    const variant = props.variant ?? (props.label ? 'secondary' : 'icon');
    const h = HEIGHT[size];
    super({
      dir: 'row',
      align: 'center',
      justify: 'center',
      gap: 8,
      height: h,
      width: variant === 'icon' ? h : 'hug',
      pad: variant === 'icon' ? 0 : [0, size === 'lg' ? 28 : size === 'sm' ? 14 : 20],
      ...props,
    });
    this.size = size;
    this.variant = variant;
    this.accent = props.accent ?? null;
    this.onClick = props.onClick ?? null;
    this.on_ = props.selected ?? false;
    const ink: ColorLike = variant === 'primary' ? 'bg.void' : 'white';
    if (props.icon) this.glyph = new Icon(props.icon, Math.round(h * (variant === 'icon' ? 0.5 : 0.44)), ink);
    if (props.label !== undefined && variant !== 'icon')
      this.text = new Label(props.label, { font: 'display', size: FONT[size], color: ink, nowrap: true });
    const kids = props.iconRight ? [this.text, this.glyph] : [this.glyph, this.text];
    for (const k of kids) if (k) this.add(k);
    if (props.tooltip) this.on({ tooltip: props.tooltip });
  }

  get label(): string {
    return this.text?.text ?? '';
  }
  set label(v: string) {
    if (this.text) this.text.text = v;
  }

  set icon(name: IconName) {
    this.glyph?.set(name);
  }

  get selected(): boolean {
    return this.on_;
  }
  set selected(v: boolean) {
    if (v === this.on_) return;
    this.on_ = v;
    this.repaint();
  }

  protected override activate(): void {
    sfx('tap');
    this.onClick?.();
  }

  override paint(p: Painter): void {
    const { bw: w, bh: h } = this;
    const r = h / 2;
    const accent = rgba(this.accent ?? accentOf(this));
    const hov = this.hoverT;
    const prs = this.pressT;
    this.paintFocus(p, w, h, r);
    if (this.variant === 'primary') {
      // glowing accent pill: slightly emissive so it reads as the hot spot of the panel
      const body = lit(accent, 1.05 + 0.3 * hov - 0.2 * prs);
      p.rect(0, 0, w, h, {
        r,
        fill: body,
        fill2: lit(accent, 0.82 + 0.2 * hov - 0.2 * prs),
        border: accent,
        glow: 14 + 8 * hov,
        glowAlpha: 0.3 + 0.25 * hov,
      });
    } else if (this.variant === 'ghost') {
      const a = Math.max(hov * 0.9, this.on_ ? 0.8 : 0);
      p.rect(0, 0, w, h, { r, fill: rgba('bg.violet', 0.6 * a), border: withA(accent, 0.5 * a), bw: 1.2 });
    } else {
      const sel = this.on_ ? 1 : 0;
      const body = mixRgba(rgba('bg.indigo', 0.96), rgba('bg.violet', 1), Math.max(hov, sel) - 0.3 * prs);
      p.rect(0, 0, w, h, {
        r,
        fill: body,
        fill2: rgba('bg.deep', 0.98),
        border: withA(this.on_ ? rgba('yellow') : accent, 0.55 + 0.45 * Math.max(hov, sel)),
        bw: 1.6,
        glow: 10,
        glowAlpha: 0.1 + 0.3 * Math.max(hov, sel),
      });
    }
  }
}

function withA(c: readonly [number, number, number, number], a: number): [number, number, number, number] {
  return [c[0], c[1], c[2], a];
}

/** Round icon button (44 px-eq target by default). */
export function iconButton(
  icon: IconName,
  tooltip: string,
  onClick: () => void,
  props: ButtonProps = {},
): Button {
  return new Button({ icon, tooltip, onClick, variant: 'icon', ...props });
}
