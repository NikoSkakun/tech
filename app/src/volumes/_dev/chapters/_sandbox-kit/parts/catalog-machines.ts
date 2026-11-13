/** Catalogue: rotating machines. */
import { francisRunner, gasTurbine, hydrogenerator, kaplanRunner, motor, peltonRunner, steamTurbine, turboSet, turbogenerator } from '@/kit';
import type { CatalogEntry } from './catalog-types';

export const MACHINES: CatalogEntry[] = [
  { id: 'steam-turbine', set: 'machines', view: { az: 20, el: 18, zoom: 1.4 }, make: () => steamTurbine() },
  {
    id: 'steam-turbine-open',
    set: 'machines',
    view: { az: 20, el: 22, zoom: 1.4 },
    make: () => {
      const t = steamTurbine();
      t.setOpen(1);
      return t;
    },
  },
  { id: 'turbogenerator', set: 'machines', view: { az: 18, el: 16, zoom: 1.3 }, make: () => turbogenerator() },
  { id: 'turbogenerator-closed', set: 'machines', view: { az: -25, el: 16, zoom: 1.3 }, make: () => turbogenerator({ cut: 0 }) },
  {
    id: 'turbo-set',
    set: 'machines',
    view: { az: 20, el: 20, zoom: 1.5 },
    make: () => {
      const t = turboSet();
      t.setOpen(0.7);
      return t;
    },
  },
];

MACHINES.push(
  { id: 'hydrogenerator', set: 'machines', view: { az: 15, el: 22, zoom: 1.2 }, make: () => hydrogenerator() },
  {
    id: 'gas-turbine-open',
    set: 'machines',
    view: { az: 20, el: 20, zoom: 1.4 },
    make: () => {
      const g = gasTurbine();
      g.setOpen(0.9);
      return g;
    },
  },
  { id: 'gas-turbine', set: 'machines', view: { az: 20, el: 16, zoom: 1.4 }, make: () => gasTurbine() },
  { id: 'motor', set: 'machines', view: { az: 25, el: 16, zoom: 1.2 }, make: () => motor() },
  {
    id: 'runner-francis',
    set: 'machines',
    view: { az: 25, el: 24, zoom: 1.2 },
    make: () => {
      const m = francisRunner();
      m.group.position.y = 1;
      return m;
    },
  },
  {
    id: 'runner-kaplan',
    set: 'machines',
    view: { az: 25, el: 24, zoom: 1.2 },
    make: () => {
      const m = kaplanRunner();
      m.group.position.y = 1.8;
      return m;
    },
  },
  {
    id: 'runner-pelton',
    set: 'machines',
    view: { az: 20, el: 14, zoom: 1.2 },
    make: () => {
      const m = peltonRunner();
      m.group.position.y = 1.8;
      return m;
    },
  },
);
