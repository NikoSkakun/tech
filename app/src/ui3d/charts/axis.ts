/**
 * Chart axis: linear or logarithmic mapping value → 0…1, "nice" ticks and uk-formatted tick labels.
 */
import { fmtNumber, superscript } from '@/content/format';
import { niceTicks } from '../widgets/slider-scale';

export interface AxisSpec {
  min: number;
  max: number;
  /** Logarithmic axis (min > 0): decades become ticks, labelled 10ⁿ. */
  log?: boolean;
  /** Axis title, e.g. `U, V` (quantity symbol, then the unit — international notation). */
  label?: string;
  /** Explicit tick values (default: automatic). */
  ticks?: readonly number[];
  /** Approximate number of automatic ticks. Default 5. */
  tickCount?: number;
  /** Custom tick text. */
  format?: (value: number) => string;
  /** Hide tick labels (sparkline-like charts). */
  bare?: boolean;
  /**
   * Calendar years: integer ticks, no thousands grouping («2010», not «2 010»). Detected automatically when
   * every tick is an integer between 1000 and 2999; set `false` to force grouping.
   */
  years?: boolean;
}

export class Axis {
  constructor(public spec: AxisSpec) {}

  /** Value → 0…1 along the axis (unclamped: callers clip). */
  t(value: number): number {
    const { min, max, log } = this.spec;
    if (log) {
      const lo = Math.log10(Math.max(min, 1e-300));
      const hi = Math.log10(Math.max(max, 1e-300));
      return (Math.log10(Math.max(value, 1e-300)) - lo) / (hi - lo || 1);
    }
    return (value - min) / (max - min || 1);
  }

  /** 0…1 → value. */
  value(t: number): number {
    const { min, max, log } = this.spec;
    return log ? min * Math.pow(max / min, t) : min + (max - min) * t;
  }

  ticks(): number[] {
    const s = this.spec;
    if (s.ticks) return s.ticks.filter((v) => v >= Math.min(s.min, s.max) && v <= Math.max(s.min, s.max));
    return niceTicks(s.min, s.max, s.tickCount ?? 5, s.log ?? false);
  }

  label(value: number): string {
    const s = this.spec;
    if (s.format) return s.format(value);
    if (s.log) {
      const e = Math.round(Math.log10(value));
      return Math.abs(e) <= 2 ? fmtNumber(value, { maxDigits: 2 }) : `10${superscript(e)}`;
    }
    if (this.isYears()) return String(Math.round(value));
    const span = Math.abs(s.max - s.min);
    return fmtNumber(value, { maxDigits: span >= 20 ? 0 : span >= 2 ? 1 : span >= 0.2 ? 2 : 3 });
  }

  private isYears(): boolean {
    const s = this.spec;
    if (s.years !== undefined) return s.years;
    if (s.log) return false;
    const lo = Math.min(s.min, s.max);
    const hi = Math.max(s.min, s.max);
    return lo >= 1000 && hi <= 2999 && this.ticks().every((v) => Number.isInteger(v));
  }
}
