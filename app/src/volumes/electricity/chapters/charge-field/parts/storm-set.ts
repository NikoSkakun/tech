/**
 * `StormDiorama` of step 6, static part (kit models, built in metres inside a group scaled to the scene): a
 * small island with a house that carries a lightning rod, a tall tree, and a cumulonimbus with an anvil made of
 * merged soft puffs. Returns the points the lightning effects need.
 */
import { Group, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { Builder, house, island, trees } from '@/kit';
import { STATIC } from '../layout';

/** Scene units per metre of the diorama. */
export const STORM_SCALE = 0.3;

export interface StormSet {
  /** Everything in metres; `group.scale` = `STORM_SCALE`, positioned at `STATIC.storm`. */
  group: Group;
  /** Local points, metres. */
  rodTip: Vector3;
  treeTop: Vector3;
  /** Lowest point of the cloud above the house, where the leader starts. */
  cloudBase: Vector3;
  /** Centre of the charging zone inside the cloud (graupel hotspot). */
  core: Vector3;
  cloudTop: Vector3;
  /** Rod mast (hidden when the «Громовідвід» toggle is off). */
  rod: Group;
  update(dt: number, t: number): void;
}

export function createStormSet(ctx: ChapterContext): StormSet {
  const group = new Group();
  group.name = 'storm-diorama';
  group.scale.setScalar(STORM_SCALE);
  group.position.copy(STATIC.storm);

  const land = island({ radius: 24, seed: 11, wobble: 0.45, relief: 0.5 });
  group.add(land.group);
  const home = house({ width: 8, depth: 7, floors: 1, roof: 'gable', seed: 5, lit: 1 });
  land.place(home.group, -5, 3, 0.35);
  home.night = 0.8;
  const roof = home.anchorLocal('roof').applyEuler(home.group.rotation).add(home.group.position);

  // lightning rod: mast on the ridge, a thick down conductor along the wall, an earth electrode
  const rb = new Builder('lightning-rod');
  rb.cyl(0.09, 3.6, { seg: 10, slot: 'metal', c: 'steel.light', at: [0, 0, 0] });
  rb.cone(0.12, 0.5, { seg: 10, slot: 'metal', c: 'white', at: [0, 3.6, 0] });
  rb.rod([0, 0.1, 0], [4.6, -3.2, 0.4], 0.07, { slot: 'metal', c: 'steel' });
  rb.rod([4.6, -3.2, 0.4], [4.9, -(roof.y - land.heightAt(0, 3)) - 0.2, 0.6], 0.07, {
    slot: 'metal',
    c: 'steel',
  });
  const rod = rb.build().group;
  rod.position.copy(roof);
  land.group.add(rod);
  const rodTip = roof.clone().add(new Vector3(0, 4.1, 0));

  const wood = trees(
    [
      { x: 9, y: land.heightAt(9, -2), z: -2, kind: 'poplar', scale: 1.9 },
      { x: 13, y: land.heightAt(13, 5), z: 5, kind: 'round', scale: 1.0 },
      { x: -14, y: land.heightAt(-14, -6), z: -6, kind: 'conifer', scale: 1.1 },
      { x: 3, y: land.heightAt(3, -10), z: -10, kind: 'bush', scale: 1.0 },
    ],
    { rng: ctx.random.fork('storm-trees') },
  );
  land.group.add(wood.group);
  const treeTop = new Vector3(9, land.heightAt(9, -2) + 15.5, -2);

  // cumulonimbus: dark flat base, bulging tower, anvil spreading at the top
  const cb = new Builder('thundercloud');
  const puff = (x: number, y: number, z: number, r: number, tone: number): void => {
    cb.sphere(r, {
      seg: 18,
      slot: 'soft',
      c: tone < 0.5 ? ['slate', 'steel'] : ['steel', 'mist'],
      at: [x, y, z],
      s: [1, 0.72, 0.9],
    });
  };
  const base = 24;
  for (let i = 0; i < 9; i++)
    puff(-14 + i * 3.6, base + 2.2 + (i % 2) * 0.6, (i % 3) - 1, 4.4 + (i % 3) * 0.5, 0.2);
  for (let i = 0; i < 6; i++)
    puff(-8 + i * 3.4, base + 7 + (i % 2), (i % 2) * 1.5 - 0.5, 5 + (i % 2) * 0.8, 0.6);
  for (let i = 0; i < 4; i++) puff(-4 + i * 3, base + 12.5, 0.3 * i, 4.6, 0.8);
  for (let i = 0; i < 9; i++)
    puff(-17 + i * 4.4, base + 17 + (i % 2) * 0.5, (i % 3) * 0.8 - 0.8, 4.2 - Math.abs(i - 4) * 0.25, 0.9);
  const cloud = cb.build().group;
  group.add(cloud);

  return {
    group,
    rodTip,
    treeTop,
    cloudBase: new Vector3(-2, base - 0.8, 2.6),
    core: new Vector3(0, base + 8, 5.6),
    cloudTop: new Vector3(0, base + 17.5, 4.4),
    rod,
    update(dt, t) {
      wood.update?.(dt, t);
      cloud.position.x = Math.sin(t * 0.25) * 0.5; // the cloud drifts a little
    },
  };
}
