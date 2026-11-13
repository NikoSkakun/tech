/**
 * uk-locale number / unit formatting (CURRICULUM language rule, DECISIONS §3, §23):
 * decimal comma, thousands separated by a no-break space, a no-break space between number and unit,
 * `×10ⁿ` for powers of ten, a real minus sign, SI unit symbols in Latin.
 */

/** U+00A0 — keeps number and unit (and thousands groups) on one line. */
export const NBSP = '\u00a0';
const MINUS = '−';
const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻',
}; // prettier-ignore

export interface NumberFormat {
  /** Fixed number of decimals. Default: up to `maxDigits` significant decimals, trailing zeros dropped. */
  digits?: number;
  /** Upper bound of decimals when `digits` is not given. Default 2. */
  maxDigits?: number;
  /** Show `+` for positive values. */
  sign?: boolean;
  /** Group thousands (1 250 000). Default true for |value| ≥ 10 000. */
  group?: boolean;
}

/** `1234.5` → `1 234,5`. */
export function fmtNumber(value: number, opts: NumberFormat = {}): string {
  if (!Number.isFinite(value)) return value > 0 ? '∞' : Number.isNaN(value) ? '—' : `${MINUS}∞`;
  const abs = Math.abs(value);
  let text =
    opts.digits !== undefined ? abs.toFixed(opts.digits) : String(Number(abs.toFixed(opts.maxDigits ?? 2)));
  const [int = '0', frac] = text.split('.');
  const group = opts.group ?? abs >= 10000;
  const grouped = group ? int.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP) : int;
  text = frac ? `${grouped},${frac}` : grouped;
  const zero = Number(abs.toFixed(opts.digits ?? opts.maxDigits ?? 2)) === 0;
  if (value < 0 && !zero) return MINUS + text;
  return opts.sign && !zero ? `+${text}` : text;
}

/** `(230, 'V')` → `230 V` with a no-break space; `%` and `°` units follow the same rule (DECISIONS §23). */
export function fmtUnit(value: number, unit: string, opts: NumberFormat = {}): string {
  const n = fmtNumber(value, opts);
  return unit ? `${n}${NBSP}${unit}` : n;
}

/** Integer → Unicode superscript (`-19` → `⁻¹⁹`). */
export function superscript(n: number): string {
  return String(Math.round(n))
    .split('')
    .map((c) => SUPERSCRIPT[c] ?? c)
    .join('');
}

/** Scientific notation the way the course writes it: `8.5e22` → `8,5×10²²`. */
export function fmtSci(value: number, digits = 1): string {
  if (value === 0 || !Number.isFinite(value)) return fmtNumber(value);
  const exp = Math.floor(Math.log10(Math.abs(value)));
  const mant = value / 10 ** exp;
  const m = fmtNumber(mant, { maxDigits: digits });
  return m === '1' ? `10${superscript(exp)}` : `${m}×10${superscript(exp)}`;
}

/** Power of ten label for scale chips: `-10` → `10⁻¹⁰ m`. */
export function fmtScale(exp: number, unit = 'm'): string {
  return `10${superscript(exp)}${NBSP}${unit}`;
}

const SI_PREFIXES: readonly [number, string][] = [
  [1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'μ'], [1e-9, 'n'], [1e-12, 'p'],
]; // prettier-ignore

/** Pick an SI prefix: `(1500, 'W')` → `1,5 kW`, `(0.0032, 'A')` → `3,2 mA` (Greek μ, DECISIONS §32). */
export function fmtSI(value: number, unit: string, opts: NumberFormat = {}): string {
  const abs = Math.abs(value);
  if (abs === 0 || !Number.isFinite(abs)) return fmtUnit(value, unit, opts);
  const hit = SI_PREFIXES.find(([f]) => abs >= f * 0.9995) ?? SI_PREFIXES[SI_PREFIXES.length - 1]!;
  return fmtUnit(value / hit[0], hit[1] + unit, {
    maxDigits: abs / hit[0] >= 100 ? 0 : abs / hit[0] >= 10 ? 1 : 2,
    ...opts,
  });
}

/** `(0.983)` → `98,3 %`. */
export function fmtPercent(fraction: number, digits = 0): string {
  return fmtUnit(fraction * 100, '%', { digits });
}

/** Range with an en dash and one unit: `(0.78, 0.83)` → `0,78–0,83`. */
export function fmtRange(a: number, b: number, unit = '', opts: NumberFormat = {}): string {
  const text = `${fmtNumber(a, opts)}–${fmtNumber(b, opts)}`;
  return unit ? `${text}${NBSP}${unit}` : text;
}

/** Seconds → `1:05` / `2 h 15 min` style durations for timers and reading time. */
export function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 3600) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return m ? `${h}${NBSP}h ${m}${NBSP}min` : `${h}${NBSP}h`;
}

/** Ukrainian plural form: `plural(5, ['крок', 'кроки', 'кроків'])` → `кроків`. */
export function plural(n: number, forms: readonly [string, string, string]): string {
  const a = Math.abs(Math.round(n)) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b === 1) return forms[0];
  if (b >= 2 && b <= 4) return forms[1];
  return forms[2];
}
