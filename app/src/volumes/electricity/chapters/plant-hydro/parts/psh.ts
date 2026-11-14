/**
 * Pumped-storage plant on the northern mountain: the artificial upper bowl (lined ring embankment) with its
 * water level, two inclined penstocks hugging the slope down to the station on the river bank (portal
 * building, surge shaft head, transformer). The penstocks carry `sky` pulses — downhill while generating,
 * uphill while pumping (`setFlow(±1)`); the bowl level is `setLevel(0…1)`.
 *
 * Anchors (world, via `bowlTop`, `station`): the bowl rim and the station portal.
 */
import { CircleGeometry, Group, Mesh, Vector3 } from 'three';
import { K, type KToonMaterial } from '@/style';
import { Builder, G, type KitModel } from '@/kit';
import { PSH } from '../layout';
import type { World } from './world';

export interface Psh {
  group: Group;
  model: KitModel;
  water: Mesh;
  pipes: KToonMaterial;
  bowlTop: Vector3;
  station: Vector3;
  /** Middle of the penstock run (callouts). */
  pipeMid: Vector3;
  setLevel(fill: number): void;
  /** +1 generating (water down), −1 pumping (water up), 0 stopped. */
  setFlow(f: number): void;
}

const BOWL_DEPTH = 7;

export function buildPsh(world: World): Psh {
  const { bowl, station } = PSH;
  const b = new Builder('psh');
  // ring embankment: grassy outside, concrete-lined inside, a walkway on the crest
  b.lathe(
    [
      [bowl.r + 12, -1],
      [bowl.r + 2, BOWL_DEPTH + 1],
      [bowl.r - 0.5, BOWL_DEPTH + 1],
      [bowl.r - 4, 0.2],
      [0.01, 0.2],
    ],
    { seg: 64, c: ['steel.light', 'mist'], slot: 'matte', at: [bowl.x, bowl.y, bowl.z] },
  );
  b.ring(bowl.r + 0.8, 0.35, {
    seg: 64,
    c: 'slate',
    at: [bowl.x, bowl.y + BOWL_DEPTH + 1.3, bowl.z],
    axis: 'y',
  });
  // intake tower in the bowl and the station on the bank: portal building, surge shaft head, transformer
  b.cyl(2.6, BOWL_DEPTH + 3, { c: ['steel.light', 'white'], at: [bowl.x + 6, bowl.y, bowl.z + bowl.r - 9] });
  const sy = world.y(station.x, station.z);
  b.box(18, 9, 12, { r: 0.8, c: ['mist', 'white'], slot: 'matte', at: [station.x, sy, station.z] });
  b.box(18.6, 1.2, 12.6, { r: 0.4, c: 'sky', at: [station.x, sy + 9, station.z] });
  b.box(6, 4.4, 0.4, { r: 0.2, c: 'ink', at: [station.x - 4, sy, station.z + 6.1] });
  for (const k of [-6, -1, 4])
    b.box(3, 2, 0.3, { r: 0, c: 'sky', slot: 'window', at: [station.x + k + 2, sy + 5, station.z + 6.05] });
  b.box(5, 5, 6, { r: 0.6, c: ['slate', 'steel'], at: [station.x + 13, sy, station.z + 2] });
  b.cyl(3.4, 6, { c: ['steel', 'steel.light'], at: [station.x - 2, sy, station.z - 14] });
  const model = b.build();

  const group = new Group();
  group.name = 'psh';
  group.add(model.group);
  // penstocks: two parallel pipes from the bowl down the slope to the station, a few metres above the ground
  const top = new Vector3(bowl.x + 4, bowl.y + 2, bowl.z + bowl.r - 2);
  const end = new Vector3(station.x - 2, sy + 4, station.z - 14);
  const pipes = K.energy({
    color: 'steel',
    pulseColor: 'sky',
    repeat: 0.05,
    speed: 9,
    length: 0.3,
    intensity: 0.9,
  });
  for (const side of [-2.4, 2.4]) {
    const pts: Vector3[] = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const p = top.clone().lerp(end, t);
      p.x += side;
      if (i > 0) p.y = world.y(p.x, p.z) + 2.2;
      pts.push(p);
    }
    group.add(new Mesh(G.tube(pts, 1.4, { seg: 12 }), pipes));
  }
  const water = new Mesh(
    new CircleGeometry(bowl.r - 1.5, 64),
    K.water({ shallow: 'sky', deep: 'blue', shape: 'disc', scale: 8, glints: 0.7, followLook: true }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(bowl.x, bowl.y + 1, bowl.z);
  group.add(water);
  return {
    group,
    model,
    water,
    pipes,
    bowlTop: new Vector3(bowl.x, bowl.y + BOWL_DEPTH + 2, bowl.z),
    station: new Vector3(station.x, sy + 9, station.z),
    pipeMid: top
      .clone()
      .lerp(end, 0.5)
      .setY(world.y((top.x + end.x) / 2, (top.z + end.z) / 2) + 4),
    setLevel(fill: number) {
      const f = Math.min(1, Math.max(0, fill));
      water.position.y = bowl.y + 0.6 + f * (BOWL_DEPTH - 0.4);
      // the lined slope widens the surface as it rises
      water.scale.setScalar(0.88 + 0.12 * f);
    },
    setFlow(f: number) {
      pipes.power = Math.min(1, Math.abs(f));
      pipes.speed = f >= 0 ? 9 : -9;
    },
  };
}
