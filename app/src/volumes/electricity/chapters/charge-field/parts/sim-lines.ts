/**
 * Field lines of the simulation (`traceFieldLines`: RK4 streamlines in metres on the table plane) drawn with
 * the fx ribbon renderer — `amber`, hue kept under bloom, chevron dashes running from «+» to «−».
 */
import { Vector3 } from 'three';
import { RibbonLines } from '@/fx';
import type { Streamline } from '@electricity/sim/charge-field';
import { SEMANTIC } from '@/style';
import { CHARGE_Y, M } from '../layout';

export interface SimLines {
  lines: RibbonLines;
  /**
   * Show these streamlines. `reversed`: the sim traced them against the field (no positive charge on the
   * table), so the points are flipped to keep the dashes running along E. `lift(x, z)` gives the height (scene
   * units) of a point — flat by default, the landscape in step 4.
   */
  set(
    streamlines: readonly Streamline[],
    reversed?: boolean,
    lift?: (xM: number, zM: number) => number,
  ): void;
}

export function createSimLines(o: { capacity?: number; width?: number } = {}): SimLines {
  const capacity = o.capacity ?? 20000;
  const lines = new RibbonLines({
    capacity,
    color: SEMANTIC.fieldE,
    width: o.width ?? 0.05,
    intensity: 1.25,
    dashRepeat: 1.5,
    dashSpeed: 0.9,
    dashStrength: 0.7,
    base: 0.45,
    endFade: [0.02, 0.06],
    keepHue: true,
  });
  lines.name = 'sim-field-lines';
  lines.frustumCulled = false;
  lines.renderOrder = 3; // over the landscape sheet of step 4
  return {
    lines,
    set(streamlines, reversed = false, lift) {
      // the sim steps 1,5 mm (0,45 mm near charges): keep every 2nd point far from the ends, it is plenty
      const total = streamlines.reduce((n, s) => n + s.points.length, 0);
      const stride = Math.max(2, Math.ceil((total * 1.05) / capacity));
      const out = streamlines.map((s) => {
        const points: Vector3[] = [];
        const n = s.points.length;
        for (let i = 0; i < n; i++) {
          if (i % stride !== 0 && i !== n - 1) continue;
          const p = s.points[reversed ? n - 1 - i : i]!;
          points.push(new Vector3(p.x * M, lift ? lift(p.x, p.z) : CHARGE_Y, p.z * M));
        }
        return { points };
      });
      lines.setLines(out.filter((l) => l.points.length > 1));
    },
  };
}
