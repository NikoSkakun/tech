/**
 * Building blocks of rotating machines whose shaft runs along X: blade rows, horizontally split casings
 * (lower / upper half shells with the joint flange — real turbines are opened by lifting the upper half),
 * bearing pedestals, couplings. Units: metres.
 */
import { Matrix4, type Color } from 'three';
import { col, type ColorLike } from '@/style';
import type { Builder } from '../core/builder';
import * as G from '../core/geo';

/** Ring of `n` blades around the X axis at position `x`, from the hub radius to the tip radius. */
export function addBladeRow(
  b: Builder,
  x: number,
  rHub: number,
  rTip: number,
  n: number,
  o: { c?: ColorLike; chord?: number; thickness?: number; stagger?: number; slot?: 'metal' | 'gloss' } = {},
): void {
  const chord = o.chord ?? (rTip - rHub) * 0.45 + 0.05;
  const blade = G.box(o.thickness ?? chord * 0.16, rTip - rHub, chord);
  const stagger = o.stagger ?? 0.6;
  const m = new Matrix4();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    // radial placement around X, then stagger: rotation about the blade's own radial axis
    m.makeRotationX(a)
      .multiply(new Matrix4().makeTranslation(0, (rHub + rTip) / 2, 0))
      .multiply(new Matrix4().makeRotationY(stagger));
    b.add(blade, { slot: o.slot ?? 'metal', c: o.c ?? 'mist', at: [x, 0, 0] }, m);
  }
}

/** Casing wall outline along the shaft: [x, outer radius] points, left to right. */
export type CasingProfile = readonly (readonly [number, number])[];

export interface HalfShellOptions {
  /** Which half: `upper` (lifts off) or `lower` (stays on the foundation). */
  half: 'upper' | 'lower';
  /** Wall thickness. */
  t: number;
  c: Color;
  /** Colour of the joint faces (the "cut" through the wall). Default pale coral. */
  cut?: Color;
  /** Bolted joint flange along both sides. Default true. */
  flange?: boolean;
  seg?: number;
}

/** Half of a horizontally split casing following `profile`. */
export function addHalfShell(b: Builder, profile: CasingProfile, o: HalfShellOptions): void {
  // closed wall section in (r, x): outer face left → right, inner face back
  const section: G.Pt[] = [
    ...profile.map(([x, r]) => [r, x] as G.Pt),
    ...[...profile].reverse().map(([x, r]) => [Math.max(r - o.t, 0.02), x] as G.Pt),
  ];
  // after mapping the lathe axis (Y) onto X, φ = π points up and φ = 0 points down
  const phiStart = o.half === 'upper' ? Math.PI / 2 : -Math.PI / 2;
  const { shell, caps } = G.revolve(section, { seg: o.seg ?? 20, phiStart, phiLength: Math.PI, crease: 35 });
  const rot = [0, 0, -Math.PI / 2] as const;
  b.add(shell, { slot: 'gloss', c: [o.c.clone().multiplyScalar(0.82), o.c], rot });
  if (caps) b.add(caps, { slot: 'gloss', c: o.cut ?? col('coral').lerp(col('white'), 0.45), rot });
  if (o.flange ?? true) {
    const s = o.half === 'upper' ? 1 : -1;
    for (let i = 0; i < profile.length - 1; i++) {
      const [x0, r0] = profile[i]!;
      const [x1, r1] = profile[i + 1]!;
      if (Math.abs(x1 - x0) < 0.05) continue;
      for (const side of [-1, 1]) {
        b.beam([x0, s * o.t * 0.6, side * (r0 + o.t * 0.4)], [x1, s * o.t * 0.6, side * (r1 + o.t * 0.4)], o.t * 1.8, { h: o.t * 1.1, slot: 'gloss', c: o.c.clone().multiplyScalar(0.9) });
        const bolts = Math.max(1, Math.round(Math.abs(x1 - x0) / (o.t * 4)));
        for (let k = 0; k < bolts; k++) {
          const t = (k + 0.5) / bolts;
          b.cyl(o.t * 0.42, o.t * 0.5, { seg: 6, slot: 'metal', c: 'slate', at: [x0 + (x1 - x0) * t, s * o.t * 1.15 - (s < 0 ? o.t * 0.5 : 0), side * (r0 + (r1 - r0) * t + o.t * 0.55)], bevel: 0 });
        }
      }
    }
  }
}

/** Journal-bearing pedestal under the shaft at `x` (shaft axis at height `axisY` above the pedestal base). */
export function addBearing(b: Builder, x: number, axisY: number, r: number, c: ColorLike = 'teal'): void {
  const cc = col(c);
  b.box(r * 3.0, axisY - r * 0.2, r * 3.4, { r: r * 0.25, slot: 'gloss', c: [cc.clone().multiplyScalar(0.78), cc], at: [x, -axisY, 0] });
  b.cyl(r * 1.7, r * 2.6, { axis: 'x', seg: 18, slot: 'gloss', c: cc, at: [x - r * 1.3, 0, 0], bevel: r * 0.25 });
  b.box(r * 0.5, r * 0.5, r * 0.5, { r: r * 0.1, slot: 'gloss', c: 'yellow', at: [x, r * 1.6, 0] });
}

/** Flanged rigid coupling on the shaft at `x`. */
export function addCoupling(b: Builder, x: number, r: number): void {
  for (const s of [-1, 1]) b.cyl(r * 2.1, r * 0.5, { axis: 'x', seg: 18, slot: 'metal', c: 'steel', at: [x + (s < 0 ? -r * 0.52 : 0.02), 0, 0], bevel: r * 0.08 });
  for (let i = 0; i < 8; i++) b.cyl(r * 0.16, r * 1.3, { axis: 'x', seg: 5, slot: 'metal', c: 'slate', at: [x - r * 0.65, Math.cos((i / 8) * 6.283) * r * 1.6, Math.sin((i / 8) * 6.283) * r * 1.6], bevel: 0 });
}
