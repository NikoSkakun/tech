/**
 * Panel — the "hologlass" container (STYLE_GUIDE §6): rounded glass plate with a gradient body, a swept accent
 * border, a soft outer glow and a dark halo that separates it from any backdrop. Plus small layout helpers.
 */
import type { ColorLike } from '@/style';
import type { IconName } from '../core/icons';
import { UiNode, type NodeProps } from '../core/node';
import { rgba, type Painter } from '../core/painter';
import { accentOf, UI } from '../theme';

export interface PanelProps extends NodeProps {
  /** `glass` (default, big panels) · `card` (smaller radius, calmer) · `inset` (dark well) · `plain` (no chrome). */
  variant?: 'glass' | 'card' | 'inset' | 'plain';
  accent?: ColorLike;
  radius?: number;
  /** Body opacity; default `UI.panelOpacity`. */
  fillOpacity?: number;
  /** Outer glow strength 0…1. Default 1. */
  glow?: number;
  /** Block the pointer (so dragging over the panel does not orbit the world). Default true. */
  blocks?: boolean;
}

export class Panel extends UiNode {
  variant: NonNullable<PanelProps['variant']>;
  accent: ColorLike | null;
  radius: number;
  fillOpacity: number;
  glow: number;
  /** 0…1 highlight (hover / selection), tweenable. */
  highlight = 0;

  constructor(props: PanelProps = {}) {
    super({ pad: props.variant === 'card' ? UI.pad.card : props.variant ? 12 : UI.pad.panel, ...props });
    this.variant = props.variant ?? 'glass';
    this.accent = props.accent ?? null;
    this.radius =
      props.radius ??
      (this.variant === 'glass'
        ? UI.radius.panel
        : this.variant === 'card'
          ? UI.radius.card
          : UI.radius.control);
    this.fillOpacity = props.fillOpacity ?? UI.panelOpacity;
    this.glow = props.glow ?? 1;
    if (props.blocks ?? this.variant !== 'plain')
      this.on({ cursor: 'default', wheel: (dy, e) => this.parent?.bubbleWheel(dy, e) ?? false });
  }

  override paint(p: Painter): void {
    const { bw: w, bh: h, radius: r } = this;
    const accent = this.accent ?? accentOf(this);
    const hi = this.highlight;
    if (this.variant === 'plain') return;
    if (this.variant === 'inset') {
      p.rect(0, 0, w, h, { r, fill: rgba('bg.void', 0.66), border: rgba(accent, 0.16 + 0.3 * hi), bw: 1 });
      return;
    }
    const glass = this.variant === 'glass';
    // dark halo: dims the backdrop right around the plate so its edge never melts into a bright scene
    p.rect(0, -4, w, h, {
      r,
      border: rgba('bg.void', 0),
      glow: glass ? 46 : 26,
      glowAlpha: glass ? 0.5 : 0.36,
    });
    p.panel(0, 0, w, h, {
      r,
      fill: rgba(glass ? 'bg.indigo' : 'bg.deep', this.fillOpacity),
      fill2: rgba(glass ? 'bg.void' : 'bg.deep', Math.min(this.fillOpacity + 0.015, 1)),
      border: rgba(accent, (glass ? 0.62 : 0.4) + 0.3 * hi),
      bw: 1.5,
      glow: glass ? 16 : 10,
      glowAlpha: (glass ? 0.2 : 0.12) * this.glow + 0.2 * hi,
    });
  }
}

/** Fixed-size icon. */
export class Icon extends UiNode {
  constructor(
    public icon: IconName,
    public size = 24,
    public color: ColorLike = 'white',
    public emissive = 1,
    props: NodeProps = {},
  ) {
    super({ width: size, height: size, ...props });
  }

  set(icon: IconName, color?: ColorLike): void {
    this.icon = icon;
    if (color !== undefined) this.color = color;
    this.repaint();
  }

  override paint(p: Painter): void {
    p.icon(this.icon, 0, 0, this.size, rgba(this.color), { emissive: this.emissive });
  }
}

/** Horizontal stack. */
export function row(props: NodeProps = {}, ...children: (UiNode | null | undefined | false)[]): UiNode {
  return new UiNode({
    dir: 'row',
    align: 'center',
    gap: UI.gap.sm,
    ...props,
    children: [...(props.children ?? []), ...children],
  });
}

/** Vertical stack. */
export function col(props: NodeProps = {}, ...children: (UiNode | null | undefined | false)[]): UiNode {
  return new UiNode({
    dir: 'col',
    gap: UI.gap.sm,
    ...props,
    children: [...(props.children ?? []), ...children],
  });
}

/** Flexible empty space (or a fixed gap when `size` is given). */
export function spacer(size?: number): UiNode {
  return size === undefined
    ? new UiNode({ width: 'fill', height: 'fill' })
    : new UiNode({ width: size, height: size });
}

/** Thin separator line. */
export class Divider extends UiNode {
  constructor(private readonly tone: ColorLike = 'slate') {
    super({ width: 'fill', height: 1 });
  }
  override paint(p: Painter): void {
    p.rect(0, 0, this.bw, 1.2, { r: 0.6, fill: rgba(this.tone, 0.5) });
  }
}
