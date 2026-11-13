/**
 * Two-dimensional potential flow around the specimen section of step 4 — the drawing aid behind the
 * streamlines (no three.js, no chapter state). A classic panel method (Hess & Smith): the outline is cut into
 * straight panels, each carrying a constant source strength, plus one constant vortex sheet all round; the
 * source strengths are solved so that no air crosses the surface. Because the equations are linear, three base
 * solutions are enough — free stream along the chord, free stream across it, unit vortex sheet — and the flow
 * for any angle of attack α and any circulation is their weighted sum:
 *
 *   v(p) = cos α · v₁(p) + sin α · v₂(p) + γ · v₃(p)          (free-stream speed = 1, chord = 1)
 *
 * `kuttaGamma(α)` is the sheet strength of smooth, attached flow (the air leaves the trailing edge cleanly);
 * by Kutta–Joukowski the lift coefficient of a sheet strength γ is C_L = 2·γ·perimeter. The step draws
 * attached flow below the stall and scales the circulation down by the simulation's own loss of lift beyond it.
 * Units: chord lengths; the outline must run counter-clockwise starting at the trailing edge.
 */
export type Pt2 = readonly [number, number];

export interface PanelFlow {
  readonly perimeter: number;
  /** Vortex-sheet strength of attached flow at angle of attack `alpha` (radians). */
  kuttaGamma(alpha: number): number;
  /** Lift coefficient that belongs to a sheet strength. */
  liftOf(gamma: number): number;
  /** Velocity at a point for free stream (cos α, sin α) and sheet strength γ; `out` = [u, v]. */
  velocity(x: number, y: number, alpha: number, gamma: number, out: [number, number]): [number, number];
  inside(x: number, y: number): boolean;
}

interface Panel {
  x: number;
  y: number;
  tx: number;
  ty: number;
  len: number;
  /** Control point (panel middle). */
  cx: number;
  cy: number;
}

/** Velocity induced at (px, py) by a panel with unit source strength (`out`) — the vortex field is its quarter turn. */
function induced(p: Panel, px: number, py: number, out: [number, number]): void {
  const dx = px - p.x;
  const dy = py - p.y;
  // panel frame: ξ along the panel, η along the outward normal (t rotated clockwise for a CCW outline)
  const xi = dx * p.tx + dy * p.ty;
  const eta = dx * p.ty - dy * p.tx;
  const r1 = xi * xi + eta * eta;
  const r2 = (xi - p.len) * (xi - p.len) + eta * eta;
  out[0] = Math.log(Math.max(r1, 1e-12) / Math.max(r2, 1e-12)) / (4 * Math.PI);
  out[1] = (Math.atan2(eta, xi - p.len) - Math.atan2(eta, xi)) / (2 * Math.PI);
}

/** Solve A·x = b for several right-hand sides (Gaussian elimination with partial pivoting; A is overwritten). */
function solve(a: Float64Array[], bs: Float64Array[]): void {
  const n = a.length;
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r]![c]!) > Math.abs(a[pivot]![c]!)) pivot = r;
    [a[c], a[pivot]] = [a[pivot]!, a[c]!];
    for (const b of bs) [b[c], b[pivot]] = [b[pivot]!, b[c]!];
    for (let r = c + 1; r < n; r++) {
      const f = a[r]![c]! / a[c]![c]!;
      if (f === 0) continue;
      for (let k = c; k < n; k++) a[r]![k]! -= f * a[c]![k]!;
      for (const b of bs) b[r]! -= f * b[c]!;
    }
  }
  for (const b of bs)
    for (let r = n - 1; r >= 0; r--) {
      let s = b[r]!;
      for (let k = r + 1; k < n; k++) s -= a[r]![k]! * b[k]!;
      b[r] = s / a[r]![r]!;
    }
}

export interface PanelFlowOptions {
  /** Region the velocity is tabulated on (chord lengths) and its resolution. */
  bounds?: { x0: number; x1: number; y0: number; y1: number };
  cell?: number;
  /** The closing panel of the outline is a blunt trailing-edge base (default true): Kutta on its neighbours. */
  bluntBase?: boolean;
}

export function createPanelFlow(outline: readonly Pt2[], o: PanelFlowOptions = {}): PanelFlow {
  const n = outline.length;
  const panels: Panel[] = outline.map(([x, y], i) => {
    const [x2, y2] = outline[(i + 1) % n]!;
    const len = Math.hypot(x2 - x, y2 - y);
    return { x, y, tx: (x2 - x) / len, ty: (y2 - y) / len, len, cx: (x + x2) / 2, cy: (y + y2) / 2 };
  });
  const perimeter = panels.reduce((s, p) => s + p.len, 0);
  const tmp: [number, number] = [0, 0];
  // no flow through the surface at every control point: A·σ = −(v·n) for the three base flows
  const a = panels.map(() => new Float64Array(n));
  const rhs = [new Float64Array(n), new Float64Array(n), new Float64Array(n)];
  panels.forEach((pi, i) => {
    const nx = pi.ty;
    const ny = -pi.tx;
    rhs[0]![i] = -nx;
    rhs[1]![i] = -ny;
    panels.forEach((pj, j) => {
      induced(pj, pi.cx, pi.cy, tmp);
      if (i === j) {
        // on the panel itself: no tangential part, half the strength outward (η = ±0 would flip the atan2)
        tmp[0] = 0;
        tmp[1] = 0.5;
      }
      const tn = pj.tx * nx + pj.ty * ny;
      const nn = pj.ty * nx - pj.tx * ny;
      a[i]![j] = tmp[0] * tn + tmp[1] * nn;
      rhs[2]![i]! -= -tmp[1] * tn + tmp[0] * nn;
    });
  });
  solve(a, rhs);
  /** Exact velocity of base flow k (0: stream along x, 1: along y, 2: unit vortex sheet) at a point. */
  const base = (k: number, px: number, py: number, out: [number, number]): void => {
    let u = k === 0 ? 1 : 0;
    let v = k === 1 ? 1 : 0;
    const sigma = rhs[k]!;
    for (let j = 0; j < n; j++) {
      const p = panels[j]!;
      induced(p, px, py, tmp);
      const s = sigma[j]!;
      // source part, then (for the vortex base flow) the sheet itself: the source field turned a quarter
      let a0 = s * tmp[0];
      let a1 = s * tmp[1];
      if (k === 2) {
        a0 -= tmp[1];
        a1 += tmp[0];
      }
      u += a0 * p.tx + a1 * p.ty;
      v += a0 * p.ty - a1 * p.tx;
    }
    out[0] = u;
    out[1] = v;
  };
  // Kutta condition: equal and opposite tangential speeds on the two panels that meet at the trailing edge
  const first = panels[0]!;
  const last = panels[n - ((o.bluntBase ?? true) ? 2 : 1)]!;
  const off = 1e-4;
  const kutta = [0, 1, 2].map((k) => {
    base(k, first.cx + first.ty * off, first.cy - first.tx * off, tmp);
    const t1 = tmp[0] * first.tx + tmp[1] * first.ty;
    base(k, last.cx + last.ty * off, last.cy - last.tx * off, tmp);
    return t1 + tmp[0] * last.tx + tmp[1] * last.ty;
  });
  // tabulate the three base flows once; drawing then costs a bilinear lookup per point
  const b = o.bounds ?? { x0: -1.9, x1: 2.6, y0: -1.5, y1: 1.7 };
  const cell = o.cell ?? 0.03;
  const gx = Math.ceil((b.x1 - b.x0) / cell) + 1;
  const gy = Math.ceil((b.y1 - b.y0) / cell) + 1;
  const table = new Float32Array(gx * gy * 6);
  for (let j = 0; j < gy; j++)
    for (let i = 0; i < gx; i++)
      for (let k = 0; k < 3; k++) {
        base(k, b.x0 + i * cell, b.y0 + j * cell, tmp);
        table[(j * gx + i) * 6 + k * 2] = tmp[0];
        table[(j * gx + i) * 6 + k * 2 + 1] = tmp[1];
      }
  const inside = (x: number, y: number): boolean => {
    let hit = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const [xi, yi] = outline[i]!;
      const [xj, yj] = outline[j]!;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  };
  return {
    perimeter,
    kuttaGamma: (alpha) => -(kutta[0]! * Math.cos(alpha) + kutta[1]! * Math.sin(alpha)) / kutta[2]!,
    liftOf: (gamma) => 2 * gamma * perimeter * LIFT_SENSE,
    inside,
    velocity(x, y, alpha, gamma, out) {
      const fx = Math.min(gx - 1.001, Math.max(0, (x - b.x0) / cell));
      const fy = Math.min(gy - 1.001, Math.max(0, (y - b.y0) / cell));
      const i = Math.floor(fx);
      const j = Math.floor(fy);
      const ax = fx - i;
      const ay = fy - j;
      const w = [(1 - ax) * (1 - ay), ax * (1 - ay), (1 - ax) * ay, ax * ay];
      const at = [(j * gx + i) * 6, (j * gx + i + 1) * 6, ((j + 1) * gx + i) * 6, ((j + 1) * gx + i + 1) * 6];
      const c = [Math.cos(alpha), Math.sin(alpha), gamma];
      let u = 0;
      let v = 0;
      for (let q = 0; q < 4; q++)
        for (let k = 0; k < 3; k++) {
          u += w[q]! * c[k]! * table[at[q]! + k * 2]!;
          v += w[q]! * c[k]! * table[at[q]! + k * 2 + 1]!;
        }
      out[0] = u;
      out[1] = v;
      return out;
    },
  };
}

/** Sense of the sheet strength that lifts toward +y in a stream along +x (fixed by the panel frame above). */
const LIFT_SENSE = 1;
