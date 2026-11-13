/**
 * Oil-immersed power transformer: tank with stiffeners on a rail-mounted base, radiator banks with fans,
 * conservator with Buchholz pipe and breather, HV / LV / neutral bushings sized by voltage, tap-changer drive
 * and control cabinet. Local frame: length along X, HV bushings toward +Z, LV toward −Z. Units: metres.
 *
 * Anchors: `hv1…3`, `lv1…3`, `neutral` (bushing tops), `tank`, `conservator`, `radiator`, `cabinet`, `oltc`.
 */
import { SEMANTIC, col, type ColorLike } from '@/style';
import { Builder, type KitModel } from '../core/builder';
import { addRibbedColumn } from './insulators';

export interface TransformerOptions {
  /** High-voltage side, kV. Default 330. */
  hv?: number;
  /** Low-voltage side, kV. Default 110. */
  lv?: number;
  /** 3 = three-phase unit (default), 1 = single-phase unit of a bank (one HV, one LV bushing). */
  phases?: 1 | 3;
  /** Size multiplier on top of the voltage-class size. */
  scale?: number;
  color?: ColorLike;
  /** Cooling fans under the radiators (forced-air cooling of large units). Default: hv ≥ 110. */
  fans?: boolean;
}

/** Bushing height above the cover for a voltage class (air clearance grows with voltage). */
export function bushingHeight(kV: number): number {
  return 0.45 + Math.pow(kV, 0.82) * 0.022;
}

const PHASE = [SEMANTIC.phaseL1, SEMANTIC.phaseL2, SEMANTIC.phaseL3] as const;

export function addPowerTransformer(b: Builder, o: TransformerOptions = {}): void {
  const hv = o.hv ?? 330;
  const lv = o.lv ?? 110;
  const n = o.phases ?? 3;
  const s = (0.42 + Math.pow(hv, 0.42) * 0.052) * (o.scale ?? 1);
  const L = (n === 3 ? 8.6 : 5.4) * s;
  const W = 3.4 * s;
  const H = 3.9 * s;
  const tank = col(o.color ?? col('mist').lerp(col('steel'), 0.3));
  const dark = col('slate').lerp(col('steel'), 0.25);
  const y0 = 0.75 * s; // tank bottom above the pad (bogies underneath)
  // pad with a gravel-filled oil pit, rails and bogies
  b.box(L + 3.2 * s, 0.35, W + 4.6 * s, { r: 0.1, slot: 'matte', c: col('mist').lerp(col('white'), 0.3), at: [0, -0.2, 0] });
  b.box(L + 2.2 * s, 0.1, W + 3.6 * s, { r: 0.04, slot: 'matte', c: col('steel.light').lerp(col('violet.light'), 0.2), at: [0, 0.12, 0] });
  for (const z of [-0.75 * s, 0.75 * s]) b.box(L + 1.6 * s, 0.14, 0.14, { r: 0, slot: 'metal', c: dark, at: [0, 0.2, z] });
  for (const x of [-L * 0.3, L * 0.3]) {
    for (const z of [-0.75 * s, 0.75 * s]) b.cyl(0.26 * s, 0.2 * s, { axis: 'z', seg: 12, slot: 'metal', c: dark, at: [x, 0.34 + 0.26 * s, z - 0.1 * s] });
    b.box(0.7 * s, 0.3 * s, 2.0 * s, { r: 0.06, slot: 'metal', c: dark, at: [x, y0 - 0.34 * s, 0] });
  }
  // tank, cover flange, vertical stiffeners, lifting lugs
  b.box(L, H, W, { r: 0.22 * s, seg: 2, slot: 'gloss', c: [tank.clone().multiplyScalar(0.8), tank], at: [0, y0, 0] });
  b.box(L + 0.24 * s, 0.16 * s, W + 0.24 * s, { r: 0.06 * s, slot: 'gloss', c: tank, at: [0, y0 + H - 0.05 * s, 0] });
  const ribs = Math.round(L / (1.1 * s));
  for (let i = 0; i <= ribs; i++) {
    const x = -L / 2 + 0.35 * s + (i / ribs) * (L - 0.7 * s);
    for (const z of [-1, 1]) b.box(0.16 * s, H * 0.86, 0.14 * s, { r: 0.04 * s, slot: 'gloss', c: tank.clone().multiplyScalar(0.9), at: [x, y0 + H * 0.06, z * (W / 2 + 0.03 * s)] });
  }
  b.anchor('tank', 0, y0 + H * 0.5, W / 2);
  // radiator banks on both long sides: header pipes, fins, fans
  const fins = Math.round((L * 0.74) / (0.3 * s));
  for (const side of [-1, 1]) {
    const z = side * (W / 2 + 1.05 * s);
    for (const y of [y0 + H * 0.16, y0 + H * 0.86]) {
      b.cyl(0.11 * s, L * 0.78, { axis: 'x', seg: 8, slot: 'metal', c: dark, at: [-L * 0.39, y, z] });
      for (const x of [-L * 0.3, L * 0.3]) b.cyl(0.09 * s, 0.9 * s, { axis: 'z', seg: 8, slot: 'metal', c: dark, at: [x, y, side > 0 ? W / 2 : z] });
    }
    for (let i = 0; i < fins; i++) {
      b.box(0.11 * s, H * 0.68, 1.1 * s, { r: 0.04 * s, slot: 'metal', c: 'steel', at: [-L * 0.37 + (i / (fins - 1)) * L * 0.74, y0 + H * 0.17, z] });
    }
    if (o.fans ?? hv >= 110) {
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * L * 0.26;
        b.cyl(0.55 * s, 0.22 * s, { seg: 16, slot: 'metal', c: dark, at: [x, y0 - 0.28 * s, z] });
        b.cyl(0.47 * s, 0.03 * s, { seg: 16, slot: 'gloss', c: 'yellow', at: [x, y0 - 0.31 * s, z], bevel: 0 });
        b.sphere(0.14 * s, { seg: 8, slot: 'metal', c: 'slate', at: [x, y0 - 0.3 * s, z] });
      }
    }
  }
  b.anchor('radiator', 0, y0 + H * 0.5, W / 2 + 1.6 * s);
  // conservator on brackets, pipe with Buchholz relay to the cover, dehydrating breather
  const cy = y0 + H + 1.7 * s;
  const cx = L * 0.2;
  b.capsule(0.62 * s, L * 0.5, { axis: 'x', seg: 16, slot: 'gloss', c: [tank.clone().multiplyScalar(0.85), tank], at: [cx, cy, -W * 0.3] });
  for (const x of [cx - L * 0.14, cx + L * 0.14]) b.beam([x, y0 + H, -W * 0.3], [x, cy - 0.5 * s, -W * 0.3], 0.16 * s, { slot: 'metal', c: dark });
  b.cyl(0.2 * s, 0.05 * s, { axis: 'x', seg: 12, slot: 'gloss', c: 'white', at: [cx + L * 0.25, cy, -W * 0.3] });
  b.rod([cx - L * 0.2, cy - 0.45 * s, -W * 0.3], [cx - L * 0.32, y0 + H + 0.1 * s, -W * 0.05], 0.07 * s, { slot: 'metal', c: dark });
  b.box(0.3 * s, 0.26 * s, 0.26 * s, { r: 0.05 * s, slot: 'gloss', c: 'coral', at: [cx - L * 0.27, y0 + H + 0.62 * s, -W * 0.17] });
  b.rod([cx + L * 0.22, cy - 0.5 * s, -W * 0.3], [cx + L * 0.22, y0 + H * 0.55, -W / 2 - 0.25 * s], 0.045 * s, { slot: 'metal', c: dark });
  b.cyl(0.13 * s, 0.4 * s, { seg: 10, slot: 'gloss', c: 'sky', at: [cx + L * 0.22, y0 + H * 0.45, -W / 2 - 0.25 * s] });
  b.anchor('conservator', cx, cy + 0.62 * s, -W * 0.3);
  // bushings: tall HV row toward +Z, shorter LV row toward −Z, neutral at the end
  const bushing = (name: string, kV: number, x: number, z: number, leanX: number, leanZ: number, mark?: ColorLike): void => {
    const h = bushingHeight(kV) * (0.8 + 0.2 * s);
    const r = (0.2 + kV * 0.00045) * s;
    b.frame({ at: [x, y0 + H, z], rot: [leanZ, 0, -leanX] }, () => {
      b.cyl(r * 1.5, 0.5 * s, { rTop: r * 1.15, seg: 12, slot: 'gloss', c: tank });
      addRibbedColumn(b, h, r, { at: [0, 0.5 * s, 0], taper: 0.62 });
      b.cyl(r * 0.5, 0.22 * s, { seg: 8, slot: 'metal', c: 'mist', at: [0, 0.5 * s + h, 0] });
      if (mark) b.ring(r * 0.62, 0.05 * s, { seg: 14, tubeSeg: 5, slot: 'gloss', c: mark, at: [0, 0.5 * s + h + 0.02, 0] });
      if (kV >= 330) b.ring(r * 1.5, 0.07 * s, { seg: 18, tubeSeg: 6, slot: 'metal', c: 'mist', at: [0, 0.5 * s + h - 0.2 * s, 0] });
      b.anchor(name, 0, 0.5 * s + h + 0.22 * s, 0);
    });
  };
  for (let i = 0; i < n; i++) {
    const k = n === 3 ? i - 1 : 0;
    bushing(`hv${i + 1}`, hv, k * L * 0.27 - L * 0.06, W * 0.2, k * 0.2, 0.16, n === 3 ? PHASE[i] : undefined);
    bushing(`lv${i + 1}`, lv, k * L * 0.16 - L * 0.2, -W * 0.26, k * 0.12, -0.14, n === 3 ? PHASE[i] : undefined);
  }
  bushing('neutral', Math.min(35, lv), -L * 0.42, W * 0.22, -0.1, 0.1);
  // on-load tap changer head with its motor drive, control cabinet with status lights, drain valve, nameplate
  b.cyl(0.42 * s, 0.5 * s, { seg: 14, slot: 'gloss', c: tank, at: [L * 0.4, y0 + H, W * 0.18] });
  b.box(0.7 * s, 1.0 * s, 0.5 * s, { r: 0.07 * s, slot: 'gloss', c: 'steel.light', at: [L / 2 + 0.3 * s, y0 + H * 0.3, W * 0.2] });
  b.anchor('oltc', L * 0.4, y0 + H + 0.5 * s, W * 0.18);
  b.box(0.55 * s, 1.5 * s, 1.1 * s, { r: 0.07 * s, slot: 'gloss', c: 'white', at: [-L / 2 - 0.32 * s, y0 + H * 0.22, 0] });
  for (const [z, c] of [[-0.25, 'green'], [0.05, 'amber']] as const) b.sphere(0.07 * s, { seg: 8, slot: 'glow', c, at: [-L / 2 - 0.6 * s, y0 + H * 0.22 + 1.25 * s, z * s] });
  b.anchor('cabinet', -L / 2 - 0.6 * s, y0 + H * 0.22 + 0.75 * s, 0);
  b.cyl(0.2 * s, 0.07 * s, { axis: 'z', seg: 10, slot: 'gloss', c: 'red', at: [L * 0.3, y0 + 0.4 * s, W / 2 + 0.3 * s] });
  b.box(0.7 * s, 0.45 * s, 0.05, { r: 0, slot: 'gloss', c: 'ink', at: [-L * 0.25, y0 + H * 0.5, W / 2 + 0.11 * s] });
}

export function powerTransformer(o: TransformerOptions = {}): KitModel {
  const b = new Builder('transformer');
  addPowerTransformer(b, o);
  return b.build();
}
