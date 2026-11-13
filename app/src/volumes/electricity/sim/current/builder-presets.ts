/**
 * Presets of the `series-parallel` constructor (node ids on the 6×4 grid). The document names the presets but
 * not their values; ours reproduce the step's «Цифри і факти» control points:
 * - series: 12 V, two 12 Ω lamps in series → 0,5 A, 3 W each;
 * - parallel: 6 V, two lamps in parallel → 0,5 A each, 1 A total (at 12 V parallel lamps would burn — 12 W > 6 W);
 * - mixed: 12 V, 2 Ω + (6 Ω ∥ 3 Ω) → 3 A, 6 V on 2 Ω, branches 1 A / 2 A;
 * - garland: 12 V, two lamps in series (the «перегоріти» button burns one → both go dark);
 * - divider: 12 V, 4 Ω + 2 Ω → 2 A, 8 V + 4 V.
 */
import { gridNode as n, type Part } from './builder';

export type BuilderPresetId = 'series' | 'parallel' | 'mixed' | 'garland' | 'divider';

const src = (emfV: number): Part => ({ id: 'V1', kind: 'source', a: n(0, 0), b: n(0, 3), emfV });

export const BUILDER_PRESETS: Readonly<Record<BuilderPresetId, readonly Part[]>> = {
  series: [
    src(12),
    { id: 'L1', kind: 'lamp', a: n(0, 0), b: n(2, 0) },
    { id: 'L2', kind: 'lamp', a: n(2, 0), b: n(4, 0) },
    { id: 'W1', kind: 'wire', a: n(4, 0), b: n(4, 3) },
    { id: 'W2', kind: 'wire', a: n(4, 3), b: n(0, 3) },
  ],
  parallel: [
    src(6),
    { id: 'W1', kind: 'wire', a: n(0, 0), b: n(2, 0) },
    { id: 'L1', kind: 'lamp', a: n(2, 0), b: n(2, 3) },
    { id: 'W2', kind: 'wire', a: n(2, 0), b: n(4, 0) },
    { id: 'L2', kind: 'lamp', a: n(4, 0), b: n(4, 3) },
    { id: 'W3', kind: 'wire', a: n(4, 3), b: n(2, 3) },
    { id: 'W4', kind: 'wire', a: n(2, 3), b: n(0, 3) },
  ],
  mixed: [
    src(12),
    { id: 'R1', kind: 'resistor', a: n(0, 0), b: n(2, 0), resistanceOhm: 2 },
    { id: 'R2', kind: 'resistor', a: n(2, 0), b: n(2, 3), resistanceOhm: 6 },
    { id: 'W1', kind: 'wire', a: n(2, 0), b: n(4, 0) },
    { id: 'R3', kind: 'resistor', a: n(4, 0), b: n(4, 3), resistanceOhm: 3 },
    { id: 'W2', kind: 'wire', a: n(4, 3), b: n(2, 3) },
    { id: 'W3', kind: 'wire', a: n(2, 3), b: n(0, 3) },
  ],
  garland: [
    src(12),
    { id: 'L1', kind: 'lamp', a: n(0, 0), b: n(2, 0) },
    { id: 'L2', kind: 'lamp', a: n(2, 0), b: n(4, 0) },
    { id: 'S1', kind: 'switch', a: n(4, 0), b: n(4, 3), closed: true },
    { id: 'W1', kind: 'wire', a: n(4, 3), b: n(0, 3) },
  ],
  divider: [
    src(12),
    { id: 'R1', kind: 'resistor', a: n(0, 0), b: n(3, 0), resistanceOhm: 4 },
    { id: 'R2', kind: 'resistor', a: n(3, 0), b: n(3, 3), resistanceOhm: 2 },
    { id: 'W1', kind: 'wire', a: n(3, 3), b: n(0, 3) },
  ],
};

/** Re-enable tripped sources after the user removed the short. */
export const resetSources = (parts: readonly Part[]): Part[] => parts.map((p) => (p.kind === 'source' ? { ...p, tripped: false } : p));
