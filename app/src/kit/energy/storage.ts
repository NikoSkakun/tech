/**
 * Storage and backup equipment: grid-scale BESS container with its HVAC and status strip, electric car with
 * a wallbox charger, and a portable petrol generator (optionally under an open canopy — it must never run
 * indoors). Units: metres.
 */
import { col, type ColorLike } from '@/style';
import { Builder, type KitModel } from '../core/builder';
import { addVehicle } from '../life/vehicles';

/** 20-ft battery container. Anchors: `ac` (cable to the transformer / PCS), `door`, `hvac`. `lime` is the BESS colour code. */
export function addBessContainer(b: Builder, o: { length?: number; color?: ColorLike } = {}): void {
  const L = o.length ?? 6.1;
  const c = col(o.color ?? 'white');
  for (const z of [-L / 2 + 0.4, L / 2 - 0.4]) b.box(2.5, 0.3, 0.5, { r: 0.05, slot: 'matte', c: 'mist', at: [0, -0.05, z] });
  b.box(2.44, 2.6, L, { r: 0.08, slot: 'gloss', c: [c.clone().multiplyScalar(0.85), c], at: [0, 0.25, 0] });
  // corrugation, corner castings, doors with lock rods on the long side (battery racks open outward)
  for (let i = 0; i < Math.round(L / 0.3); i++) b.box(0.05, 2.3, 0.12, { r: 0, slot: 'gloss', c: c.clone().multiplyScalar(0.92), at: [-1.23, 0.4, -L / 2 + 0.25 + i * 0.3] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [0.25, 2.7]) b.box(0.2, 0.18, 0.2, { r: 0, slot: 'gloss', c: 'slate', at: [sx * 1.15, y, sz * (L / 2 - 0.1)] });
  const doors = Math.round(L / 1.5);
  for (let i = 0; i < doors; i++) {
    const z = ((i + 0.5) / doors - 0.5) * (L - 0.3);
    b.box(0.06, 2.3, L / doors - 0.12, { r: 0.03, slot: 'gloss', c, at: [1.23, 0.42, z] });
    b.cyl(0.02, 2.2, { seg: 5, slot: 'metal', c: 'steel', at: [1.28, 0.46, z + L / doors / 2 - 0.2], bevel: 0 });
    b.box(0.03, 0.26, 0.3, { r: 0, slot: 'gloss', c: 'yellow', at: [1.27, 1.9, z - 0.2] });
  }
  b.box(0.04, 0.14, L - 0.4, { r: 0, slot: 'gloss', c: 'lime', at: [1.25, 2.62, 0] });
  for (let i = 0; i < 5; i++) b.sphere(0.035, { seg: 6, slot: 'glow', c: 'lime', at: [1.27, 2.45, -0.4 + i * 0.2] });
  b.anchor('door', 1.5, 1.4, 0);
  // HVAC units on one end, cable entry at the other
  for (const y of [0.6, 1.7]) {
    b.box(1.6, 0.9, 0.5, { r: 0.06, slot: 'gloss', c: 'steel.light', at: [0, y, -L / 2 - 0.25] });
    b.cyl(0.3, 0.04, { axis: 'z', seg: 14, slot: 'metal', c: 'slate', at: [0.3, y + 0.45, -L / 2 - 0.54] });
  }
  b.anchor('hvac', 0, 1.5, -L / 2 - 0.6);
  b.box(0.8, 1.2, 0.3, { r: 0.05, slot: 'gloss', c: 'steel.light', at: [0, 0.4, L / 2 + 0.15] });
  b.anchor('ac', 0, 0.5, L / 2 + 0.4);
}

/** Wallbox (frame on a wall, front +Z) with its cable holder and status ring. Anchors: `plug`, `status`. */
export function addWallbox(b: Builder): void {
  b.box(0.34, 0.5, 0.16, { r: 0.06, seg: 2, mid: true, slot: 'gloss', c: 'white', at: [0, 0, 0.08] });
  b.box(0.2, 0.26, 0.02, { r: 0.03, mid: true, slot: 'gloss', c: 'ink', at: [0, 0.06, 0.165] });
  b.ring(0.07, 0.012, { axis: 'z', seg: 16, tubeSeg: 4, slot: 'glow', c: 'green', at: [0, 0.06, 0.18] });
  b.cyl(0.05, 0.09, { axis: 'z', seg: 10, slot: 'gloss', c: 'slate', at: [0, -0.17, 0.16] });
  b.anchor('plug', 0, -0.17, 0.26);
  b.anchor('status', 0, 0.06, 0.2);
}

/** Electric car (facing +Z) with a charge-port flap on the rear-left wing. Anchors: `port`, `roof`. */
export function addElectricCar(b: Builder, color: ColorLike = 'teal'): void {
  addVehicle(b, 'car', color);
  b.box(0.04, 0.2, 0.26, { r: 0.02, slot: 'gloss', c: 'lime', at: [-0.9, 0.72, -1.5] });
  b.sphere(0.04, { seg: 6, slot: 'glow', c: 'lime', at: [-0.93, 0.82, -1.5] });
  b.anchor('port', -0.95, 0.82, -1.5);
  b.anchor('roof', 0, 1.6, 0);
}

/**
 * Portable petrol generator (≈ 3 kW): tube frame, engine with a finned cylinder, fuel tank, alternator end,
 * panel with two sockets, exhaust, wheels. Anchors: `exhaust` (smoke), `socket`, `tank`. Front (panel) faces +Z.
 */
export function addPortableGenerator(b: Builder, o: { canopy?: boolean } = {}): void {
  const frame = col('slate');
  // tube frame
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) b.cyl(0.02, 0.5, { seg: 6, slot: 'metal', c: frame, at: [sx * 0.33, 0.08, sz * 0.25], bevel: 0 });
    for (const y of [0.08, 0.58]) b.beam([sx * 0.33, y, -0.25], [sx * 0.33, y, 0.25], 0.04, { slot: 'metal', c: frame });
  }
  for (const sz of [-1, 1]) for (const y of [0.08, 0.58]) b.beam([-0.33, y, sz * 0.25], [0.33, y, sz * 0.25], 0.04, { slot: 'metal', c: frame });
  for (const sz of [-1, 1]) b.cyl(0.1, 0.05, { axis: 'z', seg: 12, slot: 'gloss', c: 'ink', at: [-0.26, 0.1, sz * 0.3 - 0.025] });
  // fuel tank on top, engine with a finned cylinder head, alternator, control panel
  b.box(0.5, 0.14, 0.4, { r: 0.05, seg: 2, slot: 'gloss', c: ['red', 'coral'], at: [0, 0.46, 0] });
  b.cyl(0.04, 0.03, { seg: 10, slot: 'gloss', c: 'ink', at: [0.12, 0.6, 0] });
  b.anchor('tank', 0, 0.63, 0);
  b.box(0.26, 0.28, 0.3, { r: 0.04, slot: 'metal', c: 'steel', at: [-0.14, 0.12, 0] });
  for (let i = 0; i < 5; i++) b.box(0.2, 0.012, 0.24, { r: 0, slot: 'metal', c: 'steel.light', at: [-0.14, 0.26 + i * 0.03, 0] });
  b.cyl(0.13, 0.26, { axis: 'x', seg: 14, slot: 'gloss', c: ['amber', 'yellow'], at: [0.02, 0.24, 0] });
  b.box(0.3, 0.2, 0.03, { r: 0.015, slot: 'gloss', c: 'ink', at: [0.12, 0.22, 0.27] });
  for (const x of [0.04, 0.2]) b.cyl(0.03, 0.01, { axis: 'z', seg: 10, slot: 'gloss', c: 'white', at: [x, 0.33, 0.285] });
  b.sphere(0.012, { seg: 6, slot: 'glow', c: 'green', at: [0.12, 0.26, 0.29] });
  b.anchor('socket', 0.04, 0.33, 0.3);
  b.cyl(0.035, 0.22, { axis: 'x', seg: 8, slot: 'metal', c: 'slate', at: [-0.5, 0.3, -0.12] });
  b.anchor('exhaust', -0.52, 0.3, -0.12);
  if (o.canopy) {
    // open-sided shelter: four posts and a pitched sheet roof — open air on every side
    const wood = col('wireBrown').lerp(col('yellow.light'), 0.3);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.09, 1.9, 0.09, { r: 0.015, c: wood, at: [sx * 0.85, 0, sz * 0.65] });
    b.box(2.1, 0.06, 1.7, { r: 0.02, slot: 'matte', c: ['teal.dark', 'teal'], at: [0, 1.95, 0], rot: [0.12, 0, 0] });
    b.box(1.9, 0.08, 1.5, { r: 0.02, slot: 'matte', c: 'mist', at: [0, -0.06, 0] });
  }
}

const wrap = (name: string, fn: (b: Builder) => void): KitModel => {
  const b = new Builder(name);
  fn(b);
  return b.build();
};
export const bessContainer = (o: Parameters<typeof addBessContainer>[1] = {}): KitModel => wrap('bess', (b) => addBessContainer(b, o));
export const wallbox = (): KitModel => wrap('wallbox', addWallbox);
export const electricCar = (color?: ColorLike): KitModel => wrap('ev', (b) => addElectricCar(b, color));
export const portableGenerator = (o: Parameters<typeof addPortableGenerator>[1] = {}): KitModel => wrap('generator', (b) => addPortableGenerator(b, o));
