/**
 * ElementCard — the "tile of the periodic table" beside the atom builder and the particle card of the
 * Standard Model wall: a big symbol, a title and a few short lines. A world console (`console.ts`), so its
 * text stays legible at any window size and camera distance.
 */
import type { ChapterContext } from '@/engine/api';
import { Label, UiNode } from '@/ui3d';
import { createConsole, type PinnedConsole } from './console';

export interface ElementCardData {
  symbol: string;
  title: string;
  /** Up to `lines` lines; `**…**` and formula markup allowed. */
  lines: readonly string[];
}

export interface ElementCardOptions {
  name: string;
  /** Panel width, px-eq, and the number of text lines under the heading. */
  width: number;
  lines: number;
  /** World units per px-eq; top-centre of the card in the world. */
  unit: number;
  top: readonly [number, number, number];
}

export interface ElementCard {
  console: PinnedConsole;
  set(data: ElementCardData): void;
}

export function createElementCard(ctx: ChapterContext, opts: ElementCardOptions): ElementCard {
  const inner = opts.width - 44; // the console panel's side padding
  const symbol = new Label('', { font: 'display', size: 56, color: 'white', nowrap: true, reserve: 6 });
  const title = new Label('', {
    font: 'bodyBold',
    size: 21,
    color: 'white',
    maxWidth: inner - 120,
    reserve: 40,
  });
  const lines = Array.from(
    { length: opts.lines },
    () => new Label('', { size: 17, color: 'mist', maxWidth: inner, reserve: 90 }),
  );
  const console3d = createConsole(ctx, {
    name: opts.name,
    width: opts.width,
    unit: opts.unit,
    top: opts.top,
    children: [
      new UiNode({ dir: 'row', align: 'center', gap: 14, width: 'fill', children: [symbol, title] }),
      new UiNode({ dir: 'col', align: 'start', gap: 5, width: 'fill', children: lines }),
    ],
  });
  let last = '';
  return {
    console: console3d,
    set(data) {
      const key = JSON.stringify(data);
      if (key === last) return;
      last = key;
      symbol.text = data.symbol;
      title.text = data.title;
      lines.forEach((line, i) => {
        line.text = data.lines[i] ?? '';
        line.visible = i < data.lines.length;
      });
    },
  };
}
