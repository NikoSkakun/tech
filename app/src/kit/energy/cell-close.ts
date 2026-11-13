/**
 * Battery cells for close-ups (M3; copied from the pilot `lab-battery` — `parts/hero-cell.ts`, `lfpBrick()` —
 * which keeps its own copies). Real size in metres by default (`scale` enlarges); poles follow the DC code:
 * + `coral`, − `blue`; electrode layers as in `cell()`: cathode `sky`, anode `slate`, separator `white`.
 *
 * `cylinderCellDetailed`: 18650 / 21700 / 4680 can with a window onto the jelly roll and a header that comes
 * apart (parts `gasket` → `cid` → `ptc` → `vent` → `cap`, explode them along +Y).
 * `prismaticCellDetailed`: 100 Ah LFP brick with threaded busbar studs, nuts, vent and optional cutaway.
 */
import { col, SEMANTIC, type ColorLike } from '@/style';
import { Builder, type KitModel } from '../core/builder';
import * as G from '../core/geo';

/** Cylindrical formats: [radius, height] in metres. */
export const CYLINDER_CELL_FORMATS = {
  '18650': [0.009, 0.065],
  '21700': [0.0105, 0.07],
  '4680': [0.023, 0.08],
} as const;

export interface CylinderCellOptions {
  format?: keyof typeof CYLINDER_CELL_FORMATS;
  /** Shrink-wrap colour. Default `teal`. */
  wrap?: ColorLike;
  /** 100° window in the can (facing +Z) showing the jelly roll. Default true. */
  window?: boolean;
  /** Uniform enlargement (1 = real size). Default 1. */
  scale?: number;
}

// the model is authored at the pilot's hero size (21700 × 34: R 0.36, H 2.4) and scaled to the format
const HR = 0.36;
const HH = 2.4;
const HY = 2.18; // header seat

/**
 * Parts: `gasket`, `cid`, `ptc`, `vent`, `cap`. Anchors: `top`, `plus` (= `cap.plus`), `minus`, `window`,
 * `inside`, `gasket`.
 */
export function cylinderCellDetailed(o: CylinderCellOptions = {}): KitModel {
  const [r, h] = CYLINDER_CELL_FORMATS[o.format ?? '21700'];
  const k = o.scale ?? 1;
  const b = new Builder(`cell-${o.format ?? '21700'}-detailed`);
  b.frame({ s: [(r / HR) * k, (h / HH) * k, (r / HR) * k] }, () => addHeroCylinder(b, o.wrap ?? 'teal', o.window ?? true));
  return b.build();
}

function addHeroCylinder(b: Builder, wrap: ColorLike, window: boolean): void {
  const R = HR;
  const label = col(wrap);
  const windowAngle = window ? 1.75 : 0;
  const phiStart = Math.PI / 2 + windowAngle / 2; // lathe φ = 0 is +X; the window is centred on +Z
  const span = Math.PI * 2 - windowAngle;
  const wall = G.revolve([[R - 0.035, 0.03], [R, 0.03], [R, HY], [R - 0.035, HY]], { seg: 64, phiStart, phiLength: span });
  b.add(wall.shell, { slot: 'gloss', c: [label.clone().multiplyScalar(0.72), label] });
  if (wall.caps) b.add(wall.caps, { slot: 'metal', c: 'mist' });
  b.cyl(R, 0.05, { seg: 64, slot: 'metal', c: SEMANTIC.dcMinus, bevel: 0.012 });
  b.ring(R + 0.004, 0.022, { at: [0, HY - 0.02, 0], seg: 64, slot: 'metal', c: 'steel.light' }); // crimp bead
  b.ring(R + 0.002, 0.012, { at: [0, 0.34, 0], seg: 64, slot: 'glow', c: 'lime' }); // accent stripe
  b.box(0.012, HH * 0.7, 0.03, { at: [-R * 0.94, 0.3, R * 0.33], r: 0, slot: 'metal', c: 'mist' }); // tab
  if (window) {
    // jelly roll cut open by the window wedge: the outer roll surface follows the can, and both cut faces show
    // the wound layers edge-on as radial stripes (cathode / separator / anode / separator) around the mandrel
    const rollR = R * 0.9;
    b.add(G.lathe([[rollR, 0.06], [rollR, HY - 0.06]], { seg: 56, phiStart, phiLength: span }), { slot: 'double', c: 'white' });
    const layers = ['sky', 'white', 'slate', 'white'] as const;
    const r0 = R * 0.14;
    const n = 24;
    const dr = (rollR - r0) / n;
    for (const phi of [phiStart, phiStart + span]) {
      for (let i = 0; i < n; i++) {
        const rr = r0 + (i + 0.5) * dr;
        b.box(dr, HY - 0.12, 0.004, { r: 0, slot: 'toon', c: layers[i % 4]!, at: [rr * Math.cos(phi), 0.06, rr * Math.sin(phi)], rot: [0, -phi, 0] });
      }
    }
    b.cyl(r0, HY - 0.1, { seg: 16, slot: 'metal', c: 'steel', at: [0, 0.05, 0], bevel: 0 }); // mandrel
  }
  b.anchor('window', 0, HH * 0.5, R);
  b.anchor('inside', 0, HH * 0.5, 0);
  b.anchor('minus', 0, 0.0, 0);
  b.anchor('top', 0, HH, 0);
  addHeader(b, R);
}

/** Header stack, bottom → top; each part pivots at its own base so it can slide up on its own. */
function addHeader(b: Builder, R: number): void {
  const washer = (p: Builder, ri: number, ro: number, h: number, c: ColorLike, slot: 'metal' | 'gloss' | 'toon'): void => {
    p.add(G.revolve([[ri, 0], [ro, 0], [ro, h], [ri, h]], { seg: 48 }).shell, { slot, c });
  };
  const gasket = b.part('gasket', { at: [0, HY - 0.02, 0] });
  washer(gasket, R * 0.55, R - 0.045, 0.06, 'ink', 'toon');
  b.anchor('gasket', R * 0.75, HY, 0);
  const cid = b.part('cid', { at: [0, HY + 0.035, 0] });
  cid.cyl(R * 0.8, 0.022, { seg: 48, slot: 'metal', c: 'mist', bevel: 0.006 });
  cid.dome(R * 0.26, 0.05, { at: [0, 0.018, 0], seg: 24, slot: 'metal', c: 'steel.light' }); // weld dimple that tears
  const ptc = b.part('ptc', { at: [0, HY + 0.06, 0] });
  washer(ptc, R * 0.36, R * 0.8, 0.035, 'amber', 'gloss');
  const vent = b.part('vent', { at: [0, HY + 0.1, 0] });
  vent.cyl(R * 0.8, 0.02, { seg: 48, slot: 'metal', c: 'steel', bevel: 0.006 });
  // scored cross: the membrane bursts along it
  for (const a of [0, Math.PI / 2]) vent.box(R * 1.2, 0.012, 0.018, { at: [0, 0.016, 0], rot: [0, a, 0], r: 0, slot: 'metal', c: 'slate' });
  const cap = b.part('cap', { at: [0, HY + 0.125, 0] });
  cap.cyl(R * 0.82, 0.05, { seg: 48, slot: 'metal', c: 'mist', bevel: 0.012 });
  cap.cyl(R * 0.5, 0.11, { at: [0, 0.04, 0], seg: 40, slot: 'gloss', c: SEMANTIC.dcPlus, bevel: 0.03 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    cap.cyl(0.035, 0.012, { at: [Math.cos(a) * R * 0.66, 0.05, Math.sin(a) * R * 0.66], seg: 12, c: 'ink', bevel: 0 });
  }
  cap.anchor('plus', 0, 0.15, 0);
}

export interface PrismaticCellOptions {
  /** Remove the front wall and show the stacked electrodes. Default false. */
  cut?: boolean;
  /** Can colour. Default blue-grey (`blue.dark` → `sky`). */
  color?: ColorLike;
  /** Uniform enlargement (1 = real size: 0.158 × 0.21 × 0.067 m, 100 Ah LFP). Default 1. */
  scale?: number;
}

/**
 * 100 Ah LFP prismatic cell ("brick"): can, insulating top cover, + / − terminals with threaded busbar studs and
 * nuts, burst vent with its scored foil, accent stripe. Anchors: `plus`, `minus` (stud tips), `vent`, `inside`.
 */
export function prismaticCellDetailed(o: PrismaticCellOptions = {}): KitModel {
  const b = new Builder('cell-lfp-detailed');
  // authored at the pilot's bench size (0.95 × 1.2 × 0.4) and scaled to a 0.21 m tall cell
  const s = (0.21 / 1.26) * (o.scale ?? 1);
  b.frame({ s }, () => {
    const [w, h, d] = [0.95, 1.2, 0.4];
    const can: [ColorLike, ColorLike] = o.color ? [col(o.color).multiplyScalar(0.75), o.color] : ['blue.dark', 'sky'];
    if (!o.cut) b.box(w, h, d, { r: 0.045, slot: 'gloss', c: can });
    else {
      b.box(w, h, d * 0.25, { r: 0.03, slot: 'gloss', c: can, at: [0, 0, -d * 0.375] });
      for (const sx of [-1, 1]) b.box(0.03, h, d, { r: 0.01, slot: 'gloss', c: can, at: [sx * (w / 2 - 0.015), 0, 0] });
      // stacked electrodes cut in steps toward the viewer, so every sheet shows a strip of its colour
      const layers = ['sky', 'white', 'slate', 'white'] as const;
      const n = 12;
      for (let i = 0; i < n; i++) {
        const lw = w * 0.9 * (1 - (0.6 * i) / (n - 1));
        b.box(lw, h * 0.86, d * 0.05, { r: 0, slot: 'toon', c: layers[i % 4]!, at: [-w * 0.45 + lw / 2, h * 0.04, -d * 0.24 + i * d * 0.06] });
      }
    }
    b.box(w * 1.02, 0.06, d * 1.05, { at: [0, h, 0], r: 0.02, c: 'ink' }); // top cover
    for (const [name, x, c] of [['plus', -0.28, SEMANTIC.dcPlus], ['minus', 0.28, SEMANTIC.dcMinus]] as const) {
      b.cyl(0.09, 0.03, { at: [x, h + 0.03, 0], seg: 18, c: 'ink' }); // insulating seal
      b.cyl(0.07, 0.09, { at: [x, h + 0.06, 0], seg: 16, slot: 'metal', c });
      b.cyl(0.028, 0.12, { at: [x, h + 0.15, 0], seg: 10, slot: 'metal', c: 'steel.light', bevel: 0.004 }); // M6 stud
      b.cyl(0.05, 0.035, { at: [x, h + 0.15, 0], seg: 6, slot: 'metal', c: 'steel', bevel: 0.004 }); // hex nut
      b.anchor(name, x, h + 0.27, 0);
    }
    b.cyl(0.06, 0.02, { at: [0, h + 0.06, 0], seg: 18, slot: 'metal', c: 'steel.light' }); // vent seat
    b.cyl(0.045, 0.012, { at: [0, h + 0.08, 0], seg: 18, slot: 'metal', c: 'mist', bevel: 0 }); // foil
    b.box(0.07, 0.006, 0.008, { at: [0, h + 0.09, 0], r: 0, slot: 'metal', c: 'slate' }); // score line
    b.anchor('vent', 0, h + 0.1, 0);
    if (!o.cut) b.ring(0.3, 0.012, { at: [0, 0.3, d / 2 + 0.005], axis: 'z', c: 'lime', slot: 'glow' });
    b.anchor('inside', 0, h / 2, 0);
  });
  return b.build();
}
