/**
 * Step 4 `brayton-sim` — «Симулятор: стиснення і температура». The same section of the gas turbine; the
 * flows recolour live with the model's temperatures and the work arrows change thickness. Board: the T–s
 * contour of the cycle (area inside = specific work, `yellow`) and the work balance (turbine work = `red`
 * compressor part + `yellow` generator part). Sliders r 4…40 and TIT 900…1700 °C, presets of four machine
 * generations, warnings «за межами сучасних матеріалів» (TIT > 1650 °C) and «машина ледве тягне сама себе»
 * (w_net < 100 kJ/kg). Model M1 (`@electricity/sim/plant-gas`).
 */
import { Vector3 } from 'three';
import { GT_PRESETS, R_RANGE, TIT_RANGE_C, airFlowKgS } from '@electricity/sim/plant-gas';
import type { Chart } from '@/ui3d';
import { HOTSPOTS } from '../hotspots';
import { GT_X } from '../parts/gt-model';
import { tsContour } from '../sim-bindings/gt';
import { hot } from './hot';
import type { StepFactory } from './types';

type Preset = keyof typeof GT_PRESETS;
const PRESETS: readonly Preset[] = ['classE', 'classF', 'classHJ', 'aeroderivative'];

export const braytonSim: StepFactory = ({ ui, L, live, isl, gt, shell }) => {
  const hero = isl.ccgt.gt;
  const { sim } = gt;
  const label: Record<Preset, string> = { classE: L.classE, classF: L.classF, classHJ: L.classHJ, aeroderivative: L.aero };
  let drawn = '';
  const setPreset = (p: string): void => {
    const pr = GT_PRESETS[p as Preset];
    if (!pr) return;
    ui.set('br.r', pr.r, { notify: true });
    ui.set('br.tit', pr.titC, { notify: true });
  };
  const res = (): typeof sim.state.res => sim.state.res;
  return {
    id: 'brayton-sim',
    stage: { camera: 'brayton-sim', show: [shell.hrsgFront, shell.inside, ...gt.flows, gt.arrowActor], enter: () => (hero.cut = 1), leave: () => (hero.cut = 0) },
    ui: {
      honesty: ['simplified', { slowed: 140, text: L.shaftSlowed }],
      controls: [
        { type: 'slider', id: 'br.r', label: L.r, min: R_RANGE[0], max: R_RANGE[1], step: 1, value: 20, digits: 0 },
        { type: 'slider', id: 'br.tit', label: L.titLong, min: TIT_RANGE_C[0], max: TIT_RANGE_C[1], step: 10, value: 1600, unit: '°C', digits: 0 },
        {
          type: 'segmented',
          id: 'br.preset',
          label: L.presets,
          items: PRESETS.map((p) => ({ id: p, label: label[p] })),
          value: 'classHJ',
          onChange: setPreset,
        },
        { type: 'note', id: 'br.hot', icon: 'warning', color: 'amber', text: L.beyondMaterials, visible: () => res().beyondMaterials },
        { type: 'note', id: 'br.weak', icon: 'warning', color: 'red', text: L.barelyRuns, visible: () => res().lowWorkWarning },
      ],
      board: {
        title: L.tsTitle,
        size: 'md',
        children: [
          {
            type: 'chart',
            id: 'br.ts',
            chart: {
              height: 200,
              x: { min: 0, max: 1.4, label: 's, kJ/(kg·K)' },
              y: { min: 0, max: 1800, label: 't, °C' },
              series: [
                { id: 'base', color: 'bg.deep', kind: 'area', stack: 'w', opacity: 0 },
                { id: 'work', label: L.workArea, color: 'yellow', kind: 'area', stack: 'w', opacity: 0.35 },
                { id: 'loop', label: L.cycle, color: 'orange', width: 2.5 },
              ],
            },
            update: (c: Chart) => {
              const key = `${sim.state.r}|${sim.state.titC}`;
              if (key === drawn) return;
              drawn = key;
              const ts = tsContour(sim.state.r, sim.state.titC);
              c.setData('base', ts.grid.s, ts.grid.lower);
              c.setData('work', ts.grid.s, ts.grid.upper.map((u, i) => u - (ts.grid.lower[i] ?? 0)));
              c.setData('loop', ts.loop.s, ts.loop.t);
            },
          },
          {
            type: 'chart',
            id: 'br.balance',
            chart: {
              height: 130,
              x: { min: 0.4, max: 3.6, ticks: [1, 2, 3], format: (v: number) => [L.workTurbine, L.toCompressor, L.toGenerator][Math.round(v) - 1] ?? '' },
              y: { min: 0, max: 1300, label: L.balance, ticks: [0, 400, 800, 1200] },
              series: [
                { id: 'turb', color: 'orange', kind: 'bars', width: 0.55 },
                { id: 'comp', color: 'red', kind: 'bars', width: 0.55 },
                { id: 'net', color: 'yellow', kind: 'bars', width: 0.55 },
              ],
              legend: false,
            },
            update: (c: Chart) => {
              c.setData('turb', [1], [res().wTurbKJkg]);
              c.setData('comp', [2], [res().wCompKJkg]);
              c.setData('net', [3], [Math.max(0, res().wNetKJkg)]);
            },
          },
          {
            type: 'stats',
            id: 'br.stats',
            items: [
              { label: L.eta, get: () => res().eta * 100, unit: '%', digits: 1 },
              { label: L.wNet, get: () => res().wNetKJkg, unit: 'kJ/kg', digits: 0 },
              { label: L.compShare, get: () => res().compressorShare * 100, unit: '%', digits: 0 },
              { label: L.t2, get: () => res().t2C, unit: '°C', digits: 0 },
              { label: L.t4, get: () => res().t4C, unit: '°C', digits: 0 },
              { label: L.airFor500, get: () => (res().wNetKJkg > 0 ? airFlowKgS(500, res()) / 1000 : 0), unit: 't/s', digits: 2 },
            ],
          },
        ],
      },
      hotspots: [hot(() => hero.axis(GT_X.burn1).add(new Vector3(0, 3.4, 1.5)), HOTSPOTS['brayton-sim'].ts)],
    },
    update() {
      live.gtTarget = 1;
      hero.cut = 1;
      sim.set(ui.value<number>('br.r'), ui.value<number>('br.tit'));
      sim.apply(gt.flow, gt.arrows);
    },
  };
};
