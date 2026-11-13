/**
 * The lab's «приладова дошка» — a holographic instrument board for the big chart of a step.
 *
 * Why not the dock? A lab step needs its sliders *and* a chart large enough to read; the dock holds one column
 * (≤ 3 sliders, ≤ 1 small chart). Why not a world console? At overview distance a world surface with standard
 * text sizes is illegible at 1280×720. So the board is a chapter-owned HUD surface (`hudSurface`, UI_API §8):
 * one glass panel in the upper-left sky of the frame — compose the step's shot so the subject sits lower-right.
 * On narrow / portrait layouts the board shrinks and centres under the chapter header.
 */
import type { ChapterContext } from '@/engine/api';
import { Label, Panel, UI, conceal, hudSurface, reveal, type UiNode, type UiSurface } from '@/ui3d';
import type { StepId } from './lab';

export interface HoloBoard {
  /** Mount a board for a step. `width` in px-eq (1 unit = 1 px at 1080p); the content decides the height. */
  add(step: StepId, o: { title?: string; width: number; children: UiNode[] }): Panel;
  /** Show the board of `step` (or none) — call from the scene's `enterStep`. */
  show(step: string, instant: boolean): void;
}

export function createHoloBoard(ctx: ChapterContext): HoloBoard {
  let surface: UiSurface | null = null;
  const boards = new Map<string, { panel: Panel; width: number }>();
  let current = '';
  const place = (): void => {
    const m = ctx.hud.metrics;
    for (const { panel, width } of boards.values()) {
      if (m.layout === 'wide') {
        // under the chapter header, right of the scale spine
        panel.scale = 1;
        panel.float = { ax: 0, ay: 0, dx: m.safeMargin + 64, dy: m.safeMargin + 118 };
      } else {
        panel.scale = Math.min(1, (m.width - 2 * m.safeMargin) / width) * 0.86;
        panel.float = { ax: 0.5, ay: 0, dy: m.safeMargin + 118 };
      }
    }
    surface?.root.relayout();
  };
  return {
    add(step, o) {
      if (!surface) {
        surface = hudSurface(ctx, 'lab-holo');
        ctx.onDispose(ctx.hud.onResize(place));
      }
      const children = o.title
        ? [
            new Label(o.title, { font: 'bodyBold', size: UI.text.small, color: 'white', nowrap: true }),
            ...o.children,
          ]
        : o.children;
      const panel = new Panel({
        variant: 'card',
        width: o.width,
        gap: 8,
        pad: [14, 16],
        visible: false,
        opacity: 0,
        blocks: false,
        children,
      });
      panel.name = `holo-${step}`;
      surface.root.add(panel);
      boards.set(step, { panel, width: o.width });
      place();
      return panel;
    },
    show(step, instant) {
      if (step === current && !instant) return;
      const before = boards.get(current)?.panel;
      const next = boards.get(step)?.panel;
      current = step;
      if (before && before !== next) conceal(before, { instant });
      if (next) reveal(next, { instant, dy: -12 });
    },
  };
}
