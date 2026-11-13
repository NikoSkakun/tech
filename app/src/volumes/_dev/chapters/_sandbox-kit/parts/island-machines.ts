/** Parade island 5 — rotating machines on a slowly turning studio table. */
import { Group } from 'three';
import { francisRunner, gasTurbine, hydrogenerator, island, kaplanRunner, motor, peltonRunner, people, turboSet } from '@/kit';
import { Parade, type ParadeBuilder } from './parade';

export const buildMachines: ParadeBuilder = (ctx) => {
  const rng = ctx.random.fork('machines');
  const parade = new Parade('island-machines');
  parade.add(island({ radius: 37, seed: 66, wobble: 0, relief: 0, biome: 'industrial', underside: 'slab', depth: 5 }));
  const table = new Group();
  table.name = 'turntable';
  table.position.y = 0.1;
  parade.group.add(table);
  // centre: the turbine-generator set with the turbine casings lifted
  const set = parade.add(turboSet({ sections: ['hp', 'ip', 'lp'] }), table);
  set.group.position.set(-set.length / 2, 0, -6);
  set.setOpen(0.75);
  const hydro = parade.add(hydrogenerator({ runnerDepth: 0, scale: 0.8 }), table);
  hydro.group.position.set(-22, 0.4, 20);
  const gt = parade.add(gasTurbine(), table);
  gt.group.position.set(6, 0, 16);
  gt.group.rotation.y = 0.5;
  gt.setOpen(0.8);
  const m = parade.add(motor({ scale: 4 }), table);
  m.group.position.set(-4, 0, 26);
  m.group.rotation.y = -0.6;
  const francis = parade.add(francisRunner({ radius: 2.4 }), table);
  francis.group.position.set(24, 2.2, 4);
  const kaplan = parade.add(kaplanRunner({ radius: 2.4 }), table);
  kaplan.group.position.set(30, 3.2, -8);
  const pelton = parade.add(peltonRunner({ radius: 2.2 }), table);
  pelton.group.position.set(22, 3.4, -22);
  pelton.group.rotation.y = -0.6;
  // people for scale (a person is 1.75 m: these machines are big)
  parade.add(
    people(
      [
        { at: [-10, 0, 2], hat: 'yellow', color: 'orange', ry: 2.8 },
        { at: [14, 0, 8], hat: 'white', color: 'blue', ry: 0.4, action: 'work' },
        { at: [-26, 0, 6], hat: 'yellow', color: 'teal', ry: 1 },
      ],
      rng,
    ),
    table,
  );
  const base = parade.update.bind(parade);
  parade.update = (dt, t) => {
    base(dt, t);
    table.rotation.y = t * 0.08;
    francis.group.rotation.y = t * 0.9;
    kaplan.group.rotation.y = t * 1.1;
  };
  return parade;
};
