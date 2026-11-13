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
  ScrollView,
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
  /**
   * Touch shells: the body scrolls by itself (it pins a search field, say) — do not wrap it in the modal's
   * scroll view. `bodyHeight()` then tells the body how tall it may be.
   */
  ownScroll?: boolean;
}

/** What `createModal` returns: the overlay plus the height its body may take right now (touch shells). */
export interface ModalOverlay extends Overlay {
  bodyHeight(): number;
}

export function createModal(hud: Hud, spec: ModalSpec): ModalOverlay {
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
  // the panel is centred in the part of the screen that is really free: on phones the frame's padding keeps
  // it clear of the notch, the home indicator and the on-screen keyboard (all zero on desktops)
  const frame = new UiNode({
    dir: 'stack',
    align: 'center',
    justify: 'center',
    width: 'fill',
    height: 'fill',
    children: [panel],
  });
  const root = new UiNode({
    dir: 'stack',
    align: 'center',
    justify: 'center',
    width: 'fill',
    height: 'fill',
    visible: false,
    opacity: 0,
    children: [scrim, frame],
  });
  hud.modal.add(root);
  let built = false;
  // touch shells: a phone screen is shorter than most of these panels — the body scrolls under the title bar
  const scroll = new ScrollView({ name: 'modal-scroll', height: 'hug' });
  const fit = (): void => {
    const m = hud.metrics;
    const touch = m.shell !== 'desk';
    const wrap = touch && !spec.ownScroll;
    if (wrap && body.parent !== scroll.content) {
      scroll.content.add(body);
      panel.add(scroll);
    } else if (!wrap && body.parent === scroll.content) {
      panel.remove(scroll);
      panel.add(body);
    }
    panel.width = Math.min(spec.width, m.width - m.safeMargin * 2);
    panel.maxH = m.height - m.safeMargin * 2;
    const s = m.safeArea;
    frame.pad = [s.top, s.right, s.bottom, s.left];
    if (touch) {
      // phones: margins of 8 inside the safe area, and the panel's own padding shrinks with the screen
      panel.width = Math.min(spec.width, m.width - s.left - s.right - 16);
      panel.maxH = m.height - s.top - s.bottom - 16;
      panel.pad = m.formFactor === 'phone' ? [16, 16] : UI.pad.panel;
      scroll.maxH = bodyHeight();
    }
    // a phone panel with a list of its own takes its full height at once: it must not jump when the list arrives
    panel.minH = touch && spec.ownScroll && m.formFactor === 'phone' ? panel.maxH : 0;
  };
  hud.engine.hud.onResize(fit);
  /** Height left for the body under the title bar (touch shells). */
  function bodyHeight(): number {
    const pad = hud.metrics.formFactor === 'phone' ? 16 : UI.pad.panel;
    return Math.max((panel.maxH === Infinity ? hud.metrics.height : panel.maxH) - pad * 2 - 40 - UI.gap.md, 120);
  }
  return {
    fullscreen: false,
    bodyHeight,
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
