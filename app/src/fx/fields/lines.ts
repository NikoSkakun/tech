/**
 * FieldLines — elegant flowing field lines for any vector field: integrates streamlines from seeds and draws
 * them as glowing ribbons whose chevron dashes run along the field direction. Colours follow the semantic
 * code: electric field **E** `amber`, magnetic field **B** `magenta`. They use the ribbon's `keepHue` by default (the
 * line core covers the backdrop and keeps its hue under bloom); pass `keepHue: false` for the old additive look.
 */
import type { Vector3 } from 'three';
import { SEMANTIC, type ColorLike } from '@/style';
import { RibbonLines, type RibbonOptions } from '../core/ribbon';
import type { VectorField } from './sources';
import { streamlines, type Streamline, type StreamlineOptions } from './streamlines';

export interface FieldLinesOptions extends Omit<RibbonOptions, 'capacity' | 'color'> {
  field: VectorField;
  seeds: readonly Vector3[];
  /** `E` (amber) or `B` (magenta); or pass `color`. Default `E`. */
  kind?: 'E' | 'B';
  color?: ColorLike;
  /** Integration options (step, maxLength, bounds, stops, bothWays…). */
  trace?: StreamlineOptions;
  /**
   * Map field magnitude to brightness: 0 = uniform lines, 1 = brightness ∝ log of the magnitude
   * (strong field near sources glows, far field dims). Default 0.5.
   */
  magnitudeContrast?: number;
  /** Point capacity. Default: enough for the first integration × 1.5. */
  capacity?: number;
}

function brightness(line: Streamline, contrast: number, lo: number, hi: number): number[] | number {
  if (contrast <= 0 || hi <= lo) return 1;
  return line.magnitude.map((m) => {
    const t = (Math.log(Math.max(m, 1e-9)) - lo) / (hi - lo);
    return 1 - contrast + contrast * (0.25 + 0.95 * Math.min(Math.max(t, 0), 1));
  });
}

/** Field lines of a vector field. Create through `createFieldLines()`. */
export class FieldLines extends RibbonLines {
  /** The most recent integration result (for placing labels, arrows, probes). */
  lines: Streamline[] = [];
  private field: VectorField;
  private seeds: readonly Vector3[];
  private readonly trace: StreamlineOptions;
  private readonly contrast: number;

  constructor(o: FieldLinesOptions) {
    const first = streamlines(o.field, o.seeds, o.trace);
    const points = first.reduce((n, l) => n + l.points.length + 1, 0);
    super({
      ...o,
      capacity: o.capacity ?? Math.ceil(points * 1.5) + 64,
      color: o.color ?? (o.kind === 'B' ? SEMANTIC.fieldB : SEMANTIC.fieldE),
      // semantic hue first: amber / magenta must not wash out to peach / pink over the indigo backdrop
      keepHue: o.keepHue ?? true,
    });
    this.name = `field-lines:${o.kind ?? 'E'}`;
    this.field = o.field;
    this.seeds = o.seeds;
    this.trace = o.trace ?? {};
    this.contrast = o.magnitudeContrast ?? 0.5;
    this.apply(first);
  }

  /**
   * Re-integrate (call when sources moved; pass a new field and / or seeds). Cheap enough to run every
   * frame for a handful of point charges; for Biot–Savart fields do it only on change.
   */
  refresh(field?: VectorField, seeds?: readonly Vector3[]): void {
    if (field) this.field = field;
    if (seeds) this.seeds = seeds;
    this.apply(streamlines(this.field, this.seeds, this.trace));
  }

  private apply(lines: Streamline[]): void {
    this.lines = lines;
    // robust magnitude range over all lines: 10th…95th percentile of log |F|
    const logs: number[] = [];
    for (const l of lines) for (let i = 0; i < l.magnitude.length; i += 4) logs.push(Math.log(Math.max(l.magnitude[i]!, 1e-9)));
    logs.sort((a, b) => a - b);
    const lo = logs[Math.floor(logs.length * 0.1)] ?? 0;
    const hi = logs[Math.floor(logs.length * 0.95)] ?? 1;
    this.setLines(
      lines.map((l) => ({ points: l.points, closed: l.closed, brightness: brightness(l, this.contrast, lo, hi) })),
    );
  }
}

/** Field lines for a vector field (see `FieldLinesOptions`). */
export function createFieldLines(o: FieldLinesOptions): FieldLines {
  return new FieldLines(o);
}
