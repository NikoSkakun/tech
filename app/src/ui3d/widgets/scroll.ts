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
      dragStart: () => undefined,
      drag: (e) => this.scrollTo(this.target - e.dy / Math.max(this.pxPerUnit(), 0.01), true),
    });
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
