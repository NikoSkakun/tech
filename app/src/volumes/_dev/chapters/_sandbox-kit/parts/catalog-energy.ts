/** Catalogue: renewables & home energy set. */
import { batteryCabinet, distributionBoard, hybridInverter, pvModule, pvTable, windTurbine } from '@/kit';
import type { CatalogEntry } from './catalog-types';

export const ENERGY: CatalogEntry[] = [
  {
    id: 'pv-module',
    set: 'energy',
    view: { az: 25, el: 50, zoom: 1.4 },
    make: () => {
      const m = pvModule();
      m.group.position.y = 0.06;
      return m;
    },
  },
  {
    id: 'pv-module-back',
    set: 'energy',
    view: { az: 25, el: 40, zoom: 1.4 },
    make: () => {
      const m = pvModule();
      m.group.rotation.x = Math.PI;
      m.group.position.y = 0.02;
      return m;
    },
  },
  { id: 'pv-table', set: 'energy', view: { az: 30, el: 22 }, make: () => pvTable() },
  {
    id: 'hybrid-inverter',
    set: 'energy',
    view: { az: 22, el: 10, zoom: 1.2 },
    make: () => {
      const m = hybridInverter();
      m.group.position.y = 0.4;
      return m;
    },
  },
  { id: 'battery-cabinet', set: 'energy', view: { az: 25, el: 12, zoom: 1.2 }, make: () => batteryCabinet() },
  {
    id: 'battery-open',
    set: 'energy',
    view: { az: 20, el: 14, zoom: 1.2 },
    make: () => {
      const m = batteryCabinet();
      m.part('cover').position.x += 0.75;
      m.setSoc(0.6);
      return m;
    },
  },
];

ENERGY.push({
  id: 'distribution-board',
  set: 'energy',
  view: { az: 28, el: 10, zoom: 1.2 },
  make: () => {
    const m = distributionBoard();
    m.group.position.y = 0.25;
    m.setDoor(1);
    m.setLever(1, 4, false);
    return m;
  },
});

ENERGY.push(
  { id: 'wind-turbine', set: 'energy', view: { az: 28, el: 6, zoom: 1.15 }, make: () => windTurbine() },
  { id: 'wind-turbine-offshore', set: 'energy', view: { az: -30, el: 4, zoom: 1.15 }, make: () => windTurbine({ foundation: 'offshore', depth: 18, accent: 'yellow' }) },
  {
    id: 'wind-nacelle-open',
    set: 'energy',
    view: { az: 118, el: 14, zoom: 1, focus: { anchor: 'gearbox', radius: 11 } },
    make: () => {
      const t = windTurbine({ hubHeight: 40 });
      t.setCover(1);
      t.setPitch(0.5);
      t.rotorSpeed = 0.4;
      return t;
    },
  },
);
