/** Catalogue: life set — people, birds, vehicles, train. */
import { Vector3 } from 'three';
import { Builder, addVehicle, birds, circlePath, people, rails, train, type VehicleKind } from '@/kit';
import type { CatalogEntry } from './catalog-types';

export const LIFE: CatalogEntry[] = [
  {
    id: 'people',
    set: 'life',
    view: { az: 15, el: 12, zoom: 1.3 },
    make: (ctx) =>
      people(
        [
          { at: [-3, 0, 0] },
          { at: [-2, 0, 0.3], ry: 0.4, color: 'coral' },
          { at: [-1.1, 0, 0], scale: 0.62, color: 'yellow' },
          { at: [-0.4, 0, 0.5], scale: 0.26, color: 'orange' },
          { at: [0.6, 0, 0], action: 'work', hat: 'yellow', color: 'orange' },
          { at: [1.6, 0, 0.2], action: 'work', hat: 'white', color: 'blue', ry: -0.5 },
          { path: [new Vector3(-3, 0, 1.6), new Vector3(3, 0, 1.6)] },
          { path: [new Vector3(3, 0, 2.4), new Vector3(-3, 0, 2.4)], color: 'teal', speed: 1.5 },
        ],
        ctx.random.fork('people'),
      ),
  },
  {
    id: 'birds',
    set: 'life',
    bare: true,
    view: { az: 20, el: 25, zoom: 1.2 },
    make: (ctx) => birds({ rng: ctx.random.fork('birds'), count: 9, radius: [6, 10], height: [2, 5], speed: 3 }),
  },
  {
    id: 'vehicles',
    set: 'life',
    view: { az: 35, el: 20, zoom: 1.3 },
    make: () => {
      const b = new Builder('vehicles');
      (['car', 'van', 'truck', 'tractor', 'boat'] as VehicleKind[]).forEach((kind, i) => {
        b.frame({ at: [(i - 2) * 4.2, kind === 'boat' ? 0.6 : 0, 0] }, () => addVehicle(b, kind, (['coral', 'yellow', 'teal', 'green', 'sky'] as const)[i]));
      });
      return b.build();
    },
  },
  {
    id: 'ship',
    set: 'life',
    view: { az: 40, el: 14, zoom: 1.2 },
    make: () => {
      const b = new Builder('ship');
      b.frame({ at: [0, 3, 0] }, () => addVehicle(b, 'ship'));
      return b.build();
    },
  },
  {
    id: 'train',
    set: 'life',
    bare: true,
    view: { az: 30, el: 22, zoom: 1.3 },
    make: () => {
      const route = circlePath(0, 0, 0, 30, 24).map((p) => [p.x, p.z] as const);
      const track = rails({ route, bend: 0, electrified: true });
      const t = train({ path: track.paths.centre!, wagons: 9, kind: 'coal' });
      track.group.add(t.group);
      track.update = t.update;
      return track;
    },
  },
];
