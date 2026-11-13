/**
 * Shade of the hero module in step 7: cells painted by hand (0 / 1) combined with the silhouettes'
 * area-weighted shade (`shadeFromShapes`). Overlaps combine multiplicatively in transmitted light, as in the
 * simulation: s = 1 − (1 − s_paint)·(1 − s_shapes). No three.js here.
 */
import { HALF_CELLS, shadeFromShapes, type ShadowShape } from '@electricity/sim/lab-pv';

export function createShadeState() {
  const painted = new Float64Array(HALF_CELLS);
  const total = new Float64Array(HALF_CELLS);
  let shapes: readonly ShadowShape[] = [];
  let version = 0;
  const rebuild = (): void => {
    const fromShapes = shapes.length ? shadeFromShapes(shapes) : null;
    for (let i = 0; i < HALF_CELLS; i++) total[i] = 1 - (1 - painted[i]!) * (1 - (fromShapes?.[i] ?? 0));
    version++;
  };
  return {
    /** Shade factor 0…1 per half-cell — give it to the bench model. */
    total,
    get version() {
      return version;
    },
    /** Number of half-cells with any shade. */
    count(): number {
      let n = 0;
      for (let i = 0; i < HALF_CELLS; i++) if (total[i]! > 0.02) n++;
      return n;
    },
    isPainted: (cell: number): boolean => painted[cell]! > 0.5,
    /** Paint or clear one half-cell; returns true when something changed. */
    paint(cell: number, on: boolean): boolean {
      if (cell < 0 || cell >= HALF_CELLS || painted[cell]! > 0.5 === on) return false;
      painted[cell] = on ? 1 : 0;
      rebuild();
      return true;
    },
    setShapes(next: readonly ShadowShape[]): void {
      shapes = next;
      rebuild();
    },
    clear(): void {
      painted.fill(0);
      shapes = [];
      rebuild();
    },
  };
}
export type ShadeState = ReturnType<typeof createShadeState>;
