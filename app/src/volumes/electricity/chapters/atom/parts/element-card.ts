/**
 * Element card — a stylised periodic-table tile as a world console: big symbol, name, and a few lines of
 * facts (Z / A, configuration, shells, charge, stability…). Used by `shells` and `atom-builder`; the caller
 * supplies ready text (element names come from the sim's data table, captions from `labels.ts`).
 */
import type { ChapterContext } from '@/engine/api';
import type { ColorLike } from '@/style';
import { Label, Panel, UiNode, worldSurface, type UiSurface } from '@/ui3d';

export interface ElementCardData {
  symbol: string;
  title: string;
  /** Up to `LINES` lines; `**…**` and formula markup allowed. */
  lines: readonly string[];
  /** Colour of the symbol (status colour in the builder). */
  tone?: ColorLike;
}

const LINES = 5;
const WIDTH = 380;

export interface ElementCard {
  surface: UiSurface;
  set(data: ElementCardData): void;
}

export function createElementCard(ctx: ChapterContext, unit = 0.0155, extraHeight = 0): ElementCard {
  const height = 96 + LINES * 27 + extraHeight; // extra room for lines that wrap (particle cards)
  const surface = worldSurface(ctx, { width: WIDTH, height, unit, name: 'element-card' });
  const symbol = new Label('', { font: 'display', size: 60, color: 'white', nowrap: true, reserve: 6 });
  const title = new Label('', {
    font: 'bodyBold',
    size: 20,
    color: 'white',
    maxWidth: WIDTH - 150,
    reserve: 40,
  });
  const lines = Array.from(
    { length: LINES },
    () => new Label('', { size: 17, color: 'mist', maxWidth: WIDTH - 36, reserve: 90 }),
  );
  surface.root.add(
    new Panel({
      variant: 'card',
      width: WIDTH,
      height,
      dir: 'col',
      align: 'start',
      gap: 5,
      pad: [14, 18, 14, 18],
      children: [
        new UiNode({ dir: 'row', align: 'center', gap: 14, height: 70, children: [symbol, title] }),
        ...lines,
      ],
    }),
  );
  let last = '';
  return {
    surface,
    set(data) {
      const key = JSON.stringify(data);
      if (key === last) return;
      last = key;
      symbol.text = data.symbol;
      title.text = data.title;
      lines.forEach((line, i) => (line.text = data.lines[i] ?? ''));
    },
  };
}
