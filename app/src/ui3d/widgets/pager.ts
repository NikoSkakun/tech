/**
 * Pager — several pages of content, one visible at a time, with prev / next and a page counter
 * (STYLE_GUIDE §6: ≤ ~450 characters per page of a side panel). Pages cross-fade with a small slide.
 */
import { sfx } from '../core/focus';
import { UiNode, type NodeProps } from '../core/node';
import { TEXT_COLOR, UI } from '../theme';
import { Button } from './button';
import { Label } from './label';

export interface PagerProps extends NodeProps {
  pages?: readonly UiNode[];
  /** Called after the visible page changed. */
  onPage?: (index: number, count: number) => void;
  /** Called when "next" is pressed on the last page (e.g. go to the next step). */
  onEnd?: () => void;
}

export class Pager extends UiNode {
  onPage: ((index: number, count: number) => void) | null;
  onEnd: (() => void) | null;
  private pages: UiNode[] = [];
  private current = 0;
  private readonly body: UiNode;
  private readonly bar: UiNode;
  private readonly counter: Label;
  private readonly prev: Button;
  private readonly next: Button;

  constructor(props: PagerProps = {}) {
    super({ dir: 'col', gap: UI.gap.sm, width: 'fill', ...props, children: [] });
    this.onPage = props.onPage ?? null;
    this.onEnd = props.onEnd ?? null;
    this.body = new UiNode({ dir: 'stack', width: 'fill' });
    this.counter = new Label(
      '',
      { font: 'mono', size: UI.text.caption, color: TEXT_COLOR.mute, nowrap: true, align: 'center' },
      { width: 56 },
    );
    this.prev = new Button({
      icon: 'prev',
      variant: 'icon',
      size: 'sm',
      tooltip: 'Попередня сторінка',
      onClick: () => this.go(this.current - 1),
    });
    this.next = new Button({
      icon: 'next',
      variant: 'icon',
      size: 'sm',
      tooltip: 'Наступна сторінка',
      onClick: () => this.go(this.current + 1),
    });
    this.bar = new UiNode({
      dir: 'row',
      align: 'center',
      justify: 'end',
      gap: 4,
      width: 'fill',
      children: [this.prev, this.counter, this.next],
    });
    this.add(this.body, this.bar);
    this.setPages(props.pages ?? []);
  }

  /** Page currently shown (0-based). */
  get page(): number {
    return this.current;
  }

  /** Take the prev / counter / next bar out of the pager to pin it elsewhere (e.g. under a scroll view). */
  takeBar(): UiNode {
    this.remove(this.bar);
    return this.bar;
  }
  get count(): number {
    return this.pages.length;
  }

  /** Replace all pages and show the first one. */
  setPages(pages: readonly UiNode[], start = 0): void {
    this.body.clear();
    this.pages = [...pages];
    this.current = Math.min(Math.max(start, 0), Math.max(pages.length - 1, 0));
    this.pages.forEach((p, i) => {
      p.visible = i === this.current;
      p.opacity = 1;
      p.x = 0;
      this.body.add(p);
    });
    this.sync();
  }

  /** Show page `index`; past the last page `onEnd` fires instead. */
  go(index: number): void {
    if (index >= this.pages.length) {
      this.onEnd?.();
      return;
    }
    const to = Math.max(index, 0);
    if (to === this.current) return;
    const dir = to > this.current ? 1 : -1;
    const from = this.pages[this.current]!;
    const page = this.pages[to]!;
    this.current = to;
    const tweens = this.surface?.host.tweens;
    from.visible = false;
    page.visible = true;
    if (tweens && !this.surface!.host.reducedMotion()) {
      page.opacity = 0;
      page.x = 26 * dir;
      tweens.to(page, { opacity: 1, x: 0 }, { duration: 0.28, ease: 'power2.out' });
    }
    sfx('page');
    this.sync();
    this.onPage?.(to, this.pages.length);
  }

  private sync(): void {
    const n = this.pages.length;
    this.bar.visible = n > 1;
    this.counter.text = `${this.current + 1} / ${n}`;
    this.prev.disabled = this.current === 0;
    this.next.disabled = this.current >= n - 1 && !this.onEnd;
  }
}
