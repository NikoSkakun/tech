/** Catalogue: small home devices, cells, sun trackers, storage and backup, special grid equipment. */
import {
  Builder,
  addCable,
  addPlug,
  addSchukoSocket,
  autotransformerBank,
  bessContainer,
  cell,
  electricCar,
  gis,
  heliostat,
  hvdcValveHall,
  lamp,
  lightSwitch,
  parabolicTrough,
  portableGenerator,
  pvTracker,
  wallbox,
} from '@/kit';
import type { CatalogEntry } from './catalog-types';

const up = <T extends { group: { position: { y: number } } }>(m: T, y: number): T => {
  m.group.position.y = y;
  return m;
};

export const ENERGY2: CatalogEntry[] = [
  {
    id: 'socket-plugs',
    set: 'energy',
    view: { az: 30, el: 18, zoom: 1.2 },
    make: () => {
      const b = new Builder('socket-plugs');
      b.frame({ at: [0, 0.06, 0] }, () => addSchukoSocket(b));
      b.frame({ at: [0.1, 0.06, 0.04] }, () => addPlug(b, 'schuko'), 's.');
      b.frame({ at: [-0.09, 0.06, 0.04] }, () => addPlug(b, 'euro', 'white'), 'e.');
      addCable(b, [[0.1, 0.06, 0.09], [0.1, 0.01, 0.16], [0, 0.01, 0.2], [-0.06, 0.01, 0.2]], { radius: 0.004 });
      return b.build();
    },
  },
  {
    id: 'lamps-switch',
    set: 'energy',
    view: { az: 20, el: 14, zoom: 1.2 },
    make: () => {
      const b = new Builder('lamps');
      const a = lamp('incandescent');
      a.setPower(1);
      a.group.position.x = -0.07;
      const l = lamp('led');
      l.setPower(1);
      l.group.position.x = 0.02;
      const s = lightSwitch();
      s.setOn(true);
      s.group.position.set(0.13, 0.05, 0);
      b.attach(a.group).attach(l.group).attach(s.group);
      return b.build();
    },
  },
  {
    id: 'cells',
    set: 'energy',
    view: { az: 25, el: 16, zoom: 1.2 },
    make: () => {
      const b = new Builder('cells');
      (['cylindrical', 'prismatic', 'pouch'] as const).forEach((kind, i) => {
        for (const cut of [false, true]) {
          const c = cell(kind, { cut });
          c.group.position.set((i - 1) * 0.2 + (i === 0 ? 0.05 : 0), 0, cut ? 0.12 : -0.05);
          if (i === 0) c.group.scale.setScalar(2);
          b.attach(c.group);
        }
      });
      return b.build();
    },
  },
  { id: 'pv-tracker', set: 'energy', view: { az: 35, el: 18 }, make: () => pvTracker() },
  { id: 'heliostat', set: 'energy', view: { az: -30, el: 12 }, make: () => heliostat() },
  { id: 'parabolic-trough', set: 'energy', view: { az: 35, el: 16 }, make: () => parabolicTrough() },
  { id: 'bess-container', set: 'energy', view: { az: 55, el: 16 }, make: () => bessContainer() },
  {
    id: 'ev-wallbox',
    set: 'energy',
    view: { az: -50, el: 16 },
    make: () => {
      const b = new Builder('ev-wallbox');
      b.attach(electricCar().group);
      b.box(0.2, 1.5, 0.3, { r: 0.04, slot: 'metal', c: 'slate', at: [-2.2, 0, -1.5] });
      const w = wallbox();
      w.group.position.set(-2.1, 1.2, -1.5);
      w.group.rotation.y = Math.PI / 2;
      b.attach(w.group);
      return b.build();
    },
  },
  { id: 'portable-generator', set: 'energy', view: { az: 30, el: 16 }, make: () => portableGenerator({ canopy: true }) },
  { id: 'at-bank', set: 'grid', view: { az: 30, el: 20 }, make: () => autotransformerBank({ spare: true }) },
  { id: 'gis', set: 'grid', view: { az: 35, el: 22 }, make: () => gis() },
  {
    id: 'hvdc-valve-hall',
    set: 'grid',
    view: { az: 25, el: 24 },
    make: () => {
      const h = hvdcValveHall();
      h.setOpen(true, true);
      return up(h, 0);
    },
  },
];
