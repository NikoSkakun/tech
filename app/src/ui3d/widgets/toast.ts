/**
 * Toast / hint — a short message pill that pops in, stays a few seconds and leaves. `ToastStack` queues them
 * in a column (newest at the bottom) and removes them when they are done.
 */
import type { ColorLike } from '@/style';
import { conceal, reveal } from '../core/anim';
import { sfx } from '../core/focus';
import type { IconName } from '../core/icons';
import { UiNode, type NodeProps } from '../core/node';
import { rgba, type Painter } from '../core/painter';
import { accentOf, STATUS, UI } from '../theme';
import { Label } from './label';
import { Icon } from './panel';

export interface ToastOptions {
  icon?: IconName;
  /** `info` (accent) · `ok` · `warning` · `alarm`. */
  tone?: 'info' | 'ok' | 'warning' | 'alarm';
  /** Seconds on screen; 0 = until dismissed. Default 4.5. */
  duration?: number;
  maxWidth?: number;
}

export class Toast extends UiNode {
  private readonly tone: ColorLike | null;

  constructor(text: string, opts: ToastOptions = {}) {
    super({
      dir: 'row',
      align: 'center',
      gap: 10,
      pad: [10, 20, 10, 16],
      minH: UI.hit,
      visible: false,
      opacity: 0,
    });
    this.tone = opts.tone && opts.tone !== 'info' ? STATUS[opts.tone] : null;
    const icon =
      opts.icon ??
      (opts.tone === 'warning' || opts.tone === 'alarm' ? 'warning' : opts.tone === 'ok' ? 'check' : 'info');
    this.add(
      new Icon(icon, 22, this.tone ?? accentOf(this)),
      new Label(text, { size: UI.text.small, maxWidth: opts.maxWidth ?? 520, lineHeight: 1.36 }),
    );
    this.on({ cursor: 'default' });
  }

  override paint(p: Painter): void {
    const tone = rgba(this.tone ?? accentOf(this));
    const r = Math.min(this.bh / 2, 24);
    p.rect(0, -3, this.bw, this.bh, { r, border: rgba('bg.void', 0), glow: 28, glowAlpha: 0.45 });
    p.rect(0, 0, this.bw, this.bh, {
      r,
      fill: rgba('bg.indigo', 0.985),
      fill2: rgba('bg.deep', 0.99),
      border: [tone[0], tone[1], tone[2], 0.75],
      bw: 1.5,
      glow: 12,
      glowAlpha: 0.2,
    });
  }
}

export class ToastStack extends UiNode {
  constructor(props: NodeProps = {}) {
    super({ dir: 'col', align: 'center', gap: 10, ...props });
  }

  /** Show a message; returns a function that dismisses it early. */
  push(text: string, opts: ToastOptions = {}): () => void {
    const toast = new Toast(text, opts);
    this.add(toast);
    reveal(toast, { dy: -18, scale: 0.9 });
    sfx('hint');
    let gone = false;
    const dismiss = (): void => {
      if (gone) return;
      gone = true;
      conceal(toast, { dy: 12, onDone: () => this.remove(toast) });
    };
    const life = opts.duration ?? 4.5;
    if (life > 0) this.surface?.host.tweens.delay(life, dismiss);
    return dismiss;
  }

  /** Remove everything at once (chapter change). */
  flush(): void {
    for (const c of [...this.children]) conceal(c, { onDone: () => this.remove(c) });
  }
}
