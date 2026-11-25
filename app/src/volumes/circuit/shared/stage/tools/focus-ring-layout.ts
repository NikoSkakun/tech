/**
 * Where the focus ring lies on screen (CSS px, y down) — a pure function, so the rule is testable. The ring is
 * separate from the lens (the owner, 2026-11-25: «зроби контрол зуму все ж окремо від лупи» → «Дуга внизу
 * завжди»): a fixed arc at the bottom of the free area, above the navigator, centred where the camera keeps its
 * target. Its size follows the viewport only; the lens, its zoom and the camera never move it. Below the band stays
 * room for the names of the marks (`under`), so nothing of it stands over the picture above the arc.
 */
export interface RingFrame {
  width: number;
  height: number;
  /** The lowest line the ring and its mark names may reach (px from the top; above the navigator). */
  floor: number;
  /** Room kept under the band for the marks' names, px. */
  under: number;
  /** The free area's horizontal extent (left of the step panel) and its centre. */
  left: number;
  right: number;
  freeX: number;
}

export interface RingLayout {
  cx: number;
  cy: number;
  /** Radius of the band's inner edge, px. */
  r: number;
  /** Band thickness, px. */
  t: number;
  /** Half the arc's length along its inner edge, px. */
  half: number;
}

const clamp = (x: number, a: number, b: number): number => Math.min(Math.max(x, a), b);

/** The arc's radius as a share of the frame's height: a gentle curve, never a straight bar. */
const RADIUS = 1.15;

export function ringThickness(height: number): number {
  return clamp(height * 0.04, 22, 40);
}

export function ringLayout(f: RingFrame): RingLayout {
  const t = ringThickness(f.height);
  const r = RADIUS * f.height;
  const half = Math.min(r * 1.15, 0.42 * (f.right - f.left), 0.34 * f.height);
  const cy = f.floor - f.under - t - r;
  const cx = clamp(f.freeX, f.left + half + t, Math.max(f.right - half - t, f.left + half + t));
  return { cx, cy, r, t, half };
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
