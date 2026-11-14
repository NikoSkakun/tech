/**
 * Fish ladder on the south bank (kit `Builder`): a staircase of small concrete pools from the tailwater up to
 * the reservoir, each a step of a few metres, standing on piers where the bank falls away. Little orange
 * fish leap from pool to pool (parts `fish0…3`, moved in `update`). Anchors: `top`, `mid`, `bottom`.
 */
import { Builder, type KitModel } from '@/kit';
import { DAM, FISH_LADDER, ISLAND, RESERVOIR } from '../layout';

export interface FishLadder extends KitModel {
  update(dt: number, t: number): void;
}

const POOLS = 15;
const FISH = 4;

export function buildFishLadder(groundY: (x: number, z: number) => number): FishLadder {
  const { x0, x1, z, width } = FISH_LADDER;
  const b = new Builder('fish-ladder');
  const pools: { x: number; y: number }[] = [];
  const len = (x0 - x1) / POOLS;
  for (let i = 0; i < POOLS; i++) {
    const t = i / (POOLS - 1);
    const x = x0 - (x0 - x1) * t;
    const y = ISLAND.seaLevel + 0.6 + (RESERVOIR.npr - 0.6 - ISLAND.seaLevel) * t;
    pools.push({ x, y });
    // pool: floor slab, two side walls and the low weir to the next pool; water surface just under the weir
    b.box(len + 0.4, 0.8, width, { r: 0.2, c: ['steel.light', 'mist'], slot: 'matte', at: [x, y - 1.6, z] });
    b.box(len + 0.4, 2.4, 0.6, { r: 0.2, c: 'mist', slot: 'matte', at: [x, y - 1.6, z - width / 2] });
    b.box(len + 0.4, 2.4, 0.6, { r: 0.2, c: 'mist', slot: 'matte', at: [x, y - 1.6, z + width / 2] });
    b.box(0.6, 1.8, width - 0.6, { r: 0.2, c: 'steel.light', slot: 'matte', at: [x - len / 2, y - 1.4, z] });
    b.box(len - 0.4, 0.15, width - 0.8, { r: 0, c: 'sky', slot: 'gloss', at: [x, y - 0.3, z] });
    // a pier down to the ground where the pool stands in the air
    const g = groundY(x, z);
    if (y - 1.6 - g > 1)
      b.box(2.2, y - 1.6 - g + 1, 2.2, { r: 0.3, c: 'steel.light', slot: 'matte', at: [x, g - 1, z] });
  }
  for (let i = 0; i < FISH; i++) {
    const f = b.part(`fish${i}`);
    f.capsule(0.32, 0.9, { axis: 'x', c: ['orange', 'amber'], at: [-0.45, 0, 0] });
    f.cone(0.34, 0.5, { axis: 'x', c: 'orange', at: [-0.95, 0, 0], rot: [0, Math.PI, 0] });
  }
  b.anchor('top', pools[POOLS - 1]!.x, pools[POOLS - 1]!.y + 1, z);
  b.anchor('mid', pools[7]!.x, pools[7]!.y + 1.5, z);
  b.anchor('bottom', pools[0]!.x, pools[0]!.y + 1, z);
  void DAM;
  const model = b.build();
  const fish = Array.from({ length: FISH }, (_, i) => model.part(`fish${i}`));
  return Object.assign(model, {
    update(_dt: number, t: number) {
      fish.forEach((f, i) => {
        // each fish climbs the ladder pool by pool: a 1.1 s leap, then a rest; its own phase and pool
        const cycle = 2.6;
        const k = Math.floor((t + i * 1.7) / cycle);
        const u = ((t + i * 1.7) % cycle) / 1.1;
        const from = (k * 3 + i * 4) % (POOLS - 1);
        const a = pools[from]!;
        const c = pools[from + 1]!;
        const s = Math.min(1, u);
        f.visible = u <= 1;
        f.position.set(
          a.x + (c.x - a.x) * s,
          a.y + (c.y - a.y) * s + 2.6 * Math.sin(Math.PI * s) - 0.2,
          z + (i - 1.5) * 1.1,
        );
        f.rotation.z = Math.atan2(c.y - a.y + 2.6 * Math.PI * Math.cos(Math.PI * s), c.x - a.x); // head (+X) along the leap
      });
    },
  });
}
