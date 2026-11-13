/** Number formatting shared by the steps: SI prefixes below pico (aC, fC) come from the sim's `siPrefix`. */
import { fmtNumber, fmtSci, fmtUnit, NBSP } from '@/content';
import { siPrefix } from '@electricity/sim/charge-field';

/** `1.6e-17, 'C'` → `16 aC`; three significant digits, sign optional. */
export function fmtPrefixed(
  value: number,
  unit: string,
  opts: { sign?: boolean; allowed?: readonly string[] } = {},
): string {
  if (value === 0) return fmtUnit(0, unit);
  const s = siPrefix(value, opts.allowed);
  const abs = Math.abs(s.value);
  const maxDigits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return fmtUnit(s.value, s.prefix + unit, { maxDigits, sign: opts.sign });
}

/** Scientific notation with two significant digits and a unit: `1,4×10⁻³ N`. */
export const fmtSciUnit = (value: number, unit: string): string => `${fmtSci(value, 1)}${NBSP}${unit}`;

/**
 * One unit for a whole force scale (chart axis and readout show the same one): millinewtons when the largest
 * force of the scale reaches 1 mN, micronewtons below that.
 */
export function forceScale(maxN: number): { unit: string; perNewton: number } {
  return maxN >= 1e-3 ? { unit: 'mN', perNewton: 1e3 } : { unit: 'μN', perNewton: 1e6 };
}

/** A value in plain notation with two significant digits: `1,4 mN`, `0,36 mN`, `225 mN`. */
export function fmtTwoSig(value: number, unit: string): string {
  const abs = Math.abs(value);
  if (abs === 0) return fmtUnit(0, unit);
  const digits = Math.min(Math.max(1 - Math.floor(Math.log10(abs)), 0), 4);
  return fmtUnit(value, unit, { digits: abs >= 10 ? 0 : digits });
}

/** Integer with thousands groups and an explicit sign. */
export const fmtCount = (n: number, sign = false): string => fmtNumber(n, { digits: 0, group: true, sign });
