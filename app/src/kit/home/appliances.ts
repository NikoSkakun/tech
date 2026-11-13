/**
 * Household appliances and sanitary ware of the shared house (`docs/volumes/electricity/chapters/_shared-house.md` §3). Each stands
 * on the origin of the current frame facing +Z and adds an anchor named after the simulator id of the device
 * (`fridge`, `kettle`, `stove`, `microwave`, `boiler_pump`, `water_heater`, `washer`, `air_cond`, `router`).
 */
import { col, type ColorLike } from '@/style';
import type { Builder } from '../core/builder';

const steel = () => col('mist').lerp(col('steel.light'), 0.3);

export function addFridge(b: Builder): void {
  b.box(0.68, 1.85, 0.66, { r: 0.06, seg: 2, slot: 'gloss', c: ['mist', 'white'] });
  b.box(0.64, 0.015, 0.02, { r: 0, slot: 'gloss', c: 'steel', at: [0, 1.2, 0.33] });
  for (const y of [0.75, 1.4]) b.box(0.04, 0.34, 0.05, { r: 0.015, slot: 'metal', c: 'steel', at: [0.25, y, 0.35] });
  b.sphere(0.02, { seg: 6, slot: 'glow', c: 'green', at: [-0.24, 1.7, 0.335] });
  b.anchor('fridge', 0, 1.3, 0.4);
}

/**
 * Kitchen run along a wall (length `w`): base cabinets with a worktop, induction hob, sink with a tap, kettle,
 * microwave, wall cabinets and an extractor hood.
 */
export function addKitchen(b: Builder, w = 3.0, c: ColorLike = 'teal'): void {
  const cc = col(c);
  b.box(w, 0.86, 0.6, { r: 0.03, slot: 'gloss', c: [cc.clone().multiplyScalar(0.82), cc] });
  b.box(w + 0.04, 0.05, 0.64, { r: 0.02, slot: 'gloss', c: steel(), at: [0, 0.86, 0] });
  const doors = Math.round(w / 0.6);
  for (let i = 0; i < doors; i++) {
    const x = ((i + 0.5) / doors - 0.5) * w;
    b.box(w / doors - 0.04, 0.74, 0.02, { r: 0.015, slot: 'gloss', c: cc.clone().multiplyScalar(1.08), at: [x, 0.08, 0.3] });
    b.box(0.14, 0.02, 0.03, { r: 0, slot: 'metal', c: 'mist', at: [x, 0.74, 0.32] });
  }
  // induction hob: black glass with four zone rings
  const hx = -w / 2 + 0.5;
  b.box(0.6, 0.012, 0.52, { r: 0.01, slot: 'gloss', c: 'ink', at: [hx, 0.91, 0] });
  for (const dx of [-0.14, 0.14]) for (const dz of [-0.12, 0.12]) b.ring(0.085, 0.006, { seg: 14, tubeSeg: 4, slot: 'glow', c: 'coral', at: [hx + dx, 0.925, dz] });
  b.anchor('stove', hx, 1.0, 0.1);
  b.box(0.7, 0.12, 0.45, { r: 0.03, slot: 'metal', c: steel(), at: [hx, 1.75, -0.05] });
  b.box(0.3, 0.5, 0.26, { r: 0.03, slot: 'metal', c: steel(), at: [hx, 1.85, -0.15] });
  // sink and tap
  const sx = w / 2 - 0.6;
  b.box(0.5, 0.012, 0.4, { r: 0.04, slot: 'metal', c: 'steel', at: [sx, 0.905, 0] });
  b.rod([sx, 0.91, -0.2], [sx, 1.15, -0.2], 0.018, { slot: 'metal', c: 'mist' });
  b.rod([sx, 1.15, -0.2], [sx, 1.12, -0.03], 0.016, { slot: 'metal', c: 'mist' });
  // kettle and microwave on the worktop
  const kx = hx + 0.75;
  b.cyl(0.085, 0.2, { rTop: 0.07, seg: 12, slot: 'gloss', c: 'white', at: [kx, 0.91, 0.02] });
  b.ring(0.06, 0.012, { axis: 'z', seg: 10, tubeSeg: 4, slot: 'gloss', c: 'ink', at: [kx + 0.1, 1.02, 0.02] });
  b.cyl(0.095, 0.03, { seg: 12, slot: 'gloss', c: 'ink', at: [kx, 0.905, 0.02] });
  b.anchor('kettle', kx, 1.15, 0.05);
  const mx = kx + 0.6;
  b.box(0.48, 0.28, 0.36, { r: 0.03, slot: 'gloss', c: 'white', at: [mx, 0.91, -0.05] });
  b.box(0.3, 0.2, 0.01, { r: 0.01, slot: 'gloss', c: 'ink', at: [mx - 0.06, 0.95, 0.13] });
  b.anchor('microwave', mx, 1.2, 0.15);
  // wall cabinets
  b.box(w - 1.0, 0.6, 0.34, { r: 0.03, slot: 'gloss', c: 'white', at: [0.5, 1.55, -0.12] });
}

/** Wall-mounted gas boiler with its pump and flue (frame on the wall). */
export function addGasBoiler(b: Builder): void {
  b.box(0.44, 0.72, 0.3, { r: 0.04, slot: 'gloss', c: 'white', at: [0, 0, 0.15], mid: true });
  b.box(0.2, 0.07, 0.01, { r: 0.01, slot: 'gloss', c: 'ink', at: [0, -0.2, 0.305], mid: true });
  b.sphere(0.015, { seg: 6, slot: 'glow', c: 'orange', at: [0.15, -0.2, 0.305] });
  b.cyl(0.06, 0.4, { seg: 8, slot: 'metal', c: 'mist', at: [0, 0.36, 0.15] });
  for (const x of [-0.14, 0, 0.14]) b.cyl(0.018, 0.3, { seg: 5, slot: 'metal', c: x === 0 ? 'yellow' : 'orange', at: [x, -0.66, 0.15], bevel: 0 });
  b.anchor('boiler_pump', 0, 0, 0.35);
}

/** Electric storage water heater: a vertical cylinder on wall brackets (frame on the wall). */
export function addWaterHeater(b: Builder): void {
  b.capsule(0.23, 0.95, { seg: 14, slot: 'gloss', c: 'white', at: [0, 0, 0.26] });
  b.cyl(0.05, 0.02, { axis: 'z', seg: 10, slot: 'gloss', c: 'ink', at: [0, -0.25, 0.48] });
  b.sphere(0.014, { seg: 6, slot: 'glow', c: 'orange', at: [0, -0.33, 0.48] });
  for (const [x, c] of [[-0.08, 'blue'], [0.08, 'coral']] as const) b.cyl(0.016, 0.25, { seg: 5, slot: 'gloss', c, at: [x, -0.7, 0.26], bevel: 0 });
  b.anchor('water_heater', 0, 0, 0.5);
}

export function addWasher(b: Builder): void {
  b.box(0.6, 0.85, 0.56, { r: 0.04, seg: 2, slot: 'gloss', c: ['mist', 'white'] });
  b.cyl(0.2, 0.04, { axis: 'z', seg: 18, slot: 'metal', c: 'steel', at: [0, 0.4, 0.27] });
  b.cyl(0.15, 0.02, { axis: 'z', seg: 18, slot: 'window', c: col('blue.dark').lerp(col('sky'), 0.4), at: [0, 0.4, 0.3] });
  b.box(0.5, 0.08, 0.01, { r: 0.01, slot: 'gloss', c: 'steel.light', at: [0, 0.72, 0.28] });
  b.cyl(0.03, 0.02, { axis: 'z', seg: 10, slot: 'gloss', c: 'ink', at: [0.15, 0.76, 0.285] });
  b.anchor('washer', 0, 0.9, 0.3);
}

export function addBath(b: Builder): void {
  b.box(1.7, 0.56, 0.75, { r: 0.12, seg: 2, slot: 'gloss', c: 'white' });
  b.box(1.5, 0.05, 0.55, { r: 0.1, slot: 'gloss', c: col('sky').lerp(col('white'), 0.3), at: [0, 0.5, 0] });
  b.rod([0.7, 0.56, -0.25], [0.7, 0.8, -0.25], 0.02, { slot: 'metal', c: 'mist' });
  b.rod([0.7, 0.8, -0.25], [0.55, 0.78, -0.25], 0.018, { slot: 'metal', c: 'mist' });
}

export function addBasin(b: Builder): void {
  b.box(0.6, 0.8, 0.45, { r: 0.03, slot: 'gloss', c: 'white' });
  b.box(0.64, 0.1, 0.5, { r: 0.04, slot: 'gloss', c: 'white', at: [0, 0.8, 0.02] });
  b.box(0.4, 0.02, 0.3, { r: 0.06, slot: 'gloss', c: 'sky.light', at: [0, 0.89, 0.04] });
  b.rod([0, 0.9, -0.15], [0, 1.05, -0.15], 0.016, { slot: 'metal', c: 'mist' });
  b.box(0.55, 0.7, 0.03, { r: 0.04, slot: 'gloss', c: col('sky.light').lerp(col('white'), 0.4), at: [0, 1.25, -0.2] });
}

export function addToilet(b: Builder): void {
  b.box(0.38, 0.4, 0.5, { r: 0.1, seg: 2, slot: 'gloss', c: 'white', at: [0, 0, 0.1] });
  b.box(0.4, 0.04, 0.46, { r: 0.02, slot: 'gloss', c: 'mist', at: [0, 0.4, 0.12] });
  b.box(0.42, 0.42, 0.18, { r: 0.05, slot: 'gloss', c: 'white', at: [0, 0.38, -0.22] });
}

/** Split air conditioner: indoor unit (frame high on a wall). */
export function addAirConIndoor(b: Builder): void {
  b.box(0.85, 0.28, 0.2, { r: 0.07, seg: 2, slot: 'gloss', c: 'white', at: [0, 0, 0.1], mid: true });
  b.box(0.7, 0.03, 0.02, { r: 0, slot: 'gloss', c: 'steel.light', at: [0, -0.1, 0.2], mid: true });
  b.sphere(0.012, { seg: 6, slot: 'glow', c: 'green', at: [0.34, 0.02, 0.2] });
  b.anchor('air_cond', 0, 0, 0.3);
}

/** Outdoor unit of the air conditioner (frame on an outside wall or a balcony floor). */
export function addAirConOutdoor(b: Builder): void {
  b.box(0.8, 0.56, 0.3, { r: 0.04, slot: 'gloss', c: 'white', at: [0, 0, 0.17] });
  b.cyl(0.21, 0.02, { axis: 'z', seg: 16, slot: 'metal', c: 'slate', at: [-0.12, 0.28, 0.32] });
  for (let i = 0; i < 3; i++) b.ring(0.07 + i * 0.065, 0.006, { axis: 'z', seg: 14, tubeSeg: 3, slot: 'metal', c: 'mist', at: [-0.12, 0.28, 0.345] });
}

/** Router with antennas and a blinking-ready LED (anchor `router`). */
export function addRouter(b: Builder): void {
  b.box(0.24, 0.035, 0.15, { r: 0.012, slot: 'gloss', c: 'white' });
  for (const s of [-1, 1]) b.cyl(0.007, 0.16, { seg: 4, slot: 'gloss', c: 'ink', at: [s * 0.09, 0.03, -0.06], rot: [0, 0, -s * 0.2], bevel: 0 });
  for (let i = 0; i < 3; i++) b.sphere(0.006, { seg: 5, slot: 'glow', c: 'green', at: [-0.06 + i * 0.03, 0.025, 0.076] });
  b.anchor('router', 0, 0.12, 0);
}
