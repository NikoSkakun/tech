/** Parade island 3 — grid: a 110 kV line arriving at a substation, 10 kV feeders on poles to a kiosk substation and a city block. */
import {
  GROUND,
  birds,
  cityBlock,
  clouds,
  distributionPole,
  forest,
  groundCover,
  instanced,
  island,
  kioskSubstation,
  latticeTower,
  poleSubstation,
  powerLine,
  road,
  substation,
  traffic,
  type LineSite,
} from '@/kit';
import { Parade, type ParadeBuilder } from './parade';

export const buildGrid: ParadeBuilder = (ctx) => {
  const rng = ctx.random.fork('grid');
  const parade = new Parade('island-grid');
  const isl = parade.add(
    island({
      radius: 66,
      seed: 44,
      relief: 1.2,
      biome: 'steppe',
      features: [
        { type: 'pad', x: -14, z: -6, w: 40, d: 62, corner: 6, y: 0.2, blend: 7 },
        { type: 'pad', x: 34, z: 26, w: 46, d: 38, corner: 8, y: 0.2, color: GROUND.asphalt(), blend: 6 },
        { type: 'lake', x: 36, z: -34, r: 10 },
      ],
    }),
  );
  const g = isl.group;
  // substation: one line bay between two transformer bays
  const yard = parade.add(substation({ kV: 110, bays: [{ type: 'transformer' }, { type: 'line' }, { type: 'transformer' }] }), g);
  yard.group.position.set(-14, 0.55, -6);
  yard.group.rotation.y = Math.PI;
  // 110 kV line: two suspension towers and a tension tower turning into the gantry
  const spots: [number, number, 'suspension' | 'tension'][] = [
    [-46, 44, 'suspension'],
    [-30, 50, 'tension'],
  ];
  const sites: (LineSite | (typeof yard.ports)[number])[] = spots.map(([x, z, type], i) => {
    const t = parade.add(latticeTower({ voltage: 110, circuits: 1, type, angle: type === 'tension' ? 0.6 : 0 }), g);
    t.group.position.set(x, isl.heightAt(x, z), z);
    t.group.rotation.y = i === 0 ? 1.2 : 0.6;
    return t;
  });
  sites.push(yard.ports[0]!);
  parade.add(powerLine(sites, { radius: 0.11 }), g);
  // 10 kV feeder on concrete poles toward the town, ending at a pole substation; a kiosk substation by the block
  const pole = distributionPole({ voltage: 10 });
  const route: [number, number][] = [[6, -16], [16, -8], [26, 0], [36, 4]];
  const placements = route.map(([x, z]) => ({ at: [x, isl.heightAt(x, z), z] as const, ry: -0.9 }));
  g.add(instanced(pole, placements));
  parade.add(pole, g).group.visible = false;
  const feeder: LineSite[] = placements.map((p) => {
    pole.group.position.set(...p.at);
    pole.group.rotation.y = p.ry;
    pole.group.updateMatrix();
    return { tower: pole, matrix: pole.group.matrix.clone() };
  });
  const tp = parade.add(poleSubstation(), g);
  tp.group.position.set(46, isl.heightAt(46, 7), 7);
  tp.group.rotation.y = -0.9 + Math.PI / 2;
  parade.add(powerLine([...feeder, tp], { radius: 0.06, sag: 0.025 }), g);
  const ktp = parade.add(kioskSubstation(), g);
  ktp.group.position.set(12, isl.heightAt(12, 14) + 0.1, 14);
  ktp.group.rotation.y = 0.6;
  // the consumers: a city block that glows at night; a road with traffic past the yard
  const city = parade.add(cityBlock({ size: [44, 36], lot: 15, floors: [2, 9], seed: 8 }), g);
  city.group.position.set(34, 0.5, 26);
  const street = parade.add(road({ ground: isl, route: [[-58, 20], [-40, 30], [8, 30], [10, 44], [30, 52]], width: 5 }), g);
  parade.add(
    traffic(
      [
        { kind: 'car', path: street.paths.laneRight! },
        { kind: 'truck', path: street.paths.laneRight!, offset: 60 },
      ],
      rng,
    ),
    g,
  );
  const avoid: [number, number, number][] = [[-14, -6, 40], [34, 26, 32], [-38, 46, 12], [20, -6, 14]];
  parade.add(forest({ count: 60, ground: isl, rng, avoid, kinds: ['poplar', 'round', 'birch', 'bush', 'fruit'], clump: 0.5 }), g);
  for (const kind of ['grass', 'flowers'] as const) parade.add(groundCover({ kind, ground: isl, rng, count: 60, avoid }), g);
  parade.add(clouds({ rng, count: 5 }), g);
  parade.add(birds({ rng, count: 6 }), g);
  return parade;
};
