/** Catalogue: industrial set. */
import { coolingTower, horizontalTank, silo, sphericalTank, stack, verticalTank } from '@/kit';
import type { CatalogEntry } from './catalog-types';

export const INDUSTRIAL: CatalogEntry[] = [
  { id: 'tank-vertical', set: 'industrial', view: { az: 30, el: 16 }, make: () => verticalTank() },
  { id: 'tank-horizontal', set: 'industrial', view: { az: 30, el: 14 }, make: () => horizontalTank() },
  { id: 'tank-sphere', set: 'industrial', view: { az: 30, el: 10 }, make: () => sphericalTank() },
  { id: 'silo', set: 'industrial', view: { az: 30, el: 10 }, make: () => silo() },
  { id: 'stack', set: 'industrial', view: { az: 30, el: 6, zoom: 1.15 }, make: () => stack() },
  { id: 'cooling-tower', set: 'industrial', view: { az: 30, el: 10 }, make: () => coolingTower() },
  { id: 'cooling-tower-cut', set: 'industrial', view: { az: 0, el: 14 }, make: () => coolingTower({ cut: 1.5 }) },
];
