/**
 * Initial states for `WaterMd`: a sheet of ice (one basal layer of ordinary ice Ih) and loose molecules.
 *
 * The sheet is a puckered honeycomb: every molecule has three neighbours in the layer at the bond length 1; the
 * two sub-lattices sit at z = ±1/6, so that every bond makes the tetrahedral 19.5° with the layer and the fourth arm
 * points straight out of it. Hydrogens obey the ice rules (Bernal, Fowler 1933): exactly one hydrogen on every
 * bond, two per molecule — which leaves many arrangements, and real ice is disordered in the same way.
 */
import type { WaterMd } from './md';

/** In-plane edge of the honeycomb (bond 1 tilted by 19.47°) and half of the pucker. */
export const EDGE = Math.sqrt(8) / 3;
export const PUCKER = 1 / 6;
/** Size of one cell of the sheet (two molecules): width and row height. */
export const CELL_W = Math.sqrt(3) * EDGE;
export const CELL_H = 1.5 * EDGE;

export interface Placed {
  p: [number, number, number];
  q: [number, number, number, number];
}

type V3 = [number, number, number];
const norm = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
};
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Quaternion (w, x, y, z) that turns the body so that its hydrogen arms point (as nearly as 104.5° allows) along t1, t2. */
export function orient(t1: V3, t2: V3): [number, number, number, number] {
  const x = norm([t1[0] + t2[0], t1[1] + t2[1], t1[2] + t2[2]]);
  const y = norm([t1[0] - t2[0], t1[1] - t2[1], t1[2] - t2[2]]);
  const z = cross(x, y);
  // rotation matrix with columns x, y, z → quaternion
  const m00 = x[0], m10 = x[1], m20 = x[2], m01 = y[0], m11 = y[1], m21 = y[2], m02 = z[0], m12 = z[1], m22 = z[2];
  const tr = m00 + m11 + m22;
  let q: [number, number, number, number];
  if (tr > 0) {
    const s = 2 * Math.sqrt(tr + 1);
    q = [s / 4, (m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s];
  } else if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    q = [(m21 - m12) / s, s / 4, (m01 + m10) / s, (m02 + m20) / s];
  } else if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    q = [(m02 - m20) / s, (m01 + m10) / s, s / 4, (m12 + m21) / s];
  } else {
    const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
    q = [(m10 - m01) / s, (m02 + m20) / s, (m12 + m21) / s, s / 4];
  }
  return q;
}

/** A uniformly random orientation. */
export function randomQuat(rnd: () => number): [number, number, number, number] {
  const u = rnd(), v = 2 * Math.PI * rnd(), w = 2 * Math.PI * rnd();
  const a = Math.sqrt(1 - u), b = Math.sqrt(u);
  return [a * Math.sin(v), a * Math.cos(v), b * Math.sin(w), b * Math.cos(w)];
}

/**
 * A sheet of ice: `cols` × `rows` cells (two molecules each), its lower-left molecule at `origin` (x, y).
 * Hydrogens are placed at random within the ice rules (seeded by `rnd`).
 */
export function iceSheet(cols: number, rows: number, rnd: () => number, origin: readonly [number, number] = [0, 0]): Placed[] {
  const n = 2 * cols * rows;
  const at: V3[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = origin[0] + CELL_W * (c + 0.5 * (r & 1));
      const y = origin[1] + CELL_H * r;
      at.push([x, y, PUCKER], [x, y + EDGE, -PUCKER]);
    }
  // bonds: each joins a site of the upper sub-lattice (even index) with one of the lower (odd index)
  const ends: [number, number][] = [];
  const of: number[][] = Array.from({ length: n }, () => []);
  const link = (a: number, b: number): void => {
    of[a]!.push(ends.length);
    of[b]!.push(ends.length);
    ends.push([a, b]);
  };
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const a = 2 * (r * cols + c);
      link(a, a + 1);
      if (r === 0) continue;
      const right = r & 1 ? c + 1 : c;
      for (const cc of [right - 1, right]) if (cc >= 0 && cc < cols) link(a, 2 * ((r - 1) * cols + cc) + 1);
    }
  // giver[e] = 0: the first end gives its hydrogen to bond e, 1: the second. Random, then repaired until every
  // molecule gives at most two hydrogens and has room for the rest (free arms: missing neighbours + the outward arm)
  const giver: number[] = ends.map(() => (rnd() < 0.5 ? 0 : 1));
  const given = (s: number): number => of[s]!.filter((e) => ends[e]![giver[e]!] === s).length;
  const bad = (s: number): number => {
    const g = given(s), deg = of[s]!.length;
    return g > 2 ? 1 : g < deg - 2 ? -1 : 0;
  };
  for (let pass = 0; pass < 200 * n; pass++) {
    const s = Math.floor(rnd() * n);
    const b = bad(s);
    if (b === 0) continue;
    // too many given: take one back; too few: give one more
    const pick = of[s]!.filter((e) => (ends[e]![giver[e]!] === s) === b > 0);
    const e = pick[Math.floor(rnd() * pick.length)]!;
    giver[e] = 1 - giver[e]!;
  }
  for (let s = 0; s < n; s++) if (bad(s) !== 0) throw new Error('iceSheet: ice rules not satisfied');
  const out: Placed[] = [];
  for (let s = 0; s < n; s++) {
    const up = s % 2 === 0;
    const me = at[s]!;
    // the four arm directions of this site: three in the layer (toward neighbours, present or not), one outward
    const sign = up ? 1 : -1;
    const inLayer: V3[] = [
      [0, sign * EDGE, -sign * 2 * PUCKER],
      [(CELL_W / 2) * 1, -sign * EDGE * 0.5, -sign * 2 * PUCKER],
      [-(CELL_W / 2), -sign * EDGE * 0.5, -sign * 2 * PUCKER],
    ];
    const outward: V3 = [0, 0, sign];
    const hydrogens: V3[] = [];
    const taken = new Set<number>();
    for (const e of of[s]!) {
      const other = ends[e]![0] === s ? ends[e]![1] : ends[e]![0];
      const o = at[other]!;
      const k = inLayer.findIndex((d) => Math.hypot(me[0] + d[0] - o[0], me[1] + d[1] - o[1]) < 0.1);
      taken.add(k);
      if (ends[e]![giver[e]!] === s) hydrogens.push(inLayer[k]!);
    }
    // the rest of the two hydrogens: the outward arm and the arms toward missing neighbours, in random order
    const free: V3[] = [outward, ...inLayer.filter((_, k) => !taken.has(k))];
    while (hydrogens.length < 2) hydrogens.push(free.splice(Math.floor(rnd() * free.length), 1)[0]!);
    out.push({ p: [me[0], me[1], me[2]], q: orient(hydrogens[0]!, hydrogens[1]!) });
  }
  return out;
}

/** Put `placed` molecules into the simulation. */
export function addAll(md: WaterMd, placed: readonly Placed[]): void {
  for (const m of placed) md.add(m.p, m.q);
}

/** Loose molecules on a jittered grid inside the rectangle (x0 … x1, y0 … y1), random orientations. */
export function scatter(count: number, rect: readonly [number, number, number, number], rnd: () => number): Placed[] {
  const [x0, y0, x1, y1] = rect;
  const nx = Math.max(1, Math.round(Math.sqrt((count * (x1 - x0)) / (y1 - y0))));
  const ny = Math.ceil(count / nx);
  const out: Placed[] = [];
  for (let k = 0; k < count; k++) {
    const cx = k % nx, cy = Math.floor(k / nx);
    const x = x0 + ((cx + 0.5 + 0.3 * (rnd() - 0.5)) * (x1 - x0)) / nx;
    const y = y0 + ((cy + 0.5 + 0.3 * (rnd() - 0.5)) * (y1 - y0)) / ny;
    out.push({ p: [x, y, 0], q: randomQuat(rnd) });
  }
  return out;
}
