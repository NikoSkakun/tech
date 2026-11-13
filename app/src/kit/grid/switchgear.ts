/**
 * Outdoor (air-insulated) switchgear, three poles per apparatus: live-tank circuit breaker and centre-break
 * disconnector. The bay runs along local Z (current flows −Z → +Z), the three phases sit along X.
 * Sizes derive from the voltage class: insulation height and phase spacing grow with kV.
 *
 * Anchors per phase K = 1…3: `pK.in`, `pK.out` (terminals toward −Z / +Z), `pK.top`.
 */
import { SEMANTIC, col } from '@/style';
import type { Builder } from '../core/builder';
import { addRibbedColumn } from './insulators';

/** Height of the insulation (support column) for a voltage class, m. */
export const insulationHeight = (kV: number): number => 0.9 + kV * 0.0095;
/** Centre-to-centre phase spacing of outdoor apparatus, m. */
export const phaseSpacing = (kV: number): number => 1.2 + kV * 0.011;
/** Height of the steel pedestals that keep live parts out of reach. */
export const PEDESTAL = 2.4;

export const PHASE_COLORS = [SEMANTIC.phaseL1, SEMANTIC.phaseL2, SEMANTIC.phaseL3] as const;

const steel = () => col('steel').lerp(col('slate'), 0.35);

/** Run `pole` three times at the phase spacing; anchors added inside get the prefix `pK.`. */
export function threePoles(b: Builder, kV: number, pole: (phase: number) => void, spacing = phaseSpacing(kV)): void {
  for (let i = 0; i < 3; i++) b.frame({ at: [(i - 1) * spacing, 0, 0] }, () => pole(i), `p${i + 1}.`);
}

/** Steel pedestal: four legs on a footing, bracing, top plate. Returns the height of the top plate. */
export function addPedestal(b: Builder, w: number, d: number, h = PEDESTAL): number {
  b.box(w + 0.5, 0.3, d + 0.5, { r: 0.08, slot: 'matte', c: ['steel', 'mist'], at: [0, -0.1, 0] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.beam([(sx * w) / 2, 0.2, (sz * d) / 2], [(sx * w) / 2, h, (sz * d) / 2], 0.13, { slot: 'metal', c: steel() });
  for (const sz of [-1, 1]) b.beam([-w / 2, 0.4, (sz * d) / 2], [w / 2, h - 0.2, (sz * d) / 2], 0.07, { slot: 'metal', c: steel() });
  b.box(w + 0.25, 0.14, d + 0.25, { r: 0.04, slot: 'metal', c: steel(), at: [0, h - 0.07, 0] });
  return h + 0.07;
}

/** Flat terminal pad with a phase-coloured tag. */
function terminal(b: Builder, name: string, x: number, y: number, z: number, phase: number): void {
  b.box(0.16, 0.08, 0.34, { r: 0.02, slot: 'metal', c: 'mist', at: [x, y - 0.04, z] });
  b.box(0.2, 0.05, 0.1, { r: 0, slot: 'gloss', c: PHASE_COLORS[phase]!, at: [x, y + 0.04, z] });
  b.anchor(name, x, y, z);
}

export interface ApparatusOptions {
  /** Voltage class, kV. Default 110. */
  kV?: number;
}

/**
 * Live-tank SF₆ circuit breaker. Up to 150 kV: one vertical interrupter per pole; from 220 kV: T-shaped pole
 * with two interrupters in series and grading capacitors. The interrupters are light grey with red end caps,
 * so the breaker is recognisable among brown porcelain. A spring-drive cabinet stands at each pole.
 */
export function addBreaker(b: Builder, o: ApparatusOptions = {}): void {
  const kV = o.kV ?? 110;
  const h = insulationHeight(kV);
  const r = 0.2 + kV * 0.00035;
  const chamber = col('mist').lerp(col('white'), 0.4);
  threePoles(b, kV, (phase) => {
    const y0 = addPedestal(b, 0.9, 0.9);
    b.box(0.7, 1.1, 0.5, { r: 0.06, slot: 'gloss', c: 'steel.light', at: [0.75, 0.9, 0] });
    b.sphere(0.07, { seg: 8, slot: 'glow', c: 'green', at: [0.75, 1.75, 0.27] });
    addRibbedColumn(b, h, r, { at: [0, y0, 0] });
    const top = y0 + h;
    if (kV <= 150) {
      b.cyl(r * 0.9, 0.2, { seg: 12, slot: 'gloss', c: 'red', at: [0, top, 0] });
      addRibbedColumn(b, h * 0.85, r * 1.15, { at: [0, top + 0.2, 0], c: chamber });
      b.cyl(r * 0.9, 0.22, { seg: 12, slot: 'gloss', c: 'red', at: [0, top + 0.2 + h * 0.85, 0] });
      terminal(b, 'in', 0, top + 0.12, -r - 0.25, phase);
      terminal(b, 'out', 0, top + 0.32 + h * 0.85, r + 0.25, phase);
      b.anchor('top', 0, top + 0.42 + h * 0.85, 0);
      return;
    }
    const len = h * 0.75;
    b.box(0.7, 0.6, 0.7, { r: 0.12, slot: 'gloss', c: 'steel.light', at: [0, top, 0] });
    for (const dir of [-1, 1]) {
      // interrupter leaning slightly upward from the centre housing, with a grading capacitor beside it
      b.frame({ at: [0, top + 0.3, dir * 0.3], rot: [dir * (Math.PI / 2 - 0.12), 0, 0] }, () => {
        addRibbedColumn(b, len, r * 1.1, { c: chamber });
        b.cyl(r * 0.85, 0.2, { seg: 12, slot: 'gloss', c: 'red', at: [0, len, 0] });
        addRibbedColumn(b, len * 0.9, r * 0.45, { at: [0.5, 0.05, 0], c: chamber, seg: 8 });
      });
      terminal(b, dir < 0 ? 'in' : 'out', 0, top + 0.3 + Math.sin(0.12) * len + 0.25, dir * (0.3 + Math.cos(0.12) * len + 0.2), phase);
    }
    b.anchor('top', 0, top + 0.6, 0);
  });
}

export interface DisconnectorOptions extends ApparatusOptions {
  /** 0 = closed (blades in line), 1 = open (blades swung 90° aside — a visible air gap). Default 0. */
  open?: number;
  /** Earthing blades (shown grounded when the main blades are open). Default true. */
  earthing?: boolean;
}

/** Horizontal centre-break disconnector: two rotating posts per pole, each carrying half of the blade. */
export function addDisconnector(b: Builder, o: DisconnectorOptions = {}): void {
  const kV = o.kV ?? 110;
  const h = insulationHeight(kV);
  const r = 0.17 + kV * 0.0003;
  const gap = h * 0.55 + 0.5;
  const open = o.open ?? 0;
  threePoles(b, kV, (phase) => {
    const y0 = addPedestal(b, 0.8, gap * 2 + 0.6);
    b.box(0.5, 0.3, gap * 2 + 0.9, { r: 0.06, slot: 'metal', c: steel(), at: [0, y0, 0] });
    for (const dir of [-1, 1]) {
      addRibbedColumn(b, h, r, { at: [0, y0 + 0.3, dir * gap] });
      const y = y0 + 0.3 + h;
      b.cyl(r * 0.9, 0.16, { seg: 10, slot: 'metal', c: 'mist', at: [0, y, dir * gap] });
      // half blade from the post toward the centre; opening swings it 90° about the post
      b.frame({ at: [0, y + 0.16, dir * gap], rot: [0, dir * open * (Math.PI / 2), 0] }, () => {
        b.beam([0, 0, 0], [0, 0, -dir * (gap - 0.04)], 0.1, { slot: 'metal', c: 'mist' });
        b.box(0.2, 0.14, 0.2, { r: 0.03, slot: 'gloss', c: PHASE_COLORS[phase]!, at: [0, -0.07, -dir * (gap - 0.18)] });
      });
      terminal(b, dir < 0 ? 'in' : 'out', 0, y + 0.2, dir * (gap + 0.35), phase);
    }
    if (o.earthing ?? true) {
      // earthing blade: lies along the frame when the line is in service, stands up to the contact when open
      b.frame({ at: [0.3, y0 + 0.3, gap], rot: [-(1 - open) * (Math.PI / 2 - 0.1), 0, 0] }, () => {
        b.beam([0, 0, 0], [0, h + 0.1, 0], 0.07, { slot: 'gloss', c: 'wireGreen' });
      });
    }
    b.anchor('top', 0, y0 + 0.5 + h, 0);
  });
  // one motor drive for the gang-operated poles
  b.box(0.6, 0.9, 0.5, { r: 0.06, slot: 'gloss', c: 'steel.light', at: [phaseSpacing(kV) + 0.9, 0.8, 0] });
}
