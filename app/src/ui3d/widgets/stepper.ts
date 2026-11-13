/**
 * Stepper — the step "dots" as tactile segments: one per step, 44 px-eq targets, the current one wide and
 * glowing, visited ones filled, the title in the tooltip. Used by the step navigator and by quizzes / pagers.
 */
import type { ColorLike } from '@/style';
import { sfx } from '../core/focus';
import { UiNode, type NodeProps } from '../core/node';
import { lit, mixRgba, rgba, type Painter } from '../core/painter';
import { accentOf, UI } from '../theme';
import { Control } from './control';

export interface StepperProps extends NodeProps {
  count: number;
  index?: number;
  /** Tooltip per step (e.g. «3. Ядро»). */
  titles?: readonly string[];
  /** Steps already seen (filled). */
  visited?: readonly boolean[];
  accent?: ColorLike;
  /** Distance between segment centres. Default 44 (shrinks automatically when the parent is narrower). */
  pitch?: number;
  onSelect?: (index: number) => void;
}

class Segment extends Control {
  /** 0…1: how "current" this segment is (animated). */
  active = 0;
  seen = false;
  constructor(
    readonly i: number,
    private readonly owner: Stepper,
    pitch: number,
    title: string | undefined,
  ) {
    super({ width: pitch, height: UI.hit });
    this.lift = 2;
    this.minHit = 0;
    if (title) this.on({ tooltip: title });
  }
  setActive(on: boolean): void {
    this.tween({ active: on ? 1 : 0 }, { duration: 0.28, ease: 'back.out' });
  }
  protected override activate(): void {
    sfx('tap');
    this.owner.onSelect?.(this.i);
  }
  override paint(p: Painter): void {
    const accent = rgba(this.owner.accent ?? accentOf(this));
    const a = Math.min(Math.max(this.active, 0), 1.15);
    const w = Math.min(this.bw - 8, 36) * (0.42 + 0.58 * a) + 4 * this.hoverT;
    const h = 8 + 3 * a + 2 * this.hoverT;
    const idle = this.seen ? mixRgba(rgba('bg.indigo'), accent, 0.62) : rgba('slate', 0.85);
    this.paintFocus(p, w + 4, h + 6, (h + 6) / 2);
    p.rect(0, 0, w, h, {
      r: h / 2,
      fill: mixRgba(idle, lit(accent, 1.35), Math.min(a, 1)),
      border: mixRgba(rgba('mist', 0.4 + 0.5 * this.hoverT), accent, Math.min(a, 1)),
      bw: 1,
      glow: 10,
      glowAlpha: 0.42 * Math.min(a, 1) + 0.2 * this.hoverT,
    });
  }
}

export class Stepper extends UiNode {
  onSelect: ((index: number) => void) | null;
  accent: ColorLike | null;
  private current: number;
  private readonly segments: Segment[] = [];

  constructor(props: StepperProps) {
    super({ dir: 'row', align: 'center', ...props });
    this.onSelect = props.onSelect ?? null;
    this.accent = props.accent ?? null;
    this.current = props.index ?? 0;
    this.build(props.count, props.titles, props.visited, props.pitch ?? 44);
  }

  /** Replace the segments (new chapter). */
  build(count: number, titles?: readonly string[], visited?: readonly boolean[], pitch = 44): void {
    this.clear();
    this.segments.length = 0;
    for (let i = 0; i < count; i++) {
      const s = new Segment(i, this, pitch, titles?.[i]);
      s.seen = visited?.[i] ?? false;
      s.active = i === this.current ? 1 : 0;
      this.segments.push(s);
    }
    this.add(...this.segments);
  }

  get count(): number {
    return this.segments.length;
  }

  get index(): number {
    return this.current;
  }
  set index(i: number) {
    if (i === this.current) return;
    this.segments[this.current]?.setActive(false);
    this.current = i;
    this.segments[i]?.setActive(true);
  }

  setVisited(i: number, seen = true): void {
    const s = this.segments[i];
    if (!s || s.seen === seen) return;
    s.seen = seen;
    s.repaint();
  }
}
