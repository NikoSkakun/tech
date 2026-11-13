/**
 * Distribution transformer 10/0.4 kV (25–1000 kVA): corrugated-fin oil tank, lid with three HV bushings and
 * four LV bushings (L1, L2, L3, N), small conservator, thermometer pocket, lifting lugs, skid base.
 * Local frame: HV bushings toward −Z, LV toward +Z, length along X. Origin: centre of the base. Units: metres.
 *
 * Anchors: `hv1…3`, `lv1…3`, `n`, `tank`.
 */
import { SEMANTIC, col, type ColorLike } from '@/style';
import { Builder, type KitModel } from '../core/builder';
import { addRibbedColumn } from './insulators';

export interface DistTransformerOptions {
  /** Rated power, kVA — sets the size. Default 400. */
  kVA?: number;
  color?: ColorLike;
}

const PHASE = [SEMANTIC.phaseL1, SEMANTIC.phaseL2, SEMANTIC.phaseL3] as const;

export function addDistTransformer(b: Builder, o: DistTransformerOptions = {}): void {
  const s = 0.62 + Math.pow((o.kVA ?? 400) / 400, 0.33) * 0.38;
  const L = 1.25 * s;
  const W = 0.72 * s;
  const H = 1.05 * s;
  const tank = col(o.color ?? col('teal').lerp(col('slate'), 0.45));
  const dark = col('slate');
  for (const z of [-0.26 * s, 0.26 * s]) b.box(L * 0.9, 0.1 * s, 0.1 * s, { r: 0, slot: 'metal', c: dark, at: [0, 0, z] });
  b.box(L, H, W, { r: 0.07 * s, seg: 2, slot: 'gloss', c: [tank.clone().multiplyScalar(0.8), tank], at: [0, 0.1 * s, 0] });
  // corrugated cooling fins all around
  const nx = Math.round(L / (0.11 * s));
  for (let i = 0; i < nx; i++) {
    const x = -L / 2 + 0.1 * s + (i / (nx - 1)) * (L - 0.2 * s);
    for (const side of [-1, 1]) b.box(0.04 * s, H * 0.74, 0.2 * s, { r: 0.015 * s, slot: 'gloss', c: tank.clone().multiplyScalar(0.9), at: [x, 0.22 * s, side * (W / 2 + 0.08 * s)] });
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) b.box(0.2 * s, H * 0.74, 0.04 * s, { r: 0.015 * s, slot: 'gloss', c: tank.clone().multiplyScalar(0.9), at: [side * (L / 2 + 0.08 * s), 0.22 * s, (i - 2) * 0.12 * s] });
  }
  const lid = 0.1 * s + H;
  b.box(L + 0.1 * s, 0.07 * s, W + 0.1 * s, { r: 0.03 * s, slot: 'gloss', c: tank, at: [0, lid - 0.02 * s, 0] });
  b.anchor('tank', 0, 0.1 * s + H / 2, W / 2 + 0.2 * s);
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 0.3 * s;
    addRibbedColumn(b, 0.42 * s, 0.085 * s, { at: [x, lid + 0.04 * s, -W * 0.22], sheds: 4, seg: 8, taper: 0.8 });
    b.sphere(0.04 * s, { seg: 6, slot: 'gloss', c: PHASE[i]!, at: [x, lid + 0.49 * s, -W * 0.22] });
    b.anchor(`hv${i + 1}`, x, lid + 0.5 * s, -W * 0.22);
  }
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * 0.2 * s;
    addRibbedColumn(b, 0.2 * s, 0.065 * s, { at: [x, lid + 0.04 * s, W * 0.24], sheds: 2, seg: 8, c: 'white' });
    b.sphere(0.035 * s, { seg: 6, slot: 'gloss', c: i < 3 ? PHASE[i]! : SEMANTIC.wireN, at: [x, lid + 0.27 * s, W * 0.24] });
    b.anchor(i < 3 ? `lv${i + 1}` : 'n', x, lid + 0.28 * s, W * 0.24);
  }
  // conservator on a bracket, oil gauge, thermometer, lifting lugs, drain valve
  b.capsule(0.13 * s, 0.7 * s, { axis: 'z', seg: 10, slot: 'gloss', c: tank, at: [L / 2 - 0.02 * s, lid + 0.36 * s, 0] });
  b.beam([L / 2 - 0.1 * s, lid, 0], [L / 2 - 0.02 * s, lid + 0.24 * s, 0], 0.06 * s, { slot: 'metal', c: dark });
  b.cyl(0.05 * s, 0.03 * s, { axis: 'x', seg: 8, slot: 'gloss', c: 'white', at: [L / 2 + 0.1 * s, lid + 0.36 * s, 0] });
  b.cyl(0.02 * s, 0.16 * s, { seg: 5, slot: 'gloss', c: 'coral', at: [-L * 0.38, lid + 0.04 * s, 0] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.06 * s, 0.1 * s, 0.03 * s, { r: 0, slot: 'metal', c: dark, at: [sx * L * 0.42, lid + 0.04 * s, sz * W * 0.42] });
  b.cyl(0.05 * s, 0.03 * s, { axis: 'x', seg: 8, slot: 'gloss', c: 'red', at: [-L / 2 - 0.12 * s, 0.22 * s, 0] });
}

export function distTransformer(o: DistTransformerOptions = {}): KitModel {
  const b = new Builder('dist-transformer');
  addDistTransformer(b, o);
  return b.build();
}
