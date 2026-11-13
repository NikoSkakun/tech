/**
 * The I-V / P-V chart of the board, shared by the curve steps. It redraws the curves only when the model's
 * curve changed (`curveVersion`) and moves the operating-point marker only when the point moved; the same
 * `BenchSample` drives the 3D rig, so chart and scene always show one state.
 */
import type { ChartSpec } from '@/hud';
import type { Chart } from '@/ui3d';
import type { IvAnalysis } from '@electricity/sim/lab-pv';
import { L } from '../labels';
import type { BenchSample } from '../sim-bindings/bench-model';

export interface CurveChartOptions {
  vMax?: number;
  iMax?: number;
  pMax?: number;
  height?: number;
  /** Reference curve drawn as a pale dashed companion (the STC curve in step 6). */
  ghost?: () => IvAnalysis | null;
  /** Flag every local maximum of P(U) (steps 7 and 10). */
  flags?: boolean;
  /** Extra series ids declared by the step (it fills them in `extra`). */
  series?: ChartSpec['chart']['series'];
  /** Called after the standard update with `changed` = the curve was redrawn this frame. */
  extra?: (chart: Chart, sample: BenchSample, changed: boolean) => void;
}

interface Seen {
  version: number;
  v: number;
  i: number;
  flags: number;
  vMax: number;
}

/** Axis maxima for a string of `n` modules. */
export function axesFor(n: number): { vMax: number; iMax: number; pMax: number } {
  return { vMax: 45 * n, iMax: 15, pMax: 500 * n };
}

export function curveChart(id: string, get: () => BenchSample | null, o: CurveChartOptions = {}): ChartSpec {
  const seen = new WeakMap<Chart, Seen>();
  return {
    type: 'chart',
    id,
    chart: {
      height: o.height ?? 250,
      x: { min: 0, max: o.vMax ?? 45, label: 'U, V' },
      y: { min: 0, max: o.iMax ?? 15, label: 'I, A' },
      y2: { min: 0, max: o.pMax ?? 500, label: 'P, W' },
      series: [
        { id: 'pv', label: L.chartPv, color: 'yellow', axis: 'y2', kind: 'area' },
        ...(o.ghost ? [{ id: 'ghost', label: L.chartStc, color: 'mist', dash: true, opacity: 0.55 } as const] : []),
        { id: 'iv', label: L.chartIv, color: 'sky', width: 3 },
        ...(o.series ?? []),
      ],
    },
    update(chart) {
      const s = get();
      if (!s) return;
      let st = seen.get(chart);
      if (!st) seen.set(chart, (st = { version: -1, v: NaN, i: NaN, flags: 0, vMax: o.vMax ?? 45 }));
      const changed = st.version !== s.curveVersion;
      if (changed) {
        st.version = s.curveVersion;
        const pts = s.analysis.points;
        const n = Math.max(1, s.input.modules);
        const ax = axesFor(n);
        if (ax.vMax !== st.vMax && o.vMax === undefined) {
          st.vMax = ax.vMax;
          chart.setAxis('x', { max: ax.vMax });
          chart.setAxis('y2', { max: ax.pMax });
        }
        chart.setData('iv', pts.map((p) => p.vV), pts.map((p) => p.iA));
        chart.setData('pv', pts.map((p) => p.vV), pts.map((p) => p.pW));
        const ghost = o.ghost?.();
        if (ghost) chart.setData('ghost', ghost.points.map((p) => p.vV), ghost.points.map((p) => p.iA));
        if (o.flags) {
          const maxima = s.analysis.localMaxima;
          for (let k = 0; k < Math.max(maxima.length, st.flags); k++) {
            const m = maxima[k];
            const top = m !== undefined && Math.abs(m.pW - s.analysis.mpp.pW) < 0.5;
            chart.setMarker(`max${k}`, m ? { x: m.vV, y: m.pW, axis: 'y2', color: top ? 'yellow' : 'amber', guides: false, ...(top ? { label: L.maxPoint } : {}) } : null);
          }
          st.flags = maxima.length;
        }
      }
      if (changed || Math.abs(st.v - s.op.vV) > 1e-3 || Math.abs(st.i - s.op.iA) > 1e-3) {
        st.v = s.op.vV;
        st.i = s.op.iA;
        chart.setMarker('op', { x: s.op.vV, y: s.op.iA, color: 'white', guides: true });
        chart.setMarker('opP', { x: s.op.vV, y: s.op.pW, axis: 'y2', color: 'yellow', guides: false });
      }
      o.extra?.(chart, s, changed);
    },
  };
}
