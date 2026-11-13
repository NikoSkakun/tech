/**
 * Slider value mapping (pure, unit-tested): track position t ∈ [0, 1] ⇄ value, for linear and logarithmic
 * scales, with step rounding, discrete stops and magnetic snap points.
 */
export interface SliderScale {
  min: number;
  max: number;
  /** `log` needs min > 0 (e.g. 0,05…1000 Ω, 10¹²…10¹⁹). Default `linear`. */
  scale?: 'linear' | 'log';
  /** Rounding step (linear: in value units; log: values are rounded to this many significant digits). */
  step?: number;
  /** Only these values are allowed (a "wheel" with fixed stops). Overrides `step`. */
  stops?: readonly number[];
  /** Magnetic values: the knob snaps to them when within `snapRange` of the track. */
  snaps?: readonly number[];
  /** Snap distance as a fraction of the track. Default 0.025. */
  snapRange?: number;
}

const clamp01 = (t: number): number => Math.min(Math.max(t, 0), 1);

/** Value → track position 0…1. */
export function valueToT(s: SliderScale, value: number): number {
  if (s.max === s.min) return 0;
  if (s.scale === 'log') {
    const lo = Math.log(Math.max(s.min, Number.MIN_VALUE));
    const hi = Math.log(Math.max(s.max, Number.MIN_VALUE));
    return clamp01((Math.log(Math.max(value, Number.MIN_VALUE)) - lo) / (hi - lo));
  }
  return clamp01((value - s.min) / (s.max - s.min));
}

/** Track position → raw (unrounded) value. */
export function tToRaw(s: SliderScale, t: number): number {
  const k = clamp01(t);
  if (s.scale === 'log') return s.min * Math.pow(s.max / s.min, k);
  return s.min + (s.max - s.min) * k;
}

function roundSig(v: number, digits: number): number {
  if (v === 0) return 0;
  const e = Math.pow(10, digits - 1 - Math.floor(Math.log10(Math.abs(v))));
  return Math.round(v * e) / e;
}

/** Apply stops / snaps / step and clamp to the range. */
export function quantize(s: SliderScale, raw: number): number {
  const lo = Math.min(s.min, s.max);
  const hi = Math.max(s.min, s.max);
  let v = Math.min(Math.max(raw, lo), hi);
  if (s.stops && s.stops.length > 0) {
    const t = valueToT(s, v);
    let best = s.stops[0]!;
    for (const stop of s.stops)
      if (Math.abs(valueToT(s, stop) - t) < Math.abs(valueToT(s, best) - t)) best = stop;
    return best;
  }
  if (s.snaps) {
    const t = valueToT(s, v);
    const range = s.snapRange ?? 0.025;
    for (const snap of s.snaps) if (Math.abs(valueToT(s, snap) - t) <= range) return snap;
  }
  if (s.step && s.step > 0) {
    if (s.scale === 'log') v = roundSig(v, Math.max(1, Math.round(s.step)));
    else v = s.min + Math.round((v - s.min) / s.step) * s.step;
    // kill float noise like 0.30000000000000004
    v = Number(v.toPrecision(12));
  }
  return Math.min(Math.max(v, lo), hi);
}

/** Track position → final value. */
export function tToValue(s: SliderScale, t: number): number {
  return quantize(s, tToRaw(s, t));
}

/**
 * Keyboard / wheel nudge: move by `count` steps (linear: `step` or 1 % of the range; log and stops: along the
 * track / to the neighbouring stop).
 */
export function nudge(s: SliderScale, value: number, count: number): number {
  if (s.stops && s.stops.length > 0) {
    const sorted = [...s.stops].sort((a, b) => valueToT(s, a) - valueToT(s, b));
    let i = 0;
    for (let k = 0; k < sorted.length; k++)
      if (Math.abs(sorted[k]! - value) < Math.abs(sorted[i]! - value)) i = k;
    return sorted[Math.min(Math.max(i + Math.sign(count), 0), sorted.length - 1)]!;
  }
  if (s.scale === 'log' || !s.step) {
    const next = tToRaw(s, valueToT(s, value) + count * 0.01);
    return quantize({ ...s, snaps: undefined }, next);
  }
  return quantize({ ...s, snaps: undefined }, value + count * s.step);
}

/** "Nice" tick values for an axis or a slider scale (decades for log). */
export function niceTicks(min: number, max: number, target = 5, log = false): number[] {
  const out: number[] = [];
  if (log) {
    for (let e = Math.ceil(Math.log10(min) - 1e-9); e <= Math.floor(Math.log10(max) + 1e-9); e++)
      out.push(10 ** e);
    return out;
  }
  const span = max - min;
  if (!(span > 0)) return [min];
  const rough = span / Math.max(target, 1);
  const mag = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / mag;
  const step = (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * mag;
  for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + step * 1e-6; v += step)
    out.push(Number(v.toPrecision(12)));
  return out;
}
