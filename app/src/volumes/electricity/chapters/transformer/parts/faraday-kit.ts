/**
 * The bench of step 1 around Faraday's ring: the ring's stand, the source (selector «постійний / змінний», power
 * lever, a «~» / «—» lamp), the galvanometer (pivoted needle, centre zero) and the lamp of the secondary circuit.
 * Kit `Builder` models, world units (the ring is Ø 2,3 units — the real ring was Ø 15–20 cm: drawn ×12).
 */
import { Group, Vector3 } from 'three';
import { Builder, lamp, type KitModel, type LampModel } from '@/kit';
import { col } from '@/style';

const CASE = col('slate').lerp(col('bg.indigo'), 0.25);

/** Stand that holds the ring upright: base plate, post, cradle. */
export function createStand(topY: number): KitModel {
  const b = new Builder('ring-stand');
  b.cyl(0.62, 0.08, { seg: 40, slot: 'gloss', c: CASE, bevel: 0.02 });
  b.cyl(0.07, topY - 0.04, { seg: 16, slot: 'metal', c: 'steel', at: [0, 0.08, 0] });
  b.box(0.5, 0.06, 0.44, { r: 0.03, slot: 'metal', c: 'steel.light', at: [0, topY - 0.06, 0] });
  return b.build();
}

export interface Source extends KitModel {
  /** Lever angle 0 (off) … 1 (on); selector 0 = DC, 1 = AC. */
  setPower(on: number): void;
  setSupply(ac: number): void;
}

/** Bench supply: a rounded case, a big rotary selector and a power lever on the front, two terminals on top. */
export function createSource(): Source {
  const b = new Builder('source');
  b.box(1.0, 0.82, 0.62, { r: 0.08, slot: 'gloss', c: [CASE, col('slate').lerp(col('violet'), 0.15)] });
  b.box(0.86, 0.6, 0.02, { r: 0.04, slot: 'gloss', c: 'ink', at: [0, 0.12, 0.31] });
  // terminals: + coral, − blue (they are the leads of the primary circuit)
  for (const [x, c] of [[-0.22, 'coral'], [0.22, 'blue']] as const) {
    b.cyl(0.07, 0.1, { seg: 16, slot: 'gloss', c, at: [x, 0.82, 0.05] });
    b.cyl(0.035, 0.08, { seg: 10, slot: 'metal', c: 'mist', at: [x, 0.92, 0.05] });
  }
  b.anchor('t1', -0.22, 0.98, 0.05).anchor('t2', 0.22, 0.98, 0.05);
  // selector dial with a pointer (rotates between «—» and «~»)
  b.cyl(0.17, 0.05, { axis: 'z', seg: 32, slot: 'gloss', c: 'steel.light', at: [-0.2, 0.42, 0.32] });
  const dial = b.part('selector', { at: [-0.2, 0.42, 0.37] });
  dial.box(0.05, 0.22, 0.05, { r: 0.02, mid: true, slot: 'gloss', c: 'white', at: [0, 0.05, 0] });
  // power lever in a slot
  b.box(0.12, 0.34, 0.04, { r: 0.03, mid: true, slot: 'gloss', c: 'bg.void', at: [0.22, 0.42, 0.33] });
  const lever = b.part('lever', { at: [0.22, 0.42, 0.35] });
  lever.cyl(0.03, 0.2, { seg: 10, slot: 'metal', c: 'mist' });
  lever.sphere(0.06, { seg: 16, slot: 'gloss', c: 'red', at: [0, 0.2, 0] });
  b.anchor('selector', -0.2, 0.42, 0.4).anchor('lever', 0.22, 0.5, 0.4).anchor('top', 0, 1.0, 0);
  const model = b.build();
  return Object.assign(model, {
    setPower: (on: number): void => void (model.part('lever').rotation.x = 0.7 - 1.4 * on),
    setSupply: (ac: number): void => void (model.part('selector').rotation.z = 0.8 - 1.6 * ac),
  });
}

export interface Galvanometer extends KitModel {
  /** Needle deflection −1…1 (full scale). */
  setNeedle(v: number): void;
}

/** Centre-zero galvanometer: round case on feet, white dial with a tick arc, black needle on a pivot. */
export function createGalvanometer(): Galvanometer {
  const b = new Builder('galvanometer');
  b.box(0.9, 0.12, 0.5, { r: 0.05, slot: 'gloss', c: CASE });
  b.cyl(0.46, 0.3, { axis: 'z', seg: 48, slot: 'gloss', c: [CASE, col('slate')], at: [0, 0.6, -0.15] });
  b.cyl(0.4, 0.02, { axis: 'z', seg: 48, slot: 'gloss', c: 'white', at: [0, 0.6, 0.15] });
  for (let i = -6; i <= 6; i++) {
    const a = (i / 6) * 0.95;
    const long = i % 3 === 0;
    const r0 = long ? 0.25 : 0.29;
    b.beam([Math.sin(a) * r0, 0.6 + Math.cos(a) * r0 - 0.12, 0.175], [Math.sin(a) * 0.34, 0.6 + Math.cos(a) * 0.34 - 0.12, 0.175], long ? 0.022 : 0.012, { h: 0.01, slot: 'flat', c: i === 0 ? 'green' : 'ink' });
  }
  for (const [x, c] of [[-0.28, 'coral'], [0.28, 'blue']] as const) b.cyl(0.05, 0.08, { seg: 12, slot: 'gloss', c, at: [x, 0.12, 0.12] });
  b.anchor('t1', -0.28, 0.2, 0.12).anchor('t2', 0.28, 0.2, 0.12);
  const needle = b.part('needle', { at: [0, 0.48, 0.2] });
  needle.beam([0, 0, 0], [0, 0.36, 0], 0.022, { h: 0.012, slot: 'flat', c: 'bg.void' });
  needle.cyl(0.035, 0.03, { axis: 'z', seg: 16, slot: 'metal', c: 'steel', at: [0, 0, -0.01] });
  b.anchor('dial', 0, 0.75, 0.2);
  const model = b.build();
  return Object.assign(model, {
    setNeedle: (v: number): void => void (model.part('needle').rotation.z = -Math.max(-1.1, Math.min(1.1, v)) * 0.95),
  });
}

/** E27 lamp on a small socket block, drawn ×6 (bulb ≈ 0,66 units). */
export function createLampStand(): { group: Group; lamp: LampModel; top: Vector3; t1: Vector3; t2: Vector3 } {
  const g = new Group();
  const b = new Builder('lamp-socket');
  b.box(0.5, 0.16, 0.42, { r: 0.05, slot: 'gloss', c: CASE });
  b.cyl(0.12, 0.14, { seg: 24, slot: 'gloss', c: 'mist', at: [0, 0.16, 0] });
  for (const x of [-0.17, 0.17]) b.cyl(0.04, 0.06, { seg: 10, slot: 'metal', c: 'mist', at: [x, 0.16, 0.12] });
  const socket = b.build();
  const bulb = lamp('incandescent');
  bulb.group.scale.setScalar(6);
  bulb.group.position.y = 0.26;
  g.add(socket.group, bulb.group);
  return { group: g, lamp: bulb, top: new Vector3(0, 0.26 + 0.66, 0), t1: new Vector3(-0.17, 0.22, 0.12), t2: new Vector3(0.17, 0.22, 0.12) };
}
