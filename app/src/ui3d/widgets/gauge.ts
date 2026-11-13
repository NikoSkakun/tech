/**
 * Gauge — radial dial or linear bar with coloured zones and an animated needle; ProgressRing — a ring that
 * fills. Zone colours follow STYLE_GUIDE §2.2 (`green` OK, `amber` warning, `red` alarm).
 */
import { fmtUnit } from '@/content/format';
import type { ColorLike } from '@/style';
import { UiNode, type NodeProps } from '../core/node';
import { lit, rgba, type Painter } from '../core/painter';
import { accentOf, TEXT_COLOR, UI } from '../theme';
import { Label } from './label';

export interface GaugeZone {
  from: number;
  to: number;
  color: ColorLike;
}

export interface GaugeProps extends NodeProps {
  kind?: 'radial' | 'linear';
  min: number;
  max: number;
  value?: number;
  unit?: string;
  digits?: number;
  label?: string;
  zones?: readonly GaugeZone[];
  accent?: ColorLike;
  /** Diameter of a radial gauge / length of a linear one. Default 150 / fill. */
  size?: number;
}

/** Dial sweep: 240° centred on 12 o'clock. */
const START = (-120 * Math.PI) / 180;
const SWEEP = (240 * Math.PI) / 180;

export class Gauge extends UiNode {
  /** Needle position 0…1 (animated). */
  t: number;
  private target: number;
  private readonly cfg: GaugeProps;
  private readonly text: Label;

  constructor(props: GaugeProps) {
    const radial = (props.kind ?? 'radial') === 'radial';
    const size = props.size ?? 150;
    super(
      radial
        ? {
            dir: 'col',
            align: 'center',
            justify: 'end',
            width: size,
            height: size * 0.96,
            pad: [0, 0, 0, 0],
            ...props,
          }
        : { dir: 'col', gap: 2, width: 'fill', pad: [0, 0, 22, 0], ...props },
    );
    this.cfg = props;
    this.target = props.value ?? props.min;
    this.t = this.toT(this.target);
    this.text = new Label(
      this.format(this.target),
      {
        font: 'mono',
        size: radial ? UI.text.h3 : UI.text.small,
        nowrap: true,
        align: 'center',
        reserve: 12,
        stable: true,
      },
      { width: radial ? size * 0.9 : 'fill', height: 26 },
    );
    const caption = props.label
      ? new Label(props.label, {
          size: UI.text.caption,
          color: TEXT_COLOR.dim,
          nowrap: true,
          align: 'center',
        })
      : null;
    if (radial) this.add(this.text, ...(caption ? [caption] : []));
    else
      this.add(
        new UiNode({
          dir: 'row',
          justify: 'between',
          width: 'fill',
          children: [caption ?? new UiNode(), this.text],
        }),
      );
  }

  get value(): number {
    return this.target;
  }
  set value(v: number) {
    if (v === this.target) return;
    this.target = v;
    this.text.text = this.format(v);
    const host = this.surface?.host;
    const t = this.toT(v);
    if (!host || host.reducedMotion()) {
      this.t = t;
      this.repaint();
    } else
      host.tweens.to(
        this as Gauge,
        { t },
        { duration: 0.5, ease: 'back.out', onUpdate: () => this.repaint() },
      );
  }

  /** Set without animation (values driven every frame). */
  setNow(v: number): void {
    this.target = v;
    this.t = this.toT(v);
    this.text.text = this.format(v);
    this.repaint();
  }

  private toT(v: number): number {
    return Math.min(Math.max((v - this.cfg.min) / (this.cfg.max - this.cfg.min || 1), 0), 1);
  }

  private format(v: number): string {
    return fmtUnit(
      v,
      this.cfg.unit ?? '',
      this.cfg.digits !== undefined ? { digits: this.cfg.digits } : { maxDigits: 1 },
    );
  }

  /** Colour of the zone the value is in (or the accent). */
  private zoneColor(t: number): ColorLike {
    const v = this.cfg.min + (this.cfg.max - this.cfg.min) * t;
    return this.cfg.zones?.find((z) => v >= z.from && v <= z.to)?.color ?? this.cfg.accent ?? accentOf(this);
  }

  override paint(p: Painter): void {
    const t = Math.min(Math.max(this.t, -0.03), 1.03);
    const tone = rgba(this.zoneColor(Math.min(Math.max(t, 0), 1)));
    const zones = this.cfg.zones ?? [];
    if ((this.cfg.kind ?? 'radial') === 'radial') {
      const d = Math.min(this.bw, this.bh / 0.96);
      const cy = this.bh / 2 - d / 2;
      const th = d * 0.085;
      p.arc(0, cy, d, START, SWEEP, th, { fill: rgba('bg.void', 0.85), border: rgba('slate', 0.5), bw: 1 });
      for (const z of zones)
        p.arc(
          0,
          cy,
          d,
          START + SWEEP * this.toT(z.from),
          SWEEP * (this.toT(z.to) - this.toT(z.from)),
          th * 0.42,
          { fill: rgba(z.color, 0.6) },
        );
      if (t > 0.004)
        p.arc(0, cy, d - th * 1.5, START, SWEEP * Math.max(t, 0), th * 0.5, {
          fill: lit(tone, 1.3),
          border: tone,
          glow: 6,
          glowAlpha: 0.3,
        });
      const a = START + SWEEP * t;
      const r = d / 2 - th * 1.6;
      p.line(0, cy, Math.sin(a) * r, cy + Math.cos(a) * r, 4, {
        fill: rgba('white'),
        border: rgba('white'),
        glow: 5,
        glowAlpha: 0.3,
      });
      p.circle(0, cy, d * 0.11, {
        fill: rgba('white'),
        fill2: rgba('mist'),
        border: lit(tone, 1.2),
        bw: 2.5,
      });
      return;
    }
    const w = this.bw;
    const y = -this.bh / 2 + 10;
    p.rect(0, y, w, 10, { r: 5, fill: rgba('bg.void', 0.85), border: rgba('slate', 0.6), bw: 1 });
    for (const z of zones) {
      const a = this.toT(z.from);
      const b = this.toT(z.to);
      p.rect(-w / 2 + (w * (a + b)) / 2, y - 9, Math.max(w * (b - a) - 3, 2), 3, {
        r: 1.5,
        fill: rgba(z.color, 0.8),
      });
    }
    const fw = Math.max(w * Math.max(t, 0), 10);
    p.rect(-w / 2 + fw / 2, y, fw, 10, {
      r: 5,
      fill: lit(tone, 1.25),
      border: tone,
      glow: 7,
      glowAlpha: 0.3,
    });
    p.rect(-w / 2 + w * t, y, 5, 20, {
      r: 2.5,
      fill: rgba('white'),
      border: rgba('white'),
      glow: 5,
      glowAlpha: 0.35,
    });
  }
}
