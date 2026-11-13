/**
 * The roof diorama of steps 8–9: the shared house (kit `cutawayHouse`, closed, without the baked lab array —
 * the chapter puts its own modules on the south slope) on a small tabletop island with a few trees and a
 * compass rose. Built in metres and scaled by `HOUSE_SCALE`; south = +Z, east = +X, as in the kit house.
 */
import { Group, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { Builder, HOUSE, cutawayHouse, forest, island, type KitModel } from '@/kit';
import type { Text3D } from '@/text';
import { L } from '../labels';
import { HOUSE_SCALE, shadows, tag } from '../world';

/** Frame of the south roof slope (house metres): origin on the tiles in the middle of the slope, +Y = outward normal, +Z = downhill. */
export const SLOPE = (() => {
  const z = HOUSE.D / 4 + 0.1;
  return { x: 0.6, y: HOUSE.eaves + (HOUSE.D / 2 - z) * Math.tan(HOUSE.pitch), z, pitch: HOUSE.pitch } as const;
})();

export interface RoofWorld {
  /** Everything, already scaled to stage units. */
  group: Group;
  /** Unscaled parent in house metres — add step objects here. */
  metres: Group;
  house: KitModel;
  /** A group sitting on the south slope (see `SLOPE`). */
  slope: Group;
  compass: Text3D[];
  update(dt: number, t: number): void;
}

export function createRoofWorld(ctx: ChapterContext): RoofWorld {
  const group = new Group();
  group.name = 'roof-world';
  const metres = new Group();
  metres.scale.setScalar(HOUSE_SCALE);
  metres.position.y = 0.55;
  group.add(metres);

  const isl = island({ radius: 15, seed: 11, relief: 0.25, biome: 'meadow', underside: 'slab', depth: 1.6 });
  metres.add(shadows(isl.group, false));
  const house = cutawayHouse({ lab: false });
  house.setOpen(false, false);
  isl.place(shadows(house.group), 0, -1);
  // trees only behind and beside the house: the south side stays open (no shade on the roof, a clear view)
  const trees = forest({
    count: ctx.quality.count(7, 3),
    ground: isl,
    rng: ctx.random.fork('roof-trees'),
    avoid: [[0, -1, 9], [0, 9, 9], [9, 5, 6], [-9, 5, 6]],
    margin: 1.5,
  });
  isl.group.add(shadows(trees.group));

  const slope = new Group();
  slope.position.set(SLOPE.x, SLOPE.y, SLOPE.z);
  slope.rotation.x = SLOPE.pitch;
  house.group.add(slope);

  // compass rose on the lawn south of the house (Пн at the far side)
  const rose = new Builder('compass');
  rose.cyl(1.5, 0.05, { seg: 40, slot: 'matte', c: 'bg.indigo' });
  rose.cyl(1.35, 0.06, { seg: 40, slot: 'matte', c: 'slate' });
  rose.cone(0.28, 1.15, { seg: 4, slot: 'gloss', c: 'coral', axis: 'z', at: [0, 0.09, 0.1] }); // south
  rose.cone(0.28, 1.15, { seg: 4, slot: 'gloss', c: 'white', axis: 'z', at: [0, 0.09, -0.1], rot: [0, Math.PI, 0] });
  const compassGroup = rose.build().group;
  const at = new Vector3(-9.2, isl.heightAt(-9.2, 7.5) + 0.05, 7.5);
  compassGroup.position.copy(at);
  isl.group.add(compassGroup);
  const compass = ([[L.north, 0, -1], [L.south, 0, 1], [L.east, 1, 0], [L.west, -1, 0]] as const).map(([text, dx, dz]) => {
    const t = tag(text, 18, 'white', 'display');
    t.scale.setScalar(1 / HOUSE_SCALE); // a screen-space label still inherits its parents' scale: undo the diorama's
    t.position.set(at.x + dx * 2.1, at.y + 0.35, at.z + dz * 2.1);
    isl.group.add(t);
    return t;
  });

  return {
    group,
    metres,
    house,
    slope,
    compass,
    update(dt, t) {
      trees.update?.(dt, t);
    },
  };
}
