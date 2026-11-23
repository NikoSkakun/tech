/**
 * Growth of a snow crystal from vapour — Reiter's model (C. Reiter, «A local cellular model for snow crystal
 * growth», 2005). A hexagonal grid of cells holds water: a cell with 1 or more is ice. Vapour diffuses between
 * the cells that are not yet next to ice (rate `alpha`); cells at the edge of the ice keep what reaches them and
 * gain `gamma` more each step; far away the air holds `beta`. Nothing tells the crystal to have six arms: the
 * grid has the hexagonal symmetry of ice, and tips reach into richer vapour, so they outrun the hollows.
 *
 * The run is recorded as «the step at which each cell froze», so a slider can show the crystal at any moment of
 * its growth, forward or backward. Deterministic; no imports (runs under plain Node).
 */
export interface SnowflakeSpec {
  /** Vapour far from the crystal (0 … 1) and the extra a boundary cell gains per step. */
  beta: number;
  gamma: number;
  /** Diffusion rate (default 1). */
  alpha?: number;
  /** Radius of the grid in cells (default 64). */
  radius?: number;
}

export interface Snowflake {
  /** Cells that froze, in the order they froze: axial coordinates (q, r) and the moment 0 … 1. */
  readonly q: Int16Array;
  readonly r: Int16Array;
  readonly at: Float32Array;
  readonly count: number;
  readonly radius: number;
}

/**
 * Weathers that grow visibly different crystals (found by trying, grid radius 64): a star with ferny arms, a
 * hexagonal plate, broad sectored arms, a spiky star, a star with side branches.
 */
export const WEATHERS: readonly SnowflakeSpec[] = [
  { beta: 0.8, gamma: 0.004 },
  { beta: 0.95, gamma: 0.003 },
  { beta: 0.7, gamma: 0.0005 },
  { beta: 0.6, gamma: 0.01 },
  { beta: 0.9, gamma: 0.01 },
];

export function growSnowflake(spec: SnowflakeSpec): Snowflake {
  const R = spec.radius ?? 64;
  const alpha = spec.alpha ?? 1;
  const side = 2 * R + 1;
  const index = (q: number, r: number): number => (r + R) * side + (q + R);
  const inside = (q: number, r: number): boolean => Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= R;
  const cells: number[] = [];
  const edge: boolean[] = [];
  for (let r = -R; r <= R; r++)
    for (let q = -R; q <= R; q++)
      if (inside(q, r)) {
        cells.push(index(q, r));
        edge.push(Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) === R);
      }
  const NB = [1, -1, side, -side, side - 1, -side + 1]; // the six neighbours in axial coordinates
  const n = side * side;
  let s = new Float32Array(n).fill(spec.beta);
  let next = new Float32Array(n);
  const u = new Float32Array(n);
  const frozenAt = new Int32Array(n).fill(-1);
  const valid = new Uint8Array(n);
  for (const c of cells) valid[c] = 1;
  s[index(0, 0)] = 1;
  frozenAt[index(0, 0)] = 0;
  const order: number[] = [index(0, 0)];
  let reach = 0;
  let step = 0;
  for (; step < 6000 && reach < R - 3; ) {
    step++;
    // receptive: ice or next to ice — keeps its water; the rest diffuses
    for (const c of cells) {
      let rec = s[c]! >= 1;
      if (!rec) for (let k = 0; k < 6; k++) if (valid[c + NB[k]!] && s[c + NB[k]!]! >= 1) { rec = true; break; }
      u[c] = rec ? 0 : s[c]!;
      next[c] = rec ? s[c]! + spec.gamma : 0;
    }
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i]!;
      if (edge[i]) { next[c] = spec.beta; continue; }
      let sum = 0;
      for (let k = 0; k < 6; k++) sum += u[c + NB[k]!]!;
      next[c]! += u[c]! + (alpha / 2) * (sum / 6 - u[c]!);
    }
    [s, next] = [next, s];
    for (const c of cells)
      if (frozenAt[c]! < 0 && s[c]! >= 1) {
        frozenAt[c] = step;
        order.push(c);
        const q = (c % side) - R, r = Math.floor(c / side) - R;
        reach = Math.max(reach, Math.abs(q), Math.abs(r), Math.abs(q + r));
      }
  }
  const q = new Int16Array(order.length), r = new Int16Array(order.length), at = new Float32Array(order.length);
  order.forEach((c, i) => {
    q[i] = (c % side) - R;
    r[i] = Math.floor(c / side) - R;
    at[i] = frozenAt[c]! / step;
  });
  return { q, r, at, count: order.length, radius: R };
}
