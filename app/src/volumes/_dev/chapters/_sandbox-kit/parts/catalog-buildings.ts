/** Catalogue: buildings set. */
import { apartmentBlock, cityBlock, controlRoom, factoryHall, house, officeBlock, warehouse, type HouseOptions } from '@/kit';
import type { CatalogEntry } from './catalog-types';

const h = (id: string, o: HouseOptions, az = 30): CatalogEntry => ({ id, set: 'buildings', view: { az, el: 16 }, make: () => house(o) });

export const BUILDINGS: CatalogEntry[] = [
  h('house-gable', { seed: 1, wall: 'white', roofColor: 'coral', shutters: 'teal' }),
  h('house-hip', { seed: 2, roof: 'hip', width: 9, wall: 'yellow.light', roofColor: 'violet' }),
  h('house-2f', { seed: 3, floors: 2, width: 9.5, depth: 8 }, -30),
  h('house-flat', { seed: 4, roof: 'flat', floors: 2, width: 8, wall: 'mist' }),
  h('house-shed', { seed: 5, roof: 'shed', width: 7, depth: 6 }, -35),
  h('house-small', { seed: 6, width: 6, depth: 5.5 }),
];

BUILDINGS.push(
  { id: 'apartment-9', set: 'buildings', view: { az: 30, el: 14 }, make: () => apartmentBlock({ floors: 9, sections: 2 }) },
  { id: 'apartment-5', set: 'buildings', view: { az: -30, el: 14 }, make: () => apartmentBlock({ floors: 5, sections: 3, seed: 4 }) },
  { id: 'office', set: 'buildings', view: { az: 30, el: 14 }, make: () => officeBlock() },
  { id: 'factory-sawtooth', set: 'buildings', view: { az: 30, el: 18 }, make: () => factoryHall() },
  { id: 'factory-gable', set: 'buildings', view: { az: 30, el: 18 }, make: () => factoryHall({ roof: 'gable', accent: 'teal', length: 32 }) },
  { id: 'warehouse', set: 'buildings', view: { az: 30, el: 18 }, make: () => warehouse() },
  { id: 'control-room', set: 'buildings', view: { az: 25, el: 16 }, make: () => controlRoom() },
  { id: 'city-block', set: 'buildings', bare: true, view: { az: 30, el: 26, zoom: 1.5 }, make: () => cityBlock() },
);
