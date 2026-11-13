/**
 * Drive trains inside the hero nacelle, in the true order of the power path (rotor at +Z):
 * main bearing → low-speed shaft → [gearbox → brake → high-speed shaft] → generator → converter →
 * transformer. Three interchangeable sets (document step 6, `DRIVETRAINS` of the simulation):
 *   A  DFIG: three-stage gearbox 1:120 + doubly-fed induction generator with slip rings, small converter;
 *   B  direct drive: no gearbox, a large ring PMSG with alternating magnets right behind the main bearing;
 *   C  medium speed: compact two-stage gearbox 1:35 + PMSG, full-scale converter.
 * Every swappable unit is a builder `part` so that the chapter can slide it in and out and spin its shaft.
 * Units: nacelle units (see nacelle.ts), axis y = 0.
 */
import { Vector3 } from 'three';
import type { DrivetrainId } from '@electricity/sim/plant-wind';
import { SEMANTIC } from '@/style';
import { addBoltCircle, type Builder } from '@/kit';

export interface DriveUnit {
  /** Part name in the built model. */
  part: string;
  /** Sets the unit belongs to. */
  sets: readonly DrivetrainId[];
  /** Direction it leaves in when its set is swapped out (nacelle units). */
  away: readonly [number, number, number];
}

export interface DriveParts {
  units: DriveUnit[];
  /** Spinning parts: name, the set they belong to (or all), speed as a multiple of the rotor speed. */
  spinners: { part: string; sets: readonly DrivetrainId[]; ratio: number }[];
}

const ALL: readonly DrivetrainId[] = ['A_DFIG', 'B_DIRECT', 'C_MEDIUM'];
const FLOOR = -2.0;

/** Saddle from the floor up to a round housing of radius `r` on the axis. */
function saddle(b: Builder, z: number, r: number, w = 0.7): void {
  b.box(r * 1.7, -FLOOR - r * 0.55, w, { r: 0.08, slot: 'metal', c: 'slate', at: [0, FLOOR, z] });
}

/** Ring of permanent magnets, poles alternating N (`coral`) / S (`blue`), on a rotor of radius `r`. */
function magnets(b: Builder, r: number, z: number, len: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    b.box(((2 * Math.PI * r) / n) * 0.74, 0.14, len, { r: 0.03, slot: 'gloss', c: i % 2 ? SEMANTIC.poleS : SEMANTIC.poleN, at: [Math.cos(a) * r, Math.sin(a) * r, z], rot: [0, 0, a - Math.PI / 2] });
  }
}

export function addDriveTrain(b: Builder): DriveParts {
  const units: DriveUnit[] = [];
  const spinners: DriveParts['spinners'] = [];
  const unit = (part: string, sets: readonly DrivetrainId[], away: readonly [number, number, number]): Builder => {
    units.push({ part, sets, away });
    return b.part(part);
  };
  /* ---------------------------------------------------------------- common to all three sets */
  b.cyl(1.25, 1.15, { axis: 'z', seg: 28, slot: 'metal', c: ['steel', 'steel.light'], at: [0, 0, 2.25] });
  addBoltCircle(b, 1.05, 14, { r: 0.07, c: 'slate', z: 2.24 });
  saddle(b, 2.5, 1.25, 1.0);
  b.anchor('mainBearing', 0, 1.35, 2.8);
  b.anchor('hub', 0, 1.9, 5.6);
  b.anchor('pitch', 1.5, -1.3, 4.3);
  // transformer at the rear (to 33–66 kV): tank, radiator fins, three bushings in the phase colours
  b.box(1.5, 1.9, 1.5, { r: 0.14, slot: 'gloss', c: ['steel', 'mist'], at: [-1.25, FLOOR, -8.2] });
  for (let i = 0; i < 6; i++) b.box(0.12, 1.4, 0.07, { r: 0, c: 'slate', at: [-0.4, FLOOR + 0.25, -8.75 + i * 0.22] });
  [SEMANTIC.phaseL1, SEMANTIC.phaseL2, SEMANTIC.phaseL3].forEach((c, i) => {
    b.cyl(0.11, 0.55, { seg: 8, slot: 'gloss', c: 'mist', at: [-1.7 + i * 0.45, FLOOR + 1.9, -8.2], rTop: 0.07 });
    b.sphere(0.1, { seg: 8, slot: 'gloss', c, at: [-1.7 + i * 0.45, FLOOR + 2.5, -8.2] });
  });
  b.anchor('transformer', -1.25, 0.75, -8.2);
  // controller cabinet with its little screen
  b.box(0.5, 1.5, 0.9, { r: 0.06, slot: 'gloss', c: ['slate', 'steel'], at: [1.95, FLOOR, 2.3] });
  b.box(0.04, 0.4, 0.5, { r: 0, slot: 'glow', c: 'cyan', at: [1.68, FLOOR + 0.85, 2.3] });
  const lss = b.part('lss');
  lss.cyl(0.55, 2.3, { axis: 'z', seg: 20, slot: 'metal', c: ['mist', 'steel.light'], at: [0, 0, 0.15] });
  lss.box(0.16, 0.16, 1.2, { r: 0.03, slot: 'metal', c: 'slate', at: [0, 0.5, 0.9] }); // key: shows the slow turn
  spinners.push({ part: 'lss', sets: ALL, ratio: 1 });
  // brake disc with its caliper (parking brake) — on the fast shaft in A, behind the generator in B / C
  const brake = unit('brake', ALL, [0, 0, 0]);
  brake.cyl(0.78, 0.14, { axis: 'z', seg: 26, slot: 'gloss', c: 'coral', at: [0, 0, -0.07] });
  brake.box(0.5, 0.42, 0.44, { r: 0.07, slot: 'metal', c: 'slate', at: [0, 0.58, -0.22] });
  brake.anchor('brake', 0, 1.15, 0);
  // converter cabinet: `violet` power electronics, blinking `cyan` indicators; its width follows the share of power
  const conv = unit('converter', ALL, [0, 0, 0]);
  conv.box(1.0, 2.5, 2.0, { r: 0.1, slot: 'gloss', c: ['violet.dark', 'violet'], at: [0, 0, 0] });
  for (let i = 0; i < 4; i++) conv.box(0.04, 0.5, 0.36, { r: 0, c: 'bg.plum', at: [-0.51, 1.6, -0.72 + i * 0.48] });
  for (let i = 0; i < 8; i++) conv.sphere(0.055, { seg: 6, slot: 'glow', c: 'cyan', at: [-0.53, 1.2 + (i % 2) * 0.16, -0.76 + Math.floor(i / 2) * 0.48] });
  // DC link: the capacitor bank between the two halves of the converter (hotspot of step 6)
  for (let i = 0; i < 3; i++) conv.cyl(0.15, 0.5, { seg: 10, slot: 'gloss', c: 'sky', at: [-0.2, 2.5, -0.5 + i * 0.5] });
  conv.anchor('converter', -0.5, 2.2, 0);
  conv.anchor('dcLink', -0.3, 3.1, 0);
  /* ------------------------------------------------------------------------------- set A: DFIG */
  const gearA = unit('gearA', ['A_DFIG'], [0, 4.5, 0]);
  gearA.cyl(1.5, 1.25, { axis: 'z', seg: 30, slot: 'gloss', c: ['teal.dark', 'teal'], at: [0, 0, -1.0] });
  gearA.cyl(1.2, 0.9, { axis: 'z', seg: 26, slot: 'gloss', c: ['teal.dark', 'teal'], at: [0, 0, -1.85] });
  gearA.box(1.5, 2.1, 0.95, { r: 0.2, slot: 'gloss', c: ['teal.dark', 'teal'], at: [0.2, -0.95, -2.6], seg: 2 });
  for (const s of [-1, 1]) gearA.box(0.5, 0.36, 0.6, { r: 0.08, slot: 'metal', c: 'slate', at: [s * 1.7, -0.2, -0.5] }); // torque arms
  for (const z of [-0.4, -1.6]) saddle(gearA, z, 1.3, 0.45);
  gearA.tube([new Vector3(1.1, 0.9, -0.6), new Vector3(1.1, 1.7, -0.6), new Vector3(1.1, 1.7, -2.2), new Vector3(0.6, 1.2, -2.4)], 0.08, { c: 'blue', slot: 'gloss', seg: 6 }); // oil cooler line
  gearA.anchor('gearboxA', 0, 1.6, -1.0);
  const hssA = b.part('hssA', { at: [0.2, 0.3, -3.4] });
  hssA.cyl(0.2, 1.55, { axis: 'z', seg: 12, slot: 'metal', c: 'mist', at: [0, 0, -0.75] });
  hssA.cyl(0.42, 0.2, { axis: 'z', seg: 18, slot: 'metal', c: 'steel', at: [0, 0, -0.5] });
  // three light marks on the coupling: at ≈ 1200 rpm they smear into a band
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3;
    hssA.box(0.5, 0.07, 0.24, { r: 0, slot: 'glow', c: 'yellow.light', at: [-Math.sin(a) * 0.43, Math.cos(a) * 0.43, -0.4], rot: [0, 0, a] });
  }
  units.push({ part: 'hssA', sets: ['A_DFIG'], away: [0, 4.5, 0] });
  spinners.push({ part: 'hssA', sets: ['A_DFIG'], ratio: 120 });
  const genA = unit('genA', ['A_DFIG'], [-5, 0, 0]);
  genA.cyl(1.12, 2.5, { axis: 'z', seg: 28, slot: 'gloss', c: ['orange', 'amber'], at: [0.2, 0.3, -6.75] });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    genA.box(0.1, 0.13, 2.2, { r: 0, slot: 'gloss', c: 'orange', at: [0.2 + Math.cos(a) * 1.15, 0.3 + Math.sin(a) * 1.15, -5.5] });
  }
  // end windings (copper) showing at both ends, terminal box, slip-ring unit on the rear end (hotspot)
  for (const z of [-4.15, -6.85]) genA.ring(0.78, 0.17, { axis: 'z', seg: 26, tubeSeg: 8, slot: 'metal', c: 'orange', at: [0.2, 0.3, z] });
  genA.box(0.8, 0.4, 0.9, { r: 0.08, slot: 'gloss', c: 'slate', at: [0.2, 1.42, -5.5] });
  genA.cyl(0.42, 0.55, { axis: 'z', seg: 16, slot: 'metal', c: 'steel.light', at: [0.2, 0.3, -7.4] });
  for (let i = 0; i < 3; i++) genA.ring(0.44, 0.045, { axis: 'z', seg: 18, tubeSeg: 5, slot: 'metal', c: 'amber', at: [0.2, 0.3, -7.3 + i * 0.16] });
  saddle(genA, -5.5, 1.1, 1.6);
  genA.anchor('generatorA', 0.2, 1.9, -5.5);
  genA.anchor('slipRings', 0.2, 0.9, -7.2);
  /* ----------------------------------------------------------------------- set B: direct drive */
  const genB = unit('genB', ['B_DIRECT'], [0, 5, 0]);
  genB.cyl(1.55, 1.5, { axis: 'z', seg: 36, slot: 'gloss', c: ['orange', 'amber'], at: [0, 0, 0.35] }); // stator with its copper
  for (const z of [0.3, 1.9]) genB.ring(1.5, 0.12, { axis: 'z', seg: 36, tubeSeg: 6, slot: 'metal', c: 'orange', at: [0, 0, z] });
  genB.anchor('generatorB', 0, 2.2, 1.1);
  const rotB = b.part('rotB');
  rotB.ring(1.83, 0.09, { axis: 'z', seg: 44, tubeSeg: 6, slot: 'metal', c: 'steel', at: [0, 0, 0.3] });
  rotB.ring(1.83, 0.09, { axis: 'z', seg: 44, tubeSeg: 6, slot: 'metal', c: 'steel', at: [0, 0, 1.9] });
  magnets(rotB, 1.78, 1.1, 1.45, 28);
  units.push({ part: 'rotB', sets: ['B_DIRECT'], away: [0, 5, 0] });
  spinners.push({ part: 'rotB', sets: ['B_DIRECT'], ratio: 1 });
  /* ----------------------------------------------------------------------- set C: medium speed */
  const gearC = unit('gearC', ['C_MEDIUM'], [0, 4.5, 0]);
  gearC.cyl(1.4, 1.2, { axis: 'z', seg: 30, slot: 'gloss', c: ['teal.dark', 'teal'], at: [0, 0, -1.05] });
  for (const s of [-1, 1]) gearC.box(0.5, 0.36, 0.6, { r: 0.08, slot: 'metal', c: 'slate', at: [s * 1.6, -0.2, -0.5] });
  saddle(gearC, -0.5, 1.3, 0.45);
  gearC.anchor('gearboxC', 0, 1.55, -0.45);
  const genC = unit('genC', ['C_MEDIUM'], [-5, 0, 0]);
  genC.cyl(1.2, 1.7, { axis: 'z', seg: 30, slot: 'gloss', c: ['orange', 'amber'], at: [0, 0, -2.8] });
  genC.ring(1.15, 0.1, { axis: 'z', seg: 30, tubeSeg: 6, slot: 'metal', c: 'orange', at: [0, 0, -2.85] });
  saddle(genC, -2.0, 1.25, 1.1);
  genC.anchor('generatorC', 0, 1.9, -2.0);
  const rotC = b.part('rotC');
  magnets(rotC, 1.42, -1.95, 1.5, 22);
  units.push({ part: 'rotC', sets: ['C_MEDIUM'], away: [-5, 0, 0] });
  spinners.push({ part: 'rotC', sets: ['C_MEDIUM'], ratio: 35 });
  return { units, spinners };
}
