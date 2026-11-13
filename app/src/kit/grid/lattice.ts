/**
 * Steel lattice building blocks: tapered four-leg bodies with X-bracing and tapering cross-arms / beams.
 * Members are square bars (angle iron reads as a bar at diorama scale), deliberately thick; everything merges
 * into the builder, so a whole tower is one draw call.
 */
import type { Color } from 'three';
import type { Builder, V3 } from '../core/builder';

export interface LatticeStyle {
  /** Leg (chord) thickness. */
  leg: number;
  /** Bracing thickness. */
  brace: number;
  c: Color;
}

export interface BodyOptions extends LatticeStyle {
  /** Centre of the bottom and top sections. */
  from: V3;
  to: V3;
  /** Section size (x-width, z-depth) at the bottom and at the top. */
  size0: readonly [number, number];
  size1: readonly [number, number];
  panels: number;
  /** Panels get shorter toward the top by this factor (1 = equal). Default 0.88. */
  shrink?: number;
  /** Bracing pattern per face: `x` crossed diagonals, `z` single alternating diagonal. Default `x`. */
  bracing?: 'x' | 'z';
  /** Axes of the section rectangle (default X and Z — a standing body). Use Y and Z for a beam running along X. */
  u?: V3;
  v?: V3;
}

/** Four-leg lattice column between two rectangular sections (works for inclined legs too). */
export function addLatticeBody(b: Builder, o: BodyOptions): void {
  const shrink = o.shrink ?? 0.88;
  const u = o.u ?? [1, 0, 0];
  const v = o.v ?? [0, 0, 1];
  // panel boundaries as fractions 0…1 with geometric spacing
  const cuts = [0];
  let step = 1;
  let total = 0;
  for (let i = 0; i < o.panels; i++) {
    total += step;
    cuts.push(total);
    step *= shrink;
  }
  const corner = (k: number, sx: number, sz: number): V3 => {
    const t = cuts[k]! / total;
    const w = o.size0[0] + (o.size1[0] - o.size0[0]) * t;
    const d = o.size0[1] + (o.size1[1] - o.size0[1]) * t;
    const a = (sx * w) / 2;
    const c = (sz * d) / 2;
    return [
      o.from[0] + (o.to[0] - o.from[0]) * t + u[0] * a + v[0] * c,
      o.from[1] + (o.to[1] - o.from[1]) * t + u[1] * a + v[1] * c,
      o.from[2] + (o.to[2] - o.from[2]) * t + u[2] * a + v[2] * c,
    ];
  };
  const ringOrder: readonly (readonly [number, number])[] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  for (let k = 0; k <= o.panels; k++) {
    for (let f = 0; f < 4; f++) {
      const [ax, az] = ringOrder[f]!;
      const [bx, bz] = ringOrder[(f + 1) % 4]!;
      if (k > 0) b.beam(corner(k, ax, az), corner(k, bx, bz), o.brace, { c: o.c });
      if (k === o.panels) continue;
      b.beam(corner(k, ax, az), corner(k + 1, ax, az), o.leg, { c: o.c });
      if ((o.bracing ?? 'x') === 'x' || (k + f) % 2 === 0) b.beam(corner(k, ax, az), corner(k + 1, bx, bz), o.brace, { c: o.c });
      if ((o.bracing ?? 'x') === 'x' || (k + f) % 2 === 1) b.beam(corner(k, bx, bz), corner(k + 1, ax, az), o.brace, { c: o.c });
    }
  }
}

export interface ArmOptions extends LatticeStyle {
  /** Centre of the root section (on the tower body) and the tip point. */
  root: V3;
  tip: V3;
  /** Root section: height (y) and depth (z, along the line). */
  rootHeight: number;
  rootDepth: number;
  panels?: number;
  /** Keep the bottom chord level with the tip and slope only the top chord (typical cross-arm; `root` y is then ignored). Default true. */
  flatBottom?: boolean;
}

/** Cross-arm tapering from a rectangular root to a tip: four chords plus zig-zag bracing on all faces. */
export function addLatticeArm(b: Builder, o: ArmOptions): void {
  const panels = o.panels ?? 3;
  const flat = o.flatBottom ?? true;
  const point = (t: number, sy: number, sz: number): V3 => {
    const h = o.rootHeight * (1 - t);
    const d = o.rootDepth * (1 - t * 0.85);
    const yc = o.root[1] + (o.tip[1] - o.root[1]) * t;
    return [
      o.root[0] + (o.tip[0] - o.root[0]) * t,
      flat ? o.tip[1] + (sy > 0 ? h : 0) : yc + (sy * h) / 2,
      o.root[2] + (o.tip[2] - o.root[2]) * t + (sz * d) / 2,
    ];
  };
  const corners: readonly (readonly [number, number])[] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  for (let k = 0; k < panels; k++) {
    const t0 = k / panels;
    const t1 = (k + 1) / panels;
    for (let f = 0; f < 4; f++) {
      const [ay, az] = corners[f]!;
      const [by, bz] = corners[(f + 1) % 4]!;
      b.beam(point(t0, ay, az), point(t1, ay, az), o.leg, { c: o.c });
      if (k > 0) b.beam(point(t0, ay, az), point(t0, by, bz), o.brace, { c: o.c });
      if (k < panels - 1 || f % 2 === 0) {
        if ((k + f) % 2 === 0) b.beam(point(t0, ay, az), point(t1, by, bz), o.brace, { c: o.c });
        else b.beam(point(t0, by, bz), point(t1, ay, az), o.brace, { c: o.c });
      }
    }
  }
}

/** Lattice girder (portal bridge, gantry beam) between two points at the same height: a square truss. */
export function addLatticeBeam(b: Builder, from: V3, to: V3, size: number, panels: number, style: LatticeStyle): void {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const len = Math.hypot(dx, dz) || 1;
  addLatticeBody(b, {
    ...style,
    from,
    to,
    size0: [size, size],
    size1: [size, size],
    panels,
    shrink: 1,
    bracing: 'z',
    u: [0, 1, 0],
    v: [-dz / len, 0, dx / len],
  });
}
