/**
 * Exterior of the 250 MVA, 330/110 kV power transformer (stylised proportions, correct structure; metres, origin =
 * centre of the pad): rail base with bogies, radiator banks on the left end and the back with fans (parts that
 * spin), conservator on brackets with the Buchholz relay on its pipe (float = part), dehydrating breather with
 * silica gel, three HV bushings (330 kV) with knife switches on top (parts that open on a trip), three LV bushings
 * (110 kV) and the neutral, the OLTC head and its drive cabinet on the right end, two top-oil thermometers (needle
 * = part) and two birds perched on a line stub for scale. The tank itself is a separate layer (`power-layers.ts`).
 */
import { Builder, addRibbedColumn, type KitModel, type V3 } from '@/kit';
import { SEMANTIC, col } from '@/style';
import { TANK } from '../world';

/** Tank: length (x), width (z), height; floor height above the pad. */
export const TK = { L: 7.0, W: 3.0, H: 3.7, y0: 0.6 } as const;
export const COVER = TK.y0 + TK.H;
const DARK = col('slate').lerp(col('ink'), 0.3);
/** Light-grey bushing porcelain («світло-сірі пагоди»). */
const PORCELAIN = col('mist').lerp(col('white'), 0.35);
const PHASE = [SEMANTIC.phaseL1, SEMANTIC.phaseL2, SEMANTIC.phaseL3] as const;
export const HV_X = [-2.1, 0, 2.1] as const;
export const LV_X = [-1.45, 0.65, 2.75] as const;
const HV_Z = 0.75;
const LV_Z = -0.3;
export const HV_H = 3.1;
const LV_H = 1.5;
export const CONS = { x: 0.6, y: COVER + 1.55, z: -0.85, r: 0.55, len: 3.4 } as const;

export function createExterior(): KitModel {
  const b = new Builder('power-exterior');
  // pad, gravel pit, rails, bogies
  b.box(TK.L + 4.0, 0.3, TK.W + 4.0, { r: 0.1, slot: 'matte', c: col('steel').lerp(col('slate'), 0.45), at: [0, -0.3, 0] });
  b.box(TK.L + 3.4, 0.06, TK.W + 3.4, { r: 0.03, slot: 'matte', c: col('slate').lerp(col('violet'), 0.25), at: [0, 0, 0] });
  for (const z of [-0.8, 0.8]) b.box(TK.L + 1.4, 0.12, 0.14, { r: 0, slot: 'metal', c: DARK, at: [0, 0.06, z] });
  for (const x of [-2.4, 2.4]) {
    b.box(0.9, 0.3, 2.1, { r: 0.05, slot: 'metal', c: DARK, at: [x, 0.3, 0] });
    for (const z of [-0.8, 0.8]) b.cyl(0.22, 0.16, { axis: 'z', seg: 16, slot: 'metal', c: 'slate', at: [x, 0.22, z - 0.08] });
  }
  // radiator banks: left end (fins along z) and back (fins along x), header pipes, fans as parts
  const finH = TK.H * 0.72;
  const fy = TK.y0 + TK.H * 0.12;
  for (let i = 0; i < 11; i++) b.box(1.2, finH, 0.1, { r: 0.04, slot: 'metal', c: 'steel', at: [-TK.L / 2 - 1.0, fy, -1.25 + i * 0.25] });
  for (let i = 0; i < 18; i++) b.box(0.1, finH, 1.2, { r: 0.04, slot: 'metal', c: 'steel', at: [-2.6 + i * 0.3, fy, -TK.W / 2 - 1.0] });
  for (const y of [fy + 0.12, fy + finH - 0.12]) {
    b.rod([-TK.L / 2, y, 0], [-TK.L / 2 - 1.65, y, 0], 0.11, { slot: 'metal', c: DARK });
    b.rod([-TK.L / 2 - 1.0, y, -1.4], [-TK.L / 2 - 1.0, y, 1.4], 0.09, { slot: 'metal', c: DARK });
    b.rod([0, y, -TK.W / 2], [0, y, -TK.W / 2 - 1.65], 0.11, { slot: 'metal', c: DARK });
    b.rod([-2.75, y, -TK.W / 2 - 1.0], [2.75, y, -TK.W / 2 - 1.0], 0.09, { slot: 'metal', c: DARK });
  }
  const fan = (name: string, at: V3, axis: 'x' | 'z'): void => {
    b.cyl(0.5, 0.18, { axis, seg: 28, slot: 'metal', c: DARK, at });
    const p = b.part(name, { at: [at[0] + (axis === 'x' ? 0.2 : 0), at[1], at[2] + (axis === 'z' ? -0.02 : 0)] });
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const rot: V3 = axis === 'x' ? [a, 0, 0] : [0, 0, a];
      p.frame({ rot }, () => p.box(axis === 'x' ? 0.03 : 0.16, axis === 'x' ? 0.42 : 0.42, axis === 'x' ? 0.16 : 0.03, { r: 0.015, mid: true, slot: 'gloss', c: 'yellow', at: [0, 0.22, 0] }));
    }
    p.sphere(0.1, { seg: 12, slot: 'metal', c: 'slate' });
  };
  fan('fan0', [-TK.L / 2 - 1.75, fy + finH * 0.3, -0.55], 'x');
  fan('fan1', [-TK.L / 2 - 1.75, fy + finH * 0.3, 0.55], 'x');
  fan('fan2', [-1.5, fy + finH * 0.3, -TK.W / 2 - 1.62], 'z');
  fan('fan3', [1.5, fy + finH * 0.3, -TK.W / 2 - 1.62], 'z');
  addTopGear(b);
  return b.build();
}

/** Everything on and above the cover. Same frame as the layers in `power-layers.ts`. */
function addTopGear(b: Builder): void {
  // conservator on two brackets, oil-level gauge on its end
  const { x: cx, y: cy, z: cz, r: cr, len } = CONS;
  b.capsule(cr, len, { axis: 'x', seg: 28, slot: 'gloss', c: [TANK.clone().multiplyScalar(0.85), TANK], at: [cx, cy, cz] });
  for (const x of [cx - len * 0.3, cx + len * 0.3]) b.beam([x, COVER, cz], [x, cy - cr * 0.8, cz], 0.18, { slot: 'metal', c: DARK });
  b.cyl(0.22, 0.06, { axis: 'x', seg: 20, slot: 'gloss', c: 'white', at: [cx + len / 2 + cr - 0.02, cy, cz] });
  b.anchor('conservator', cx, cy + cr, cz).anchor('levelGauge', cx + len / 2 + cr + 0.05, cy, cz);
  // Buchholz pipe from the conservator down to the cover with the relay in the middle (glass window + float part)
  const pipeA: V3 = [cx - len / 2 + 0.2, cy - cr * 0.7, cz];
  const relay: V3 = [-1.55, COVER + 0.75, -0.6];
  const pipeB: V3 = [-1.85, COVER + 0.05, -0.45];
  b.rod(pipeA, relay, 0.08, { slot: 'metal', c: DARK });
  b.rod(relay, pipeB, 0.08, { slot: 'metal', c: DARK });
  b.box(0.42, 0.36, 0.34, { r: 0.06, mid: true, slot: 'gloss', c: 'coral', at: relay });
  b.cyl(0.11, 0.04, { axis: 'z', seg: 16, slot: 'glass', at: [relay[0], relay[1] + 0.02, relay[2] + 0.17] });
  const float = b.part('float', { at: [relay[0], relay[1] + 0.07, relay[2] + 0.2] });
  float.sphere(0.06, { seg: 14, slot: 'gloss', c: 'white' });
  b.anchor('buchholz', relay[0], relay[1] + 0.2, relay[2] + 0.2).anchor('gasIn', pipeB[0], pipeB[1], pipeB[2]);
  // breather: pipe from the conservator down the back corner to a glass cylinder of silica gel
  const br: V3 = [cx + len / 2 - 0.1, TK.y0 + 1.5, cz - cr - 0.25];
  b.rod([cx + len / 2 - 0.1, cy - cr * 0.6, cz], [br[0], br[1] + 0.75, br[2]], 0.05, { slot: 'metal', c: DARK });
  b.cyl(0.2, 0.7, { seg: 20, slot: 'glass', at: br });
  for (let i = 0; i < 26; i++) {
    const a = i * 2.4;
    const y = br[1] + 0.06 + (i / 26) * 0.58;
    b.sphere(0.055, { seg: 8, slot: 'gloss', c: i < 17 ? 'orange' : 'blue', at: [br[0] + Math.cos(a) * 0.1, y, br[2] + Math.sin(a) * 0.1] });
  }
  b.cyl(0.22, 0.08, { seg: 20, slot: 'metal', c: DARK, at: [br[0], br[1] + 0.7, br[2]] });
  b.anchor('breather', br[0], br[1] + 0.35, br[2] - 0.2);
  // bushings: HV (330 kV) with a knife switch on the line stub, LV (110 kV), neutral
  const bushing = (kV: number, x: number, z: number, h: number, r: number, mark?: (typeof PHASE)[number]): void => {
    b.frame({ at: [x, COVER, z] }, () => {
      b.cyl(r * 1.6, 0.4, { rTop: r * 1.2, seg: 16, slot: 'gloss', c: TANK });
      addRibbedColumn(b, h, r, { at: [0, 0.4, 0], taper: 0.6, sheds: Math.round(h / 0.17), c: PORCELAIN });
      b.cyl(r * 0.55, 0.22, { seg: 12, slot: 'metal', c: 'mist', at: [0, 0.4 + h, 0] });
      if (mark) b.ring(r * 0.7, 0.05, { seg: 16, tubeSeg: 5, slot: 'gloss', c: mark, at: [0, 0.42 + h, 0] });
      if (kV >= 330) b.ring(r * 1.5, 0.06, { seg: 20, tubeSeg: 6, slot: 'metal', c: 'mist', at: [0, 0.2 + h, 0] });
    });
  };
  HV_X.forEach((x, i) => {
    bushing(330, x, HV_Z, HV_H, 0.3, PHASE[i]);
    const top: V3 = [x, COVER + 0.4 + HV_H + 0.22, HV_Z];
    b.anchor(`hv${i + 1}`, top[0], top[1], top[2]);
    // knife switch: fixed jaw on a short post, the blade is a part hinged at the bushing top
    b.box(0.1, 0.5, 0.1, { r: 0.02, slot: 'metal', c: 'steel', at: [x, top[1], HV_Z + 0.75] });
    b.rod([x, top[1] + 0.5, HV_Z + 0.75], [x, top[1] + 0.5, HV_Z + 2.0], 0.05, { slot: 'metal', c: 'steel.light' });
    const blade = b.part(`blade${i}`, { at: top });
    blade.beam([0, 0.02, 0], [0, 0.48, 0.75], 0.07, { h: 0.05, slot: 'metal', c: 'steel.light' });
  });
  LV_X.forEach((x, i) => {
    bushing(110, x, LV_Z, LV_H, 0.22, PHASE[i]);
    b.anchor(`lv${i + 1}`, x, COVER + 0.4 + LV_H + 0.22, LV_Z);
  });
  bushing(35, -3.0, 0.9, 0.8, 0.15);
  b.anchor('neutral', -3.0, COVER + 1.45, 0.9);
  // birds on the first line stub (scale: a sparrow is 15 cm)
  for (const [dz, ry] of [[0.35, 0.3], [0.62, -0.4]] as const) {
    b.frame({ at: [HV_X[0], COVER + 0.4 + HV_H + 0.82, HV_Z + 0.75 + dz], rot: [0, ry, 0] }, () => {
      b.capsule(0.06, 0.08, { axis: 'z', seg: 10, slot: 'gloss', c: 'ink' });
      b.sphere(0.045, { seg: 10, slot: 'gloss', c: 'ink', at: [0, 0.05, 0.08] });
      b.cone(0.018, 0.05, { axis: 'z', seg: 6, slot: 'gloss', c: 'amber', at: [0, 0.05, 0.12] });
    });
  }
  // OLTC: head on the cover, drive shaft down the end wall, motor-drive cabinet
  b.cyl(0.45, 0.55, { seg: 24, slot: 'gloss', c: TANK, at: [2.85, COVER, 0.85] });
  b.rod([2.85, COVER + 0.3, 0.85], [TK.L / 2 + 0.15, COVER + 0.3, 0.85], 0.04, { slot: 'metal', c: DARK });
  b.rod([TK.L / 2 + 0.15, COVER + 0.3, 0.85], [TK.L / 2 + 0.15, TK.y0 + 1.9, 0.85], 0.04, { slot: 'metal', c: DARK });
  b.box(0.6, 1.5, 1.1, { r: 0.06, slot: 'gloss', c: 'mist', at: [TK.L / 2 + 0.35, TK.y0 + 0.6, 0.85] });
  b.box(0.04, 1.2, 0.85, { r: 0.02, slot: 'gloss', c: 'steel.light', at: [TK.L / 2 + 0.66, TK.y0 + 0.75, 0.85] });
  b.anchor('oltc', 2.85, COVER + 0.6, 0.85).anchor('oltcDrive', TK.L / 2 + 0.7, TK.y0 + 1.4, 0.85);
  // marshalling cabinet on the pad (front-right corner) with the two dial thermometers: top oil and winding
  const mc: V3 = [4.15, 0, TK.W / 2 + 0.75];
  b.box(0.9, 1.7, 0.55, { r: 0.06, slot: 'gloss', c: 'mist', at: mc });
  b.box(0.95, 0.08, 0.6, { r: 0.03, slot: 'gloss', c: 'steel', at: [mc[0], 1.7, mc[2]] });
  for (let i = 0; i < 2; i++) {
    const at: V3 = [mc[0], 1.3 - i * 0.62, mc[2] + 0.28];
    b.cyl(0.25, 0.08, { axis: 'z', seg: 28, slot: 'gloss', c: 'slate', at });
    b.cyl(0.21, 0.02, { axis: 'z', seg: 28, slot: 'gloss', c: 'white', at: [at[0], at[1], at[2] + 0.08] });
    b.beam([at[0] + 0.05, at[1] + 0.12, at[2] + 0.11], [at[0] + 0.15, at[1] + 0.02, at[2] + 0.11], 0.03, { h: 0.01, slot: 'flat', c: 'red' });
    const needle = b.part(`thermo${i}`, { at: [at[0], at[1], at[2] + 0.12] });
    needle.beam([0, 0, 0], [0, 0.17, 0], 0.025, { h: 0.01, slot: 'flat', c: 'bg.void' });
    b.anchor(`thermo${i}`, at[0], at[1], at[2] + 0.15);
  }
}
