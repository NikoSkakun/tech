/**
 * Where the focus ring lies on screen (CSS px, y down) — pure functions, so the rule is testable:
 *
 * - while the whole lens is in the frame the band hugs the bottom of its rim (a small gap outside the ring);
 * - as the lens grows the band rides down with the rim until its outer edge meets `floor` (the line above the
 *   navigator); from there it stays pinned on that line and the lens grows on past the frame — the arc keeps the
 *   curvature of the rim up to `cap`, then stays an arc of radius `cap` (never a straight bar). No jump anywhere:
 *   every quantity is continuous in the lens's circle, and a lens that cannot be projected (behind the camera) is
 *   the limit of a growing one.
 */
export interface RingCircle {
  /** Centre and radius of the lens's rim on screen, px. */
  cx: number;
  cy: number;
  r: number;
}

export interface RingFrame {
  width: number;
  height: number;
  /** The band's outer edge stays above this line (px from the top). */
  floor: number;
  /** The free area's horizontal extent (left of the step panel) and its centre. */
  left: number;
  right: number;
  freeX: number;
}

export interface RingLayout {
  cx: number;
  cy: number;
  /** Radius of the band's inner edge (the lens edge), px. */
  r: number;
  /** Band thickness, px. */
  t: number;
  /** Half the arc's length along its inner edge, px. */
  half: number;
  /** 0 riding the lens … 1 pinned well past it (the cyan rim line's strength). */
  pinned: number;
}

const clamp = (x: number, a: number, b: number): number => Math.min(Math.max(x, a), b);
const smooth = (a: number, b: number, x: number): number => {
  const k = clamp((x - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};

/** Gap between the lens's rim and the band, px. */
const GAP = 3;
/** Half the arc as an angle (rad) while it hugs a small lens. */
const SPAN = 1.15;

export function ringThickness(height: number): number {
  return clamp(height * 0.04, 22, 40);
}

export function ringLayout(lens: RingCircle | null, f: RingFrame): RingLayout {
  const t = ringThickness(f.height);
  const cap = 1.15 * f.height;
  const big = lens === null || !Number.isFinite(lens.r) || lens.r + GAP >= cap;
  const r = big ? cap : lens.r + GAP;
  // a big lens's centre drifts to the free area's centre (where the camera keeps its target)
  const w = big ? 1 : smooth(0.55 * cap, cap, lens.r);
  const lowest = f.floor - t - r;
  const natural = lens === null ? Number.POSITIVE_INFINITY : lens.cy;
  const cy = Math.min(natural, lowest);
  const pinned = big ? 1 : smooth(0, 0.12 * f.height, natural - lowest);
  const half = Math.min(r * SPAN, 0.42 * (f.right - f.left), 0.34 * f.height);
  const x = big ? f.freeX : lens.cx + (f.freeX - lens.cx) * w;
  const cx = clamp(x, f.left + half + t, Math.max(f.right - half - t, f.left + half + t));
  return { cx, cy, r, t, half, pinned };
}

/** Screen point at arc coordinate s (px along the inner edge from the middle) and v (across, 0 … 1). */
export function ringPoint(l: RingLayout, s: number, v: number, out = { x: 0, y: 0 }): { x: number; y: number } {
  const a = s / l.r;
  const rr = l.r + v * l.t;
  out.x = l.cx + rr * Math.sin(a);
  out.y = l.cy + rr * Math.cos(a);
  return out;
}

/** Arc coordinate s of a screen point (its angle about the centre, along the inner edge). */
export function ringS(l: RingLayout, x: number, y: number): number {
  return Math.atan2(x - l.cx, y - l.cy) * l.r;
}

/** Padding at each end of the track (the marks never sit on the rounded ends), px. */
export const trackPad = (l: RingLayout): number => 0.75 * l.t;

/** s of a value on the track (min at the left end, max at the right). */
export function valueS(l: RingLayout, value: number, min: number, max: number): number {
  const k = clamp((value - min) / (max - min), 0, 1);
  const p = trackPad(l);
  return -l.half + p + k * 2 * (l.half - p);
}

/** Value change for a move of `ds` px along the arc (the whole track = the whole range). */
export function valuePerPx(l: RingLayout, min: number, max: number): number {
  return (max - min) / Math.max(2 * (l.half - trackPad(l)), 1);
}
