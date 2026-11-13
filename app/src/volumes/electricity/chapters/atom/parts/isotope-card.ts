/**
 * Isotope card — the nuclide notation ᴬ_Z X as a small holographic card in the world (mass number on top,
 * atomic number below, element symbol): ⁶³₂₉Cu. A world console (`worldSurface`), crisp at any zoom.
 */
import type { ChapterContext } from '@/engine/api';
import { Label, Panel, UiNode, worldSurface, type UiSurface } from '@/ui3d';

export interface IsotopeCardOptions {
  mass: number;
  charge: number;
  symbol: string;
}

export function createIsotopeCard(ctx: ChapterContext, opts: IsotopeCardOptions): UiSurface {
  const surface = worldSurface(ctx, { width: 210, height: 150, unit: 0.016, name: 'isotope-card' });
  const numbers = new UiNode({
    dir: 'col',
    align: 'end',
    gap: 6,
    children: [
      new Label(String(opts.mass), { font: 'mono', size: 30, color: 'mist', nowrap: true }),
      new Label(String(opts.charge), { font: 'mono', size: 30, color: 'coral', nowrap: true }),
    ],
  });
  const symbol = new Label(opts.symbol, { font: 'display', size: 84, color: 'white', nowrap: true });
  surface.root.add(
    new Panel({
      variant: 'card',
      width: 210,
      height: 150,
      dir: 'row',
      align: 'center',
      justify: 'center',
      gap: 10,
      children: [numbers, symbol],
    }),
  );
  return surface;
}
