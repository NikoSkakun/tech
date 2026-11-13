/** Catalogue: environment set — roads, rails, fences, lamps, bridges, ground cover, clouds, backdrop. */
import { Vector3 } from 'three';
import {
  Builder,
  addBoltCircle,
  addHazardStripe,
  addRivets,
  addVent,
  foamStrip,
  waterDisc,
  waterRibbon,
  addBridge,
  addFence,
  addRails,
  addRoad,
  addStreetLamp,
  clouds,
  groundCover,
  hills,
  island,
  moonDisc,
  sunDisc,
} from '@/kit';
import type { CatalogEntry } from './catalog-types';

export const ENV2: CatalogEntry[] = [
  {
    id: 'roads-rails',
    set: 'env',
    bare: true,
    view: { az: 25, el: 30, zoom: 1.5 },
    make: (ctx) => {
      const isl = island({
        radius: 55,
        seed: 11,
        underside: 'slab',
        relief: 0.8,
        features: [
          {
            type: 'river',
            width: 13,
            path: [
              [-60, 14],
              [-10, 6],
              [20, 14],
              [60, 8],
            ],
          },
        ],
      });
      const b = new Builder('dressing');
      addRoad(b, { ground: isl, route: [[-48, -22], [-12, -26], [-4, -6]] });
      addBridge(b, { from: [-4, isl.heightAt(-4, -6) + 0.12, -6], to: [3, isl.heightAt(3, 26) + 0.12, 26], kind: 'arch', clearance: 5, spans: 2 });
      addRoad(b, { ground: isl, route: [[3, 26], [8, 40], [30, 44]] });
      addRails(b, { ground: isl, route: [[-50, -38], [0, -42], [46, -24]], electrified: true });
      addFence(b, { ground: isl, kind: 'picket', route: [[-40, -12], [-22, -12], [-22, 0]] });
      addFence(b, { ground: isl, kind: 'rail', route: [[14, -10], [36, -8], [40, 4]] });
      addFence(b, { ground: isl, kind: 'mesh', route: [[12, 30], [30, 30], [30, 38]] });
      addFence(b, { ground: isl, kind: 'wall', route: [[-36, 26], [-18, 28], [-14, 40]] });
      const lamps = [
        [-30, -19, 'road'],
        [-14, -20, 'double'],
        [-30, -6, 'park'],
        [10, 36, 'road'],
      ] as const;
      for (const [x, z, kind] of lamps) {
        b.frame({ at: [x, isl.heightAt(x, z), z], rot: [0, 1.2, 0] }, () => addStreetLamp(b, { kind }), `${kind}${x}.`);
      }
      const dressing = b.build();
      isl.group.add(dressing.group);
      const rng = ctx.random.fork('cover');
      for (const kind of ['grass', 'flowers', 'rocks', 'boulders'] as const) {
        isl.group.add(groundCover({ kind, ground: isl, rng, count: kind === 'boulders' ? 8 : 70 }).group);
      }
      const sky = clouds({ rng, count: 5, radius: [45, 70], heights: [[18, 30]], size: [0.7, 1.3] });
      isl.group.add(sky.group);
      isl.update = sky.update;
      return isl;
    },
  },
  {
    id: 'backdrop',
    set: 'env',
    bare: true,
    view: { az: 0, el: 8, zoom: 1.6 },
    make: () => {
      const b = new Builder('backdrop');
      const h = hills({ radius: 120, count: 9, arc: 2.2, start: -2.7, kind: 'mountains', height: [40, 75], base: 0 });
      const g = hills({ radius: 80, count: 7, arc: 2.0, start: -2.6, height: [10, 22], base: 0, seed: 4 });
      const sun = sunDisc({ radius: 9 });
      sun.group.position.set(-40, 70, -100);
      const moon = moonDisc({ radius: 7, phase: 0.45 });
      moon.group.position.set(45, 62, -100);
      b.attach(h.group).attach(g.group).attach(sun.group).attach(moon.group);
      return b.build();
    },
  },
  {
    id: 'water-details',
    set: 'env',
    bare: true,
    view: { az: 20, el: 35, zoom: 1.4 },
    make: () => {
      const b = new Builder('water-details');
      b.box(30, 0.4, 22, { r: 0.2, slot: 'matte', c: 'green', at: [0, -0.4, 0] });
      b.attach(waterDisc(5, 0.05, { scale: 1 }).group);
      const bank = [new Vector3(-14, 0.05, 8), new Vector3(-4, 0.05, 7), new Vector3(4, 0.05, 9), new Vector3(14, 0.05, 8)];
      b.attach(waterRibbon(bank, 3, { scale: 1 }).group);
      b.attach(foamStrip(bank.map((p) => p.clone().setZ(p.z - 1.7)), 0.3).group);
      // detail helpers on a steel plate
      b.box(6, 3, 0.3, { r: 0.05, slot: 'gloss', c: 'steel.light', at: [9, 0, -6] });
      addRivets(b, [6.3, 2.8, -5.85], [11.7, 2.8, -5.85], 12);
      b.frame({ at: [7.6, 1.4, -5.85] }, () => addVent(b, 1.6, 1.4));
      b.frame({ at: [10.6, 1.5, -5.84] }, () => addBoltCircle(b, 0.6, 10));
      b.frame({ at: [9, 0.02, -4.6] }, () => addHazardStripe(b, 6, 0.5));
      return b.build();
    },
  },
];
