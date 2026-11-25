/**
 * A value the reader scrubs (UI_API §3.3): the thumb is `target`, the scene shows `shown`. While dragged the scene
 * follows the thumb exactly; a click on the track glides there on a critically damped spring (no kick at the start,
 * no overshoot), so every frame stays a pure function of `shown` and a slider can run both ways.
 */
export interface Scrub {
  target: number;
  shown: number;
  drag: boolean;
  /** Time constant of the glide (s). */
  tau: number;
  /** Speed of the glide (per s). */
  v: number;
}

export function scrub(value = 0, tau = 0.3): Scrub {
  return { target: value, shown: value, drag: false, tau, v: 0 };
}

/** One frame of the glide toward `target`. */
export function glide(s: Scrub, dt: number): void {
  if (s.drag) {
    s.shown = s.target;
    s.v = 0;
    return;
  }
  const w = 1 / s.tau;
  const h = Math.min(dt, 1 / 30);
  s.v += (w * w * (s.target - s.shown) - 2 * w * s.v) * h;
  s.shown += s.v * h;
  if (Math.abs(s.target - s.shown) < 1e-4 && Math.abs(s.v) < 1e-3) {
    s.shown = s.target;
    s.v = 0;
  }
}

/** Put the value there at once (deep links, step entries). */
export function snap(s: Scrub, value = s.target): void {
  s.target = s.shown = value;
  s.v = 0;
}

export const clamp01 = (v: number): number => Math.min(Math.max(v, 0), 1);

/** Smoothstep of `v` between `a` and `b`. */
export function smooth(a: number, b: number, v: number): number {
  const k = clamp01((v - a) / (b - a));
  return k * k * (3 - 2 * k);
}

/** Moves `value` toward `to` by at most `rate × dt` (a plain linear follow for things that are not scrubbed). */
export function approach(value: number, to: number, rate: number, dt: number): number {
  const d = to - value;
  const step = rate * dt;
  return Math.abs(d) <= step ? to : value + Math.sign(d) * step;
}
