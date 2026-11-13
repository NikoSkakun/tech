/**
 * Shared frame of the modal overlays (settings, glossary, help): a dimming scrim that blocks the scene and
 * closes on click, and a centred hologlass panel with a title bar. The body is built lazily on first open
 * and rebuilt on every open when `fresh` is set.
 */
import {
  Button,
  Icon,
  Label,
  Panel,
  UI,
  UiNode,
  conceal,
  reveal,
  rgba,
  type IconName,
  type Painter,
} from '@/ui3d';
import type { Hud, Overlay } from '../shell';

class Scrim extends UiNode {
  override paint(p: Painter): void {
    p.rect(0, 0, this.bw + 40, this.bh + 40, { fill: rgba('bg.void', 0.72) });
  }
}

export interface ModalSpec {
  title: string;
  icon: IconName;
  /** Preferred panel width (shrinks to the screen). */
  width: number;
  /** Fill the body. Called on first open, or on every open when `fresh`. `arg` is what `hud.open(name, arg)` passed. */
  build(body: UiNode, arg: unknown): void;
  fresh?: boolean;
  key?(e: KeyboardEvent): boolean;
  onClose?(): void;
}

export function createModal(hud: Hud, spec: ModalSpec): Overlay {
  const scrim = new Scrim({ width: 'fill', height: 'fill' });
  scrim.on({ cursor: 'default', click: () => hud.close(), wheel: () => true });
  const body = new UiNode({ dir: 'col', gap: UI.gap.md, width: 'fill' });
  const panel = new Panel({
    width: spec.width,
    gap: UI.gap.md,
    children: [
      new UiNode({
        dir: 'row',
        align: 'center',
        gap: 12,
        width: 'fill',
        children: [
          new Icon(spec.icon, 28, 'cyan'),
          new Label(spec.title, { font: 'display', size: UI.text.h2, nowrap: true }, { width: 'fill' }),
          new Button({
            icon: 'close',
            variant: 'icon',
            size: 'sm',
            tooltip: 'Закрити (Esc)',
            onClick: () => hud.close(),
          }),
        ],
      }),
      body,
    ],
  });
  const root = new UiNode({
    dir: 'stack',
    align: 'center',
    justify: 'center',
    width: 'fill',
    height: 'fill',
    visible: false,
    opacity: 0,
    children: [scrim, panel],
  });
  hud.modal.add(root);
  let built = false;
  const fit = (): void => {
    const m = hud.metrics;
    panel.width = Math.min(spec.width, m.width - m.safeMargin * 2);
    panel.maxH = m.height - m.safeMargin * 2;
  };
  hud.engine.hud.onResize(fit);
  return {
    fullscreen: false,
    key: spec.key,
    open(arg) {
      fit();
      if (!built || spec.fresh) {
        body.clear();
        spec.build(body, arg);
        built = true;
      }
      reveal(root, { dy: 0, scale: 1, duration: 0.2 });
      panel.scale = 0.94;
      panel.y = -16;
      hud.host.tweens.to(panel, { scale: 1, y: 0 }, { duration: 0.32, ease: 'back.out' });
    },
    close() {
      spec.onClose?.();
      conceal(root, { dy: 0, scale: 1 });
    },
  };
}

/** A labelled row of a settings-like form: caption on the left, control on the right (stacked when narrow). */
export function field(label: string, control: UiNode, hint?: string): UiNode {
  return new UiNode({
    dir: 'col',
    gap: 6,
    width: 'fill',
    children: [
      new Label(label, { font: 'bodyBold', size: UI.text.small }),
      control,
      hint
        ? new Label(hint, { size: UI.text.caption, color: 'steel', lineHeight: 1.34 }, { width: 'fill' })
        : null,
    ],
  });
}
