/**
 * Electronic components in the kit's style (rounded, chunky, three levels of detail), added into a kit
 * `Builder` at a place. Used by the opened inverter and by the rigs of steps 3–6 and 11. Sizes in the units of
 * the model they are added to; every function takes the base centre `at` unless stated.
 */
import type { ColorLike } from '@/style';
import type { Builder, V3 } from '@/kit';
import { COPPER } from '../world';

/** Toroidal choke lying flat: dark ferrite ring with `turns` copper loops around it. `at` = centre of the base. */
export function addToroid(
  b: Builder,
  at: V3,
  R: number,
  r: number,
  turns = 14,
  wire: ColorLike = COPPER,
): void {
  const y = at[1] + r * 1.15;
  b.ring(R, r, { seg: 40, tubeSeg: 10, c: 'ink', at: [at[0], y, at[2]] });
  for (let k = 0; k < turns; k++) {
    const phi = (k / turns) * Math.PI * 2;
    b.ring(r * 1.14, r * 0.2, {
      axis: 'x',
      seg: 16,
      tubeSeg: 6,
      slot: 'metal',
      c: wire,
      at: [at[0] + Math.cos(phi) * R, y, at[2] + Math.sin(phi) * R],
      rot: [0, -phi + Math.PI / 2, 0],
    });
  }
  // two leads going down to the board
  for (const s of [-1, 1])
    b.cyl(r * 0.16, r * 1.2, {
      seg: 8,
      slot: 'metal',
      c: wire,
      at: [at[0] + s * R * 0.35, at[1], at[2] + R + r * 0.9],
    });
}

/**
 * Power transistor in a TO-247 package standing on its legs, front toward +Z: black body, metal tab with the
 * mounting hole, three legs. `at` = bottom centre of the legs; `h` = total height.
 */
export function addTransistor(b: Builder, at: V3, h = 0.62, c: ColorLike = 'ink'): void {
  const w = h * 0.5;
  const leg = h * 0.3;
  for (const k of [-1, 0, 1])
    b.box(w * 0.1, leg, w * 0.06, {
      r: 0,
      slot: 'metal',
      c: 'mist',
      at: [at[0] + k * w * 0.28, at[1], at[2]],
    });
  b.box(w, h * 0.5, w * 0.3, { r: w * 0.05, slot: 'gloss', c, at: [at[0], at[1] + leg, at[2]] });
  b.box(w, h * 0.2, w * 0.1, {
    r: w * 0.03,
    slot: 'metal',
    c: 'steel',
    at: [at[0], at[1] + leg + h * 0.5, at[2] - w * 0.1],
  });
  b.cyl(w * 0.13, w * 0.12, {
    axis: 'z',
    seg: 12,
    c: 'slate',
    at: [at[0], at[1] + leg + h * 0.6, at[2] - w * 0.16],
  });
  // moulded mark on the body
  b.cyl(w * 0.08, w * 0.02, {
    axis: 'z',
    seg: 10,
    c: 'slate',
    at: [at[0] - w * 0.3, at[1] + leg + h * 0.4, at[2] + w * 0.15],
  });
}

/** Electrolytic capacitor: steel can with a sleeve, scored top and a polarity stripe. `at` = base centre. */
export function addCan(b: Builder, at: V3, r: number, h: number, sleeve: ColorLike = 'slate'): void {
  b.cyl(r, h, { seg: 32, bevel: r * 0.12, slot: 'gloss', c: sleeve, at });
  b.cyl(r * 0.86, h * 0.03, { seg: 32, bevel: 0, slot: 'metal', c: 'mist', at: [at[0], at[1] + h, at[2]] });
  for (const a of [0, Math.PI / 3, -Math.PI / 3])
    b.box(r * 1.5, h * 0.012, r * 0.06, {
      r: 0,
      slot: 'metal',
      c: 'steel',
      at: [at[0], at[1] + h * 1.03, at[2]],
      rot: [0, a, 0],
    });
  b.box(r * 0.5, h * 0.8, r * 0.1, { r: 0, c: 'mist', at: [at[0], at[1] + h * 0.1, at[2] + r * 0.97] });
}

/**
 * Finned heat sink: a vertical base plate facing +Z with `fins` fins behind it. `at` = bottom centre of the
 * plate's front face; `w` × `h` plate, `d` fin depth.
 */
export function addHeatSink(
  b: Builder,
  at: V3,
  w: number,
  h: number,
  d: number,
  fins = 10,
  c: ColorLike = 'slate',
): void {
  const t = Math.min(0.1, d * 0.2);
  b.box(w, h, t, { r: t * 0.25, slot: 'metal', c, at: [at[0], at[1], at[2] - t / 2] });
  for (let i = 0; i < fins; i++) {
    const x = at[0] + ((i + 0.5) / fins - 0.5) * (w - 0.04);
    b.box((w / fins) * 0.42, h * 0.96, d, { r: 0.012, slot: 'metal', c, at: [x, at[1], at[2] - t - d / 2] });
  }
}

/** Relay: blue moulded case on a dark base with a label plate and solder pins. `at` = base centre. */
export function addRelay(b: Builder, at: V3, s = 1, c: ColorLike = 'blue'): void {
  b.box(0.48 * s, 0.06 * s, 0.38 * s, { r: 0.01, c: 'ink', at });
  b.box(0.44 * s, 0.4 * s, 0.34 * s, {
    r: 0.04 * s,
    slot: 'gloss',
    c: [c, 'sky'],
    at: [at[0], at[1] + 0.05 * s, at[2]],
  });
  b.box(0.3 * s, 0.012 * s, 0.2 * s, { r: 0, c: 'white', at: [at[0], at[1] + 0.45 * s, at[2]] });
  b.box(0.2 * s, 0.014 * s, 0.03 * s, { r: 0, c: 'slate', at: [at[0], at[1] + 0.452 * s, at[2] + 0.03 * s] });
  for (const k of [-1, 1])
    b.box(0.05 * s, 0.1 * s, 0.02 * s, {
      r: 0,
      slot: 'metal',
      c: 'mist',
      at: [at[0] + k * 0.12 * s, at[1] - 0.06 * s, at[2]],
    });
}
