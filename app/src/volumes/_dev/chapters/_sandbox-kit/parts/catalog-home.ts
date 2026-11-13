/** Catalogue: the shared cutaway house. */
import { cutawayHouse } from '@/kit';
import type { CatalogEntry } from './catalog-types';

export const HOME: CatalogEntry[] = [
  {
    id: 'cutaway-house',
    set: 'energy',
    view: { az: 8, el: 14, zoom: 1.25 },
    make: () => {
      const h = cutawayHouse();
      h.setOpen(true);
      return h;
    },
  },
  { id: 'cutaway-house-closed', set: 'energy', view: { az: 30, el: 20, zoom: 1.2 }, make: () => cutawayHouse() },
  {
    id: 'cutaway-house-roof-off',
    set: 'energy',
    view: { az: 10, el: 58, zoom: 1.25 },
    make: () => {
      const h = cutawayHouse({ wall: 'sky.light', roofColor: 'violet' });
      h.setOpen(true, true);
      return h;
    },
  },
  {
    id: 'cutaway-house-home',
    set: 'energy',
    view: { az: -18, el: 12, zoom: 1.25 },
    make: () => {
      const h = cutawayHouse({ lab: false });
      h.setOpen(true);
      return h;
    },
  },
];
