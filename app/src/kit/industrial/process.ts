/**
 * Process equipment and its building: shell-and-tube heat exchanger / steam condenser with a cutaway window
 * onto the tube bundle, and the machine (turbine) hall with a removable roof and front wall and an overhead
 * bridge crane. Units: metres.
 */
import { col, type ColorLike } from '@/style';
import { Builder, type KitModel } from '../core/builder';
import * as G from '../core/geo';

const dark = () => col('slate').lerp(col('steel'), 0.3);

export interface ExchangerOptions {
  length?: number;
  radius?: number;
  /** `condenser`: steam neck on top and hotwell underneath (turbine exhaust → condensate). */
  kind?: 'exchanger' | 'condenser';
  /** Angle of the cutaway window, radians (0 = closed). Default 1.7. */
  cut?: number;
  /** Tube-side (cooling water) and shell-side media colours. */
  cold?: ColorLike;
  hot?: ColorLike;
  color?: ColorLike;
}

/** Axis along X. Anchors: `coldIn`, `coldOut` (water box nozzles), `hotIn`, `hotOut` (shell side), `tubes`. */
export function addHeatExchanger(b: Builder, o: ExchangerOptions = {}): void {
  const L = o.length ?? 8;
  const r = o.radius ?? 1.2;
  const cut = o.cut ?? 1.7;
  const condenser = o.kind === 'condenser';
  const c = col(o.color ?? col('mist').lerp(col('steel.light'), 0.3));
  const cold = col(o.cold ?? 'sky');
  const hot = col(o.hot ?? (condenser ? 'mist' : 'orange'));
  const y = r + (condenser ? 1.5 : 0.9);
  b.frame({ at: [0, y, 0] }, () => {
    // shell: a thick tube with a window cut toward the viewer (front-top); the cut faces get the section colour
    const t = r * 0.07;
    const section: G.Pt[] = [[r - t, -L / 2], [r, -L / 2], [r, L / 2], [r - t, L / 2]];
    const { shell, caps } = G.revolve(section, { seg: 36, phiStart: Math.PI * 0.72 + cut / 2, phiLength: Math.PI * 2 - cut });
    b.add(shell, { slot: 'gloss', c: [c.clone().multiplyScalar(0.84), c], rot: [0, 0, -Math.PI / 2] });
    if (caps) b.add(caps, { slot: 'gloss', c: col('coral').lerp(col('white'), 0.3), rot: [0, 0, -Math.PI / 2] });
    // tube bundle between two tube sheets, with baffles
    const pitch = r * 0.24;
    for (let i = -3; i <= 3; i++) {
      for (let j = -3; j <= 3; j++) {
        const ty = i * pitch;
        const tz = j * pitch + (i % 2 ? pitch / 2 : 0);
        if (Math.hypot(ty, tz) > r * 0.8) continue;
        b.cyl(r * 0.065, L - 0.1, { axis: 'x', seg: 6, slot: 'metal', c: cold, at: [-L / 2 + 0.05, ty, tz], bevel: 0 });
      }
    }
    for (const s of [-1, 1]) b.cyl(r - t, 0.12, { axis: 'x', seg: 28, slot: 'metal', c: dark(), at: [s * (L / 2 - 0.1) - 0.06, 0, 0] });
    for (let i = 1; i <= 3; i++) b.cyl(r * 0.86, 0.05, { axis: 'x', seg: 24, slot: 'metal', c: 'steel', at: [-L / 2 + (i / 4) * L, i % 2 ? r * 0.08 : -r * 0.08, 0], bevel: 0 });
    b.anchor('tubes', 0, r * 0.4, r * 0.7);
    // water boxes (heads) with the cooling-water nozzles, body flanges
    for (const s of [-1, 1]) {
      b.dome(r, r * 0.7, { axis: 'x', seg: 28, slot: 'gloss', c: [c.clone().multiplyScalar(0.84), c], at: [s * (L / 2 + 0.25), 0, 0], s: [s, 1, 1] });
      b.cyl(r * 1.1, 0.25, { axis: 'x', seg: 28, slot: 'metal', c: dark(), at: [s * (L / 2 + 0.12) - 0.12, 0, 0] });
    }
    const nz = r * 0.3;
    b.cyl(nz, r * 0.9, { seg: 10, slot: 'gloss', c: 'blue', at: [-L / 2 - r * 0.35, -r * 1.5, 0] });
    b.cyl(nz, r * 0.9, { seg: 10, slot: 'gloss', c: cold, at: [-L / 2 - r * 0.35, r * 0.6, 0] });
    b.anchor('coldIn', -L / 2 - r * 0.35, -r * 1.5, 0);
    b.anchor('coldOut', -L / 2 - r * 0.35, r * 1.5, 0);
    if (condenser) {
      // exhaust-steam neck from the turbine above, hotwell collecting the condensate below
      b.box(L * 0.55, r * 1.1, r * 1.5, { r: 0.12, slot: 'gloss', c: [hot.clone().multiplyScalar(0.85), hot], at: [L * 0.05, r * 0.8, -r * 0.1] });
      b.box(L * 0.4, r * 0.7, r * 1.0, { r: 0.1, slot: 'gloss', c: 'blue', at: [0, -r * 1.55, 0] });
      b.anchor('hotIn', L * 0.05, r * 1.9, -r * 0.1);
      b.anchor('hotOut', 0, -r * 1.55, r * 0.6);
    } else {
      b.cyl(nz, r * 0.8, { seg: 10, slot: 'gloss', c: hot, at: [L * 0.3, r * 0.7, 0] });
      b.cyl(nz, r * 0.8, { seg: 10, slot: 'gloss', c: hot.clone().lerp(col('white'), 0.4), at: [-L * 0.3, -r * 1.5, 0] });
      b.anchor('hotIn', L * 0.3, r * 1.5, 0);
      b.anchor('hotOut', -L * 0.3, -r * 1.5, 0);
    }
  });
  for (const x of [-L * 0.3, L * 0.3]) b.box(0.6, y - r * 0.4, r * 1.7, { r: 0.08, slot: 'matte', c: ['steel', 'mist'], at: [x, 0, 0] });
}

export function heatExchanger(o: ExchangerOptions = {}): KitModel {
  const b = new Builder(o.kind ?? 'exchanger');
  addHeatExchanger(b, o);
  return b.build();
}

export interface MachineHall extends KitModel {
  /** Bridge crane position along the hall, −1 … 1, and trolley position across, −1 … 1. */
  setCrane(along: number, across?: number): void;
  /** Hide / show the roof and the front wall (they are parts: `roof`, `front`). */
  setOpen(roof: boolean, front?: boolean): void;
}

/**
 * Machine hall along X: operating floor, column rows, window bands, crane rails with a bridge crane.
 * Parts: `roof`, `front` (the +Z wall), `crane` › `trolley`. Anchors: `unitN` (machine bays on the floor), `hook`.
 */
export function machineHall(o: { length?: number; width?: number; height?: number; units?: number; color?: ColorLike } = {}): MachineHall {
  const L = o.length ?? 60;
  const W = o.width ?? 26;
  const H = o.height ?? 20;
  const units = o.units ?? 2;
  const wall = col(o.color ?? col('mist').lerp(col('sky.light'), 0.3));
  const wallC = [wall.clone().multiplyScalar(0.84), wall] as const;
  const glass = col('blue.dark').lerp(col('sky'), 0.3);
  const b = new Builder('machine-hall');
  b.box(L + 1, 1.2, W + 1, { r: 0.1, slot: 'matte', c: col('steel').lerp(col('violet'), 0.15), at: [0, -1, 0] });
  b.box(L - 0.6, 0.12, W - 0.6, { r: 0, slot: 'matte', c: col('teal.light').lerp(col('mist'), 0.5), at: [0, 0.2, 0] });
  for (let i = 0; i < units; i++) b.anchor(`unit${i + 1}`, ((i + 0.5) / units - 0.5) * L, 0.32, 0);
  const wallPanel = (p: Builder, z: number, s: number): void => {
    p.box(L, H, 0.5, { r: 0.1, c: wallC, at: [0, 0.2, z] });
    const bays = Math.round(L / 7);
    for (let i = 0; i < bays; i++) {
      const x = ((i + 0.5) / bays - 0.5) * (L - 1);
      p.box(L / bays - 1.6, H * 0.4, 0.2, { r: 0, slot: 'window', c: glass, at: [x, 0.2 + H * 0.4, z + s * 0.2] });
      for (const k of [0.33, 0.66]) p.box(L / bays - 1.6, 0.12, 0.26, { r: 0, c: 'white', at: [x, 0.2 + H * (0.4 + 0.4 * k), z + s * 0.2] });
    }
    p.box(L + 0.1, 0.8, 0.6, { r: 0, c: 'coral', at: [0, 0.2 + H * 0.24, z] });
  };
  wallPanel(b, -W / 2 + 0.25, -1);
  for (const s of [-1, 1]) b.box(0.5, H, W, { r: 0.1, c: wallC, at: [s * (L / 2 - 0.25), 0.2, 0] });
  const front = b.part('front');
  wallPanel(front, W / 2 - 0.25, 1);
  // columns with corbels carrying the crane rails
  const cols = Math.round(L / 7) + 1;
  for (let i = 0; i < cols; i++) {
    const x = (i / (cols - 1) - 0.5) * (L - 1.4);
    for (const s of [-1, 1]) {
      b.box(0.8, H, 0.8, { r: 0.1, c: wall.clone().multiplyScalar(0.9), at: [x, 0.2, s * (W / 2 - 0.8)] });
      b.box(0.8, 0.8, 1.2, { r: 0.1, c: wall.clone().multiplyScalar(0.8), at: [x, H * 0.72, s * (W / 2 - 1.4)] });
    }
  }
  for (const s of [-1, 1]) b.box(L - 1, 0.3, 0.3, { r: 0, slot: 'metal', c: dark(), at: [0, H * 0.72 + 0.8, s * (W / 2 - 1.6)] });
  // bridge crane: double girder across the hall, trolley with hook
  const crane = b.part('crane', { at: [0, H * 0.72 + 1.1, 0] });
  for (const dx of [-1.2, 1.2]) crane.box(0.8, 1.4, W - 2.6, { r: 0.12, slot: 'gloss', c: ['amber', 'yellow'], at: [dx, 0, 0] });
  for (const s of [-1, 1]) crane.box(4.2, 0.8, 0.9, { r: 0.12, slot: 'gloss', c: 'yellow', at: [0, -0.1, s * (W / 2 - 1.6)] });
  const trolley = crane.part('trolley');
  trolley.box(3.2, 1.0, 2.6, { r: 0.15, slot: 'gloss', c: 'coral', at: [0, 1.4, 0] });
  for (const s of [-1, 1]) trolley.cyl(0.05, H * 0.3, { seg: 4, slot: 'metal', c: 'slate', at: [s * 0.3, -H * 0.3 + 1.4, 0], bevel: 0 });
  trolley.box(1.2, 0.9, 0.7, { r: 0.15, slot: 'gloss', c: 'yellow', at: [0, -H * 0.3 + 0.6, 0] });
  trolley.ring(0.4, 0.12, { axis: 'z', seg: 14, tubeSeg: 6, slot: 'metal', c: dark(), at: [0, -H * 0.3 + 0.25, 0] });
  trolley.anchor('hook', 0, -H * 0.3, 0);
  // roof (part): shallow gable with a ridge ventilator
  const roof = b.part('roof', { at: [0, 0.2 + H, 0] });
  roof.add(G.extrude([[-W / 2 - 0.6, 0], [W / 2 + 0.6, 0], [0, W * 0.1]] as G.Pt[], L + 1, { bevel: 0.12 }), { slot: 'matte', c: [wall.clone().multiplyScalar(0.7), wall.clone().multiplyScalar(0.86)], rot: [0, Math.PI / 2, 0] });
  roof.box(L * 0.8, 1.0, 2.2, { r: 0.15, c: wall.clone().multiplyScalar(0.8), at: [0, W * 0.1 - 0.3, 0] });
  const model = b.build();
  return Object.assign(model, {
    setCrane(along: number, across = 0): void {
      model.part('crane').position.x = (along * (L - 8)) / 2;
      model.part('trolley').position.z = (across * (W - 8)) / 2;
    },
    setOpen(roofOff: boolean, frontOff = false): void {
      model.part('roof').visible = !roofOff;
      model.part('front').visible = !frontOff;
    },
  });
}
