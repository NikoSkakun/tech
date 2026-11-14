/**
 * Heat-recovery steam generator (котел-утилізатор): a horizontal gas tunnel along +X from the gas-turbine
 * exhaust to the stack. Inside, tube bundles in the order the hot gas meets them (document, step 6): HP
 * superheater + reheater → HP evaporator → (SCR) → HP economiser → IP superheater / evaporator → LP evaporator
 * → economisers. Three drums on the roof (HP, IP, LP), each over its evaporator. The south wall is a part
 * (`front`) that steps hide for the cutaway; tubes are colour-coded: water `blue`, boiling `sky`, steam
 * `white`+`pink`. Origin: ground under the inlet end of the tunnel, gas flowing toward +X.
 */
import { Vector3 } from 'three';
import { Builder, type KitModel } from '@/kit';
import { col, type ColorToken } from '@/style';

export interface HrsgBundle {
  /** x of the bundle centre (model space), its function and pressure level. */
  x: number;
  kind: 'sh' | 'evap' | 'eco';
  level: 'hp' | 'ip' | 'lp';
}

/** Bundles along the tunnel (fractions of the length) — hot end first. */
export const BUNDLES: readonly (Omit<HrsgBundle, 'x'> & { f: number })[] = [
  { f: 0.1, kind: 'sh', level: 'hp' },
  { f: 0.22, kind: 'evap', level: 'hp' },
  { f: 0.42, kind: 'eco', level: 'hp' },
  { f: 0.53, kind: 'sh', level: 'ip' },
  { f: 0.63, kind: 'evap', level: 'ip' },
  { f: 0.76, kind: 'evap', level: 'lp' },
  { f: 0.88, kind: 'eco', level: 'lp' },
];
const TUBE: Record<HrsgBundle['kind'], ColorToken> = { sh: 'pink', evap: 'sky', eco: 'blue' };

export interface HrsgModel extends KitModel {
  length: number;
  bundles: HrsgBundle[];
  /** Model-space centre of the drum of a level (on the roof). */
  drum: Record<HrsgBundle['level'], Vector3>;
}

export function buildHrsg(o: { length: number; width: number; height: number; inletY: number }): HrsgModel {
  const { length: L, width: W, height: H } = o;
  const b = new Builder('hrsg');
  const casing = col('steel').lerp(col('mist'), 0.4).lerp(col('violet'), 0.08);
  const ribs = col('steel').lerp(col('violet'), 0.1);
  // foundation slab, back wall (north), roof, and the inlet transition (round exhaust → rectangular tunnel)
  b.box(L + 2, 0.8, W + 2, { r: 0.1, slot: 'matte', c: ['steel', 'mist'], at: [L / 2, 0, 0] });
  b.box(L, H, 0.5, { r: 0.1, c: [casing.clone().multiplyScalar(0.8), casing], at: [L / 2, 0.8, -W / 2] });
  b.box(L, 0.6, W, { r: 0.1, c: ribs, at: [L / 2, 0.8 + H, 0] });
  for (const s of [-1, 1]) b.box(0.5, H, W, { r: 0.1, c: casing, at: [L / 2 + (s * (L - 0.5)) / 2, 0.8, 0] });
  for (let i = 0; i <= 9; i++) b.box(0.5, H + 0.4, 0.8, { r: 0.08, c: ribs, at: [(i / 9) * L, 0.8, -W / 2 - 0.3] });
  b.anchor('inlet', 0, o.inletY, 0).anchor('outlet', L, 0.8 + H * 0.6, 0);
  // tube bundles: rows of vertical tubes across the gas path
  const bundles: HrsgBundle[] = [];
  for (const spec of BUNDLES) {
    const x = spec.f * L;
    bundles.push({ x, kind: spec.kind, level: spec.level });
    const c = col(TUBE[spec.kind]);
    for (let row = 0; row < 4; row++)
      for (let k = 0; k < 9; k++) {
        const z = -W / 2 + 1.2 + (k / 8) * (W - 2.4) + (row % 2) * 0.55;
        b.cyl(0.17, H - 2.2, { seg: 8, slot: 'gloss', c: [c.clone().multiplyScalar(0.8), c], at: [x - 0.9 + row * 0.6, 1.9, z], bevel: 0 });
      }
    // headers top and bottom
    for (const yy of [1.6, H - 0.2]) b.cyl(0.32, W - 1.6, { axis: 'z', seg: 12, slot: 'metal', c: c.clone().multiplyScalar(0.6), at: [x, yy, -W / 2 + 0.8] });
  }
  // SCR catalyst module between the HP evaporator and the HP economiser (honeycomb blocks)
  const scrX = 0.33 * L;
  for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) b.box(0.9, (H - 3) / 4 - 0.3, (W - 2) / 4 - 0.3, { r: 0.06, slot: 'matte', c: ['lime.dark', 'teal'], at: [scrX, 1.6 + r * ((H - 3) / 4), -W / 2 + 1 + (k + 0.5) * ((W - 2) / 4)] });
  b.anchor('scr', scrX, H * 0.6, W / 2);
  // drums on the roof: HP (biggest) → IP → LP, with downcomers into the casing
  const drum = {} as Record<HrsgBundle['level'], Vector3>;
  for (const [level, r, len] of [['hp', 1.25, 9], ['ip', 0.95, 7], ['lp', 1.05, 8]] as const) {
    const x = bundles.find((u) => u.kind === 'evap' && u.level === level)?.x ?? L / 2;
    const y = 0.8 + H + 2.6;
    b.cyl(r, len, { axis: 'z', seg: 28, slot: 'gloss', c: ['steel', 'mist'], at: [x, y, -len / 2], bevel: r * 0.4 });
    for (const s of [-1, 1]) b.box(0.6, 2.2, 0.6, { r: 0.1, c: ribs, at: [x, 0.8 + H, (s * len) / 3] });
    for (const s of [-1, 1]) b.cyl(0.22, 2.4, { seg: 10, slot: 'metal', c: 'blue', at: [x + s * 1.2, 0.8 + H, 1], bevel: 0 });
    drum[level] = new Vector3(x, y, 0);
    b.anchor(`drum.${level}`, x, y + r, 0);
  }
  // service platforms and stairs on the south side (they stay when the front wall is lifted)
  for (const yy of [H * 0.35, H * 0.7]) b.box(L - 2, 0.25, 1.4, { r: 0.05, slot: 'metal', c: 'steel', at: [L / 2, 0.8 + yy, W / 2 + 0.9] });
  const front = b.part('front');
  front.box(L - 0.6, H, 0.5, { r: 0.1, c: [casing.clone().multiplyScalar(0.86), casing], at: [L / 2, 0.8, W / 2] });
  for (let i = 0; i <= 9; i++) front.box(0.5, H + 0.4, 0.8, { r: 0.08, c: ribs, at: [(i / 9) * L, 0.8, W / 2 + 0.3] });
  front.box(L - 1, 1.2, 0.3, { r: 0.05, c: 'violet', at: [L / 2, 0.8 + H * 0.82, W / 2 + 0.75] });
  const model = b.build();
  return Object.assign(model, { length: L, bundles, drum });
}
