/**
 * Step 12: the things on the «стрічка масштабів», from 15 Wh to GWh. Small devices are built here in the kit
 * style; the home battery, the car and the BESS containers are kit models. Every item is normalised to
 * ≈ 1.6 units (the ribbon carries «не в масштабі») and stands on y = 0.
 */
import type { Group } from 'three';
import { Builder, batteryCabinet, bessContainer, electricCar, instanced } from '@/kit';
import { SEMANTIC } from '@/style';
import { group } from '../world';

function phone(): Group {
  const b = new Builder('phone');
  b.box(0.62, 1.25, 0.09, { r: 0.07, slot: 'gloss', c: ['ink', 'slate'] });
  b.box(0.54, 1.13, 0.02, { at: [0, 0.06, 0.045], r: 0.05, slot: 'window', c: 'sky' });
  b.box(0.2, 0.34, 0.012, { at: [0, 0.42, 0.058], r: 0.03, slot: 'glow', c: 'lime' }); // battery icon on the screen
  b.cyl(0.05, 0.03, { at: [-0.17, 1.0, -0.06], axis: 'z', seg: 14, c: 'ink' });
  return b.build().group;
}

function laptop(): Group {
  const b = new Builder('laptop');
  b.box(1.5, 0.08, 1.0, { r: 0.03, slot: 'metal', c: 'mist' });
  b.box(1.3, 0.012, 0.5, { at: [0, 0.08, -0.14], r: 0, c: 'ink' });
  b.box(0.5, 0.012, 0.26, { at: [0, 0.08, 0.3], r: 0.02, c: 'steel' });
  b.frame({ at: [0, 0.08, -0.5], rot: [-0.3, 0, 0] }, () => {
    b.box(1.5, 0.98, 0.05, { r: 0.03, slot: 'metal', c: 'mist' });
    b.box(1.38, 0.86, 0.012, { at: [0, 0.06, 0.03], r: 0.02, slot: 'window', c: 'sky' });
  });
  return b.build().group;
}

function ebike(): Group {
  const b = new Builder('ebike');
  for (const x of [-0.62, 0.62]) {
    b.ring(0.36, 0.045, { at: [x, 0.4, 0], axis: 'z', seg: 36, c: 'ink' });
    b.cyl(0.05, 0.1, { at: [x, 0.4, -0.05], axis: 'z', seg: 12, slot: 'metal', c: 'steel' });
  }
  const tube = (a: readonly [number, number, number], c: readonly [number, number, number]): void => {
    b.rod(a, c, 0.035, { seg: 8, slot: 'gloss', c: 'teal' });
  };
  tube([-0.62, 0.4, 0], [-0.2, 0.42, 0]);
  tube([-0.2, 0.42, 0], [0.38, 0.95, 0]);
  tube([-0.2, 0.42, 0], [-0.3, 1.0, 0]);
  tube([-0.3, 1.0, 0], [0.38, 0.95, 0]);
  tube([0.38, 0.95, 0], [0.62, 0.4, 0]);
  tube([-0.62, 0.4, 0], [-0.3, 1.0, 0]);
  b.box(0.3, 0.06, 0.16, { at: [-0.34, 1.0, 0], r: 0.03, c: 'ink' }); // saddle
  b.rod([0.38, 0.95, 0], [0.34, 1.15, 0], 0.025, { seg: 8, slot: 'metal', c: 'steel' });
  b.rod([0.34, 1.15, -0.22], [0.34, 1.15, 0.22], 0.025, { seg: 8, c: 'ink' });
  // the battery on the down tube: 10S4P of 18650 cells
  b.frame({ at: [0.09, 0.56, 0], rot: [0, 0, 0.74] }, () => {
    b.box(0.5, 0.15, 0.13, { r: 0.04, slot: 'gloss', c: ['lime.dark', 'lime'] });
  });
  return b.build().group;
}

function powerStation(): Group {
  const b = new Builder('power-station');
  b.box(1.3, 0.95, 0.85, { r: 0.1, slot: 'gloss', c: ['slate', 'steel'] });
  b.box(1.0, 0.4, 0.02, { at: [0, 0.42, 0.43], r: 0.04, c: 'ink' });
  b.box(0.42, 0.2, 0.012, { at: [-0.22, 0.52, 0.445], r: 0.02, slot: 'window', c: 'sky' });
  for (let k = 0; k < 2; k++)
    b.cyl(0.07, 0.02, { at: [0.2 + k * 0.2, 0.62, 0.44], axis: 'z', seg: 14, c: 'slate' });
  b.sphere(0.03, { at: [0.3, 0.2, 0.44], seg: 8, slot: 'glow', c: 'lime' });
  b.rod([-0.45, 0.95, 0], [-0.45, 1.12, 0], 0.04, { seg: 8, c: 'ink' });
  b.rod([0.45, 0.95, 0], [0.45, 1.12, 0], 0.04, { seg: 8, c: 'ink' });
  b.rod([-0.45, 1.12, 0], [0.45, 1.12, 0], 0.05, { seg: 8, c: 'ink' });
  return b.build().group;
}

/** Shredder of the recycling plant: hopper, crusher box, outlet chute. Anchors are fixed points in its space. */
function recycler(): Group {
  const b = new Builder('recycler');
  b.box(1.3, 0.8, 1.0, { r: 0.06, c: ['bg.indigo', 'slate'] });
  b.cyl(0.7, 0.55, { at: [0, 0.8, 0], rTop: 0.95, seg: 4, slot: 'metal', c: 'steel', bevel: 0.02 }); // hopper
  b.box(0.5, 0.08, 0.9, { at: [0.95, 0.42, 0], rot: [0, 0, -0.35], r: 0.02, slot: 'metal', c: 'steel' }); // chute
  b.cyl(0.16, 0.06, { at: [-0.3, 0.45, 0.5], axis: 'z', seg: 16, slot: 'metal', c: SEMANTIC.dcPlus });
  b.sphere(0.04, { at: [0.3, 0.6, 0.5], seg: 8, slot: 'glow', c: 'lime' });
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

export function createScaleItem(id: ScaleStopId): Group {
  switch (id) {
    case 'phone':
      return phone();
    case 'laptop':
      return laptop();
    case 'ebike':
      return ebike();
    case 'station':
      return powerStation();
    case 'home': {
      const m = batteryCabinet();
      m.setSoc(0.7);
      m.group.scale.setScalar(1.45);
      return group('home-battery', 0, 0, 0, [m.group]);
    }
    case 'ev': {
      const m = electricCar('teal');
      m.group.scale.setScalar(0.44);
      m.group.rotation.y = Math.PI / 2;
      return group('ev', 0, 0, 0, [m.group]);
    }
    case 'bess': {
      const m = bessContainer();
      m.group.scale.setScalar(0.3);
      m.group.rotation.y = Math.PI / 2;
      return group('bess', 0, 0, 0, [m.group]);
    }
    case 'plant': {
      // a field of containers: 2 × 4, seen from afar
      const m = bessContainer();
      const rows = instanced(
        m,
        [-1.5, -0.5, 0.5, 1.5].flatMap((x) =>
          [-0.55, 0.55].map((z) => ({ at: [x * 3.4, 0, z * 8.5] as const })),
        ),
      );
      rows.scale.setScalar(0.105);
      return group('plant', 0, 0, 0, [rows]);
    }
    case 'recycling':
      return recycler();
  }
}
