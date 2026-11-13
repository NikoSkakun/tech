/**
 * Toggle — pill switch with a sliding knob and a label.
 */
import type { ColorLike } from '@/style';
import { sfx } from '../core/focus';
import type { NodeProps } from '../core/node';
import { lit, mixRgba, rgba, type Painter } from '../core/painter';
import { accentOf, UI } from '../theme';
import { Control } from './control';
import { Label } from './label';

export interface ToggleProps extends NodeProps {
  value?: boolean;
  label?: string;
  accent?: ColorLike;
  tooltip?: string;
  onChange?: (value: boolean) => void;
}

const W = 54;
const H = 30;

export class Toggle extends Control {
  onChange: ((value: boolean) => void) | null;
  /** Knob position 0…1 (animated). */
  t: number;
  private state: boolean;
  private readonly accentColor: ColorLike | null;

  constructor(props: ToggleProps = {}) {
    super({ dir: 'row', align: 'center', gap: 12, height: UI.hit, pad: [0, 0, 0, W + 12], ...props });
    this.state = props.value ?? false;
    this.t = this.state ? 1 : 0;
    this.accentColor = props.accent ?? null;
    this.onChange = props.onChange ?? null;
    this.lift = 2;
    this.squash = 0.97;
    if (props.label) this.add(new Label(props.label, { size: UI.text.small, color: 'white' }));
    if (props.tooltip) this.on({ tooltip: props.tooltip });
  }

  get value(): boolean {
    return this.state;
  }
  /** Set programmatically (no `onChange`). */
  set value(v: boolean) {
    if (v === this.state) return;
    this.state = v;
    this.tween({ t: v ? 1 : 0 }, { duration: 0.22, ease: 'back.out' });
  }

  protected override activate(): void {
    this.value = !this.state;
    sfx(this.state ? 'toggleOn' : 'toggleOff');
    this.onChange?.(this.state);
  }

  override paint(p: Painter): void {
    const accent = rgba(this.accentColor ?? accentOf(this));
    const cx = -this.bw / 2 + W / 2;
    const t = Math.min(Math.max(this.t, -0.08), 1.08);
    this.paintFocus(p, this.bw + 8, H + 4, H / 2);
    p.rect(cx, 0, W, H, {
      r: H / 2,
      fill: mixRgba(rgba('bg.void', 0.9), lit(accent, 0.9), Math.min(Math.max(t, 0), 1)),
      border: mixRgba(rgba('slate', 0.9), accent, Math.max(t, this.hoverT)),
      bw: 1.6,
      glow: 8,
      glowAlpha: 0.3 * Math.max(t, 0) + 0.15 * this.hoverT,
    });
    const d = H - 8 + 2 * this.hoverT;
    p.circle(cx - W / 2 + H / 2 + (W - H) * t, 0, d, { fill: rgba('white'), fill2: rgba('mist') });
  }
}
