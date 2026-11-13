/**
 * Card — a titled hologlass card with rich text and an optional expandable «Детальніше» section
 * (STYLE_GUIDE §6: depth lives in hotspot cards and expandable details, not in the main panel).
 */
import type { ColorLike } from '@/style';
import { conceal, reveal } from '../core/anim';
import type { IconName } from '../core/icons';
import { UiNode } from '../core/node';
import { TEXT_COLOR, UI } from '../theme';
import { Button } from './button';
import { Label } from './label';
import { Icon, Panel, type PanelProps } from './panel';

export interface CardProps extends PanelProps {
  title?: string;
  /** Small line above the title (category, e.g. «Гаряча точка»). */
  kicker?: string;
  icon?: IconName;
  body?: string;
  /** Hidden behind the «Детальніше» button. */
  details?: string;
  /** Extra nodes under the body (chips, formulas, buttons). */
  extra?: readonly UiNode[];
  /** Shows a close button in the corner. */
  onClose?: () => void;
  accent?: ColorLike;
}

export class Card extends Panel {
  private readonly more: Label | null = null;
  private readonly moreButton: Button | null = null;
  private open = false;

  constructor(props: CardProps = {}) {
    super({ variant: 'card', dir: 'col', gap: UI.gap.sm, width: 400, ...props });
    const head = new UiNode({ dir: 'row', align: 'center', gap: 10, width: 'fill' });
    if (props.icon) head.add(new Icon(props.icon, 24, props.accent ?? 'cyan'));
    const titles = new UiNode({ dir: 'col', gap: 0, width: 'fill' });
    if (props.kicker)
      titles.add(
        new Label(props.kicker.toUpperCase(), {
          font: 'bodyBold',
          size: UI.text.caption,
          color: TEXT_COLOR.mute,
          letterSpacing: 0.06,
          nowrap: true,
        }),
      );
    if (props.title)
      titles.add(
        new Label(props.title, { font: 'display', size: UI.text.h3, lineHeight: 1.22 }, { width: 'fill' }),
      );
    head.add(titles);
    if (props.onClose)
      head.add(
        new Button({
          icon: 'close',
          variant: 'icon',
          size: 'sm',
          tooltip: 'Закрити',
          onClick: props.onClose,
          alignSelf: 'start',
        }),
      );
    if (props.title || props.kicker || props.onClose) this.add(head);
    if (props.body)
      this.add(new Label(props.body, { size: UI.text.small, lineHeight: 1.44 }, { width: 'fill' }));
    for (const n of props.extra ?? []) this.add(n);
    if (props.details) {
      this.more = new Label(
        props.details,
        { size: UI.text.small, color: TEXT_COLOR.dim, lineHeight: 1.44 },
        { width: 'fill', visible: false, opacity: 0 },
      );
      this.moreButton = new Button({
        label: 'Детальніше',
        icon: 'chevronDown',
        iconRight: true,
        variant: 'ghost',
        size: 'sm',
        alignSelf: 'start',
        onClick: () => this.toggle(),
      });
      this.add(this.moreButton, this.more);
    }
  }

  /** Expand / collapse the details. */
  toggle(open = !this.open): void {
    if (!this.more || !this.moreButton || open === this.open) return;
    this.open = open;
    this.moreButton.label = open ? 'Згорнути' : 'Детальніше';
    this.moreButton.icon = open ? 'chevronUp' : 'chevronDown';
    if (open) reveal(this.more, { dy: 8, scale: 1 });
    else conceal(this.more, { dy: 6, scale: 1 });
  }

  get expanded(): boolean {
    return this.open;
  }
}
