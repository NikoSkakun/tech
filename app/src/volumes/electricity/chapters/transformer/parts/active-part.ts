/**
 * The «active part» of a three-phase core-type power transformer, as kit `Builder` helpers (metres): a laminated
 * three-limb core with top and bottom yokes, and concentric disc windings on each limb — LV inside (`sky` copper),
 * a pressboard cylinder (`mist`), HV outside (`coral` copper). Windings can be revolved with a front window
 * (`cut`, radians) so the layers and the limb inside show, the classic cutaway of a textbook figure.
 * Shared by the power transformer of steps 4–6 and the three-phase core of step 7.
 */
import type { Color, Vector3 } from 'three';
import { type Builder, G, type Tint, type V3 } from '@/kit';
import { col, type ColorLike } from '@/style';
import { COPPER_PRIMARY, COPPER_SECONDARY } from '../world';

/** Geometry of the active part (metres, origin = centre of the tank floor). */
export const ACTIVE = {
  pitch: 2.1,
  limbR: 0.4,
  yokeH: 0.5,
  bottom: 0.15,
  limbH: 2.0,
  lv: [0.48, 0.64] as const,
  board: [0.67, 0.71] as const,
  hv: [0.75, 0.96] as const,
  /** Winding height (both windings), centred on the limb. */
  windH: 1.8,
};
export const limbX = (k: number): number => (k - 1) * ACTIVE.pitch;
export const limbY0 = (): number => ACTIVE.bottom + ACTIVE.yokeH;
export const limbMid = (): number => limbY0() + ACTIVE.limbH / 2;

const STEEL_A = col('steel');
const STEEL_B = col('slate').lerp(col('steel'), 0.4);

/** Stripes of the sheet edges along Z (laminations seen on the yoke / limb faces). */
const laminated =
  (sheet = 0.09) =>
  (p: Vector3, _n: Vector3, out: Color): void =>
    void out.copy(Math.floor((p.z + 5) / sheet) % 2 ? STEEL_A : STEEL_B);

/**
 * Three limbs and two yokes. The limbs are stepped (two concentric boxes approximate the round cross-section of a
 * real stepped core) so the round windings sit on them naturally.
 */
export function addCore(b: Builder, o: { limbs?: number; stripes?: boolean } = {}): void {
  const n = o.limbs ?? 3;
  const span = (n - 1) * ACTIVE.pitch + 2 * ACTIVE.limbR + 0.2;
  const tint: Tint = o.stripes === false ? 'steel' : laminated();
  const r = ACTIVE.limbR;
  for (const y of [ACTIVE.bottom, limbY0() + ACTIVE.limbH])
    b.box(span, ACTIVE.yokeH, 2 * r * 0.92, { r: 0.04, slot: 'metal', c: tint, at: [0, y, 0] });
  for (let k = 0; k < n; k++) {
    const x = (k - (n - 1) / 2) * ACTIVE.pitch;
    b.box(2 * r * 0.94, ACTIVE.limbH, 2 * r * 0.62, { r: 0.03, slot: 'metal', c: tint, at: [x, limbY0(), 0] });
    b.box(2 * r * 0.62, ACTIVE.limbH, 2 * r * 0.94, { r: 0.03, slot: 'metal', c: tint, at: [x, limbY0(), 0] });
  }
  // clamping frames along the yokes (dark steel) with bolts
  for (const y of [ACTIVE.bottom + ACTIVE.yokeH * 0.15, limbY0() + ACTIVE.limbH + ACTIVE.yokeH * 0.15])
    for (const z of [-1, 1]) b.box(span + 0.1, ACTIVE.yokeH * 0.7, 0.08, { r: 0.02, slot: 'metal', c: 'slate', at: [0, y, z * r * 0.98] });
}

export interface WindingOptions {
  inner: number;
  outer: number;
  /** Bottom and height. */
  y: number;
  h: number;
  color: ColorLike;
  /** Number of discs (grooves between them on the outside). */
  discs?: number;
  /** Width of the front window (rad, centred on +Z); 0 = closed. */
  cut?: number;
  at?: V3;
}

/** A disc winding as a solid of revolution with grooves; the cut faces get a darker copper. (kit lathe: φ = 0 is +X, so the window is centred on φ = π/2 = +Z.) */
export function addWinding(b: Builder, o: WindingOptions): void {
  const discs = o.discs ?? 18;
  const sec: [number, number][] = [[o.inner, o.y]];
  const dz = o.h / discs;
  const notch = Math.min(0.04, (o.outer - o.inner) * 0.25);
  sec.push([o.outer, o.y]);
  for (let i = 1; i < discs; i++) {
    const y = o.y + i * dz;
    sec.push([o.outer, y - dz * 0.12], [o.outer - notch, y - dz * 0.06], [o.outer - notch, y + dz * 0.06], [o.outer, y + dz * 0.12]);
  }
  sec.push([o.outer, o.y + o.h], [o.inner, o.y + o.h]);
  const cut = o.cut ?? 0;
  const { shell, caps } = G.revolve(sec, { seg: 48, phiStart: Math.PI / 2 + cut / 2, phiLength: Math.PI * 2 - cut, crease: 40 });
  const base = col(o.color);
  b.add(shell, { slot: 'metal', c: [base.clone().multiplyScalar(0.8), base], at: o.at });
  if (caps) b.add(caps, { slot: 'toon', c: base.clone().lerp(col('orange'), 0.3).multiplyScalar(0.85), at: o.at });
}

/** A thin pressboard cylinder between the windings. */
export function addBoard(b: Builder, o: { r0: number; r1: number; y: number; h: number; cut?: number; at?: V3 }): void {
  const cut = o.cut ?? 0;
  const { shell, caps } = G.revolve([[o.r0, o.y], [o.r1, o.y], [o.r1, o.y + o.h], [o.r0, o.y + o.h]], { seg: 48, phiStart: Math.PI / 2 + cut / 2, phiLength: Math.PI * 2 - cut });
  b.add(shell, { slot: 'toon', c: 'mist', at: o.at });
  if (caps) b.add(caps, { slot: 'toon', c: col('mist').multiplyScalar(0.85), at: o.at });
}

/** LV, pressboard and HV of one limb (positions relative to the limb's floor point). */
export function addLimbWindings(b: Builder, x: number, which: 'lv' | 'hv' | 'both', cut = 0, colors?: { lv?: ColorLike; hv?: ColorLike }): void {
  const y = limbMid() - ACTIVE.windH / 2;
  const at: V3 = [x, 0, 0];
  if (which !== 'hv') addWinding(b, { inner: ACTIVE.lv[0], outer: ACTIVE.lv[1], y, h: ACTIVE.windH, color: colors?.lv ?? COPPER_SECONDARY, discs: 22, cut: cut * 0.8, at });
  if (which !== 'lv') {
    addBoard(b, { r0: ACTIVE.board[0], r1: ACTIVE.board[1], y: y - 0.05, h: ACTIVE.windH + 0.1, cut: cut * 0.9, at });
    addWinding(b, { inner: ACTIVE.hv[0], outer: ACTIVE.hv[1], y, h: ACTIVE.windH, color: colors?.hv ?? COPPER_PRIMARY, discs: 26, cut, at });
  }
}
