/**
 * ScrollView — a clipped column that scrolls with the wheel, by dragging (touch) or with the keyboard when a
 * control inside is focused; soft fade at the edges and a slim scrollbar.
 */
import { UiNode, type NodeProps } from '../core/node';
import { rgba, type Painter } from '../core/painter';
import { accentOf } from '../theme';

export interface ScrollProps extends NodeProps {
  /** Fade of the top / bottom edge in units. Default 18. */
  feather?: number;
}

export class ScrollView extends UiNode {
  /** Put the scrolling children here. */
  readonly content: UiNode;
  /** Current offset in units (0 = top). Smoothly follows `target`. */
  offset = 0;
  private target = 0;
  private readonly feather: number;
  /** Finger velocity while dragging, units / s (positive = content moves down), for the fling on release. */
  private velocity = 0;
  private lastDragAt = 0;

  constructor(props: ScrollProps = {}) {
    super({
      dir: 'col',
      width: 'fill',
      height: 'fill',
      clip: true,
      clipFeather: props.feather ?? 18,
      ...props,
      children: [],
    });
    this.feather = props.feather ?? 18;
    this.content = new UiNode({ dir: 'col', width: 'fill', gap: props.gap ?? 0, children: props.children });
    this.add(this.content);
    this.gap = 0;
    this.on({
      cursor: 'default',
      wheel: (dy) => {
        if (this.range <= 0) return false;
        this.scrollTo(this.target + dy * 0.9);
        return true;
      },
      dragStart: () => {
        this.velocity = 0;
        this.lastDragAt = performance.now();
      },
      drag: (e) => {
        const du = e.dy / Math.max(this.pxPerUnit(), 0.01);
        const now = performance.now();
        const dt = Math.max((now - this.lastDragAt) / 1000, 1 / 240);
        this.lastDragAt = now;
        // low-pass: single events are noisy
        this.velocity = this.velocity * 0.6 + (du / dt) * 0.4;
        this.scrollTo(this.target - du, true);
      },
      dragEnd: (e) => {
        // a finger flick keeps the content moving and lets it settle (mouse drags stop where they are)
        if (e.pointerType === 'mouse' || performance.now() - this.lastDragAt > 80) return;
        const v = this.velocity;
        if (Math.abs(v) < 220) return;
        this.fling(this.target - v * 0.28, Math.min(0.9, 0.35 + Math.abs(v) / 4000));
      },
    });
  }

  /** Touch: take over a vertical finger drag from the content when there is something to scroll that way. */
  override wantsDrag(dx: number, dy: number): boolean {
    if (Math.abs(dy) < Math.abs(dx) || this.range <= 0) return false;
    return dy < 0 ? this.target < this.range - 0.5 : this.target > 0.5;
  }

  private fling(offset: number, duration: number): void {
    this.target = Math.min(Math.max(offset, 0), this.range);
    const host = this.surface?.host;
    if (!host) return;
    host.tweens.to(
      this as ScrollView,
      { offset: this.target },
      { duration, ease: 'power3.out', onUpdate: () => this.sync() },
    );
  }

  /** Scrollable distance in units. */
  get range(): number {
    return Math.max(this.content.bh - (this.bh - this.padT - this.padB), 0);
  }

  scrollTo(offset: number, instant = false): void {
    this.target = Math.min(Math.max(offset, 0), this.range);
    const host = this.surface?.host;
    if (!host || instant) {
      this.offset = this.target;
      this.sync();
    } else
      host.tweens.to(
        this as ScrollView,
        { offset: this.target },
        { duration: 0.22, ease: 'power2.out', onUpdate: () => this.sync() },
      );
  }

  /** Scroll so that `node` (a descendant of `content`) is visible. */
  reveal(node: UiNode): void {
    let top = 0;
    for (let n: UiNode | null = node; n && n !== this.content; n = n.parent) top += n.by;
    const view = this.bh - this.padT - this.padB;
    if (top < this.target) this.scrollTo(top - 8);
    else if (top + node.bh > this.target + view) this.scrollTo(top + node.bh - view + 8);
  }

  private pxPerUnit(): number {
    // CSS px per unit ≈ scale of the surface on screen; the HUD keeps it in the engine's text viewport
    return this.surface ? this.surface.cssPxPerUnit : 1;
  }

  private sync(): void {
    this.content.y = this.offset;
    this.repaint();
  }

  override paint(p: Painter): void {
    // keep the offset valid after a relayout (content got shorter)
    if (this.target > this.range) {
      this.target = this.offset = this.range;
      this.content.y = this.offset;
    }
    const range = this.range;
    // fade the edges only when there is something to scroll to (content that fits must not look cut)
    this.clipFeather = range > 0 ? this.feather : 0;
    if (range <= 0) return;
    const view = this.bh;
    const thumb = Math.max((view * view) / (view + range), 32);
    const y = view / 2 - thumb / 2 - (this.offset / range) * (view - thumb);
    const accent = rgba(accentOf(this));
    // the bar sits just outside the clipped box (in the parent's padding) so it never covers text
    const x = this.bw / 2 + 9;
    p.rect(x, 0, 3, view - 8, { r: 1.5, fill: rgba('slate', 0.3) });
    p.rect(x, y, 4, thumb - 8, { r: 2, fill: [accent[0], accent[1], accent[2], 0.75] });
  }
}
