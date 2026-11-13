/**
 * Insulators: suspension / tension strings of cap-and-pin discs (count by voltage class), and the ribbed
 * porcelain columns that every piece of substation apparatus stands on (bushings, post insulators, arresters).
 * Units: metres; discs are drawn ~2× real diameter so they read in a diorama, at the real pitch, so the string
 * length matches the voltage class.
 */
import { col, type ColorLike } from '@/style';
import type { AddOptions, Builder } from '../core/builder';
import * as G from '../core/geo';

export type InsulatorKind = 'glass' | 'porcelain' | 'polymer';

/**
 * Discs in one suspension string by nominal voltage (kV) — stylised typical values of post-Soviet lines,
 * the same table the `transmission` chapter teaches: 35 → 3, 110 → 8, 150 → 10, 220 → 14, 330 → 20,
 * 400 → 23, 500 → 27, 750 → 40.
 */
export function discsFor(kV: number): number {
  const table: readonly (readonly [number, number])[] = [
    [35, 3],
    [110, 8],
    [150, 10],
    [220, 14],
    [330, 20],
    [400, 23],
    [500, 27],
    [750, 40],
  ];
  for (const [u, n] of table) if (kV <= u) return n;
  return 40;
}

/** Colour of the insulating body by kind. */
export function insulatorColor(kind: InsulatorKind): ReturnType<typeof col> {
  if (kind === 'glass') return col('sky.light').lerp(col('teal.light'), 0.45);
  if (kind === 'porcelain') return col('wireBrown').lerp(col('coral.dark'), 0.45);
  return col('coral.dark').lerp(col('slate'), 0.35);
}

export interface StringOptions {
  /** Number of discs (see `discsFor`). */
  discs: number;
  kind?: InsulatorKind;
  /** Disc spacing along the string. Default 0.15 m (real pitch ≈ 146 mm). */
  pitch?: number;
  /** Disc radius. Default 0.3 m (exaggerated ×2.3 for legibility). */
  radius?: number;
  /** Corona (grading) ring at the line end — used from 330 kV up. */
  ring?: boolean;
  /** Fewer segments for towers seen from far away. */
  low?: boolean;
  /** Phase marker colour on the line-end clamp (L1 yellow / L2 green / L3 red), optional. */
  phase?: ColorLike;
}

/**
 * Add a string hanging from the origin of the current frame along −Y (rotate the frame for tension strings).
 * Returns its length; the conductor clamp centre is at y = −length.
 */
export function addInsulatorString(b: Builder, o: StringOptions): number {
  const kind = o.kind ?? 'glass';
  const pitch = o.pitch ?? 0.15;
  const r = o.radius ?? 0.3;
  const seg = o.low ? 7 : 12;
  const body = insulatorColor(kind);
  const metal = col('slate').lerp(col('steel'), 0.4);
  const top = 0.22; // clevis and ball-eye at the tower end
  b.box(0.12, top, 0.16, { r: 0.03, slot: 'metal', c: metal, at: [0, -top, 0] });
  let length = top;
  if (kind === 'polymer') {
    // composite long-rod: thin core with many small sheds
    const rodLength = o.discs * pitch;
    const sheds = Math.max(4, Math.round(o.discs * 1.4));
    const profile: G.Pt[] = [[0, 0]];
    for (let i = 0; i < sheds; i++) {
      const y = (i / sheds) * rodLength;
      const p = rodLength / sheds;
      profile.push([r * 0.2, y], [r * 0.62, y + p * 0.3], [r * 0.6, y + p * 0.42], [r * 0.2, y + p * 0.75]);
    }
    profile.push([r * 0.2, rodLength], [0, rodLength]);
    b.lathe(profile, { seg, slot: 'gloss', c: body, at: [0, -length - rodLength, 0], crease: 50 });
    length += rodLength;
  } else {
    // one bell-shaped disc, reused for every unit of the string
    const disc = G.lathe(
      [
        [0, 0.025],
        [r * 0.5, 0],
        [r * 0.94, 0.008],
        [r, 0.035],
        [r * 0.74, 0.07],
        [r * 0.34, 0.1],
        [r * 0.26, pitch * 0.82],
        [0, pitch * 0.82],
      ],
      { seg, crease: 55 },
    );
    const cap = G.cyl(r * 0.3, pitch * 0.36, { seg: Math.max(6, seg - 4), bevel: 0.01 });
    for (let i = 0; i < o.discs; i++) {
      const y = -length - (i + 1) * pitch;
      b.add(disc, { slot: 'gloss', c: body, at: [0, y, 0] });
      b.add(cap, { slot: 'metal', c: metal, at: [0, y + pitch * 0.7, 0] });
    }
    length += o.discs * pitch;
  }
  // line end: clamp body (carries the phase colour mark), optional corona ring
  b.box(0.14, 0.2, 0.2, { r: 0.04, slot: 'metal', c: metal, at: [0, -length - 0.2, 0] });
  length += 0.2;
  b.capsule(0.11, 0.7, { axis: 'z', seg: 8, slot: 'metal', c: o.phase ?? metal, at: [0, -length, 0] });
  if (o.ring) b.ring(r * 1.35, 0.05, { seg: o.low ? 12 : 20, tubeSeg: 5, slot: 'metal', c: 'mist', at: [0, -length + 0.42, 0] });
  return length;
}

let lowDetail = false;

/**
 * Build with low-detail insulator columns (M3: `substation({ detail: 'light' })`): sheds every ~0.4 m instead of
 * ~0.16 m and 8 instead of 12 segments — about a quarter of the triangles, indistinguishable from afar.
 * Explicit `sheds` / `seg` options still win.
 */
export function withLowDetail<T>(fn: () => T): T {
  const saved = lowDetail;
  lowDetail = true;
  try {
    return fn();
  } finally {
    lowDetail = saved;
  }
}

/** True inside `withLowDetail`. */
export function isLowDetail(): boolean {
  return lowDetail;
}

export interface ColumnOptions extends AddOptions {
  /** Number of sheds. Default: one per ~0.16 m. */
  sheds?: number;
  /** Top radius / bottom radius of the core (tapered bushings). Default 1. */
  taper?: number;
  kind?: InsulatorKind;
  seg?: number;
}

/**
 * Ribbed insulator column standing on the frame origin (base y = 0): `radius` is the shed radius.
 * The body colour defaults to brown porcelain; metal flanges cap both ends.
 */
export function addRibbedColumn(b: Builder, height: number, radius: number, o: ColumnOptions = {}): void {
  const sheds = o.sheds ?? Math.max(3, Math.round(height / (lowDetail ? 0.4 : 0.16)));
  const seg = o.seg ?? (lowDetail ? 8 : 12);
  const taper = o.taper ?? 1;
  const flange = Math.min(0.09, height * 0.08);
  const body = height - 2 * flange;
  const profile: G.Pt[] = [[0, 0]];
  for (let i = 0; i < sheds; i++) {
    const k = 1 + (taper - 1) * (i / sheds);
    const y = (i / sheds) * body;
    const p = body / sheds;
    profile.push([radius * 0.58 * k, y], [radius * k, y + p * 0.28], [radius * 0.97 * k, y + p * 0.44], [radius * 0.58 * k, y + p * 0.8]);
  }
  profile.push([radius * 0.58 * taper, body], [0, body]);
  const { at = [0, 0, 0], rot, s, c, slot } = o;
  b.frame({ at, rot, s }, () => {
    const metal = col('steel').lerp(col('slate'), 0.3);
    b.cyl(radius * 0.8, flange, { seg, slot: 'metal', c: metal, bevel: flange * 0.25 });
    b.lathe(profile, { seg, slot: slot ?? 'gloss', c: c ?? insulatorColor(o.kind ?? 'porcelain'), at: [0, flange, 0], crease: 50 });
    b.cyl(radius * 0.8 * taper, flange, { seg, slot: 'metal', c: metal, at: [0, height - flange, 0], bevel: flange * 0.25 });
  });
}
