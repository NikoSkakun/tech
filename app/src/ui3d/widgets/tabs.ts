/**
 * Tabs — segmented control: a dark well with one sliding highlighted segment. Copes with 6–7 items by
 * shrinking padding and type (the chapters' longest segmented choices). ←/→ move the selection when focused.
 */
import type { ColorLike } from '@/style';
import { sfx } from '../core/focus';
import type { IconName } from '../core/icons';
import { UiNode, type NodeProps } from '../core/node';
import { lit, rgba, type Painter } from '../core/painter';
import { accentOf, UI } from '../theme';
import { Control } from './control';
import { Label } from './label';
import { Icon } from './panel';

export interface TabItem<T extends string = string> {
  id: T;
  label?: string;
  icon?: IconName;
  tooltip?: string;
}

export interface TabsProps<T extends string = string> extends NodeProps {
  items: readonly TabItem<T>[];
  value?: T;
  accent?: ColorLike;
  /** Segments share the width equally (default) or hug their labels. */
  equal?: boolean;
  onChange?: (id: T) => void;
}

class Segment extends Control {
  readonly text: Label | null = null;
  /** Width the label needs on one line at the current size (units). */
  natural = 0;
  constructor(
    readonly item: TabItem,
    private readonly owner: Tabs,
    compact: boolean,
    equal: boolean,
  ) {
    super({
      dir: 'row',
      align: 'center',
      justify: 'center',
      gap: 6,
      height: 'fill',
      width: equal ? 'fill' : 'hug',
      pad: [4, compact ? 9 : 16],
    });
    this.lift = 0;
    this.squash = 0.96;
    if (item.icon) this.add(new Icon(item.icon, 20, 'white'));
    if (item.label) {
      // wraps onto a second line only when even the smaller type does not fit (the well grows)
      this.text = new Label(item.label, {
        font: 'bodyBold',
        size: compact ? UI.text.caption : UI.text.small,
        color: 'mist',
        align: 'center',
        lineHeight: 1.1,
      });
      this.add(this.text);
    }
    this.measureNatural();
    if (item.tooltip) this.on({ tooltip: item.tooltip });
  }
  /** Recompute the one-line width and share the well in proportion to it (long labels get more room). */
  measureNatural(): void {
    const label = this.text ? this.text.measure(Infinity)[0] : 0;
    this.natural = label + (this.item.icon ? 26 : 0) + this.padL + this.padR;
    this.grow = Math.max(this.natural, 40);
  }
  protected override activate(): void {
    this.owner.select(this.item.id, true);
  }
  override onKey(e: KeyboardEvent): boolean {
    if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
      this.owner.shift(e.code === 'ArrowRight' ? 1 : -1);
      return true;
    }
    return super.onKey(e);
  }
  override paint(p: Painter): void {
    this.paintFocus(p, this.bw - 4, this.bh - 4, (this.bh - 4) / 2);
    if (this.hoverT > 0.01)
      p.rect(0, 0, this.bw - 4, this.bh - 6, { r: this.bh / 2, fill: rgba('bg.violet', 0.5 * this.hoverT) });
  }
}

export class Tabs<T extends string = string> extends UiNode {
  onChange: ((id: T) => void) | null;
  /** Highlight box (animated): centre x and width in local units. */
  selX = 0;
  selW = 0;
  selY = 0;
  selH = 0;
  private current: T;
  private readonly segments: Segment[];
  private readonly accentColor: ColorLike | null;
  private settled = false;
  private compact: boolean;

  constructor(props: TabsProps<T>) {
    super({ dir: 'row', align: 'stretch', height: 'hug', minH: 44, width: 'fill', pad: 4, ...props });
    const compact = props.items.length >= 5;
    this.compact = compact;
    this.accentColor = props.accent ?? null;
    this.onChange = props.onChange ?? null;
    this.current = props.value ?? props.items[0]!.id;
    this.segments = props.items.map(
      (it) => new Segment(it, this as unknown as Tabs, compact, props.equal ?? true),
    );
    this.add(...this.segments);
    // `ctl-<id>` → items `ctl-<id>:<item id>` (QA locates and clicks single segments)
    if (props.name) for (const seg of this.segments) seg.name = `${props.name}:${seg.item.id}`;
    this.restyle();
  }

  get value(): T {
    return this.current;
  }

  /** Dims every segment and makes them inert. */
  get disabled(): boolean {
    return this.segments.every((s) => s.disabled);
  }
  set disabled(v: boolean) {
    for (const s of this.segments) s.disabled = v;
  }
  set value(id: T) {
    this.select(id, false);
  }

  /** @internal */
  select(id: string, notify: boolean): void {
    if (id === this.current) return;
    this.current = id as T;
    this.restyle();
    const seg = this.segments.find((s) => s.item.id === id);
    const tweens = this.surface?.host.tweens;
    if (seg && tweens && this.settled) {
      tweens.to(
        this as { selX: number; selW: number; selY: number; selH: number },
        { selX: this.centre(seg), selW: seg.bw, selY: this.middle(seg), selH: seg.bh },
        { duration: 0.26, ease: 'back.out', onUpdate: () => this.repaint() },
      );
    } else this.settled = false;
    this.repaint();
    if (notify) {
      sfx('tap');
      this.onChange?.(this.current);
    }
  }

  /** @internal */
  shift(by: number): void {
    const i = this.segments.findIndex((s) => s.item.id === this.current);
    const next = this.segments[Math.min(Math.max(i + by, 0), this.segments.length - 1)];
    if (next) this.select(next.item.id, true);
  }

  private centre(seg: Segment): number {
    return -this.bw / 2 + seg.bx + seg.bw / 2;
  }
  private middle(seg: Segment): number {
    return this.bh / 2 - seg.by - seg.bh / 2;
  }

  private restyle(): void {
    for (const s of this.segments)
      s.text?.setStyle({ color: s.item.id === this.current ? 'bg.void' : 'mist' });
  }

  /**
   * Labels that do not fit their share of the well: first the smaller type, then the segments wrap onto more
   * rows (each keeps its whole label — words are never broken).
   */
  private fit(): boolean {
    const room = this.bw - this.padL - this.padR + 0.5;
    const need = (): number => this.segments.reduce((sum, s) => sum + s.natural, 0);
    if (this.wrap || need() <= room) return false;
    if (!this.compact) {
      this.compact = true;
      for (const s of this.segments) {
        s.text?.setStyle({ size: UI.text.caption });
        s.padL = s.padR = 9;
        s.measureNatural();
      }
    }
    if (need() > room) {
      this.wrap = true;
      this.gap = 2;
      for (const s of this.segments) {
        s.width = 'hug';
        s.height = 36;
        s.text?.setStyle({ nowrap: true });
      }
    }
    this.settled = false;
    this.relayout();
    return true;
  }

  override paint(p: Painter): void {
    if (this.fit()) return;
    const accent = rgba(this.accentColor ?? accentOf(this));
    const seg = this.segments.find((s) => s.item.id === this.current);
    if (seg && !this.settled) {
      // first paint after layout: no animation
      this.selX = this.centre(seg);
      this.selW = seg.bw;
      this.selY = this.middle(seg);
      this.selH = seg.bh;
      this.settled = true;
    }
    const r = this.wrap ? 22 : this.bh / 2;
    p.rect(0, 0, this.bw, this.bh, { r, fill: rgba('bg.void', 0.8), border: rgba('slate', 0.7), bw: 1 });
    p.rect(this.selX, this.wrap ? this.selY : 0, this.selW, this.wrap ? this.selH - 4 : this.bh - 8, {
      r: this.wrap ? (this.selH - 4) / 2 : this.bh / 2,
      fill: lit(accent, 1.08),
      fill2: lit(accent, 0.86),
      border: accent,
      glow: 9,
      glowAlpha: 0.3,
    });
  }
}
