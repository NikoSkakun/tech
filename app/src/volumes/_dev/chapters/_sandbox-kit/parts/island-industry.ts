/** Parade island 2 — industry: a thermal plant in miniature (coal yard → conveyor → hall → stack, cooling towers, tank farm, pipe rack, rail). */
import {
  Builder,
  GROUND,
  addControlRoom,
  addCoolingTower,
  addFactoryHall,
  addFence,
  addHorizontalTank,
  addPipe,
  addPipeRack,
  addPump,
  addRails,
  addSilo,
  addSphericalTank,
  addStack,
  addValve,
  addVerticalTank,
  addWarehouse,
  clouds,
  conveyor,
  forest,
  gantryCrane,
  island,
  people,
  train,
} from '@/kit';
import { Parade, type ParadeBuilder } from './parade';

export const buildIndustry: ParadeBuilder = (ctx) => {
  const rng = ctx.random.fork('industry');
  const parade = new Parade('island-industry');
  const isl = parade.add(
    island({
      radius: 64,
      seed: 33,
      relief: 0.6,
      features: [
        { type: 'pad', x: 0, z: -4, w: 96, d: 78, corner: 14, color: GROUND.concrete(), y: 0, blend: 6 },
        { type: 'pad', x: -30, z: 22, w: 26, d: 20, corner: 5, color: GROUND.coal(), y: 0.05 },
        { type: 'lake', x: 40, z: 34, r: 11 },
      ],
    }),
  );
  const g = isl.group;
  const b = new Builder('plant');
  const at = (x: number, z: number, ry: number, fn: () => void, prefix: string): void => void b.frame({ at: [x, 0.05, z], rot: [0, ry, 0] }, fn, prefix);
  // toy proportions: the towers are far smaller than life next to the buildings
  at(34, -34, 0, () => addCoolingTower(b, { height: 46 }), 'ct1.');
  at(6, -42, 0, () => addCoolingTower(b, { height: 46, cut: 1.4 }), 'ct2.');
  at(-22, -30, 0, () => addStack(b, { height: 58, radius: 2.6 }), 'stack.');
  at(-6, -12, 0, () => addFactoryHall(b, { length: 44, width: 18, height: 13, roof: 'gable', accent: 'coral' }), 'hall.');
  at(-34, -12, Math.PI / 2, () => addFactoryHall(b, { length: 22, width: 14, height: 22, roof: 'flat', accent: 'amber', seed: 3 }), 'boiler.');
  at(30, 6, 0, () => addWarehouse(b, { length: 22, width: 12, height: 6 }), 'store.');
  at(6, 12, 0, () => addControlRoom(b), 'control.');
  // tank farm
  at(40, -8, 0, () => addVerticalTank(b, { radius: 5, height: 8, bund: false }), 'tank1.');
  at(52, 4, 0, () => addVerticalTank(b, { radius: 4, height: 7, band: 'amber', bund: false }), 'tank2.');
  at(-2, 28, 0.3, () => addSphericalTank(b, { radius: 4 }), 'sphere.');
  at(12, 30, 0.3, () => addHorizontalTank(b, { length: 8, radius: 1.5 }), 'bullet.');
  for (let i = 0; i < 3; i++) at(-48 + i * 5.2, -2, 0, () => addSilo(b, { radius: 2.1, height: 8 }), `silo${i}.`);
  // pipe rack from the hall to the tanks, a pump set with valves, process lines to the cooling towers
  at(22, -1.5, 0, () => addPipeRack(b, { length: 24, height: 5 }), 'rack.');
  at(22, 18, 0.2, () => addPump(b, { size: 1.3 }), 'pump.');
  addPipe(b, [[20, 1.2, 18.4], [14, 1.2, 18.4], [14, 1.2, 26], [12, 1.2, 28]], { radius: 0.3, color: 'blue', name: 'suction' });
  addPipe(b, [[6, 2, -30], [6, 2, -24], [-2, 2, -24], [-2, 2, -21]], { radius: 0.7, color: 'sky', flangeEvery: 0, name: 'coolingReturn' });
  addPipe(b, [[34, 2, -24], [34, 2, -20], [10, 2, -20], [10, 2, -21]], { radius: 0.7, color: 'blue', flangeEvery: 0, name: 'coolingSupply' });
  b.frame({ at: [2, 2, -24], rot: [0, Math.PI / 2, 0] }, () => addValve(b, { radius: 0.7, kind: 'butterfly' }), 'valve.');
  addPipe(b, [[-22, 4, -27], [-22, 4, -21.5]], { radius: 1.1, color: 'steel', flangeEvery: 0 });
  // rail siding for the coal trains, fence along the plant boundary
  const track = addRails(b, { ground: isl, route: [[-58, 40], [-34, 36], [-8, 40], [16, 46]], bend: 30 });
  addFence(b, { ground: isl, kind: 'wall', route: [[-56, 30], [-44, 32], [-44, 14]] });
  parade.add(b.build(), g);
  // movers: coal conveyor, yard crane, train, workers
  parade.add(conveyor({ from: [-30, 1.4, 16], to: [-34, 17, -3] }), g);
  const crane = parade.add(gantryCrane({ span: 20, height: 11 }), g);
  crane.group.position.set(-30, 0.1, 24);
  crane.setTrolley(-0.3);
  crane.setHook(0.4);
  parade.add(train({ path: track, mode: 'pingpong', wagons: 6, kind: 'coal', speed: 4 }), g);
  parade.add(
    people(
      [
        { at: [2, 0.1, 17], hat: 'yellow', action: 'work', color: 'orange' },
        { at: [4, 0.1, 17.6], hat: 'white', ry: -1, color: 'blue' },
        { at: [-24, 0.1, 30], hat: 'yellow', color: 'orange', ry: 2 },
      ],
      rng,
    ),
    g,
  );
  parade.add(forest({ count: 26, ground: isl, rng, avoid: [[0, -4, 56], [40, 34, 13]], clump: 0.2, margin: 3 }), g);
  parade.add(clouds({ rng, count: 5 }), g);
  // toggling the crane keeps the yard alive
  const base = parade.update.bind(parade);
  parade.update = (dt, t) => {
    base(dt, t);
    crane.setTrolley(Math.sin(t * 0.35) * 0.7);
    crane.setHook(0.45 + Math.sin(t * 0.5 + 1) * 0.3);
  };
  return parade;
};
