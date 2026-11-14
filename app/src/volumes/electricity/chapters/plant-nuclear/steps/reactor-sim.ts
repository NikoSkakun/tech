/**
 * Step 8 `reactor-sim` — «Пульт оператора». The control room: the rod-group lever, the turbine-load knob and
 * the scram button under its cover are direct handles in the scene (drag / turn / tap) with the same controls
 * in the dock. Model M3 (`createReactor`: point kinetics, one delayed group, heat balance, negative temperature
 * feedback, scram at n > 1,07 or T > 330 °C, decay heat after it). The mimic glows with the power, the
 * window's reactor glows with the fission power, the line's pulses follow the generator; the board shows the
 * instruments and 300 s of history. Time ×1 / ×10 / ×60; «Відновити роботу» after a scram, «Скинути».
 */
import { type Vector3 } from 'three';
import { audio } from '@/audio';
import { createReactor } from '@electricity/sim/plant-nuclear';
import { HOTSPOTS } from '../hotspots';
import { HALL_TUNE, INNER_POST } from '../looks';
import { buildControlRoom } from '../parts/control-room';
import { hot, probe } from './hot';
import type { StepFactory } from './types';

const SPEEDS = { x1: 1, x10: 10, x60: 60 } as const;
type Speed = keyof typeof SPEEDS;
const pct = (v: number): string => `${Math.round(v * 100)} %`;

export const reactorSim: StepFactory = ({ ctx, ui, L, live, inner }) => {
  const set = inner.sets.console;
  const room = buildControlRoom();
  set.add(room.group);
  let reactor = createReactor();
  let lastScram = false;
  let since = 0;
  const w = (p: Vector3): Vector3 => set.localToWorld(p.clone());
  const reset = (): void => {
    reactor = createReactor();
    lastScram = false;
    ui.set('rs.h', 70);
    ui.set('rs.L', 100);
  };
  const scram = (): void => reactor.scram();
  const restore = (): void => {
    reactor.restore();
    lastScram = false;
    ui.set('rs.h', 70);
    ui.set('rs.L', 100);
  };
  const active = (): boolean => ctx.stage.current === 'reactor-sim';
  // direct manipulation: lever (drag up/down), knob (drag left/right), button (tap)
  let grabH = 0;
  let grabL = 0;
  ctx.input.register(room.hit.lever, { cursor: 'grab', tooltip: L.rodGroup, enabled: active, dragStart: () => (grabH = ui.value<number>('rs.h')), drag: (e) => ui.set('rs.h', Math.round(Math.min(100, Math.max(0, grabH - e.totalY * 0.4))), { notify: true }) });
  ctx.input.register(room.hit.knob, { cursor: 'grab', tooltip: L.turbineLoad, enabled: active, dragStart: () => (grabL = ui.value<number>('rs.L')), drag: (e) => ui.set('rs.L', Math.round(Math.min(100, Math.max(30, grabL + e.totalX * 0.3))), { notify: true }) });
  ctx.input.register(room.hit.button, { cursor: 'pointer', tooltip: L.scramButton, enabled: active, click: scram });
  for (const [name, at] of [['rs.lever', room.at.lever], ['rs.knob', room.at.knob], ['rs.button', room.at.button]] as const) probe(name, () => w(at));
  ctx.qa.expose('console', () => ({ ...reactor.state }));
  const st = () => reactor.state;
  const reason = (): string => (st().scramReason === 'manual' ? L.reasonManual : st().scramReason === 'power' ? L.reasonPower : L.reasonTemp);
  return {
    id: 'reactor-sim',
    stage: { camera: 'reactor-sim', envTune: HALL_TUNE, post: INNER_POST, enter: reset },
    ui: {
      reset: true,
      honesty: [{ kind: 'simplified', text: L.simplified }],
      controls: [
        { type: 'slider', id: 'rs.h', label: L.rodGroup, min: 0, max: 100, step: 1, unit: '%', value: 70, disabled: () => st().scram },
        { type: 'slider', id: 'rs.L', label: L.turbineLoad, min: 30, max: 100, step: 1, unit: '%', value: 100, disabled: () => st().scram },
        { type: 'button', id: 'rs.scram', label: L.scramButton, icon: 'warning', primary: true, visible: () => !st().scram, onClick: scram },
        { type: 'button', id: 'rs.restore', label: L.restore, icon: 'play', primary: true, visible: () => st().scram, onClick: restore },
        { type: 'note', id: 'rs.restart', text: L.restartNote, icon: 'clock', color: 'mist', visible: () => st().scram },
        { type: 'segmented', id: 'rs.speed', label: L.timeSpeed, items: [{ id: 'x1', label: L.x1 }, { id: 'x10', label: L.x10 }, { id: 'x60', label: L.x60 }], value: 'x1' },
        { type: 'button', id: 'rs.reset', label: L.simReset, icon: 'resetView', onClick: reset },
      ],
      board: {
        title: L.consoleTitle,
        size: 'md',
        children: [
          {
            type: 'stats',
            id: 'rs.inst',
            columns: 3,
            items: [
              { label: L.reactorPower, get: () => pct(st().thermalMW / 3000) },
              { label: L.heatMw, get: () => `${Math.round(st().thermalMW)} MW` },
              { label: L.generatorPower, get: () => `${Math.round(st().electricMW)} MW`, color: () => 'yellow' },
              { label: L.coolantT, get: () => `${st().tempC.toFixed(1).replace('.', ',')} °C`, color: () => (st().tempC > 330 ? 'red' : st().tempC > 315 ? 'amber' : 'green') },
              { label: L.reactivityShort, get: () => `${Math.round(st().reactivity * 1e5)} pcm` },
              { label: L.rodsShort, get: () => pct(st().rodPosition) },
            ],
          },
          { type: 'note', id: 'rs.residual', text: () => `${L.residual}: ${Math.round(st().thermalMW)} MW`, icon: 'warning', color: 'orange', visible: () => st().scram },
          { type: 'note', id: 'rs.alarm', text: () => `${L.scrammed}: ${reason()}`, icon: 'warning', color: 'red', visible: () => st().scram },
          {
            type: 'chart',
            id: 'rs.hist',
            chart: {
              height: 150,
              legend: true,
              window: 300,
              x: { min: 0, max: 300, label: 't, s' },
              y: { min: 0, max: 120, label: '%' },
              y2: { min: 280, max: 340, label: 'T, °C' },
              series: [{ id: 'n', label: L.powerSeries, color: 'orange' }, { id: 'q', label: L.heatSeries, color: 'amber', dash: true }, { id: 'T', label: L.tempSeries, color: 'sky', axis: 'y2' }],
            },
            update: (chart) => {
              if (since < 0.25) return;
              since = 0;
              const s = st();
              chart.push('n', s.timeS, s.n * 100);
              chart.push('q', s.timeS, (s.thermalMW / 3000) * 100);
              chart.push('T', s.timeS, s.tempC);
            },
          },
        ],
      },
      callouts: [
        { anchor: () => w(room.at.lever), text: L.rodGroup, side: 'left', priority: 0 },
        { anchor: () => w(room.at.knob), text: L.turbineLoad, side: 'up', priority: 1 },
        { anchor: () => w(room.at.button), text: L.scramButton, side: 'right', color: 'red', priority: 2 },
        { anchor: () => w(room.at.mimic), text: L.mimic, side: 'up', priority: 3 },
        { anchor: () => w(room.at.window), text: L.window, side: 'up', priority: 4 },
      ],
      hotspots: [hot(() => w(room.at.supervisor), HOTSPOTS['reactor-sim'].supervisor)],
    },
    update(dt, t) {
      reactor.set({ rodTarget: ui.value<number>('rs.h') / 100, load: ui.value<number>('rs.L') / 100 });
      const k = SPEEDS[ui.value<Speed>('rs.speed')];
      reactor.step(dt * k);
      since += dt * k;
      const s = st();
      if (s.scram && !lastScram) {
        lastScram = true;
        audio.play('error', { gain: 0.35 });
        if (s.scramReason !== 'manual') ui.toast(`${L.scrammed}: ${reason()}`, { tone: 'alarm' });
      }
      // the handles follow the model (the lever shows the real rod position, it moves at ≈ 1 %/s)
      room.lever.rotation.x = -0.9 + 1.8 * s.rodPosition;
      room.knob.rotation.y = -2.4 + 4.8 * ((s.load - 0.3) / 0.7);
      room.cover.rotation.x = s.scram ? -1.6 : -0.15 * (1 + Math.sin(t * 2)) * 0.3;
      const n = Math.min(1.3, s.n);
      const heat = s.thermalMW / 3000;
      (room.glows.reactor.material as unknown as { intensity: number }).intensity = 0.2 + 1.5 * heat;
      (room.glows.window.material as unknown as { intensity: number }).intensity = 0.15 + 1.6 * n;
      (room.glows.loop.material as unknown as { intensity: number }).intensity = 0.4 + 1.0 * heat;
      (room.glows.turbine.material as unknown as { intensity: number }).intensity = 0.2 + 1.2 * (s.electricMW / 1000);
      (room.glows.generator.material as unknown as { intensity: number }).intensity = 0.2 + 1.4 * (s.electricMW / 1000);
      (room.glows.alarm.material as unknown as { intensity: number }).intensity = s.scram ? 0.6 + 0.9 * (0.5 + 0.5 * Math.sin(t * 8)) : 0;
      room.line.material.power = s.electricMW / 1000;
      live.powerTarget = s.electricMW / 1000;
    },
  };
};
