/** Catalogue: M3 kit additions (close-up cells, level tube, light substation, turbine fleet, offshore set). */
import { Group, Mesh, BoxGeometry } from 'three';
import {
  Builder,
  addFloater,
  addJackUp,
  addJacket,
  addScour,
  addTopside,
  cylinderCellDetailed,
  levelTube,
  prismaticCellDetailed,
  substation,
  windFleet,
  windTurbine,
} from '@/kit';
import { K } from '@/style';
import type { CatalogEntry } from './catalog-types';

export const M3: CatalogEntry[] = [
  { id: 'cell-21700-detailed', set: 'energy', view: { az: 20, el: 14, zoom: 1.1 }, make: () => cylinderCellDetailed({ scale: 20 }) },
  { id: 'cell-4680-detailed', set: 'energy', view: { az: 20, el: 14 }, make: () => cylinderCellDetailed({ format: '4680', wrap: 'violet', scale: 10 }) },
  { id: 'cell-lfp-detailed', set: 'energy', view: { az: 25, el: 18 }, make: () => prismaticCellDetailed({ scale: 6 }) },
  { id: 'cell-lfp-cut', set: 'energy', view: { az: 15, el: 15 }, make: () => prismaticCellDetailed({ scale: 6, cut: true }) },
  { id: 'level-tube', set: 'energy', view: { az: 20, el: 10 }, make: () => levelTube({ height: 1, radius: 0.08, level: 0.62, color: 'lime' }) },
  {
    id: 'substation-light',
    set: 'grid',
    view: { az: 35, el: 28 },
    make: () => substation({ kV: 110, detail: 'light', bays: [{ type: 'line' }, { type: 'transformer' }] }),
  },
  {
    id: 'wind-fleet',
    set: 'energy',
    view: { az: 30, el: 18 },
    make: () => {
      const fleet = windFleet(
        [0, 1, 2, 3, 4, 5].map((i) => ({ at: [(i % 3) * 260 - 260, 0, Math.floor(i / 3) * 300 - 150] as const, yaw: 0.3 * (i - 2) })),
        { hubHeight: 90, rotorDiameter: 110 },
      );
      const b = new Builder('wind-fleet');
      b.attach(fleet.group);
      const model = b.build();
      model.update = (dt) => fleet.update(dt);
      return model;
    },
  },
  {
    id: 'turbine-own-interior',
    set: 'energy',
    view: { az: 60, el: 20, focus: { anchor: 'gearbox', radius: 9 } },
    make: () => {
      const room = new Group();
      room.add(new Mesh(new BoxGeometry(2.5, 2.5, 7), K.toon({ color: 'coral' })));
      room.children[0]!.position.set(0, -0.6, -2.5);
      const t = windTurbine({ interior: room });
      t.setCover(1);
      return t;
    },
  },
  {
    id: 'offshore-set',
    set: 'energy',
    view: { az: 30, el: 15 },
    make: () => {
      const b = new Builder('offshore-set');
      let seed = 3;
      const rand = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      b.frame({ at: [-60, 0, 0] }, () => (addJacket(b, 25), addTopside(b, 'hvdc')));
      b.frame({ at: [0, 0, 0] }, () => addFloater(b));
      b.frame({ at: [45, 0, 0] }, () => (addScour(b, 8, rand), addJackUp(b, 25)));
      return b.build();
    },
  },
];
