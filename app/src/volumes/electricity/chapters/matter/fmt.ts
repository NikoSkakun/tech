/** Number formatting shared by the steps, on top of `@/content`. */
import { fmtSci } from '@/content';

/**
 * Scientific notation that never prints a mantissa of 10 (`9,99×10³` rounded must become `1,0×10⁴`, not
 * `10×10³`): the value is first rounded to the shown significant digits.
 */
export const sci = (x: number, digits = 1): string =>
  x === 0 ? '0' : fmtSci(Number(x.toPrecision(digits + 1)), digits);
