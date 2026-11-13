/**
 * ProgressRing — a ring that fills clockwise from 12 o'clock (chapter progress, loading, timers).
 * With `spin` it shows an indeterminate rotating arc instead.
 */
import type { ColorLike } from '@/style';
import { UiNode, type NodeProps } from '../core/node';
import { lit, rgba, type Painter } from '../core/painter';
import { accentOf, UI } from '../theme';
import { Label } from './label';

export interface ProgressRingProps extends NodeProps {
  /** 0…1. */
  value?: number;
  size?: number;
  thickness?: number;
  accent?: ColorLike;
  /** Text in the middle (e.g. `7/10`). */
  label?: string;
}

export class ProgressRing extends UiNode {
  /** Displayed fraction (animated). */
  t: number;
  /** Rotation of the indeterminate arc, radians (drive it from an update loop or leave 0). */
  spin: number | null = null;
  accent: ColorLike | null;
  private readonly thickness: number;
  private readonly text: Label | null = null;

  constructor(props: ProgressRingProps = {}) {
    const size = props.size ?? 44;
    super({ dir: 'stack', align: 'center', justify: 'center', width: size, height: size, ...props });
    this.t = props.value ?? 0;
    this.accent = props.accent ?? null;
    this.thickness = props.thickness ?? Math.max(4, size * 0.12);
    if (props.label !== undefined) {
      this.text = new Label(
        props.label,
        {
          font: 'mono',
          size: Math.max(UI.text.caption, size * 0.26),
          nowrap: true,
          align: 'center',
          reserve: 6,
          stable: true,
        },
        { width: size, height: size },
      );
      this.add(this.text);
    }
  }

  get value(): number {
    return this.t;
  }
  set value(v: number) {
    const t = Math.min(Math.max(v, 0), 1);
    if (t === this.t) return;
    const host = this.surface?.host;
    if (!host || host.reducedMotion()) {
      this.t = t;
      this.repaint();
    } else
      host.tweens.to(
        this as ProgressRing,
        { t },
        { duration: 0.5, ease: 'power2.out', onUpdate: () => this.repaint() },
      );
  }

  set label(text: string) {
    if (this.text) this.text.text = text;
  }

  override paint(p: Painter): void {
    const d = Math.min(this.bw, this.bh);
    const accent = rgba(this.accent ?? accentOf(this));
    const full = Math.PI * 2;
    p.arc(0, 0, d, 0, full, this.thickness, {
      fill: rgba('bg.void', 0.8),
      border: rgba('slate', 0.55),
      bw: 1,
    });
    if (this.spin !== null)
      p.arc(0, 0, d, this.spin, full * 0.28, this.thickness, {
        fill: lit(accent, 1.35),
        border: accent,
        glow: 6,
        glowAlpha: 0.3,
      });
    else if (this.t > 0.002)
      p.arc(0, 0, d, 0, Math.max(full * this.t, 0.02), this.thickness, {
        fill: lit(accent, 1.3),
        border: accent,
        glow: 6,
        glowAlpha: 0.28,
      });
  }
}
