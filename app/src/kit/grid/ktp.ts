/**
 * Consumer substations 10/0.4 kV:
 *  - `kioskSubstation` — «КТП» kiosk: steel cabin with HV, transformer and LV compartments. The front doors are
 *    a separate part (`doors`), so a chapter can open the cabin: inside are the HV fuses, the transformer and
 *    the 0.4 kV board with a main switch, colour-coded busbars and feeder breakers;
 *  - `poleSubstation` — «щоглова ТП»: transformer on a platform between two poles, drop-out fuses and
 *    arresters above it, LV cabinet below. The 10 kV line lands on the pin insulators at the top.
 * Units: metres. The kiosk's doors face +Z; the pole station's line runs along Z.
 */
import { SEMANTIC, col } from '@/style';
import { Builder, type KitModel } from '../core/builder';
import type { LineSupport } from './conductors';
import { addDistTransformer } from './dist-transformer';
import { addRibbedColumn } from './insulators';
import { addDistributionPole } from './poles';

const PHASE = [SEMANTIC.phaseL1, SEMANTIC.phaseL2, SEMANTIC.phaseL3] as const;

export interface KioskOptions {
  kVA?: number;
  /** Overhead 10 kV entry through roof bushings (default) or cable entry (no roof gear). */
  overhead?: boolean;
}

/** Anchors: `hv1…3` (roof bushings), `lv` (cable outlet), `transformer`, `board`, `fuses`, `lamp`. Part: `doors`. */
export function addKioskSubstation(b: Builder, o: KioskOptions = {}): void {
  const body = col('mist').lerp(col('teal.light'), 0.25);
  const dark = col('slate');
  const W = 4.2;
  const H = 2.5;
  const D = 2.2;
  for (const x of [-1.5, 1.5]) b.box(0.5, 0.4, D + 0.3, { r: 0.06, slot: 'matte', c: ['steel', 'mist'], at: [x, -0.1, 0] });
  // cabin shell open toward +Z: floor, back, sides, ceiling, partitions
  b.box(W, 0.12, D, { r: 0.03, slot: 'matte', c: dark, at: [0, 0.3, 0] });
  b.box(W, H, 0.1, { r: 0.03, c: [body.clone().multiplyScalar(0.82), body], at: [0, 0.4, -D / 2 + 0.05] });
  for (const x of [-W / 2 + 0.05, W / 2 - 0.05]) b.box(0.1, H, D, { r: 0.03, c: [body.clone().multiplyScalar(0.82), body], at: [x, 0.4, 0] });
  for (const x of [-0.75, 0.95]) b.box(0.06, H, D - 0.15, { r: 0, c: body.clone().multiplyScalar(0.9), at: [x, 0.4, -0.05] });
  b.box(W + 0.5, 0.14, D + 0.5, { r: 0.05, c: dark, at: [0, H + 0.38, 0] });
  b.box(W + 0.3, 0.2, D + 0.3, { r: 0.08, c: 'teal', at: [0, H + 0.5, 0] });
  // inside: HV fuses (left), transformer (middle), 0.4 kV board (right)
  for (let i = 0; i < 3; i++) {
    const x = -1.75 + i * 0.36;
    addRibbedColumn(b, 0.3, 0.07, { at: [x, 1.2, -0.7], sheds: 2, seg: 8, rot: [Math.PI / 2, 0, 0] });
    addRibbedColumn(b, 0.3, 0.07, { at: [x, 2.0, -0.7], sheds: 2, seg: 8, rot: [Math.PI / 2, 0, 0] });
    b.cyl(0.05, 0.86, { seg: 8, slot: 'gloss', c: 'white', at: [x, 1.17, -0.36] });
    b.box(0.09, 0.07, 0.09, { r: 0, slot: 'gloss', c: PHASE[i]!, at: [x, 2.03, -0.36] });
  }
  b.anchor('fuses', -1.4, 1.6, -0.3);
  b.frame({ at: [0.1, 0.42, -0.05], rot: [0, Math.PI, 0] }, () => addDistTransformer(b, { kVA: o.kVA ?? 400 }), 't.');
  b.anchor('transformer', 0.1, 1.2, 0.5);
  b.box(0.95, 1.9, 0.3, { r: 0.04, slot: 'gloss', c: 'white', at: [1.5, 0.5, -0.8] });
  b.box(0.34, 0.42, 0.14, { r: 0.03, slot: 'gloss', c: 'ink', at: [1.5, 1.85, -0.62] });
  b.box(0.08, 0.2, 0.1, { r: 0.02, slot: 'gloss', c: 'red', at: [1.5, 1.98, -0.52], rot: [0.5, 0, 0] });
  for (let i = 0; i < 4; i++) {
    b.box(0.82, 0.05, 0.05, { r: 0, slot: 'gloss', c: i < 3 ? PHASE[i]! : SEMANTIC.wireN, at: [1.5, 1.66 - i * 0.09, -0.6] });
  }
  for (let i = 0; i < 5; i++) {
    b.box(0.13, 0.3, 0.14, { r: 0.02, slot: 'gloss', c: 'steel.light', at: [1.16 + i * 0.17, 0.85, -0.6] });
    b.box(0.05, 0.1, 0.06, { r: 0, slot: 'gloss', c: 'blue', at: [1.16 + i * 0.17, 0.98, -0.52] });
  }
  b.anchor('board', 1.5, 1.4, -0.5);
  b.cyl(0.07, 0.5, { seg: 8, slot: 'gloss', c: 'ink', at: [1.75, -0.1, 0.4] });
  b.anchor('lv', 1.75, 0.1, 0.4);
  // front doors (one part): three leaves with louvres, handles and warning signs
  const doors = b.part('doors', { at: [0, 0.4, D / 2 - 0.04] });
  for (const [x, w, vent] of [[-1.42, 1.3, false], [0.1, 1.66, true], [1.52, 1.1, false]] as const) {
    doors.box(w, H - 0.05, 0.07, { r: 0.03, c: [body.clone().multiplyScalar(0.86), body], at: [x, 0, 0] });
    if (vent) for (let i = 0; i < 6; i++) doors.box(w * 0.7, 0.06, 0.05, { r: 0, c: dark, at: [x, 0.35 + i * 0.13, 0.04], rot: [0.5, 0, 0] });
    doors.box(0.06, 0.24, 0.06, { r: 0.02, slot: 'metal', c: dark, at: [x + w / 2 - 0.14, 1.1, 0.05] });
    doors.cone(0.2, 0.34, { seg: 3, tip: 0.02, slot: 'gloss', c: 'yellow', at: [x, 1.62, 0.02], s: [1, 1, 0.12], rot: [0, Math.PI / 6, 0] });
  }
  b.box(0.3, 0.1, 0.16, { r: 0.03, slot: 'lamp', c: 'white', at: [1.52, H + 0.28, D / 2 + 0.06] });
  b.anchor('lamp', 1.52, H + 0.2, D / 2 + 0.2);
  if (o.overhead ?? true) {
    // roof entry: three wall bushings and arresters on a short mast
    b.box(1.5, 0.5, 0.6, { r: 0.06, c: body, at: [-1.3, H + 0.68, -0.4] });
    for (let i = 0; i < 3; i++) {
      const x = -1.75 + i * 0.45;
      addRibbedColumn(b, 0.55, 0.1, { at: [x, H + 1.16, -0.4], sheds: 4, seg: 8 });
      b.sphere(0.05, { seg: 6, slot: 'gloss', c: PHASE[i]!, at: [x, H + 1.75, -0.4] });
      b.anchor(`hv${i + 1}`, x, H + 1.76, -0.4);
    }
  }
}

export function kioskSubstation(o: KioskOptions = {}): KitModel {
  const b = new Builder('ktp');
  addKioskSubstation(b, o);
  return b.build();
}

/** Pole-mounted substation. Anchors: line phases `p1…3` (`.in` / `.out`), `lv`, `transformer`, `fuses`. */
export function poleSubstation(o: { kVA?: number } = {}): LineSupport {
  const b = new Builder('pole-substation');
  const steel = col('slate').lerp(col('steel'), 0.3);
  let phases: string[] = [];
  b.frame({ at: [-1.1, 0, 0] }, () => (phases = addDistributionPole(b, { voltage: 10, height: 9.5 }).phases));
  b.frame({ at: [1.1, 0, 0] }, () => addDistributionPole(b, { voltage: 10, height: 9.5, phaseMarks: false }), 'b.');
  // platform with the transformer
  for (const z of [-0.5, 0.5]) b.beam([-1.3, 3.3, z], [1.3, 3.3, z], 0.14, { slot: 'metal', c: steel });
  for (const x of [-0.6, 0, 0.6]) b.beam([x, 3.38, -0.6], [x, 3.38, 0.6], 0.08, { slot: 'metal', c: steel });
  b.frame({ at: [0, 3.44, 0] }, () => addDistTransformer(b, { kVA: o.kVA ?? 160 }), 't.');
  b.anchor('transformer', 0, 4, 0.6);
  // drop-out fuses and arresters on a cross-arm above
  b.beam([-1.2, 6.6, 0], [1.2, 6.6, 0], 0.12, { slot: 'metal', c: steel });
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 0.55;
    addRibbedColumn(b, 0.5, 0.08, { at: [x, 6.66, 0.1], sheds: 3, seg: 8 });
    b.cyl(0.035, 0.6, { seg: 6, slot: 'gloss', c: 'white', at: [x, 6.7, 0.28], rot: [0.35, 0, 0] });
    addRibbedColumn(b, 0.45, 0.07, { at: [x, 6.66, -0.25], sheds: 3, seg: 8, c: 'steel.light' });
    b.rod([x, 7.2, 0.1], [-1.1 + (i - 1) * 0.75, i === 1 ? 9.9 : 8.95, 0], 0.025, { slot: 'metal', c: 'mist', seg: 4 });
    b.rod([x, 6.7, 0.3], [(i - 1) * 0.3, 4.75, -0.1], 0.025, { slot: 'metal', c: 'mist', seg: 4 });
  }
  b.anchor('fuses', 0, 7, 0.3);
  // LV cabinet with a conduit from the transformer
  b.box(0.7, 0.9, 0.35, { r: 0.05, slot: 'gloss', c: 'steel.light', at: [1.1, 1.2, 0.4] });
  b.rod([0.3, 4.5, 0.2], [1.1, 2.1, 0.4], 0.04, { slot: 'gloss', c: 'ink', seg: 5 });
  b.anchor('lv', 1.1, 1.2, 0.6);
  return Object.assign(b.build(), { phases, shields: [] as string[], spec: { bundle: 1 } });
}
