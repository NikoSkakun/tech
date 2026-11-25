/**
 * The numbers this volume adds to the battery model of `circuit` (`battery-cell.ts`): pure functions, unit-tested.
 */

/** Share of its store an alkaline AA loses per year in a drawer at room temperature (Energizer handbook: ≈ 3 %). */
export const DRAWER_LOSS_PER_YEAR = 0.03;

/** The battery's `life` (0 fresh … 1 dead) after `years` in a drawer: the store shrinks by 3 % a year. */
export function drawerLife(years: number): number {
  return 1 - (1 - DRAWER_LOSS_PER_YEAR) ** Math.max(years, 0);
}
