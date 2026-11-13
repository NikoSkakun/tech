/** Parade island 1 — nature & town: lake, forest, village street on a 0.4 kV line, a few blocks, road with traffic. */
import { Vector3 } from 'three';
import {
  Builder,
  addApartmentBlock,
  addBridge,
  addFence,
  addHouse,
  addOfficeBlock,
  addRoad,
  addStreetLamp,
  birds,
  clouds,
  distributionPole,
  forest,
  groundCover,
  instanced,
  island,
  people,
  powerLine,
  traffic,
} from '@/kit';
import { Parade, type ParadeBuilder } from './parade';

export const buildTown: ParadeBuilder = (ctx) => {
  const rng = ctx.random.fork('town');
  const parade = new Parade('island-town');
  const ring: [number, number][] = [];
  for (let i = 0; i < 12; i++) ring.push([Math.cos((i / 12) * Math.PI * 2) * 38, Math.sin((i / 12) * Math.PI * 2) * 34 + 2]);
  const isl = parade.add(
    island({
      radius: 62,
      seed: 21,
      features: [
        { type: 'lake', x: -6, z: 4, r: 15, squash: 0.8, rot: 0.3 },
        { type: 'hill', x: -30, z: -34, r: 26, h: 9 },
        { type: 'pad', x: 30, z: -32, w: 40, d: 26, rot: -0.35, blend: 6 },
        { type: 'pad', x: 26, z: 30, w: 44, d: 14, rot: 0.75, blend: 5 },
        { type: 'path', width: 1.6, path: [[-22, 28], [-12, 22], [-8, 14]] },
      ],
    }),
  );
  const g = isl.group;
  // road ring with lamps; a short spur to the lake over a small bridge is left for the hydro chapters
  const b = new Builder('town');
  const centre = addRoad(b, { ground: isl, route: ring, closed: true, bend: 9, width: 5.5 });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.2;
    const x = Math.cos(a) * 42.5;
    const z = Math.sin(a) * 38.5 + 2;
    b.frame({ at: [x, isl.heightAt(x, z), z], rot: [0, -a + Math.PI, 0] }, () => addStreetLamp(b), `lamp${i}.`);
  }
  // village street: houses facing the road
  const houses: [number, number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const x = 12 + t * 30;
    const z = 22 + t * 22 - Math.sin(t * Math.PI) * 6;
    if (!isl.inside(x, z, 9)) continue;
    houses.push([x, z, 0.75 + Math.PI]);
    b.frame({ at: [x, isl.heightAt(x, z) - 0.1, z], rot: [0, 0.75 + Math.PI, 0] }, () => addHouse(b, { seed: 40 + i, floors: i === 2 ? 2 : 1, roof: i % 3 === 1 ? 'hip' : 'gable' }), `house${i}.`);
  }
  addFence(b, { ground: isl, kind: 'picket', route: [[6, 20], [14, 31], [24, 40]] });
  // town quarter on the big pad
  const blocks: [number, number, number, () => void][] = [
    [22, -38, -0.35, () => addApartmentBlock(b, { floors: 9, sections: 1, seed: 3 })],
    [40, -30, -0.35, () => addApartmentBlock(b, { floors: 5, sections: 2, seed: 5 })],
    [28, -22, -0.35 + Math.PI, () => addOfficeBlock(b, { floors: 6, width: 16, depth: 11 })],
  ];
  blocks.forEach(([x, z, ry, make], i) => b.frame({ at: [x, isl.heightAt(x, z), z], rot: [0, ry, 0] }, make, `block${i}.`));
  addBridge(b, { from: [-34, isl.heightAt(-34, 22) + 0.3, 22], to: [-22, isl.heightAt(-22, 28) + 0.3, 28], kind: 'beam', width: 3, clearance: 2, spans: 1 });
  parade.add(b.build(), g);
  // 0.4 kV street line with a lamp on every pole
  const pole = distributionPole({ voltage: 0.4, lamp: true });
  const spots = houses.map(([x, z]) => ({ at: [x - 5.5, isl.heightAt(x - 5.5, z + 6), z + 6] as const, ry: 2.3 }));
  if (spots.length > 1) {
    g.add(instanced(pole, spots));
    parade.add(pole, g).group.visible = false;
    const sites = spots.map((p) => {
      pole.group.position.set(...p.at);
      pole.group.rotation.y = p.ry;
      pole.group.updateMatrix();
      return { tower: pole, matrix: pole.group.matrix.clone() };
    });
    parade.add(powerLine(sites, { radius: 0.07, color: 'ink', sag: 0.03 }), g);
  }
  // nature and life
  const avoid: [number, number, number][] = [...houses.map(([x, z]) => [x, z, 9] as [number, number, number]), [30, -32, 26], [-28, 25, 8]];
  parade.add(forest({ count: 120, ground: isl, rng, avoid, clump: 0.6, minDist: 4 }), g);
  for (const kind of ['grass', 'flowers', 'rocks'] as const) parade.add(groundCover({ kind, ground: isl, rng, count: 70, avoid }), g);
  parade.add(groundCover({ kind: 'reeds', ground: isl, rng, wet: true, spots: [[-18, 12], [-16, 14], [4, 15], [6, 13], [-2, -8]].map(([x, z]) => ({ x: x!, z: z! })) }), g);
  parade.add(clouds({ rng, count: 6 }), g);
  parade.add(birds({ rng, count: 7, centre: [0, 0, 0] }), g);
  parade.add(
    traffic(
      [
        { kind: 'car', path: centre, mode: 'loop' },
        { kind: 'van', path: centre, mode: 'loop', offset: 90 },
        { kind: 'tractor', path: centre, mode: 'loop', offset: 160 },
      ],
      rng,
    ),
    g,
  );
  const y = (x: number, z: number): number => isl.heightAt(x, z);
  parade.add(
    people(
      [
        { at: [16, y(16, 30), 30], ry: 1 },
        { at: [17.2, y(17.2, 30.6), 30.6], ry: -2, scale: 0.62 },
        { at: [-20, y(-20, 16), 16], action: 'work', hat: 'yellow' },
        { path: [new Vector3(-22, y(-22, 28) + 0.05, 28), new Vector3(-12, y(-12, 22) + 0.05, 22), new Vector3(-9, y(-9, 15) + 0.05, 15)] },
        { path: [new Vector3(24, y(24, -26) + 0.2, -26), new Vector3(36, y(36, -22) + 0.2, -22)], speed: 1.4 },
      ],
      rng,
    ),
    g,
  );
  return parade;
};
