/**
 * The step board (`StepUiSpec.board`): a HUD panel for big charts, tables and stat grids. Wide screens: top-left,
 * right of the scale spine and under the header. Narrow / portrait: full width under the header, above the
 * bottom sheet. It can be collapsed to its title; its body scrolls when the screen is short. The column module
 * fills it; the shell reports its area to the camera director (inset `left` on wide screens, `top` otherwise).
 */
import type { HudMetrics } from '@/engine/api';
import { Button, Label, Panel, ScrollView, UI, UiNode, conceal, reveal } from '@/ui3d';
import type { HudContext, HudModule } from './context';
import type { BoardSpec } from './step-ui-types';

const WIDTH = { sm: 380, md: 520, lg: 680 } as const;

export interface StepBoard extends HudModule {
  /** Show `spec` with the built body nodes (null: hide the board). */
  show(spec: BoardSpec | null, nodes: readonly UiNode[], actions: readonly UiNode[], instant: boolean): void;
  /** Lay out for the metrics; `bottom` = units the bottom sheet takes from the bottom edge (narrow layouts). */
  place(m: HudMetrics, top: number, bottom: number): void;
  /** Whether a board is on screen. */
  readonly active: boolean;
}

export function createBoard(hud: HudContext): StepBoard {
  const title = new Label('', { font: 'bodyBold', size: UI.text.h3 }, { width: 'fill' });
  let collapsed = false;
  const fold = new Button({
    name: 'board-fold',
    icon: 'chevronUp',
    variant: 'icon',
    size: 'sm',
    tooltip: 'Згорнути / розгорнути дошку',
    onClick: () => {
      collapsed = !collapsed;
      fold.icon = collapsed ? 'chevronDown' : 'chevronUp';
      if (collapsed) conceal(body, { dy: 8, scale: 1, onDone: () => hud.relayout() });
      else reveal(body, { dy: 8, scale: 1 });
      hud.relayout();
    },
  });
  const head = new UiNode({ dir: 'row', align: 'center', gap: 8, width: 'fill', children: [title, fold] });
  const content = new ScrollView({ height: 'hug', gap: 14 });
  const actions = new UiNode({ dir: 'row', wrap: true, gap: 10, width: 'fill' });
  const body = new UiNode({ dir: 'col', gap: 12, width: 'fill', children: [content, actions] });
  const node = new Panel({
    name: 'board',
    width: WIDTH.md,
    gap: 12,
    pad: [16, 20],
    visible: false,
    opacity: 0,
    children: [head, body],
  });
  let spec: BoardSpec | null = null;

  return {
    node,
    get active() {
      return spec !== null;
    },
    show(next, nodes, buttons, instant) {
      spec = next;
      content.content.clear();
      actions.clear();
      if (!next) {
        conceal(node, { instant, dx: -16, dy: 0, onDone: () => hud.relayout() });
        hud.relayout();
        return;
      }
      for (const n of nodes) content.content.add(n);
      for (const b of buttons) actions.add(b);
      actions.visible = buttons.length > 0;
      title.text = next.title ?? '';
      title.visible = !!next.title;
      content.scrollTo(0, true);
      reveal(node, { instant, dx: -24, dy: 0, tilt: 0.04 });
      hud.relayout();
    },
    place(m, top, bottom) {
      const margin = m.safeMargin;
      const want = WIDTH[spec?.size ?? 'md'];
      content.maxH = 4000;
      if (m.layout === 'wide') {
        // right of the spine; never under the step column (468 + margins) on the right
        const left = margin + 64;
        const free = m.width - left - (468 + margin * 2) - 24;
        node.width = Math.max(Math.min(want, free), 300);
        node.float = { ax: 0, ay: 0, dx: left, dy: top };
        node.rotY = hud.engine.reducedMotion ? 0 : 0.03; // mirror of the column's tilt
        content.maxH = Math.max(m.height - top - margin - 96 - chrome(), 120);
      } else {
        node.width = Math.min(m.width - margin * 2, Math.max(want, 560));
        node.float = { ax: 0.5, ay: 0, dy: top };
        node.rotY = 0;
        content.maxH = Math.max(m.height - top - bottom - 24 - chrome(), 110);
      }
    },
  };

  /** Height of the board without its scrolling content (title row, actions, padding). */
  function chrome(): number {
    return 16 * 2 + 12 + (head.bh || 36) + (actions.visible ? 12 + (actions.bh || 44) : 0);
  }
}
