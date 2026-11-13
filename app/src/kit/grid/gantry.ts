/**
 * Line-entry gantry (portal) of an outdoor switchyard: lattice columns and girder across one or more bays,
 * strain insulator strings receiving the incoming line, lightning masts on the columns.
 * The girder runs along X; the line arrives from +Z. Units: metres.
 *
 * Anchors per bay B = 1…n and phase K = 1…3: `bB.pK` with the aliases `.line` / `.in` / `.out` (where the line
 * conductor lands — the same names a tower uses, so `powerLine` can end on a gantry) and `.drop` (the dropper
 * to the first apparatus starts here); `sN` (`.in` / `.out`) shield-wire points on the column tops.
 */
import { col } from '@/style';
import type { Builder } from '../core/builder';
import { addInsulatorString, discsFor } from './insulators';
import { addLatticeBeam, addLatticeBody, type LatticeStyle } from './lattice';
import { PHASE_COLORS, phaseSpacing } from './switchgear';

export interface GantryOptions {
  kV?: number;
  /** Number of bays under the girder. Default 1. */
  bays?: number;
  /** Width of one bay. Default: 3 × phase spacing + 1.5 m. */
  bayWidth?: number;
  /** Girder height. Default 7 m + 0.03 m per kV. */
  height?: number;
  /** Strain strings toward +Z (incoming line). Default true; false = bare girder (bus portal). */
  strings?: boolean;
}

export const bayWidth = (kV: number): number => 3 * phaseSpacing(kV) + 1.5;
export const gantryHeight = (kV: number): number => 7 + kV * 0.03;

export function addGantry(b: Builder, o: GantryOptions = {}): void {
  const kV = o.kV ?? 110;
  const bays = o.bays ?? 1;
  const bw = o.bayWidth ?? bayWidth(kV);
  const h = o.height ?? gantryHeight(kV);
  const sp = phaseSpacing(kV);
  const k = 0.75 + kV / 900;
  const style: LatticeStyle = { leg: 0.2 * k, brace: 0.1 * k, c: col('steel').lerp(col('mist'), 0.25) };
  const girder = 1.1 * k;
  const total = bays * bw;
  for (let i = 0; i <= bays; i++) {
    const x = -total / 2 + i * bw;
    // A-shaped column: wide along the line at the foot, narrow at the girder
    addLatticeBody(b, { ...style, from: [x, 0, 0], to: [x, h + girder / 2, 0], size0: [1.2 * k, 3.2 * k], size1: [0.9 * k, girder], panels: Math.max(4, Math.round(h / 2.6)) });
    for (const sz of [-1, 1]) b.box(1.9 * k, 0.6, 1.1 * k, { r: 0.1, slot: 'matte', c: ['steel', 'mist'], at: [x, -0.3, sz * 1.6 * k] });
    // lightning mast with a rod
    addLatticeBody(b, { ...style, from: [x, h + girder / 2, 0], to: [x, h + girder / 2 + 3.2 * k, 0], size0: [0.9 * k, girder], size1: [0.2 * k, 0.2 * k], panels: 2 });
    b.cyl(0.04 * k, 2.2 * k, { seg: 5, slot: 'metal', c: 'mist', at: [x, h + girder / 2 + 3.2 * k, 0], bevel: 0 });
    for (const suffix of ['', '.in', '.out']) b.anchor(`s${i + 1}${suffix}`, x, h + girder / 2 + 3.2 * k, 0);
  }
  addLatticeBeam(b, [-total / 2, h, 0], [total / 2, h, 0], girder, Math.max(4, Math.round(total / (girder * 1.3))), style);
  for (let bay = 0; bay < bays; bay++) {
    const cx = -total / 2 + (bay + 0.5) * bw;
    for (let p = 0; p < 3; p++) {
      const x = cx + (p - 1) * sp;
      const name = `b${bay + 1}.p${p + 1}`;
      if (o.strings ?? true) {
        // strain string toward the incoming line (+Z), drooping 12°
        b.frame({ at: [x, h - girder / 2, girder / 2], rot: [-(Math.PI / 2 - 0.2), 0, 0] }, () => {
          const length = addInsulatorString(b, { discs: discsFor(kV) + 1, ring: kV >= 330, phase: PHASE_COLORS[p] });
          for (const suffix of ['', '.line', '.drop', '.in', '.out']) b.anchor(name + suffix, 0, -length, 0);
        });
      } else {
        for (const suffix of ['', '.line', '.drop', '.in', '.out']) b.anchor(name + suffix, x, h - girder / 2, 0);
      }
    }
  }
}
