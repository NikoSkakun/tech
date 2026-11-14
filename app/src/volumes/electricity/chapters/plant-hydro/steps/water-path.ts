/**
 * Step 4 `water-path` — «Шлях води крізь ГЕС». The longitudinal section of the stand rig (`path-rig.ts`) with
 * the water moving through it (`path-flow.ts`). «Відкриття напрямного апарата» turns the 20 wicket gates and
 * sets the flow (M2, Francis, H = 80 m, Q_design = 300 m³/s). «Аварійне закриття» closes them in the chosen
 * time (0,5 s or 10 s): the penstock pressure (M3) peaks on the gauge and the chart; at 0,5 s the red
 * «гідроудар!» shows and the pipe shudders. «Зрівняльний резервуар» puts the surge tank on the penstock: the
 * peak is cut and the water in the tower jumps and sways. After 12 s the gates reopen to the slider value.
 */
import { Vector3 } from 'three';
import {
  gateOperatingPoint,
  gaugePressureMPa,
  staticPressureMPa,
  STEP4_STATION,
  surgeTankLevelM,
} from '@electricity/sim/plant-hydro';
import { HOTSPOTS } from '../hotspots';
import { buildPathFlow } from '../parts/path-flow';
import { buildPathRig, PATH, spiralPoint } from '../parts/path-rig';
import { hot } from './hot';
import type { StepFactory } from './types';

const EVENT_S = 12;
const TS = Array.from({ length: 101 }, (_, i) => i / 10);

export const waterPath: StepFactory = ({ ctx, ui, L, stand }) => {
  const rig = buildPathRig();
  stand.top.add(rig.group);
  const flow = buildPathFlow(ctx);
  rig.group.add(flow.group);
  const aRig = ctx.stage.actor(rig.group, { appear: 'grow' });
  ctx.stage.actor(rig.tank, { appear: 'grow' });
  const slider = (): number => ui.value<number>('wp.gate') / 100;
  const closure = (): number => (ui.value<string>('wp.tc') === 'fast' ? 0.5 : 10);
  const tankOn = (): boolean => ui.value<boolean>('wp.tank');
  // the event: a trip at `trip` (engine clock) with the closure time and tank state of that moment
  let trip = -1e9;
  let tripTc = 10;
  let tripTank = false;
  let gate = 0.85;
  const since = (): number => ctx.clock.time - trip;
  const inEvent = (): boolean => since() < EVENT_S;
  // the gauge cannot read below zero: the illustrative oscillation of M3 dips under it (column separation)
  const surge = (): number =>
    Math.max(0, inEvent() ? gaugePressureMPa(tripTc, tripTank, since()) : staticPressureMPa());
  let peak = 0;
  const op = () => gateOperatingPoint(gate);
  const w = (v: Vector3) => (): Vector3 => rig.group.localToWorld(v.clone());
  ctx.qa.expose('path', () => ({
    gate,
    pressure: surge(),
    peak,
    tank: rig.tank.visible,
    flow: op().flowM3s,
  }));
  return {
    id: 'water-path',
    stage: {
      camera: 'water-path',
      show: [stand.group, aRig],
      enter: () => {
        trip = -1e9;
        ctx.stage.toggle(rig.tank, tankOn());
      },
    },
    ui: {
      honesty: [{ kind: 'simplified', text: L.stationModel }, 'notToScale', { slowed: 5 }],
      controls: [
        { type: 'slider', id: 'wp.gate', label: L.gate, min: 0, max: 100, step: 1, unit: '%', value: 85 },
        {
          type: 'segmented',
          id: 'wp.tc',
          label: L.closeTime,
          value: 'fast',
          items: [
            { id: 'fast', label: L.fast },
            { id: 'slow', label: L.slow },
          ],
        },
        {
          type: 'toggle',
          id: 'wp.tank',
          label: L.surgeTank,
          value: false,
          onChange: (on) => ctx.stage.toggle(rig.tank, Boolean(on)),
        },
        {
          type: 'button',
          id: 'wp.trip',
          label: L.trip,
          icon: 'warning',
          primary: true,
          onClick: () => {
            trip = ctx.clock.time;
            peak = 0;
            tripTc = closure();
            tripTank = tankOn();
          },
        },
      ],
      board: {
        title: L.gauge,
        size: 'sm',
        children: [
          {
            type: 'stats',
            id: 'wp.stats',
            columns: 3,
            items: [
              { label: L.flowNow, unit: 'm³/s', digits: 0, get: () => op().flowM3s },
              { label: L.power, unit: 'MW', digits: 0, get: () => op().powerMW },
              { label: L.etaNow, unit: '%', digits: 1, get: () => op().eta * 100 },
            ],
          },
          {
            type: 'gauge',
            id: 'wp.p',
            kind: 'linear',
            label: L.gauge,
            min: 0,
            max: 7,
            unit: 'MPa',
            digits: 2,
            zones: [
              { from: 0, to: staticPressureMPa() + 0.5, color: 'green' },
              { from: staticPressureMPa() + 0.5, to: staticPressureMPa() + 2, color: 'amber' },
              { from: staticPressureMPa() + 2, to: 7, color: 'red' },
            ],
            get: () => surge(),
          },
          {
            type: 'chart',
            id: 'wp.chart',
            chart: {
              height: 150,
              x: { min: 0, max: 10, label: 't, s' },
              y: { min: 0, max: 7, label: 'p, MPa' },
              series: [
                { id: 'p', color: 'blue' },
                { id: 'st', color: 'mist', dash: true },
              ],
            },
            init: (c) => c.setData('st', [0, 10], [staticPressureMPa(), staticPressureMPa()]),
            update: (c) => {
              const t = Math.min(10, since());
              const xs = inEvent() ? TS.filter((x) => x <= t) : [];
              c.setData(
                'p',
                xs,
                xs.map((x) => Math.max(0, gaugePressureMPa(tripTc, tripTank, x))),
              );
            },
          },
          {
            type: 'note',
            id: 'wp.hammer',
            text: L.hammer,
            icon: 'warning',
            color: 'red',
            visible: () => inEvent() && surge() - staticPressureMPa() > 2,
          },
        ],
      },
      callouts: [
        {
          anchor: w(PATH.intake.clone().add(new Vector3(-1, 6, 0))),
          text: L.rack,
          side: 'left',
          priority: 3,
        },
        { anchor: w(new Vector3(-12, 28, 3)), text: L.penstock, side: 'up', priority: 1 },
        {
          anchor: w(spiralPoint(0.05).add(new Vector3(0, 1.5, 0))),
          text: L.spiral,
          side: 'down',
          priority: 2,
        },
        {
          anchor: w(PATH.unit.clone().add(new Vector3(3, 0, 3))),
          text: L.wicket,
          side: 'right',
          priority: 4,
        },
        {
          anchor: w(PATH.unit.clone().add(new Vector3(0, -1, 0))),
          text: L.runner,
          side: 'right',
          priority: 0,
        },
        { anchor: w(new Vector3(32, 8, 2)), text: L.draft, side: 'down', priority: 5 },
        { anchor: w(new Vector3(16, 29, 6)), text: L.generator, side: 'up', priority: 6 },
        { anchor: w(new Vector3(-28, 43, 0)), text: L.intakeGate, side: 'up', priority: 7 },
      ],
      hotspots: [
        hot(rig.model.anchor('stayVanes'), HOTSPOTS['water-path'].stayVanes),
        hot(rig.model.anchor('headCover'), HOTSPOTS['water-path'].headCover),
      ],
    },
    update(dt, t) {
      // gate: the slider, or the closing ramp of a trip (linear over T_c), then a slow reopening
      const s = since();
      const target = slider();
      if (s < EVENT_S) gate = Math.max(0, target * (1 - s / tripTc));
      else gate += (target - gate) * Math.min(1, dt * 1.2);
      const q = op().flowM3s / STEP4_STATION.designFlowM3s;
      flow.set(q);
      flow.update(dt);
      rig.runner.group.rotation.y += dt * 3.2 * Math.min(1.2, q);
      rig.rotor.rotation.y = rig.runner.group.rotation.y;
      // wicket vanes: tangential (closed) → turned 55° (fully open)
      for (const v of rig.vanes) v.rotation.y = (v.userData.base as number) + Math.PI / 2 - 0.95 * gate;
      // water hammer: the pipe shudders with the pressure wave (no shake with reduced motion)
      const dp = inEvent() ? surge() - staticPressureMPa() : 0;
      peak = Math.max(peak, inEvent() ? surge() : 0);
      const shake = ctx.reducedMotion ? 0 : Math.min(0.5, Math.max(0, dp - 1) * 0.12);
      rig.pipeGroup.position.set(shake * Math.sin(t * 61), shake * Math.sin(t * 47 + 1), 0);
      const z = inEvent() && tripTank ? surgeTankLevelM(s) : 0;
      rig.tankWater.scale.y = 22 + z * 0.8;
      rig.tankWater.position.y = (22 + z * 0.8) / 2;
    },
  };
};
