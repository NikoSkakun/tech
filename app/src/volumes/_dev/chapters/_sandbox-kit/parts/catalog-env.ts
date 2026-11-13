/** Catalogue: environment set. */
import { GROUND, forest, island, trees, type TreeKind } from '@/kit';
import type { CatalogEntry } from './catalog-types';

const KINDS: TreeKind[] = ['round', 'oak', 'conifer', 'poplar', 'birch', 'pine', 'fruit', 'bush'];

export const ENV: CatalogEntry[] = [
  {
    id: 'trees',
    set: 'env',
    view: { az: 10, el: 12, zoom: 1.5 },
    make: (ctx) =>
      trees(
        KINDS.flatMap((kind, i) => [0, 1].map((row) => ({ x: (i - 3.5) * 7, y: 0, z: row * 7 - 3.5, kind }))),
        { rng: ctx.random.fork('trees') },
      ),
  },
  {
    id: 'forest',
    set: 'env',
    bare: true,
    make: (ctx) => {
      const isl = island({ radius: 60, seed: 5, features: [{ type: 'lake', x: -18, z: 12, r: 17, squash: 0.75, rot: 0.4 }] });
      const f = forest({ count: 150, ground: isl, rng: ctx.random.fork('forest') });
      isl.group.add(f.group);
      isl.update = f.update;
      return isl;
    },
  },
  { id: 'island', set: 'env', bare: true, make: () => island({ radius: 60, seed: 3 }) },
  {
    id: 'island-lake',
    set: 'env',
    bare: true,
    make: () =>
      island({
        radius: 60,
        seed: 5,
        features: [
          { type: 'lake', x: -18, z: 12, r: 17, squash: 0.75, rot: 0.4 },
          { type: 'hill', x: 22, z: -18, r: 26, h: 11 },
          { type: 'pad', x: 14, z: 22, w: 26, d: 18, rot: 0.3, color: GROUND.gravel() },
          {
            type: 'path',
            width: 2.4,
            path: [
              [-50, -20],
              [-20, -24],
              [0, -8],
              [14, 14],
            ],
          },
        ],
      }),
  },
  {
    id: 'island-slab-sea',
    set: 'env',
    bare: true,
    make: () =>
      island({
        radius: 60,
        seed: 8,
        underside: 'slab',
        sea: -1.2,
        relief: 1,
        height: (x, z) => -3.5 + 6 * Math.exp(-((x + 12) ** 2 + (z - 6) ** 2) / 900) + 4 * Math.exp(-((x - 30) ** 2 + (z + 22) ** 2) / 260),
      }),
  },
];
