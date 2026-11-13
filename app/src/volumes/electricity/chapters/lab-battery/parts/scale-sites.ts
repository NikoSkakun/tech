/**
 * Step 12: the big stops of the «стрічка масштабів» — home storage, electric car, container storage, a storage
 * plant and the recycling line — composed from kit models plus small chapter set pieces, and the list of
 * stops with the energy each stands for. Normalised to ≈ 1.6 units («не в масштабі»), standing on y = 0.
 */
import type { Group } from 'three';
import { Builder, batteryCabinet, bessContainer, electricCar, hybridInverter, instanced } from '@/kit';
import { SEMANTIC } from '@/style';
import { group } from '../world';
import { ebike, laptop, phone, powerStation } from './scale-items';

/** Home storage: the battery cabinet under its hybrid inverter on a piece of wall. */
function homeStorage(): Group {
  const b = new Builder('home-wall');
  b.box(1.7, 1.75, 0.08, { at: [0, 0, -0.34], r: 0.03, c: ['bg.indigo', 'slate'] });
  b.box(1.8, 0.05, 0.9, { at: [0, 0, 0], r: 0.02, c: 'slate' }); // floor slab
  b.rod([0.5, 0.75, -0.28], [0.5, 1.05, -0.28], 0.02, { seg: 8, c: 'ink' }); // cable cabinet → inverter
  const cabinet = batteryCabinet();
  cabinet.setSoc(0.7);
  cabinet.group.scale.setScalar(1.25);
  cabinet.group.position.set(0.05, 0.05, 0);
  const inverter = hybridInverter();
  inverter.setLeds({ grid: true, bat: true });
  inverter.group.scale.setScalar(0.95);
  inverter.group.position.set(0.5, 1.32, -0.28);
  return group('home-storage', 0, 0, 0, [b.build().group, cabinet.group, inverter.group]);
}

/** Electric car at a charging post (the cable glows lime: energy going into the pack). */
function carAtCharger(): Group {
  const car = electricCar('teal');
  car.group.scale.setScalar(0.44);
  car.group.rotation.y = Math.PI / 2;
  const b = new Builder('charge-post');
  b.box(0.16, 0.95, 0.14, { at: [0.95, 0, -0.55], r: 0.04, slot: 'gloss', c: ['slate', 'white'] });
  b.box(0.1, 0.16, 0.012, { at: [0.95, 0.66, -0.474], r: 0.02, slot: 'window', c: 'sky' });
  b.sphere(0.022, { at: [0.95, 0.56, -0.47], seg: 8, slot: 'glow', c: 'lime' });
  // charging cable from the post to the car's port
  b.rod([0.95, 0.5, -0.47], [0.9, 0.2, -0.36], 0.018, { seg: 6, slot: 'glow', c: 'lime' });
  b.rod([0.9, 0.2, -0.36], [0.72, 0.36, -0.3], 0.018, { seg: 6, slot: 'glow', c: 'lime' });
  b.box(0.3, 0.02, 0.22, { at: [0.95, 0, -0.55], r: 0.01, c: 'slate' });
  return group('ev', 0, 0, 0, [car.group, b.build().group]);
}

/** One storage container on its pad, with the power-conversion cabinet, a transformer and bollards. */
function containerSite(): Group {
  const box = bessContainer();
  box.group.scale.setScalar(0.3);
  box.group.rotation.y = Math.PI / 2;
  const b = new Builder('bess-pad');
  b.box(2.3, 0.05, 1.5, { r: 0.02, c: 'slate' }); // concrete pad
  b.box(0.34, 0.5, 0.3, { at: [0.98, 0.05, 0.42], r: 0.03, slot: 'gloss', c: ['mist', 'white'] }); // PCS cabinet
  for (let i = 0; i < 4; i++) b.box(0.26, 0.016, 0.01, { at: [0.98, 0.2 + i * 0.07, 0.575], r: 0, c: 'ink' });
  b.sphere(0.02, { at: [0.88, 0.48, 0.575], seg: 8, slot: 'glow', c: 'lime' });
  // pad-mounted transformer with cooling fins and three bushings
  b.box(0.36, 0.4, 0.34, { at: [0.98, 0.05, -0.38], r: 0.03, c: ['slate', 'steel'] });
  for (let i = 0; i < 5; i++) b.box(0.05, 0.3, 0.02, { at: [1.18, 0.1, -0.5 + i * 0.06], r: 0, c: 'slate' });
  for (const dz of [-0.1, 0, 0.1])
    b.cyl(0.022, 0.12, { at: [0.98, 0.45, -0.38 + dz], seg: 8, slot: 'gloss', c: 'white' });
  for (const [x, z] of [
    [-1.05, 0.68],
    [0, 0.7],
    [1.05, 0.7],
  ] as const)
    b.cyl(0.03, 0.26, { at: [x, 0.05, z], seg: 10, slot: 'gloss', c: 'yellow' }); // bollards
  return group('bess', 0, 0, 0, [box.group, b.build().group]);
}

/** A storage plant seen from afar: a field of containers, a control hut, a transformer and a line tower. */
function plant(): Group {
  const rows = instanced(
    bessContainer(),
    [-1.5, -0.5, 0.5, 1.5].flatMap((x) => [-0.55, 0.55].map((z) => ({ at: [x * 3.4, 0, z * 8.5] as const }))),
  );
  rows.scale.setScalar(0.105);
  const b = new Builder('plant-site');
  b.box(2.5, 0.03, 2.3, { r: 0.01, c: ['bg.indigo', 'slate'] }); // gravel pad
  for (let i = 0; i <= 8; i++)
    b.cyl(0.012, 0.16, { at: [-1.2 + i * 0.3, 0.03, 1.1], seg: 6, slot: 'metal', c: 'steel' });
  b.box(2.42, 0.012, 0.012, { at: [0, 0.17, 1.1], r: 0, slot: 'metal', c: 'steel' }); // fence rail
  b.box(0.34, 0.2, 0.26, { at: [0.95, 0.03, 0], r: 0.02, slot: 'gloss', c: ['mist', 'white'] }); // control hut
  b.box(0.38, 0.03, 0.3, { at: [0.95, 0.23, 0], r: 0.01, c: 'slate' });
  b.box(0.1, 0.07, 0.006, { at: [0.95, 0.1, 0.132], r: 0.008, slot: 'glow', c: 'amber' });
  b.box(0.22, 0.2, 0.2, { at: [-0.95, 0.03, 0], r: 0.02, c: ['slate', 'steel'] }); // transformer
  for (const dz of [-0.06, 0, 0.06])
    b.cyl(0.012, 0.09, { at: [-0.95, 0.23, dz], seg: 6, slot: 'gloss', c: 'white' });
  // lattice tower taking the energy away
  for (const [dx, dz] of [
    [-0.05, -0.05],
    [0.05, -0.05],
    [-0.05, 0.05],
    [0.05, 0.05],
  ] as const)
    b.rod([-0.95 + dx * 1.6, 0.03, -0.75 + dz * 1.6], [-0.95 + dx * 0.3, 1.0, -0.75 + dz * 0.3], 0.008, {
      seg: 5,
      slot: 'metal',
      c: 'steel.light',
    });
  for (const y of [0.78, 0.94])
    b.rod([-1.2, y, -0.75], [-0.7, y, -0.75], 0.008, { seg: 5, slot: 'metal', c: 'steel.light' });
  const site = group('plant', 0, 0, 0, [rows, b.build().group]);
  site.scale.setScalar(1.25); // a far view, but it still has to fill its stop
  return site;
}

/**
 * Recycling line: spent modules ride a conveyor into the shredder; the «чорна маса» pours down the chute and
 * the recovered metals pile up in bins (Li `lime`, Ni `green`, Co `blue`, Cu `orange` — the step's nuggets fly
 * into them).
 */
function recycler(): Group {
  const b = new Builder('recycler');
  b.box(1.1, 0.8, 0.9, { r: 0.06, c: ['bg.indigo', 'slate'] }); // crusher box
  b.cyl(0.62, 0.5, { at: [0, 0.8, 0], rTop: 0.85, seg: 4, slot: 'metal', c: 'steel', bevel: 0.02 }); // hopper
  b.box(0.5, 0.26, 0.012, { at: [0, 0.3, 0.455], r: 0.02, c: 'ink' }); // control panel
  b.sphere(0.035, { at: [-0.14, 0.44, 0.465], seg: 8, slot: 'glow', c: 'lime' });
  b.cyl(0.05, 0.02, { at: [0.12, 0.42, 0.455], axis: 'z', seg: 14, slot: 'metal', c: SEMANTIC.dcPlus });
  // conveyor rising from the left with three spent modules on it
  b.frame({ at: [-1.0, 0.3, 0], rot: [0, 0, 0.5] }, () => {
    b.box(1.5, 0.06, 0.5, { at: [0, 0, 0], r: 0.02, c: 'ink' });
    for (const x of [-0.72, 0.72])
      b.cyl(0.07, 0.52, { at: [x, 0.03, -0.26], axis: 'z', seg: 12, slot: 'metal', c: 'steel' });
    for (let i = 0; i < 3; i++) {
      b.box(0.3, 0.14, 0.36, {
        at: [-0.5 + i * 0.48, 0.06, 0],
        r: 0.03,
        slot: 'gloss',
        c: ['slate', 'steel'],
      });
      b.box(0.3, 0.02, 0.1, { at: [-0.5 + i * 0.48, 0.2, 0], r: 0.005, c: 'lime.dark' });
    }
  });
  for (const x of [-1.55, -0.75])
    b.rod([x, 0, 0.2], [x, x < -1 ? 0.05 : 0.5, 0.2], 0.03, { seg: 6, slot: 'metal', c: 'steel' });
  // chute and the bins of recovered metals
  b.box(0.5, 0.06, 0.7, { at: [0.8, 0.44, 0], rot: [0, 0, -0.35], r: 0.02, slot: 'metal', c: 'steel' });
  (['lime', 'green', 'blue', 'orange'] as const).forEach((c, i) => {
    const z = -0.6 + i * 0.4;
    b.box(0.34, 0.2, 0.34, { at: [1.45, 0, z], r: 0.03, c: 'slate' });
    b.cone(0.14, 0.14, { at: [1.45, 0.19, z], seg: 10, slot: 'gloss', c });
  });
  return b.build().group;
}

/** Stops of the ribbon in order, with the energy each stands for (Wh; a range where the document gives one). */
export const SCALE_STOPS = [
  { id: 'phone', wh: [15, 15] },
  { id: 'laptop', wh: [60, 60] },
  { id: 'ebike', wh: [500, 500] },
  { id: 'station', wh: [1e3, 3e3] },
  { id: 'home', wh: [5e3, 30e3] },
  { id: 'ev', wh: [40e3, 100e3] },
  { id: 'bess', wh: [3e6, 5e6] },
  { id: 'plant', wh: [1e8, 1e9] },
  { id: 'recycling', wh: null },
] as const;
export type ScaleStopId = (typeof SCALE_STOPS)[number]['id'];

const MAKE: Record<ScaleStopId, () => Group> = {
  phone,
  laptop,
  ebike,
  station: powerStation,
  home: homeStorage,
  ev: carAtCharger,
  bess: containerSite,
  plant,
  recycling: recycler,
};

export function createScaleItem(id: ScaleStopId): Group {
  return MAKE[id]();
}
