/**
 * Control — base of every interactive widget: animated hover / press / focus / disabled state
 * (STYLE_GUIDE §5: hover 120 ms lift + glow, press 80 ms squash, release spring), keyboard focus, sound hooks.
 * Subclasses read `hoverT`, `pressT`, `focusT` (0…1) in `paint()` and override `activate()` / `onKey()`.
 */
import type { TweenOptions } from '@/engine/api';
import { MOTION } from '@/style';
import { sfx, uiFocus, type Focusable } from '../core/focus';
import { UiNode, type NodeProps } from '../core/node';
import type { Painter } from '../core/painter';
import { rgba } from '../core/painter';
import { UI } from '../theme';

export class Control extends UiNode implements Focusable {
  hoverT = 0;
  pressT = 0;
  focusT = 0;
  /** Lift toward the viewer on hover, units. */
  protected lift = 4;
  /** Scale while pressed. */
  protected squash = 0.94;
  /** False for controls that only show state (a chip without an action): no 44 px target is required. */
  clickable = true;
  private off = false;

  constructor(props: NodeProps = {}) {
    super(props);
    this.minHit = UI.hit;
    this.on({
      hover: (over) => {
        if (this.off) return;
        if (over) sfx('hover');
        this.tween({ hoverT: over ? 1 : 0, z: over ? this.lift : 0 }, MOTION.hover);
      },
      press: () => {
        if (this.off) return;
        uiFocus.set(this, false);
        this.tween({ pressT: 1, scale: this.squash }, MOTION.press);
      },
      release: () => this.tween({ pressT: 0, scale: 1 }, MOTION.release),
      click: () => {
        if (!this.off) this.activate();
      },
      wheel: (dy, e) => this.parent?.bubbleWheel(dy, e) ?? false,
    });
  }

  /** Disabled controls are dimmed and inert. */
  get disabled(): boolean {
    return this.off;
  }
  set disabled(v: boolean) {
    if (v === this.off) return;
    this.off = v;
    this.tween({ opacity: v ? 0.38 : 1, hoverT: 0, z: 0 }, MOTION.hover);
  }

  /** Play the press feedback without a pointer (a scripted press, e.g. `ui.press(id)`). */
  flash(): void {
    this.tween({ pressT: 1, scale: this.squash }, MOTION.press);
    this.tween({ pressT: 0, scale: 1 }, { ...MOTION.release, delay: MOTION.press.duration });
  }

  /** Click / Enter / Space. */
  protected activate(): void {
    // subclasses
  }

  onKey(e: KeyboardEvent): boolean {
    if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') {
      if (!this.off) {
        this.tween({ scale: this.squash }, MOTION.press);
        this.tween({ scale: 1 }, { ...MOTION.release, delay: MOTION.press.duration });
        this.activate();
      }
      return true;
    }
    return false;
  }

  onFocus(focused: boolean, ring: boolean): void {
    this.tween({ focusT: focused && ring ? 1 : 0 }, MOTION.hover);
  }

  /** Tween own numeric properties on the engine clock and repaint while they move. */
  protected tween(props: Record<string, number>, opts: TweenOptions = {}): void {
    const host = this.surface?.host;
    if (!host) {
      Object.assign(this, props);
      this.repaint();
      return;
    }
    const user = opts.onUpdate;
    host.tweens.to(this as unknown as Record<string, number>, props, {
      ...opts,
      duration: host.reducedMotion() ? Math.min(opts.duration ?? 0.3, 0.12) : opts.duration,
      onUpdate: (k) => {
        this.repaint();
        user?.(k);
      },
    });
  }

  /** Focus ring around a rounded box — call at the start of `paint()`. */
  protected paintFocus(p: Painter, w: number, h: number, r: number): void {
    if (this.focusT < 0.01) return;
    p.rect(0, 0, w + 8, h + 8, {
      r: r + 4,
      border: rgba('white', 0.95 * this.focusT),
      bw: 2,
      glow: 8,
      glowAlpha: 0.4 * this.focusT,
    });
  }

  protected override onAttach(surface: unknown): void {
    if (!surface) uiFocus.release(this);
  }
}
