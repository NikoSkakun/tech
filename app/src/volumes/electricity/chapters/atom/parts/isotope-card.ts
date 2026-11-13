/**
 * IsotopeCard — the nuclide notation of the nucleus on screen as the document writes it (mass number above,
 * atomic number below, element symbol): ⁶³₂₉Cu. A world console (`console.ts`): three glyphs, nothing to read.
 */
import type { ChapterContext } from '@/engine/api';
import { Label, UiNode } from '@/ui3d';
import { createConsole, type PinnedConsole } from './console';

export interface IsotopeCardOptions {
  mass: number;
  charge: number;
  symbol: string;
  /** Top-centre of the card in the world. */
  top: readonly [number, number, number];
  /** World units per px-eq. */
  unit: number;
}

export function createIsotopeCard(ctx: ChapterContext, opts: IsotopeCardOptions): PinnedConsole {
  const numbers = new UiNode({
    dir: 'col',
    align: 'end',
    gap: 2,
    children: [
      new Label(String(opts.mass), { font: 'mono', size: 22, color: 'mist', nowrap: true }),
      new Label(String(opts.charge), { font: 'mono', size: 22, color: 'coral', nowrap: true }),
    ],
  });
  const symbol = new Label(opts.symbol, { font: 'display', size: 58, color: 'white', nowrap: true });
  return createConsole(ctx, {
    name: 'isotope-card',
    width: 160,
    unit: opts.unit,
    top: opts.top,
    children: [
      new UiNode({
        dir: 'row',
        align: 'center',
        justify: 'center',
        gap: 10,
        width: 'fill',
        children: [numbers, symbol],
      }),
    ],
  });
}
