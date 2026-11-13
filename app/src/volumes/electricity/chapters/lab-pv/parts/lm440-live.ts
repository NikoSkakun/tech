/**
 * The hero module driven by one model sample: brightness of every half-cell (light × current), the electron
 * "snake" through the six branches and the three bypass routes (density ∝ current), diode glow, hot spots.
 * Everything is a pure function of the sample — no history, so any step can be entered from anywhere.
 */
import { Color, type Group } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createFlow, createHalo } from '@/fx';
import { HALF_CELL_COLS, HALF_CELLS, LM440, halfCellLocation } from '@electricity/sim/lab-pv';
import { col } from '@/style';
import { hotCellOf, type BenchSample } from '../sim-bindings/bench-model';
import { createLm440, type Lm440 } from './lm440';
import { SECTION_COLORS, cellCentre, electronPaths } from './lm440-layout';

export interface LiveLook {
  /** 0…1: how strongly the cells show their section colour. */
  tint?: number;
  /** 0…1: visibility of the electron flow. */
  electrons?: number;
  /** Extra darkening / yellowing of the laminate with age, 0…1 (step 11). */
  age?: number;
  /** Thermal look of the cells: −1 frosty … 0 at 25 °C … +1 at ≈ 85 °C. */
  heat?: number;
}

export interface LiveModule extends Lm440 {
  /** Apply a model sample (or `null` = an unlit, idle module). `t` = engine time. */
  apply(sample: BenchSample | null, t: number, look?: LiveLook): void;
  /** World-space-free centre of a half-cell in the module frame. */
  cellCentre: typeof cellCentre;
}

export function createLiveModule(ctx: ChapterContext): LiveModule {
  const m = createLm440();
  const paths = electronPaths();
  const flow = createFlow(ctx, {
    kind: 'electron',
    paths: paths.map((path, i) => ({ path, weight: i < 6 ? 1 : 0.14 })),
    count: 230,
    radius: 0.011,
    speed: 0.5,
    spread: 0.012,
    endFade: 0.06,
  });
  m.layers.cells.add(flow);
  const halos = [0, 1, 2].map(() => {
    const h = createHalo({ color: 'orange', size: 0.5, intensity: 0, amount: 0.5 });
    (m.layers.cells as Group).add(h);
    return h;
  });
  const palette = {
    ink: col('ink'),
    indigo: col('bg.indigo'),
    blue: col('blue'),
    orange: col('orange'),
    red: col('red'),
    amber: col('amber'),
    sky: col('sky'),
    sections: SECTION_COLORS.map((c) => col(c)),
  };
  const c = new Color();
  const hotAt = new Int16Array(3);

  return {
    ...m,
    cellCentre,
    apply(sample, t, look = {}) {
      const tint = look.tint ?? 0;
      const age = look.age ?? 0;
      const heat = look.heat ?? 0;
      const shade = sample?.input.shade ?? null;
      const g01 = sample ? Math.min(1.2, sample.input.g / 1000) : 0.35;
      hotAt.fill(-1);
      sample?.hot.forEach((h, k) => {
        if (k < 3) hotAt[k] = hotCellOf(h.section, shade);
      });
      for (let i = 0; i < HALF_CELLS; i++) {
        const loc = halfCellLocation(i);
        const light = (1 - Math.min(1, shade?.[i] ?? 0)) * g01;
        const work = sample ? sample.branch[loc.section * 2 + (loc.branch === 'top' ? 0 : 1)]! : 0;
        c.copy(palette.ink).lerp(palette.indigo, 0.25 + 0.6 * Math.min(1, light));
        c.lerp(palette.blue, 0.05 + 0.15 * Math.min(1, light) + 0.14 * work);
        if (tint > 0) c.lerp(palette.sections[loc.section]!, tint * (0.22 + 0.3 * Math.min(1, light)));
        if (age > 0) c.lerp(palette.amber, age * 0.14);
        if (heat > 0) c.lerp(heat > 0.6 ? palette.red : palette.orange, heat * 0.42);
        else if (heat < 0) c.lerp(palette.sky, -heat * 0.3);
        m.cells.setColorAt(i, c);
      }
      halos.forEach((halo, k) => {
        const h = sample?.hot[k];
        const cell = hotAt[k]!;
        if (!h || cell < 0) {
          halo.intensity = 0;
          return;
        }
        const red = h.colour === 'red';
        const level = Math.min(1, h.displayW / 200);
        const pulse = red ? 0.75 + 0.25 * Math.sin(t * 9) : 0.9 + 0.1 * Math.sin(t * 3);
        m.cells.setColorAt(cell, c.copy(red ? palette.red : palette.orange).multiplyScalar(0.7 + 0.3 * pulse));
        cellCentre(cell, halo.position).y += 0.012;
        halo.color.copy(red ? palette.red : palette.orange);
        halo.size = 0.28 + 0.5 * level;
        halo.intensity = (0.5 + 1.3 * level) * pulse;
      });
      if (m.cells.instanceColor) m.cells.instanceColor.needsUpdate = true;
      const i01 = sample ? sample.op.iA / LM440.iscA : 0;
      flow.fade = look.electrons ?? 1;
      flow.speed = 0.12 + 0.75 * i01;
      for (let k = 0; k < 6; k++) flow.setPathDensity(k, sample ? Math.min(1, sample.branch[k]!) : 0);
      for (let s = 0; s < 3; s++) {
        const d = sample ? sample.diode[s]! : 0;
        flow.setPathDensity(6 + s, d > 0.01 ? 1 : 0);
        m.diodes.glow[s]!.intensity = d > 0.01 ? 1.5 + 0.35 * Math.sin(t * 6 + s) : 0.3;
      }
    },
  };
}

export { HALF_CELL_COLS };
