/**
 * Step 5 `iv-curve` — the module on the bench with a variable resistor. The rheostat (dock slider or the knob
 * in the scene) moves the operating point along the I-V curve; chart, needles, cable pulses and the electron
 * flow in the cells all follow the same model sample (STC: 1000 W/m², 25 °C).
 */
import { fmtNumber } from '@/content';
import type { Chart } from '@/ui3d';
import type { StepFactory } from '../chapter';
import { doc } from '../content';
import { L, fill } from '../labels';
import { createRig } from '../parts/rig';
import type { BenchSample } from '../sim-bindings/bench-model';
import { curveChart } from '../ui-bits/curve-chart';

const ID = 'iv-curve';
const GAME_S = 20;

export const ivCurve: StepFactory = (lab) => {
  const { ctx, ui } = lab;
  const rig = lab.share('rig', () => createRig(ctx));
  lab.stageRoot.add(rig.group, rig.desk);
  let sample: BenchSample | null = null;
  const game = { left: 0, best: 0 };
  const ohm = (): number => ui.value<number>('r5');

  ctx.input.register(rig.bench.knob, {
    tooltip: L.rheostatTip,
    cursor: 'grab',
    enabled: () => lab.isCurrent(ID),
    // one screen width ≈ the whole logarithmic scale
    drag: (e) => ui.set('r5', Math.min(1000, Math.max(0.05, ohm() * Math.exp(e.dx * 0.012))), { notify: true }),
  });
  ctx.qa.probe('knob5', rig.bench.knob);
  ctx.qa.expose('bench5', () => (sample ? { v: sample.op.vV, i: sample.op.iA, p: sample.op.pW, r: ohm(), best: game.best, left: game.left } : null));

  const boxes = (chart: Chart, s: BenchSample, changed: boolean): void => {
    if (!changed) return;
    const a = s.analysis;
    chart.setData('ideal', [0, a.vocV, a.vocV], [a.iscA, a.iscA, 0]);
    chart.setData('real', [0, a.mpp.vV, a.mpp.vV], [a.mpp.iA, a.mpp.iA, 0]);
    chart.setMarker('isc', { x: 0, y: a.iscA, color: 'sky', label: 'I_sc', guides: false });
    chart.setMarker('voc', { x: a.vocV, y: 0, color: 'sky', label: 'V_oc', guides: false });
    chart.setMarker('mpp', { x: a.mpp.vV, y: a.mpp.pW, axis: 'y2', color: 'yellow', label: 'MPP', guides: false });
  };
  let lineR = NaN;
  let lineOn = false;
  const loadLine = (chart: Chart): void => {
    const on = ui.value<boolean>('line5');
    const r = ohm();
    if (on === lineOn && (r === lineR || !on)) return;
    lineOn = on;
    lineR = r;
    const xEnd = Math.min(45, 15 * r);
    if (on) chart.setData('load', [0, xEnd], [0, xEnd / r]);
    else chart.clearData('load');
  };

  return {
    id: ID,
    shots: {
      [ID]: { position: [2.2, 3.6, 10.4], target: [0.35, 2.3, 0], frameAspect: 0.95, fov: 34, fit: { center: [0.3, 2.3, 0], radius: 3.4 }, orbit: { azimuth: 0.6, polar: 0.3 } },
    },
    stage: {
      show: [rig.group, rig.desk],
      enter() {
        game.left = 0;
        lineR = NaN;
      },
    },
    ui: {
      hint: L.hint5,
      board: {
        title: L.board5,
        size: 'md',
        children: [
          curveChart('chart5', () => sample, {
            series: [
              { id: 'ideal', label: L.boxIdeal, color: 'mist', dash: true, opacity: 0.6 },
              { id: 'real', label: L.boxReal, color: 'yellow', dash: [2, 3], opacity: 0.8 },
              { id: 'load', label: L.loadLine, color: 'cyan', dash: true },
            ],
            extra: (chart, s, changed) => (boxes(chart, s, changed), loadLine(chart)),
          }),
          {
            type: 'stats',
            id: 'stats5',
            items: [
              { label: L.voltage, get: () => sample?.op.vV ?? 0, unit: 'V', digits: 1, color: () => 'sky' },
              { label: L.current, get: () => sample?.op.iA ?? 0, unit: 'A', digits: 2, color: () => 'cyan' },
              { label: L.power, get: () => sample?.op.pW ?? 0, unit: 'W', digits: 0, color: () => 'yellow' },
            ],
          },
          {
            type: 'stats',
            id: 'game5',
            columns: 2,
            visible: () => game.left > 0 || game.best > 0,
            items: [
              { label: L.record, get: () => game.best, unit: 'W', digits: 0, color: () => 'yellow' },
              { label: L.timeLeft, get: () => Math.ceil(game.left), unit: 's', digits: 0 },
            ],
          },
        ],
      },
      controls: [
        { type: 'slider', id: 'r5', label: L.resistance, min: 0.05, max: 1000, value: 10, scale: 'log', step: 3, unit: 'Ω' },
        { type: 'toggle', id: 'line5', label: doc(ID, 2), value: false },
        { type: 'readout', id: 'ff5', label: L.fillFactor, get: () => sample?.analysis.fillFactor ?? 0, digits: 3 },
        {
          type: 'button',
          id: 'game5-start',
          label: doc(ID, 1),
          icon: 'target',
          primary: true,
          onClick: () => {
            game.left = GAME_S;
            game.best = 0;
            ui.toast(L.gameGo, { icon: 'clock' });
          },
        },
      ],
      callouts: [
        { anchor: rig.lamp.ball, text: L.sunLamp, side: 'up' },
        { anchor: rig.bench.anchors.rheostat, text: L.rheostat, side: 'down', color: 'cyan' },
        { anchor: rig.bench.anchors.wattmeter, text: () => `${L.wattmeter} · ${fmtNumber(Math.round(sample?.op.pW ?? 0))} W`, side: 'up', color: 'yellow' },
      ],
      hotspots: [
        { anchor: rig.bench.anchors.ammeter, content: 'i-sc' },
        { anchor: rig.bench.anchors.voltmeter, content: 'v-oc' },
      ],
    },
    update(dt, t) {
      if (!lab.isCurrent(ID)) return;
      sample = rig.model.sample({ g: 1000, tc: 25, shade: null, bypass: true, modules: 1, load: { kind: 'resistor', ohm: ohm() } });
      rig.show(sample, t, { knob: rig.knobOf(ohm()) });
      if (game.left > 0) {
        game.best = Math.max(game.best, sample.op.pW);
        game.left -= dt;
        if (game.left <= 0) {
          game.left = 0;
          ui.toast(fill(L.gameDone, { p: fmtNumber(Math.round((game.best / sample.analysis.mpp.pW) * 100)) }), { icon: 'star', duration: 7 });
        }
      }
    },
  };
};
