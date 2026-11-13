/**
 * Board of step 4: the I(U) chart with the recorded points (markers; `amber` = taken in current-limit mode),
 * the faint theoretical curve of the sample on the rig, the live operating point, and the R / U / I / P
 * readouts. Everything is drawn from the same `ohmBench` reading the 3D rig uses.
 */
import { fmtUnit } from '@/content';
import type { BoardSpec } from '@/hud';
import {
  OHM_BENCH,
  filamentResistanceOhm,
  type BenchReading,
  type BenchSample,
} from '@electricity/sim/current';
import { DOC } from '../labels';
import { OWN } from '../labels-own';

export interface OhmPoint {
  u: number;
  i: number;
  /** Recorded while the supply was limiting the current. */
  cc: boolean;
}

const MAX_POINTS = 40;
const U_MAX = OHM_BENCH.supplyRangeV.max;
const I_MAX = OHM_BENCH.currentLimitA;

export function ohmBoard(o: {
  points: OhmPoint[];
  reading: () => BenchReading;
  sample: () => BenchSample;
  record: () => void;
  clear: () => void;
}): { spec: BoardSpec; dirty(): void } {
  let stale = true;
  let curveKey = '';
  const spec: BoardSpec = {
    title: OWN.ivTitle,
    size: 'md',
    children: [
      {
        type: 'chart',
        id: 'iv4',
        chart: {
          height: 232,
          x: { min: 0, max: U_MAX, label: 'U, V' },
          y: { min: 0, max: I_MAX, label: 'I, A' },
          series: [{ id: 'law', color: 'mist', dash: true, opacity: 0.55, width: 1.6 }],
          legend: false,
        },
        update: (chart) => {
          const s = o.sample();
          const r = o.reading();
          const key = s.kind === 'lamp' ? 'lamp' : `${s.material}|${s.lengthM}|${s.areaMm2}`;
          if (key !== curveKey) {
            curveKey = key;
            if (s.kind === 'lamp') {
              const us = Array.from({ length: 49 }, (_, k) => (k / 48) * U_MAX);
              chart.setData(
                'law',
                us,
                us.map((u) => u / filamentResistanceOhm(u)),
              );
            } else {
              // I = U/R, drawn up to the edge of the plot
              const uEnd = Math.min(U_MAX, I_MAX * r.resistanceOhm);
              chart.setData('law', [0, uEnd], [0, uEnd / r.resistanceOhm]);
            }
          }
          if (stale) {
            stale = false;
            for (let n = 0; n < MAX_POINTS; n++) {
              const p = o.points[n];
              chart.setMarker(
                `p${n}`,
                p ? { x: p.u, y: p.i, color: p.cc ? 'amber' : 'yellow', guides: false } : null,
              );
            }
          }
          chart.setMarker('now', { x: r.voltageV, y: r.currentA, color: 'white' });
        },
      },
      {
        type: 'stats',
        id: 'out4',
        columns: 4,
        items: [
          {
            label: 'R',
            get: () =>
              fmtUnit(o.reading().resistanceOhm, 'Ω', { maxDigits: o.reading().resistanceOhm < 10 ? 2 : 1 }),
          },
          { label: 'U', get: () => fmtUnit(o.reading().voltageV, 'V', { digits: 2 }) },
          {
            label: 'I',
            get: () => fmtUnit(o.reading().currentA, 'A', { digits: 2 }),
            color: () => (o.reading().constantCurrent ? 'amber' : 'white'),
          },
          { label: 'P = U·I', get: () => fmtUnit(o.reading().powerW, 'W', { maxDigits: 1 }) },
        ],
      },
      { type: 'button', id: 'rec4', label: DOC.record, icon: 'plus', primary: true, onClick: o.record },
      {
        type: 'button',
        id: 'clr4',
        label: DOC.clear,
        icon: 'close',
        onClick: () => {
          o.clear();
          stale = true;
        },
      },
    ],
  };
  return { spec, dirty: () => void (stale = true) };
}
