/**
 * Distribution poles: concrete and wooden, 35 kV / 10 kV / 0.4 kV. The line runs along local Z.
 *
 *  - 35 kV: concrete pole, two cross-arms, short strings of 3 discs (phases in a triangle);
 *  - 10 kV: one cross-arm with pin insulators, the middle phase on top of the pole;
 *  - 0.4 kV bare: four pin insulators (L1, L2, L3, N); with `sip` — one insulated self-supporting bundle
 *    («СІП») on a hook, optionally with a street-light arm.
 * Wooden poles stand on a concrete stub strapped with steel bands, as on old rural lines.
 *
 * Anchors: phase points named in `phases` (each with `.in` / `.out`), `drop` (service drop to a house),
 * `light` (lamp), `top`. The result is a `LineSupport`, so `powerLine()` strings wires between poles.
 */
import { SEMANTIC, col, type ColorLike } from '@/style';
import { Builder } from '../core/builder';
import type { LineSupport } from './conductors';
import { addInsulatorString, addRibbedColumn } from './insulators';

export interface PoleOptions {
  /** 35, 10 or 0.4 (kV). Default 10. */
  voltage?: 35 | 10 | 0.4;
  kind?: 'concrete' | 'wood';
  /** 0.4 kV only: insulated bundled cable (СІП) instead of bare wires. Default true. */
  sip?: boolean;
  /** 0.4 kV only: street-light arm. */
  lamp?: boolean;
  height?: number;
  /** L1 / L2 / L3 colour marks on the insulator caps. Default true. */
  phaseMarks?: boolean;
}

const PHASE = [SEMANTIC.phaseL1, SEMANTIC.phaseL2, SEMANTIC.phaseL3] as const;

export function addDistributionPole(b: Builder, o: PoleOptions = {}): { phases: string[] } {
  const voltage = o.voltage ?? 10;
  const wood = o.kind === 'wood';
  const h = o.height ?? (voltage === 35 ? 15 : voltage === 10 ? 10 : 8.5);
  const steel = col('slate').lerp(col('steel'), 0.3);
  const phases: string[] = [];
  const mark = (i: number): ColorLike => ((o.phaseMarks ?? true) && i < 3 ? PHASE[i]! : 'mist');
  const point = (name: string, x: number, y: number, z = 0): void => {
    phases.push(name);
    for (const suffix of ['', '.in', '.out']) b.anchor(name + suffix, x, y, z);
  };
  // the pole itself
  if (wood) {
    const brown = col('wireBrown').lerp(col('ink'), 0.3);
    b.box(0.34, 3.4, 0.3, { r: 0.05, slot: 'matte', c: ['steel', 'mist'], at: [0, -0.6, 0.3] });
    b.cyl(0.17, h - 0.5, { rTop: 0.11, seg: 8, slot: 'matte', c: [brown.clone().multiplyScalar(0.8), brown], at: [0, 0.5, 0], bevel: 0.02 });
    for (const y of [0.9, 2.3]) b.box(0.42, 0.1, 0.72, { r: 0.03, slot: 'metal', c: steel, at: [0, y, 0.14] });
  } else {
    const concrete = col('mist').lerp(col('steel.light'), 0.35);
    b.cyl(0.21, h, { rTop: 0.13, seg: 8, slot: 'matte', c: [concrete.clone().multiplyScalar(0.8), concrete], bevel: 0.02 });
    b.cyl(0.3, 0.35, { rTop: 0.24, seg: 8, slot: 'matte', c: 'steel', at: [0, -0.1, 0] });
  }
  b.box(0.3, 0.38, 0.03, { r: 0, slot: 'gloss', c: 'yellow', at: [0, 1.9, 0.2] });
  const pin = (name: string, x: number, y: number, i: number): void => {
    b.cyl(0.03, 0.18, { seg: 5, slot: 'metal', c: steel, at: [x, y, 0], bevel: 0 });
    addRibbedColumn(b, voltage === 10 ? 0.34 : 0.2, voltage === 10 ? 0.11 : 0.08, { at: [x, y + 0.16, 0], sheds: voltage === 10 ? 3 : 2, c: 'white', seg: 8 });
    const top = y + 0.16 + (voltage === 10 ? 0.34 : 0.2);
    b.sphere(0.05, { seg: 6, slot: 'gloss', c: mark(i), at: [x, top + 0.02, 0] });
    point(name, x, top, 0);
  };
  if (voltage === 35) {
    for (const [i, x, y] of [[0, -1.5, h - 0.6], [1, 1.5, h - 2.1], [2, -1.5, h - 3.6]] as const) {
      b.beam([0, y + 0.5, 0], [x, y + 0.1, 0], 0.09, { slot: 'metal', c: steel });
      b.beam([0, y, 0], [x * 1.05, y, 0], 0.12, { slot: 'metal', c: steel });
      let len = 0;
      b.frame({ at: [x, y, 0] }, () => (len = addInsulatorString(b, { discs: 3, phase: mark(i), radius: 0.24, low: true })));
      point(`p${i + 1}`, x, y - len, 0);
    }
  } else if (voltage === 10) {
    b.beam([-0.85, h - 1.0, 0], [0.85, h - 1.0, 0], 0.11, { slot: 'metal', c: steel });
    for (const sx of [-1, 1]) b.beam([0, h - 1.7, 0], [sx * 0.7, h - 1.05, 0], 0.06, { slot: 'metal', c: steel });
    pin('p1', -0.75, h - 0.95, 0);
    pin('p2', 0, h + 0.02, 1);
    pin('p3', 0.75, h - 0.95, 2);
  } else if (o.sip ?? true) {
    // hook + suspension clamp carrying the twisted bundle a little below the top
    b.beam([0, h - 0.5, 0], [0.34, h - 0.5, 0], 0.05, { slot: 'metal', c: steel });
    b.box(0.12, 0.2, 0.34, { r: 0.04, slot: 'gloss', c: 'ink', at: [0.34, h - 0.74, 0] });
    point('sip', 0.34, h - 0.68, 0);
    b.box(0.18, 0.26, 0.14, { r: 0.03, slot: 'gloss', c: 'slate', at: [0.2, h - 1.3, 0] });
    b.anchor('drop', 0.2, h - 1.3, 0);
  } else {
    b.beam([-0.8, h - 0.5, 0], [0.8, h - 0.5, 0], 0.1, { slot: 'metal', c: steel });
    ['p1', 'p2', 'p3', 'n'].forEach((name, i) => pin(name, -0.66 + i * 0.44, h - 0.45, i));
    b.anchor('drop', 0, h - 0.5, 0);
  }
  if (o.lamp && voltage === 0.4) {
    b.beam([0, h - 1.5, 0], [-0.5, h - 1.0, 0], 0.07, { slot: 'metal', c: steel });
    b.beam([-0.5, h - 1.0, 0], [-1.5, h - 0.86, 0], 0.07, { slot: 'metal', c: steel });
    b.box(0.8, 0.14, 0.34, { r: 0.06, slot: 'metal', c: 'steel.light', at: [-1.75, h - 0.92, 0] });
    b.box(0.56, 0.06, 0.24, { r: 0.02, slot: 'lamp', c: col('yellow').lerp(col('white'), 0.35), at: [-1.78, h - 0.97, 0] });
    b.anchor('light', -1.78, h - 1.0, 0);
  }
  b.anchor('top', 0, h, 0);
  return { phases };
}

/** A distribution pole as a model (a `LineSupport` for `powerLine`). */
export function distributionPole(o: PoleOptions = {}): LineSupport {
  const b = new Builder(`pole-${o.voltage ?? 10}`);
  const { phases } = addDistributionPole(b, o);
  return Object.assign(b.build(), { phases, shields: [] as string[], spec: { bundle: 1 } });
}
