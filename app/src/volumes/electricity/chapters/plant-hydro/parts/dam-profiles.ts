/**
 * Cross-sections of the four dam types of step 3, in real metres (x downstream, y up, origin at the foot of
 * the upstream face), and the resampling that lets one profile morph into another: every polygon is walked
 * counter-clockwise from the upstream foot and resampled to the same number of points by arc length.
 * Pure geometry — no three.js — so it is unit-tested (`__tests__/dam-profiles.test.ts`).
 */
export type DamType = 'gravity' | 'arch' | 'embankment' | 'runOfRiver';
export type Pt = readonly [number, number];

/** Demonstration heights of the document: 100 m, the run-of-river weir 15 m. */
export const DAM_HEIGHT: Record<DamType, number> = {
  gravity: 100,
  arch: 100,
  embankment: 100,
  runOfRiver: 15,
};

/** Counter-clockwise outlines starting at the upstream foot; the last point is the upstream crest corner. */
export const PROFILES: Record<DamType, readonly Pt[]> = {
  // a massive concrete wedge: base ≈ 0,8 × height
  gravity: [
    [0, 0],
    [80, 0],
    [10, 90],
    [10, 100],
    [0, 100],
  ],
  // a thin wall: its section is a slender wedge (the arch carries the load into the banks)
  arch: [
    [0, 0],
    [24, 0],
    [7, 100],
    [0, 100],
  ],
  // a wide embankment with slopes ≈ 1 : 1,3 and a 10 m crest
  embankment: [
    [-130, 0],
    [140, 0],
    [10, 100],
    [0, 100],
  ],
  // a low weir that only backs the river up
  runOfRiver: [
    [0, 0],
    [22, 0],
    [12, 15],
    [0, 15],
  ],
};

/** Clay core of the embankment; the other types get it collapsed to a sliver hidden inside the body. */
export const CORE: Record<DamType, readonly Pt[]> = {
  gravity: [
    [4, 2],
    [5, 2],
    [5, 3],
    [4, 3],
  ],
  arch: [
    [3, 2],
    [4, 2],
    [4, 3],
    [3, 3],
  ],
  embankment: [
    [-14, 0],
    [24, 0],
    [8, 97],
    [2, 97],
  ],
  runOfRiver: [
    [4, 1],
    [5, 1],
    [5, 2],
    [4, 2],
  ],
};

/** Resample a closed polygon to `n` points equally spaced along its perimeter, starting at its first point. */
export function resample(poly: readonly Pt[], n: number): [number, number][] {
  const edges = poly.map((p, i) => {
    const q = poly[(i + 1) % poly.length]!;
    return { p, q, len: Math.hypot(q[0] - p[0], q[1] - p[1]) };
  });
  const total = edges.reduce((s, e) => s + e.len, 0);
  const out: [number, number][] = [];
  let e = 0;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const s = (i / n) * total;
    while (e < edges.length - 1 && acc + edges[e]!.len < s) acc += edges[e++]!.len;
    const { p, q, len } = edges[e]!;
    const t = len > 0 ? (s - acc) / len : 0;
    out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
  }
  return out;
}

/** Point-wise blend of two resampled polygons. */
export function blend(a: readonly Pt[], b: readonly Pt[], t: number): [number, number][] {
  return a.map((p, i) => [p[0] + (b[i]![0] - p[0]) * t, p[1] + (b[i]![1] - p[1]) * t]);
}

/** x of the upstream face at height y for a profile (the closing edge: last point → first point). */
export function upstreamFaceX(profile: readonly Pt[], y: number): number {
  const foot = profile[0]!;
  const top = profile[profile.length - 1]!;
  const t = Math.min(1, Math.max(0, (y - foot[1]) / (top[1] - foot[1] || 1)));
  return foot[0] + (top[0] - foot[0]) * t;
}
