/**
 * Home distribution board with DIN-rail modules: main switch, SPD, RCD, RCBO, MCBs, energy meter, voltage
 * relay. Every switching module has its own lever part, so a chapter can trip and reset each one; the cover
 * (the plates hiding the terminals) and the door are parts too. Units: metres (1 DIN module = 17.5 mm wide).
 * Origin: centre of the back of the enclosure on the wall, front toward +Z.
 *
 * Anchors: `rR.mM` (front of module M in row R, both from 0), `rR.mM.in` / `.out` (top / bottom terminals),
 * `n`, `pe` (neutral and earth bars), `feed` (cable entry at the top), `door`.
 */
import { SEMANTIC, col, type ColorLike } from '@/style';
import { Builder, type KitModel } from '../core/builder';

export type DinType = 'main' | 'mcb' | 'rcd' | 'rcbo' | 'spd' | 'meter' | 'relay' | 'blank';

export interface DinModule {
  type: DinType;
  /** Poles (width in modules for switching devices). Default 1 (rcd: 2, main: 2, meter: 4, relay: 2). */
  poles?: number;
  /** Initial lever state. Default on. */
  on?: boolean;
  /** Colour tag on the module (circuit group marker). */
  tag?: ColorLike;
}

export interface BoardOptions {
  /** Rows of modules, top to bottom. Default: a typical flat board (main, SPD, RCD, meter / relay + 8 MCBs). */
  rows?: readonly (readonly DinModule[])[];
  /** Modules per row (enclosure width). Default 12. */
  width?: number;
  /**
   * Every lever as its own part (so `setLever` can trip single breakers; one extra draw call per lever).
   * Set false for boards seen from afar: the levers are then merged, in their initial positions. Default true.
   */
  leverParts?: boolean;
}

export interface BoardHandles {
  /** Move a lever: on = up. */
  setLever(row: number, index: number, on: boolean): void;
  /** Door angle 0 (closed) … 1 (fully open, 110°). */
  setDoor(open: number): void;
}

const U = 0.0175;
const WIDTHS: Record<DinType, number> = { main: 2, mcb: 1, rcd: 2, rcbo: 1, spd: 1, meter: 4, relay: 2, blank: 1 };
const DEFAULT_ROWS: DinModule[][] = [
  [{ type: 'main' }, { type: 'spd', poles: 2 }, { type: 'rcd' }, { type: 'meter' }, { type: 'relay' }],
  [
    { type: 'rcbo', tag: 'sky' },
    { type: 'rcbo', tag: 'sky' },
    ...(['yellow', 'yellow', 'coral', 'coral', 'lime', 'lime', 'violet', 'orange'] as const).map((tag) => ({ type: 'mcb' as const, tag })),
  ],
];

/** Adds the board; call the returned function with the built model to get the lever / door handles. */
export function addDistributionBoard(b: Builder, o: BoardOptions = {}): (model: KitModel) => BoardHandles {
  const rows = o.rows ?? DEFAULT_ROWS;
  const n = o.width ?? 12;
  const W = n * U + 0.07;
  const rowH = 0.16;
  const H = rows.length * rowH + 0.12;
  const D = 0.095;
  const white = col('white');
  const levers = new Map<string, string>();
  // enclosure: back box, DIN rails, N and PE bars
  b.box(W, H, D, { r: 0.012, mid: true, slot: 'gloss', c: [white.clone().multiplyScalar(0.88), white], at: [0, 0, D / 2] });
  b.box(W - 0.02, H - 0.02, 0.01, { r: 0, mid: true, slot: 'gloss', c: 'mist', at: [0, 0, D + 0.001] });
  b.anchor('feed', 0, H / 2, D / 2);
  const yBars = -H / 2 + 0.035;
  b.box(W * 0.4, 0.012, 0.012, { r: 0, mid: true, slot: 'metal', c: SEMANTIC.wireN, at: [-W * 0.24, yBars, D + 0.012] });
  for (let i = 0; i < 8; i++) b.box((W * 0.4) / 8, 0.012, 0.012, { r: 0, mid: true, slot: 'metal', c: i % 2 ? SEMANTIC.wirePEStripe : SEMANTIC.wirePE, at: [W * 0.05 + ((i + 0.5) * W * 0.4) / 8, yBars, D + 0.012] });
  b.anchor('n', -W * 0.24, yBars, D + 0.02);
  b.anchor('pe', W * 0.25, yBars, D + 0.02);
  const cover = b.part('cover', { at: [0, 0, D + 0.006] });
  rows.forEach((row, r) => {
    const y = H / 2 - 0.085 - r * rowH;
    b.box(W - 0.03, 0.035, 0.008, { r: 0, mid: true, slot: 'metal', c: 'steel.light', at: [0, y, D + 0.008] });
    // cover plates above and below the row hide the terminals, as on a real board
    for (const s of [-1, 1]) cover.box(W - 0.03, 0.036, 0.05, { r: 0.006, mid: true, slot: 'gloss', c: white, at: [0, y + s * 0.043, 0.027] });
    let x = -((row.reduce((sum, m) => sum + (m.poles ?? WIDTHS[m.type]), 0) * U) / 2);
    row.forEach((m, i) => {
      const poles = m.poles ?? WIDTHS[m.type];
      const w = poles * U;
      const cx = x + w / 2;
      const name = `r${r}.m${i}`;
      const z0 = D + 0.012;
      b.box(w - 0.0012, 0.085, 0.044, { r: 0.003, mid: true, slot: 'gloss', c: m.type === 'blank' ? 'mist' : white, at: [cx, y, z0 + 0.022] });
      b.box(w - 0.0012, 0.045, 0.022, { r: 0.003, mid: true, slot: 'gloss', c: m.type === 'blank' ? 'mist' : white, at: [cx, y, z0 + 0.055] });
      b.anchor(name, cx, y, z0 + 0.07);
      b.anchor(`${name}.in`, cx, y + 0.04, z0 + 0.03);
      b.anchor(`${name}.out`, cx, y - 0.04, z0 + 0.03);
      if (m.tag) b.box(w - 0.004, 0.006, 0.002, { r: 0, mid: true, slot: 'gloss', c: m.tag, at: [cx, y - 0.016, z0 + 0.067] });
      const front = z0 + 0.066;
      if (m.type === 'meter') {
        b.box(w * 0.7, 0.02, 0.002, { r: 0, mid: true, slot: 'gloss', c: 'ink', at: [cx, y + 0.006, front] });
        b.sphere(0.0025, { seg: 6, slot: 'glow', c: 'red', at: [cx + w * 0.3, y - 0.012, front] });
      } else if (m.type === 'relay') {
        b.box(w * 0.75, 0.016, 0.002, { r: 0, mid: true, slot: 'gloss', c: 'ink', at: [cx, y + 0.008, front] });
        b.box(w * 0.5, 0.007, 0.001, { r: 0, mid: true, slot: 'glow', c: 'red', at: [cx, y + 0.008, front + 0.0015] });
        for (const k of [-1, 0, 1]) b.cyl(0.0022, 0.002, { axis: 'z', seg: 6, slot: 'gloss', c: 'steel', at: [cx + k * 0.008, y - 0.01, front] });
      } else if (m.type === 'spd') {
        for (let p = 0; p < poles; p++) {
          b.box(U * 0.7, 0.03, 0.004, { r: 0.002, mid: true, slot: 'gloss', c: 'steel.light', at: [x + (p + 0.5) * U, y + 0.002, front] });
          b.box(U * 0.36, 0.006, 0.002, { r: 0, mid: true, slot: 'gloss', c: 'green', at: [x + (p + 0.5) * U, y - 0.008, front + 0.002] });
        }
      } else if (m.type !== 'blank') {
        if (m.type === 'rcd' || m.type === 'rcbo') b.box(0.006, 0.006, 0.003, { r: 0.002, mid: true, slot: 'gloss', c: 'yellow', at: [cx + w / 2 - 0.006, y + 0.014, front] });
        // lever (one bar across all poles): pivot at the front face
        const place = { at: [cx, y, front - 0.002], rot: [(m.on ?? true) ? -0.55 : 0.55, 0, 0] } as const;
        const lever = (target: Builder): void => void target.box(w - 0.005, 0.009, 0.016, { r: 0.002, slot: 'gloss', c: m.type === 'main' ? 'red' : m.type === 'mcb' ? 'slate' : 'blue', at: [0, -0.0045, 0.008], mid: true });
        if (o.leverParts ?? true) {
          lever(b.part(`lever.${name}`, place));
          levers.set(`${r}.${i}`, b.fullName(`lever.${name}`));
        } else b.frame(place, () => lever(b));
      }
      x += w;
    });
  });
  // hinged door with a smoked window (hinge on the left edge)
  const door = b.part('door', { at: [-W / 2, 0, D + 0.07] });
  door.box(W, H, 0.012, { r: 0.008, mid: true, slot: 'gloss', c: white, at: [W / 2, 0, 0] });
  door.box(W - 0.05, H - 0.06, 0.006, { r: 0.006, mid: true, slot: 'glass', c: 'sky', at: [W / 2, 0, 0.005] });
  door.box(0.012, 0.04, 0.012, { r: 0.003, mid: true, slot: 'gloss', c: 'steel', at: [W - 0.012, 0, 0.012] });
  b.anchor('door', W / 2, 0, D + 0.09);
  const doorName = b.fullName('door');
  return (model) => ({
    setLever(row, index, on) {
      const lever = levers.get(`${row}.${index}`);
      if (lever) model.part(lever).rotation.x = on ? -0.55 : 0.55;
    },
    setDoor(open) {
      model.part(doorName).rotation.y = -open * 1.92;
    },
  });
}

export function distributionBoard(o: BoardOptions = {}): KitModel & BoardHandles {
  const b = new Builder('distribution-board');
  const bind = addDistributionBoard(b, o);
  const model = b.build();
  return Object.assign(model, bind(model));
}
