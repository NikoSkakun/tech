/**
 * Instrument transformers, surge arresters and bus supports of an outdoor switchyard — three poles each,
 * same conventions as `switchgear.ts` (bay along Z, phases along X, anchors `pK.in` / `pK.out` / `pK.top`).
 */
import { col } from '@/style';
import type { Builder } from '../core/builder';
import { addRibbedColumn } from './insulators';
import { PHASE_COLORS, addPedestal, insulationHeight, threePoles, type ApparatusOptions } from './switchgear';

/**
 * Current transformer (top-core type): the line current passes straight through the head on top of the
 * column — so it has two primary terminals, in line with the bay.
 */
export function addCurrentTransformer(b: Builder, o: ApparatusOptions = {}): void {
  const kV = o.kV ?? 110;
  const h = insulationHeight(kV);
  const r = 0.2 + kV * 0.0004;
  threePoles(b, kV, (phase) => {
    const y0 = addPedestal(b, 0.8, 0.8);
    b.box(0.75, 0.5, 0.75, { r: 0.08, slot: 'gloss', c: 'steel.light', at: [0, y0, 0] });
    b.box(0.25, 0.3, 0.12, { r: 0.03, slot: 'gloss', c: 'slate', at: [0, y0 + 0.1, 0.42] });
    addRibbedColumn(b, h, r, { at: [0, y0 + 0.5, 0], taper: 0.85 });
    const y = y0 + 0.5 + h;
    // head: a horizontal drum holding the ring cores, with an oil-expansion cap
    b.capsule(r * 1.7, r * 5, { axis: 'z', seg: 14, slot: 'gloss', c: ['steel', 'steel.light'], at: [0, y + r * 1.5, 0] });
    b.cyl(r * 0.9, r * 1.1, { seg: 12, slot: 'gloss', c: 'steel.light', at: [0, y + r * 3, 0] });
    b.ring(r * 1.72, 0.04, { axis: 'z', seg: 16, tubeSeg: 5, slot: 'gloss', c: PHASE_COLORS[phase]!, at: [0, y + r * 1.5, 0] });
    for (const dir of [-1, 1]) {
      b.cyl(0.07, 0.3, { axis: 'z', seg: 8, slot: 'metal', c: 'mist', at: [0, y + r * 1.5, dir > 0 ? r * 2.4 : -r * 2.4 - 0.3] });
      b.anchor(dir < 0 ? 'in' : 'out', 0, y + r * 1.5, dir * (r * 2.4 + 0.3));
    }
    b.anchor('top', 0, y + r * 4.1, 0);
  });
}

/**
 * Capacitor voltage transformer: a stack of capacitor units on a base tank, tapped off one phase conductor
 * (single terminal on top — it hangs on the line, the current does not pass through it).
 */
export function addVoltageTransformer(b: Builder, o: ApparatusOptions = {}): void {
  const kV = o.kV ?? 110;
  const h = insulationHeight(kV) * 1.05;
  const r = 0.2 + kV * 0.00035;
  const units = kV >= 500 ? 3 : kV >= 220 ? 2 : 1;
  threePoles(b, kV, (phase) => {
    const y0 = addPedestal(b, 0.8, 0.8);
    b.box(0.85, 0.75, 0.85, { r: 0.1, slot: 'gloss', c: ['steel', 'steel.light'], at: [0, y0, 0] });
    b.box(0.3, 0.35, 0.12, { r: 0.03, slot: 'gloss', c: 'slate', at: [0, y0 + 0.2, 0.47] });
    for (let i = 0; i < units; i++) addRibbedColumn(b, h / units, r, { at: [0, y0 + 0.75 + (i * h) / units, 0] });
    const y = y0 + 0.75 + h;
    b.cyl(r * 0.85, 0.16, { seg: 12, slot: 'gloss', c: PHASE_COLORS[phase]!, at: [0, y, 0] });
    b.cyl(0.07, 0.3, { seg: 8, slot: 'metal', c: 'mist', at: [0, y + 0.16, 0] });
    for (const name of ['in', 'out', 'top']) b.anchor(name, 0, y + 0.46, 0);
  });
}

/**
 * Metal-oxide surge arrester («ОПН»): slim polymer-housed column between phase and earth, with a grading
 * ring from 220 kV, a discharge counter on the pedestal and a visible earth lead.
 */
export function addSurgeArrester(b: Builder, o: ApparatusOptions = {}): void {
  const kV = o.kV ?? 110;
  const h = insulationHeight(kV) * 0.9;
  const r = 0.16 + kV * 0.00028;
  const units = kV >= 500 ? 3 : kV >= 220 ? 2 : 1;
  const housing = col('steel.light').lerp(col('sky.light'), 0.25);
  threePoles(b, kV, (phase) => {
    const y0 = addPedestal(b, 0.6, 0.6);
    for (let i = 0; i < units; i++) addRibbedColumn(b, h / units, r, { at: [0, y0 + (i * h) / units, 0], c: housing, kind: 'polymer' });
    const y = y0 + h;
    if (kV >= 220) {
      b.ring(r * 2.6, 0.06, { seg: 20, tubeSeg: 6, slot: 'metal', c: 'mist', at: [0, y - h * 0.18, 0] });
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        b.rod([Math.cos(a) * r * 2.6, y - h * 0.18, Math.sin(a) * r * 2.6], [0, y, 0], 0.03, { slot: 'metal', c: 'mist', seg: 4 });
      }
    }
    b.cyl(r * 0.8, 0.14, { seg: 10, slot: 'gloss', c: PHASE_COLORS[phase]!, at: [0, y, 0] });
    b.box(0.22, 0.26, 0.14, { r: 0.03, slot: 'gloss', c: 'white', at: [0.3, 1.5, 0.3] });
    b.rod([0.25, y0, 0.25], [0.3, 0.2, 0.3], 0.03, { slot: 'gloss', c: 'wireGreen', seg: 4 });
    for (const name of ['in', 'out', 'top']) b.anchor(name, 0, y + 0.14, 0);
  });
}

/** Post insulators carrying a rigid tubular busbar section across the bay (anchors at the bar ends). */
export function addBusSupport(b: Builder, o: ApparatusOptions & { length?: number } = {}): void {
  const kV = o.kV ?? 110;
  const h = insulationHeight(kV);
  const r = 0.17 + kV * 0.0003;
  const len = o.length ?? 4;
  threePoles(b, kV, (phase) => {
    const y0 = addPedestal(b, 0.6, 0.6);
    addRibbedColumn(b, h, r, { at: [0, y0, 0] });
    const y = y0 + h + 0.12;
    b.box(0.26, 0.12, 0.3, { r: 0.03, slot: 'metal', c: 'mist', at: [0, y - 0.12, 0] });
    b.cyl(0.11, len, { axis: 'z', seg: 10, slot: 'metal', c: 'mist', at: [0, y + 0.08, -len / 2] });
    b.ring(0.115, 0.03, { axis: 'z', seg: 12, tubeSeg: 4, slot: 'gloss', c: PHASE_COLORS[phase]!, at: [0, y + 0.08, 0.5] });
    b.anchor('in', 0, y + 0.08, -len / 2);
    b.anchor('out', 0, y + 0.08, len / 2);
    b.anchor('top', 0, y + 0.2, 0);
  });
}
