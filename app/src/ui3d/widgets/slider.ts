/**
 * Slider — glowing track, chunky knob, value bubble while dragging (STYLE_GUIDE §6). Linear or log scale,
 * step rounding, fixed stops, magnetic snaps, keyboard arrows (Shift = ×10, Home / End), mouse wheel.
 */
import type { DragInfo, PointerInfo } from '@/engine/api';
import { fmtUnit } from '@/content/format';
import { MOTION, type ColorLike } from '@/style';
import { sfx, uiFocus } from '../core/focus';
import { UiNode, type NodeProps } from '../core/node';
import { lit, rgba, type Painter } from '../core/painter';
import { accentOf, TEXT_COLOR, UI } from '../theme';
import { Control } from './control';
import { Label } from './label';
import { nudge, tToValue, valueToT, type SliderScale } from './slider-scale';

export interface SliderProps extends NodeProps, SliderScale {
  value?: number;
  label?: string;
  unit?: string;
  /** Decimals of the displayed value (default: automatic). */
  digits?: number;
  /** Custom value text (overrides `unit` / `digits`). */
  format?: (value: number) => string;
  accent?: ColorLike;
  /** Labelled marks under the track. */
  marks?: readonly { value: number; label: string }[];
  tooltip?: string;
  /** Fires on every change while dragging. */
  onChange?: (value: number) => void;
  /** Fires when the user lets go (drag end, key, wheel). */
  onCommit?: (value: number) => void;
}

const KNOB = 26;
const TRACK = 10;

class Track extends Control {
  /** Knob position 0…1 (animated toward the value). */
  t = 0;
  dragT = 0;
  constructor(
    private readonly owner: Slider,
    private readonly accentColor: ColorLike | null,
  ) {
    super({ width: 'fill', height: UI.hit });
    this.lift = 0;
    this.squash = 1;
    const setFromPointer = (e: PointerInfo | DragInfo): void => {
      const p = this.localPoint(e);
      if (p) owner.setFromT((p.x + this.span / 2) / this.span, true);
    };
    this.on({
      cursor: 'ew-resize',
      press: (e) => {
        uiFocus.set(this, false); // arrows adjust the slider from now on
        setFromPointer(e);
      },
      dragStart: () => this.tween({ dragT: 1 }, MOTION.hover),
      drag: setFromPointer,
      dragEnd: () => {
        this.tween({ dragT: 0 }, { duration: 0.25, delay: 0.35 });
        owner.commit();
      },
      wheel: (dy, e) => {
        // inside a scroll view that can scroll, the wheel scrolls unless this slider has the focus (a click on it)
        if (uiFocus.current !== this && this.inScroller()) return this.parent?.bubbleWheel(dy, e) ?? false;
        owner.step(dy > 0 ? -1 : 1);
        return true;
      },
    });
  }

  /** Usable track length (the knob never overhangs the ends). */
  private inScroller(): boolean {
    for (let n = this.parent; n; n = n.parent)
      if (n.clip && ((n as { range?: number }).range ?? 0) > 0) return true;
    return false;
  }

  get span(): number {
    return Math.max(this.bw - KNOB, 1);
  }

  override onKey(e: KeyboardEvent): boolean {
    const k = e.shiftKey ? 10 : 1;
    if (e.code === 'ArrowRight' || e.code === 'ArrowUp') this.owner.step(k);
    else if (e.code === 'ArrowLeft' || e.code === 'ArrowDown') this.owner.step(-k);
    else if (e.code === 'Home') this.owner.setFromT(0, true, true);
    else if (e.code === 'End') this.owner.setFromT(1, true, true);
    else return false;
    return true;
  }

  moveTo(t: number, animate: boolean): void {
    if (animate) this.tween({ t }, { duration: 0.16, ease: 'power2.out' });
    else {
      this.t = t;
      this.repaint();
    }
    this.owner.bubble.x = (t - 0.5) * this.span;
  }

  override paint(p: Painter): void {
    const span = this.span;
    const accent = rgba(this.accentColor ?? accentOf(this));
    const x0 = -span / 2;
    const kx = x0 + span * this.t;
    const hot = Math.max(this.hoverT, this.dragT);
    this.owner.bubble.opacity = this.dragT; // the bubble follows the drag state
    this.paintFocus(p, this.bw, KNOB + 6, (KNOB + 6) / 2);
    p.rect(0, 0, span + TRACK, TRACK, {
      r: TRACK / 2,
      fill: rgba('bg.void', 0.85),
      border: rgba('slate', 0.7),
      bw: 1,
    });
    const filled = Math.max(kx - x0, 0) + TRACK;
    p.rect(x0 - TRACK / 2 + filled / 2, 0, filled, TRACK, {
      r: TRACK / 2,
      fill: lit(accent, 1.25 + 0.35 * hot),
      border: accent,
      glow: 8 + 6 * hot,
      glowAlpha: 0.28 + 0.2 * hot,
    });
    for (const m of this.owner.markTs)
      p.rect(x0 + span * m, 0, 2.5, TRACK + 8, { r: 1.2, fill: rgba('mist', 0.55) });
    const d = KNOB + 4 * hot - 3 * this.pressT;
    p.circle(kx, 0, d, {
      fill: rgba('white'),
      fill2: rgba('mist'),
      border: lit(accent, 1.3),
      bw: 3.5,
      glow: 10 + 8 * hot,
      glowAlpha: 0.35 + 0.3 * hot,
    });
    p.circle(kx, 0, d * 0.3, { fill: lit(accent, 1.4) });
  }
}

class Bubble extends UiNode {
  readonly text: Label;
  constructor() {
    super({ float: { ax: 0.5, ay: 0, px: 0.5, py: 1, dy: 2 }, layerUp: 1, pad: [5, 12], opacity: 0 });
    this.text = new Label('', {
      font: 'mono',
      size: UI.text.small,
      color: 'bg.void',
      nowrap: true,
      reserve: 14,
    });
    this.add(this.text);
  }
  override paint(p: Painter): void {
    p.rect(0, 0, this.bw, this.bh, {
      r: this.bh / 2,
      fill: rgba('white', 0.97),
      border: rgba('white'),
      glow: 10,
      glowAlpha: 0.3,
    });
    p.rect(0, -this.bh / 2 - 1, 9, 9, { r: 2, rot: Math.PI / 4, fill: rgba('white', 0.97) });
  }
}

export class Slider extends UiNode {
  readonly range: SliderScale;
  /** @internal */
  readonly bubble = new Bubble();
  /** @internal mark positions 0…1 */
  markTs: number[] = [];
  onChange: ((value: number) => void) | null;
  onCommit: ((value: number) => void) | null;
  private current: number;
  private readonly track: Track;
  private readonly valueLabel: Label;
  private readonly nameLabel: Label;
  private readonly markValues: number[];
  private readonly format: (v: number) => string;

  constructor(props: SliderProps) {
    super({ dir: 'col', gap: 0, width: 'fill', ...props });
    this.range = {
      min: props.min,
      max: props.max,
      scale: props.scale,
      step: props.step,
      stops: props.stops,
      snaps: props.snaps,
      snapRange: props.snapRange,
    };
    this.onChange = props.onChange ?? null;
    this.onCommit = props.onCommit ?? null;
    this.format =
      props.format ??
      ((v) =>
        fmtUnit(
          v,
          props.unit ?? '',
          props.digits !== undefined ? { digits: props.digits } : { maxDigits: 3 },
        ));
    this.current = tToValue(this.range, valueToT(this.range, props.value ?? props.min));
    const name = new Label(props.label ?? '', { size: UI.text.small, color: TEXT_COLOR.dim, nowrap: true });
    this.nameLabel = name;
    this.valueLabel = new Label(
      this.format(this.current),
      { font: 'mono', size: UI.text.small, color: 'white', nowrap: true, align: 'right', reserve: 14 },
      { width: 150, height: 26 },
    );
    this.track = new Track(this, props.accent ?? null);
    if (props.tooltip) this.track.on({ tooltip: props.tooltip });
    this.track.add(this.bubble);
    this.add(
      new UiNode({
        dir: 'row',
        align: 'center',
        justify: 'between',
        width: 'fill',
        children: [name, this.valueLabel],
      }),
      this.track,
    );
    const marks = props.marks ?? [];
    this.markValues = [...marks.map((m) => m.value), ...(props.snaps ?? []), ...(props.stops ?? [])];
    this.markTs = this.markValues.map((v) => valueToT(this.range, v));
    if (marks.length > 0) {
      const strip = new UiNode({ dir: 'stack', width: 'fill', height: 20 });
      for (const m of marks) {
        const t = valueToT(this.range, m.value);
        strip.add(
          new Label(
            m.label,
            { size: UI.text.caption, color: TEXT_COLOR.mute, nowrap: true },
            { float: { ax: 0.03 + 0.94 * t, ay: 0.5, px: t, py: 0.5 } },
          ),
        );
      }
      this.add(strip);
    }
    this.track.moveTo(valueToT(this.range, this.current), false);
    this.bubble.text.text = this.format(this.current);
  }

  get value(): number {
    return this.current;
  }
  /** Set programmatically (no `onChange`); the knob glides to the new position. */
  set value(v: number) {
    this.update(tToValue(this.range, valueToT(this.range, v)), true, false);
  }

  get disabled(): boolean {
    return this.track.disabled;
  }
  set disabled(v: boolean) {
    this.track.disabled = v;
  }

  /** Caption above the track. */
  get label(): string {
    return this.nameLabel.text;
  }
  set label(text: string) {
    this.nameLabel.text = text;
  }

  /**
   * Change the range live (the voltage limit follows the chemistry). The value is clamped into it without
   * `onChange`; tick marks follow, the captions of `marks` keep their places (declare them inside every range).
   */
  setRange(min: number, max: number): void {
    if (min === this.range.min && max === this.range.max) return;
    this.range.min = min;
    this.range.max = max;
    this.markTs = this.markValues.map((v) => valueToT(this.range, v));
    this.update(
      tToValue(this.range, valueToT(this.range, Math.min(Math.max(this.current, min), max))),
      true,
      false,
    );
    this.track.moveTo(valueToT(this.range, this.current), true);
    this.track.repaint();
  }

  /** @internal Pointer / Home / End. */
  setFromT(t: number, notify: boolean, commit = false): void {
    this.update(tToValue(this.range, t), false, notify);
    if (commit) this.commit();
  }

  /** @internal Keyboard / wheel. */
  step(count: number): void {
    this.update(nudge(this.range, this.current, count), true, true);
    this.commit();
  }

  /** @internal */
  commit(): void {
    this.onCommit?.(this.current);
  }

  private update(value: number, animate: boolean, notify: boolean): void {
    const changed = value !== this.current;
    this.current = value;
    this.track.moveTo(valueToT(this.range, value), animate);
    if (!changed) return;
    const text = this.format(value);
    this.valueLabel.text = text;
    this.bubble.text.text = text;
    if (this.range.stops || this.range.snaps?.includes(value)) sfx('snap');
    else sfx('slide');
    if (notify) this.onChange?.(value);
  }
}
