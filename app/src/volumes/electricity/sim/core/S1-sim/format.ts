/**
 * Numeric display helpers that are physics, not typography: SI prefix selection and duration bucketing.
 * Locale formatting (decimal comma, non-breaking spaces) is the UI's job.
 */

export interface SiScaled {
  /** Value divided by 10^exponent. */
  value: number;
  /** SI prefix symbol (Latin; μ is U+03BC per DECISIONS §32). */
  prefix: string;
  exponent: number;
}

const PREFIXES: readonly [number, string][] = [
  [-18, 'a'],
  [-15, 'f'],
  [-12, 'p'],
  [-9, 'n'],
  [-6, 'μ'],
  [-3, 'm'],
  [0, ''],
  [3, 'k'],
  [6, 'M'],
  [9, 'G'],
  [12, 'T'],
];

/**
 * Picks the SI prefix so that 1 ≤ |value| < 1000 (clamped to the a…T range). Zero → no prefix.
 * `allowed` restricts the choice (e.g. `['p','n','μ','m','']` for currents).
 */
export function siPrefix(value: number, allowed?: readonly string[]): SiScaled {
  const list = allowed ? PREFIXES.filter(([, p]) => allowed.includes(p)) : PREFIXES;
  if (value === 0 || !Number.isFinite(value) || list.length === 0) return { value, prefix: '', exponent: 0 };
  const e = Math.log10(Math.abs(value));
  let chosen = list[0];
  for (const entry of list) if (e >= entry[0] - 1e-12) chosen = entry;
  return { value: value / 10 ** chosen[0], prefix: chosen[1], exponent: chosen[0] };
}

export type DurationUnit = 's' | 'min' | 'h' | 'd';

/** Splits a duration into the most readable unit (`current` §2: «с / хв / год / доби»). */
export function durationParts(seconds: number): { value: number; unit: DurationUnit } {
  const s = Math.abs(seconds);
  if (s < 60) return { value: seconds, unit: 's' };
  if (s < 3600) return { value: seconds / 60, unit: 'min' };
  if (s < 86400) return { value: seconds / 3600, unit: 'h' };
  return { value: seconds / 86400, unit: 'd' };
}

/** Mantissa/exponent split for scientific notation (`2,2×10⁻⁷`). */
export function scientific(value: number): { mantissa: number; exponent: number } {
  if (value === 0 || !Number.isFinite(value)) return { mantissa: value, exponent: 0 };
  let exponent = Math.floor(Math.log10(Math.abs(value)));
  let mantissa = value / 10 ** exponent;
  // guard against 9.9999999 → 10 after rounding by the caller
  if (Math.abs(mantissa) >= 10) {
    mantissa /= 10;
    exponent += 1;
  }
  return { mantissa, exponent };
}
