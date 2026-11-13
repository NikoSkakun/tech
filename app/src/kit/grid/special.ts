/**
 * Special substation equipment: autotransformer bank of single-phase units with fire walls, gas-insulated
 * switchgear (GIS) bays, and an HVDC converter valve hall with suspended valve towers, wall bushings and a
 * smoothing reactor. Units: metres.
 */
import { SEMANTIC, col } from '@/style';
import { Builder, type KitModel } from '../core/builder';
import { addRibbedColumn } from './insulators';
import { addPowerTransformer } from './transformer';

const PHASE = [SEMANTIC.phaseL1, SEMANTIC.phaseL2, SEMANTIC.phaseL3] as const;

/**
 * Bank of three single-phase autotransformers (the way 750 / 330 kV units are built: one tank per phase) with
 * fire walls between them and an optional spare. Units stand along X. Anchors: `a.hv1`, `b.hv1`, `c.hv1`,
 * `a.lv1`… (and all other transformer anchors with the phase prefix), `spare.*`.
 */
export function addAutotransformerBank(b: Builder, o: { hv?: number; lv?: number; spare?: boolean } = {}): void {
  const hv = o.hv ?? 750;
  const s = 0.42 + Math.pow(hv, 0.42) * 0.052;
  const pitch = 5.4 * s + 7.5;
  const units = o.spare ? ['a', 'b', 'c', 'spare'] : ['a', 'b', 'c'];
  units.forEach((name, i) => {
    const x = (i - (units.length - 1) / 2) * pitch;
    b.frame({ at: [x, 0, 0] }, () => addPowerTransformer(b, { hv, lv: o.lv ?? 330, phases: 1 }), `${name}.`);
    if (i < units.length - 1) b.box(0.5, 3.9 * s + 4, 3.4 * s + 7, { r: 0.1, slot: 'matte', c: ['steel', 'mist'], at: [x + pitch / 2, 0, 0] });
    if (i < 3) b.box(1.2, 0.5, 0.1, { r: 0, slot: 'gloss', c: PHASE[i]!, at: [x, 0.6, 3.4 * s * 0.5 + 2.3] });
  });
}

/**
 * Gas-insulated switchgear: `bays` identical bays 1.6 m apart along X sharing two busbar tubes. Each bay, front
 * (+Z) to back: local control cabinet, circuit-breaker tank with its drive, disconnector / earthing-switch
 * housings, current-transformer ring, cable sealing end going down. Anchors: `bayN` (front), `bayN.cable`, `bus`.
 */
export function addGis(b: Builder, o: { bays?: number } = {}): void {
  const bays = o.bays ?? 4;
  const alu = col('mist').lerp(col('white'), 0.3);
  const flange = col('steel');
  const w = bays * 1.6;
  b.box(w + 1.2, 0.2, 7, { r: 0.05, slot: 'matte', c: col('teal.light').lerp(col('mist'), 0.6), at: [0, -0.2, 0] });
  for (const [z, y] of [[-0.9, 3.0], [-2.1, 3.0]] as const) {
    b.cyl(0.36, w + 0.6, { axis: 'x', seg: 16, slot: 'gloss', c: [alu.clone().multiplyScalar(0.85), alu], at: [-w / 2 - 0.3, y, z], bevel: 0.05 });
    for (let i = 0; i <= bays; i++) b.cyl(0.42, 0.1, { axis: 'x', seg: 16, slot: 'metal', c: flange, at: [-w / 2 + i * 1.6 - 0.05, y, z] });
  }
  b.anchor('bus', 0, 3.4, -1.5);
  for (let i = 0; i < bays; i++) {
    const x = -w / 2 + (i + 0.5) * 1.6;
    b.frame({ at: [x, 0, 0] }, () => {
      // control cabinet with a mimic strip
      b.box(1.0, 2.1, 0.6, { r: 0.05, slot: 'gloss', c: 'white', at: [0, 0, 2.6] });
      b.box(0.7, 0.5, 0.02, { r: 0, slot: 'gloss', c: 'ink', at: [0, 1.3, 2.91] });
      for (let k = 0; k < 3; k++) b.sphere(0.04, { seg: 6, slot: 'glow', c: k === 0 ? 'red' : 'green', at: [-0.2 + k * 0.2, 1.05, 2.92] });
      // breaker: horizontal tank with the spring drive on its front
      b.cyl(0.5, 2.6, { axis: 'z', seg: 18, slot: 'gloss', c: [alu.clone().multiplyScalar(0.85), alu], at: [0, 1.1, -0.6], bevel: 0.08 });
      b.box(0.8, 0.9, 0.6, { r: 0.08, slot: 'gloss', c: 'steel.light', at: [0, 0.65, 1.9] });
      for (const z of [-0.6, 2.0]) b.cyl(0.56, 0.1, { axis: 'z', seg: 18, slot: 'metal', c: flange, at: [0, 1.1, z - 0.05] });
      for (const z of [-0.2, 1.4]) b.box(0.5, 0.6, 0.3, { r: 0.05, slot: 'metal', c: 'slate', at: [0, 0, z] });
      // risers to the two busbars with disconnector housings, CT ring, cable sealing end
      for (const z of [-0.9, -2.1]) {
        b.cyl(0.28, 3.0 - 1.1 - 0.3, { seg: 14, slot: 'gloss', c: alu, at: [0, 1.5, z] });
        b.sphere(0.4, { seg: 14, slot: 'gloss', c: alu, at: [0, 2.2, z], s: [1, 0.9, 1] });
        b.cyl(0.1, 0.3, { axis: 'x', seg: 8, slot: 'gloss', c: 'yellow', at: [0.36, 2.2, z] });
      }
      b.cyl(0.3, 1.5, { axis: 'z', seg: 14, slot: 'gloss', c: alu, at: [0, 1.1, -2.4] });
      b.ring(0.34, 0.12, { axis: 'z', seg: 16, tubeSeg: 6, slot: 'gloss', c: 'coral', at: [0, 1.1, -2.9] });
      b.cyl(0.34, 1.6, { seg: 14, slot: 'gloss', c: [alu.clone().multiplyScalar(0.85), alu], at: [0, -0.1, -3.3] });
      b.cyl(0.4, 0.1, { seg: 14, slot: 'metal', c: flange, at: [0, 1.5, -3.3] });
      b.anchor(`bay${i + 1}.cable`, 0, 0, -3.3);
    });
    b.anchor(`bay${i + 1}`, x, 1.4, 3.1);
  }
}

export interface ValveHall extends KitModel {
  /** Hide / show the roof and the front wall (parts `roof`, `front`). */
  setOpen(roof: boolean, front?: boolean): void;
}

/**
 * HVDC converter valve hall (line-commutated, one pole): three double-valve towers of thyristor modules hanging
 * from the ceiling, AC wall bushings on the back wall (toward the converter transformers), DC wall bushings on
 * the right end wall (+ coral / − blue), smoothing reactor outside. Parts: `roof`, `front`.
 * Anchors: `ac1…3`, `dcPlus`, `dcMinus`, `valve1…3`, `reactor`.
 */
export function hvdcValveHall(): ValveHall {
  const [L, W, H] = [34, 18, 17];
  const wall = col('mist').lerp(col('sky.light'), 0.2);
  const wc = [wall.clone().multiplyScalar(0.84), wall] as const;
  const b = new Builder('valve-hall');
  b.box(L + 1, 0.6, W + 1, { r: 0.1, slot: 'matte', c: 'steel', at: [0, -0.4, 0] });
  b.box(L - 0.6, 0.1, W - 0.6, { r: 0, slot: 'matte', c: col('teal.light').lerp(col('mist'), 0.6), at: [0, 0.2, 0] });
  b.box(L, H, 0.5, { r: 0.1, c: wc, at: [0, 0.2, -W / 2 + 0.25] });
  for (const s of [-1, 1]) b.box(0.5, H, W, { r: 0.1, c: wc, at: [s * (L / 2 - 0.25), 0.2, 0] });
  b.part('front').box(L, H, 0.5, { r: 0.1, c: wc, at: [0, 0.2, W / 2 - 0.25] });
  const roof = b.part('roof', { at: [0, 0.2 + H, 0] });
  roof.box(L + 0.8, 0.6, W + 0.8, { r: 0.15, slot: 'matte', c: wall.clone().multiplyScalar(0.75) });
  const shield = col('mist').lerp(col('white'), 0.5);
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 8.5 - 3;
    // suspension insulators from the roof beams, then two stacks (double valve) of modules with corona shields
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.frame({ at: [x + sx * 1.6, 0.2 + H - 0.2, sz * 1.2], rot: [Math.PI, 0, 0] }, () => addRibbedColumn(b, 2.6, 0.14, { seg: 8, sheds: 8, c: 'steel.light' }));
    for (let k = 0; k < 6; k++) {
      const y = 0.2 + H - 3.4 - k * 1.55;
      b.box(4.4, 0.9, 3.0, { r: 0.12, slot: 'gloss', c: k < 3 ? 'coral' : 'sky', at: [x, y - 0.9, 0] });
      b.box(4.9, 0.25, 3.5, { r: 0.12, slot: 'gloss', c: shield, at: [x, y - 0.1, 0] });
      for (let m = 0; m < 6; m++) b.box(0.5, 0.6, 0.06, { r: 0, slot: 'gloss', c: 'ink', at: [x - 1.75 + m * 0.7, y - 0.75, 1.51] });
    }
    b.box(4.9, 0.3, 3.5, { r: 0.14, slot: 'gloss', c: shield, at: [x, 0.2 + H - 3.4 - 6 * 1.55 - 0.15, 0] });
    b.anchor(`valve${i + 1}`, x, 0.2 + H - 7, 2);
    // AC wall bushing through the back wall
    b.frame({ at: [x, 9, -W / 2 + 0.25], rot: [-Math.PI / 2 + 0.25, 0, 0] }, () => {
      addRibbedColumn(b, 5, 0.3, { taper: 0.6, seg: 10 });
      b.sphere(0.3, { seg: 8, slot: 'gloss', c: PHASE[i]!, at: [0, 5.2, 0] });
    });
    b.anchor(`ac${i + 1}`, x, 10.3, -W / 2 - 4.8);
  }
  for (const [name, z, c] of [['dcPlus', -3, 'coral'], ['dcMinus', 3, 'blue']] as const) {
    b.frame({ at: [L / 2 - 0.25, 10, z], rot: [0, 0, -Math.PI / 2 + 0.2] }, () => {
      addRibbedColumn(b, 6, 0.32, { taper: 0.6, seg: 10, c: 'steel.light', kind: 'polymer' });
      b.sphere(0.34, { seg: 8, slot: 'gloss', c, at: [0, 6.2, 0] });
    });
    b.anchor(name, L / 2 + 5.8, 11.3, z);
  }
  // smoothing reactor: air-core coil on post insulators
  const rx = L / 2 + 9;
  for (let i = 0; i < 6; i++) b.frame({ at: [rx + Math.cos(i * 1.047) * 1.6, 0, -3 + Math.sin(i * 1.047) * 1.6] }, () => addRibbedColumn(b, 4, 0.18, { seg: 8, c: 'steel.light', kind: 'polymer' }));
  b.cyl(2.2, 4, { seg: 28, slot: 'gloss', c: ['teal.dark', 'teal'], at: [rx, 4, -3], bevel: 0.2 });
  for (let i = 0; i < 16; i++) b.box(0.1, 3.8, 0.2, { r: 0, slot: 'gloss', c: 'teal.light', at: [rx + Math.cos((i / 16) * 6.283) * 2.2, 4.1, -3 + Math.sin((i / 16) * 6.283) * 2.2], rot: [0, -(i / 16) * 6.283, 0] });
  b.anchor('reactor', rx, 8.4, -3);
  const model = b.build();
  return Object.assign(model, {
    setOpen(roofOff: boolean, frontOff = false): void {
      model.part('roof').visible = !roofOff;
      model.part('front').visible = !frontOff;
    },
  });
}

const wrap = (name: string, fn: (b: Builder) => void): KitModel => {
  const b = new Builder(name);
  fn(b);
  return b.build();
};
export const autotransformerBank = (o: Parameters<typeof addAutotransformerBank>[1] = {}): KitModel => wrap('at-bank', (b) => addAutotransformerBank(b, o));
export const gis = (o: Parameters<typeof addGis>[1] = {}): KitModel => wrap('gis', (b) => addGis(b, o));
