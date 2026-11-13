/**
 * Step 12: the small things on the «стрічка масштабів» — phone, laptop, e-bike, portable power station —
 * built in the kit style. One idea runs through all of them: the battery inside is the `lime` part, so the eye
 * finds "where the watt-hours live" at every scale. Every item is normalised to ≈ 1.6 units (the ribbon
 * carries «не в масштабі») and stands on y = 0. The big stops are in `scale-sites.ts`.
 */
import type { Group } from 'three';
import { Builder } from '@/kit';
import { SEMANTIC } from '@/style';

/** Phone on a desk stand, back toward the viewer's left: screen with a charge icon, camera island, cable. */
export function phone(): Group {
  const b = new Builder('phone');
  b.box(0.7, 0.06, 0.5, { r: 0.03, c: ['bg.indigo', 'slate'] }); // stand
  b.box(0.5, 0.34, 0.06, { at: [0, 0.05, -0.16], rot: [-0.25, 0, 0], r: 0.03, c: 'slate' });
  b.frame({ at: [0, 0.07, 0.02], rot: [-0.22, 0, 0] }, () => {
    b.box(0.62, 1.28, 0.085, { r: 0.07, slot: 'gloss', c: ['ink', 'slate'] });
    b.box(0.56, 1.2, 0.012, { at: [0, 0.04, 0.043], r: 0.055, slot: 'window', c: 'sky' });
    // charge screen: a big battery outline with four lime bars and a cap
    b.box(0.3, 0.52, 0.008, { at: [0, 0.36, 0.05], r: 0.04, c: 'ink' });
    for (let i = 0; i < 4; i++)
      b.box(0.24, 0.1, 0.008, { at: [0, 0.39 + i * 0.12, 0.056], r: 0.02, slot: 'glow', c: 'lime' });
    b.box(0.12, 0.04, 0.008, { at: [0, 0.88, 0.05], r: 0.012, c: 'ink' });
    b.box(0.2, 0.03, 0.008, { at: [0, 1.12, 0.05], r: 0.012, c: 'ink' }); // speaker slot
    // back: camera island with two lenses and a flash
    b.box(0.26, 0.3, 0.03, { at: [-0.14, 0.9, -0.055], r: 0.05, slot: 'gloss', c: 'slate' });
    for (const y of [0.97, 1.1]) {
      b.cyl(0.055, 0.03, { at: [-0.14, y, -0.085], axis: 'z', seg: 18, slot: 'metal', c: 'steel' });
      b.cyl(0.032, 0.012, { at: [-0.14, y, -0.092], axis: 'z', seg: 14, slot: 'gloss', c: 'ink' });
    }
    for (const y of [0.7, 0.86])
      b.box(0.012, 0.11, 0.03, { at: [0.315, y, 0], r: 0.005, slot: 'metal', c: 'steel' });
  });
  // cable to a little charger brick
  b.rod([0, 0.1, 0.06], [0.2, 0.05, 0.3], 0.018, { seg: 8, c: 'mist' });
  b.rod([0.2, 0.05, 0.3], [0.52, 0.05, 0.3], 0.018, { seg: 8, c: 'mist' });
  b.box(0.2, 0.2, 0.16, { at: [0.62, 0, 0.3], r: 0.04, slot: 'gloss', c: 'white' });
  return b.build().group;
}

/** Open laptop: key grid, trackpad, a screen with a little chart, and the lime battery under the palm rest. */
export function laptop(): Group {
  const b = new Builder('laptop');
  b.box(1.5, 0.07, 1.0, { r: 0.03, slot: 'metal', c: 'mist' });
  b.box(1.34, 0.01, 0.5, { at: [0, 0.07, -0.16], r: 0.01, c: 'ink' }); // keyboard well
  for (let row = 0; row < 5; row++)
    for (let k = 0; k < 13; k++)
      b.box(0.08, 0.016, 0.075, { at: [-0.6 + k * 0.1, 0.078, -0.36 + row * 0.1], r: 0, c: 'slate' });
  b.box(0.48, 0.008, 0.24, { at: [0, 0.07, 0.33], r: 0.02, slot: 'gloss', c: 'steel' }); // trackpad
  // cutaway in the front edge: the battery pack glows inside
  b.box(1.1, 0.045, 0.02, { at: [0, 0.012, 0.5], r: 0.01, c: 'ink' });
  for (let i = 0; i < 3; i++)
    b.box(0.32, 0.03, 0.02, { at: [-0.36 + i * 0.36, 0.02, 0.508], r: 0.008, slot: 'glow', c: 'lime' });
  for (const x of [-0.55, 0.55])
    b.cyl(0.035, 0.2, { at: [x - 0.1, 0.085, -0.5], axis: 'x', seg: 12, slot: 'metal', c: 'steel' }); // hinges
  b.frame({ at: [0, 0.08, -0.5], rot: [-0.3, 0, 0] }, () => {
    b.box(1.5, 0.98, 0.045, { r: 0.03, slot: 'metal', c: 'mist' });
    b.box(1.4, 0.88, 0.012, { at: [0, 0.05, 0.026], r: 0.02, slot: 'window', c: 'sky' });
    // on the screen: a small bar chart and the battery indicator in the corner
    [0.2, 0.34, 0.26, 0.46, 0.38].forEach((h, i) =>
      b.box(0.1, h, 0.006, { at: [-0.42 + i * 0.16, 0.2, 0.034], r: 0.01, slot: 'glow', c: 'cyan' }),
    );
    b.box(0.16, 0.07, 0.006, { at: [0.5, 0.78, 0.034], r: 0.015, slot: 'glow', c: 'lime' });
  });
  return b.build().group;
}

/** E-bike with spoked wheels, crank, hub motor, headlight — and the 10S4P pack (lime) on the down tube. */
export function ebike(): Group {
  const b = new Builder('ebike');
  for (const x of [-0.62, 0.62]) {
    b.ring(0.36, 0.045, { at: [x, 0.4, 0], axis: 'z', seg: 40, c: 'ink' }); // tyre
    b.ring(0.31, 0.014, { at: [x, 0.4, 0], axis: 'z', seg: 36, slot: 'metal', c: 'steel.light' }); // rim
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      b.rod([x, 0.4, 0], [x + Math.cos(a) * 0.31, 0.4 + Math.sin(a) * 0.31, 0], 0.006, {
        seg: 5,
        slot: 'metal',
        c: 'mist',
      });
    }
    b.cyl(x < 0 ? 0.1 : 0.045, 0.12, { at: [x, 0.4, -0.06], axis: 'z', seg: 18, slot: 'metal', c: 'steel' }); // rear hub motor
  }
  const tube = (
    a: readonly [number, number, number],
    c: readonly [number, number, number],
    r = 0.035,
  ): void => {
    b.rod(a, c, r, { seg: 10, slot: 'gloss', c: 'teal' });
  };
  tube([-0.62, 0.4, 0], [-0.2, 0.42, 0], 0.026); // chain stay
  tube([-0.2, 0.42, 0], [0.38, 0.95, 0], 0.045); // down tube
  tube([-0.2, 0.42, 0], [-0.3, 1.0, 0]); // seat tube
  tube([-0.3, 1.0, 0], [0.38, 0.95, 0]); // top tube
  tube([-0.62, 0.4, 0], [-0.3, 1.0, 0], 0.024); // seat stay
  b.rod([0.38, 0.95, 0], [0.62, 0.4, 0], 0.03, { seg: 10, slot: 'metal', c: 'steel' }); // fork
  b.box(0.32, 0.06, 0.17, { at: [-0.34, 1.02, 0], r: 0.03, c: 'ink' }); // saddle
  b.rod([-0.3, 0.92, 0], [-0.31, 1.03, 0], 0.02, { seg: 8, slot: 'metal', c: 'steel' });
  b.rod([0.38, 0.95, 0], [0.33, 1.17, 0], 0.025, { seg: 8, slot: 'metal', c: 'steel' }); // stem
  b.rod([0.33, 1.17, -0.24], [0.33, 1.17, 0.24], 0.022, { seg: 8, slot: 'metal', c: 'steel' });
  for (const z of [-0.2, 0.2])
    b.rod([0.33, 1.17, z - 0.06], [0.33, 1.17, z + 0.06], 0.03, { seg: 8, c: 'ink' }); // grips
  b.sphere(0.045, { at: [0.43, 1.08, 0], seg: 10, slot: 'glow', c: 'yellow' }); // headlight
  // crank, chainring, pedals
  b.cyl(0.1, 0.02, { at: [-0.2, 0.42, 0.05], axis: 'z', seg: 24, slot: 'metal', c: 'steel.light' });
  b.rod([-0.2, 0.42, 0.08], [-0.08, 0.3, 0.08], 0.016, { seg: 6, slot: 'metal', c: 'steel' });
  b.rod([-0.2, 0.42, -0.08], [-0.32, 0.54, -0.08], 0.016, { seg: 6, slot: 'metal', c: 'steel' });
  b.box(0.1, 0.025, 0.07, { at: [-0.08, 0.29, 0.12], r: 0.008, c: 'ink' });
  b.box(0.1, 0.025, 0.07, { at: [-0.32, 0.53, -0.12], r: 0.008, c: 'ink' });
  // the battery on the down tube: 10S4P of 18650 cells, with its latch and charge port
  b.frame({ at: [0.09, 0.56, 0], rot: [0, 0, 0.74] }, () => {
    b.box(0.52, 0.16, 0.14, { r: 0.045, slot: 'gloss', c: ['lime.dark', 'lime'] });
    b.box(0.06, 0.17, 0.15, { at: [0.2, -0.005, 0], r: 0.02, c: 'ink' });
    for (let i = 0; i < 4; i++)
      b.sphere(0.014, { at: [-0.16 + i * 0.06, 0.165, 0.03], seg: 6, slot: 'glow', c: 'lime' });
  });
  return b.build().group;
}

/** Portable power station: sockets, ports, a segment display, vents, bumpers and the cell block behind a window. */
export function powerStation(): Group {
  const b = new Builder('power-station');
  b.box(1.3, 0.95, 0.85, { r: 0.1, slot: 'gloss', c: ['slate', 'steel'] });
  for (const x of [-0.62, 0.62])
    for (const y of [0.02, 0.8]) b.box(0.14, 0.14, 0.9, { at: [x, y, 0], r: 0.05, c: 'ink' }); // corner bumpers
  b.box(1.02, 0.62, 0.02, { at: [0, 0.2, 0.43], r: 0.04, c: 'ink' }); // front panel
  // display: charge level in lime segments
  b.box(0.44, 0.2, 0.012, { at: [-0.24, 0.56, 0.445], r: 0.02, slot: 'window', c: 'sky' });
  for (let i = 0; i < 5; i++)
    b.box(0.06, 0.12, 0.008, { at: [-0.4 + i * 0.08, 0.6, 0.454], r: 0.008, slot: 'glow', c: 'lime' });
  // two sockets and a row of USB ports
  for (const x of [0.18, 0.4]) {
    b.cyl(0.085, 0.02, { at: [x, 0.66, 0.44], axis: 'z', seg: 20, slot: 'gloss', c: 'white' });
    for (const dx of [-0.03, 0.03])
      b.cyl(0.012, 0.012, { at: [x + dx, 0.66, 0.458], axis: 'z', seg: 8, c: 'ink' });
  }
  for (let i = 0; i < 4; i++)
    b.box(0.07, 0.03, 0.01, { at: [0.1 + i * 0.1, 0.42, 0.445], r: 0.006, slot: 'metal', c: 'steel.light' });
  b.cyl(0.05, 0.02, { at: [-0.36, 0.34, 0.44], axis: 'z', seg: 14, slot: 'metal', c: SEMANTIC.dcPlus }); // solar input
  b.sphere(0.03, { at: [0.42, 0.3, 0.445], seg: 8, slot: 'glow', c: 'lime' });
  // side: vent slots and a window onto the cell block
  for (let i = 0; i < 5; i++) b.box(0.012, 0.04, 0.5, { at: [0.655, 0.2 + i * 0.07, 0], r: 0, c: 'ink' });
  b.box(0.012, 0.22, 0.5, { at: [0.655, 0.6, 0], r: 0.004, slot: 'glow', c: 'lime' });
  // handle
  b.rod([-0.45, 0.95, 0], [-0.45, 1.12, 0], 0.04, { seg: 8, c: 'ink' });
  b.rod([0.45, 0.95, 0], [0.45, 1.12, 0], 0.04, { seg: 8, c: 'ink' });
  b.rod([-0.45, 1.12, 0], [0.45, 1.12, 0], 0.05, { seg: 10, c: 'ink' });
  return b.build().group;
}
