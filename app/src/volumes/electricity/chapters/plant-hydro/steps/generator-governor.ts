/**
 * Step 6 `generator-governor` — «Гідрогенератор, регулятор і пуск „з нуля“». The machine-hall slice on the stand
 * (`unit-rig.ts`). «Пари полюсів» p = 1…48: n = 3000/p rpm, the rotor widens with p and turns slower (on screen
 * slowed ×10). «Різко відкрити напрямний апарат» 80 → 90 % / «Плавно» (10 s ramp): the governor model M5
 * (T_w = 1,5 s) plots P_m(t) — the dip to 60 % first, then the rise. «Блекаут → пуск з нуля»: the map's lamps go
 * dark, our plant (green) starts from a small diesel, spins up, excites, energises the buses and the five
 * substations light one by one (M5 scenario, ≈ 90 s in real time).
 */
import { Vector3 } from 'three';
import { fmtNumber } from '@/content';
import { blackStartScenario, createHydroTurbine, generatorRpm } from '@electricity/sim/plant-hydro';
import { HOTSPOTS } from '../hotspots';
import { buildUnitRig } from '../parts/unit-rig';
import { hot } from './hot';
import type { StepFactory } from './types';

const WINDOW_S = 14;
const BLACK_S = 95;

export const generatorGovernor: StepFactory = ({ ctx, ui, L, stand }) => {
  const rig = buildUnitRig();
  stand.top.add(rig.group);
  const aRig = ctx.stage.actor(rig.group, { appear: 'grow' });
  const p = (): number => ui.value<number>('gg.p');
  let turbine = createHydroTurbine(0.8);
  let run = false;
  let samples: { t: number; pm: number; g: number }[] = [];
  let black = -1;
  let drawnP = -1;
  const start = (ramp: number): void => {
    turbine = createHydroTurbine(0.8);
    turbine.command(0.9, ramp);
    samples = [{ t: 0, pm: 0.8, g: 0.8 }];
    run = true;
  };
  const scenario = () => blackStartScenario(Math.max(0, black));
  const phaseText = (): string => {
    const ph = scenario().phase;
    return ph === 'diesel'
      ? L.phaseDiesel
      : ph === 'spinUp'
        ? L.phaseSpin
        : ph === 'excitation'
          ? L.phaseExcite
          : ph === 'synchronised'
            ? L.phaseSync
            : ph === 'restoring'
              ? L.phaseRestore
              : L.phaseDone;
  };
  const v = new Vector3();
  ctx.qa.expose('gov', () => ({
    samples: samples.length,
    pm: samples[samples.length - 1]?.pm ?? null,
    pmMin: samples.length ? Math.min(...samples.map((x) => x.pm)) : null,
    black,
    rpm: generatorRpm(p()),
  }));
  const at = (n: Parameters<typeof rig.at>[0]) => (): Vector3 => rig.at(n, v.clone());
  return {
    id: 'generator-governor',
    stage: {
      camera: 'generator-governor',
      show: [stand.group, aRig],
      enter: () => {
        run = false;
        samples = [];
        black = -1;
      },
    },
    ui: {
      honesty: [{ slowed: 10 }, 'simplified', 'notToScale'],
      controls: [
        {
          type: 'slider',
          id: 'gg.p',
          label: L.polePairs,
          min: 1,
          max: 48,
          step: 1,
          value: 40,
          marks: [
            { value: 1, label: L.likeTurbo },
            { value: 40, label: '75 rpm' },
          ],
        },
        {
          type: 'button',
          id: 'gg.sharp',
          label: L.sharp, // the document's long caption: no icon, so it fits a 360 px phone
          primary: true,
          onClick: () => start(0),
        },
      ],
      board: {
        title: L.pmTitle,
        size: 'sm',
        children: [
          // «Плавно» and the black start live with the chart and the phase readout on the board (a small phone shows
          // only one long dock button without scrolling)
          { type: 'button', id: 'gg.smooth', label: L.smooth, icon: 'play', onClick: () => start(10) },
          { type: 'button', id: 'gg.black', label: L.blackStart, icon: 'play', onClick: () => (black = 0) },
          {
            type: 'stats',
            id: 'gg.n',
            columns: 2,
            items: [
              {
                label: L.rpm,
                unit: 'rpm',
                digits: 1,
                get: () => (black >= 0 ? (scenario().speedPct / 100) * generatorRpm(p()) : generatorRpm(p())),
              },
            ],
          },
          {
            type: 'chart',
            id: 'gg.chart',
            chart: {
              height: 150,
              x: { min: 0, max: WINDOW_S, label: 't, s' },
              y: { min: 0.5, max: 1, label: 'P_m, G' },
              series: [
                { id: 'pm', label: 'P_m', color: 'yellow' },
                { id: 'g', label: L.gateSeries, color: 'mist', dash: true },
              ],
            },
            update: (c) => {
              c.setData(
                'pm',
                samples.map((s) => s.t),
                samples.map((s) => s.pm),
              );
              c.setData(
                'g',
                samples.map((s) => s.t),
                samples.map((s) => s.g),
              );
            },
          },
          {
            type: 'note',
            id: 'gg.lin',
            text: L.linearModel,
            icon: 'info',
            visible: () => samples.length > 0,
          },
          { type: 'note', id: 'gg.bsm', text: L.blackStartModel, icon: 'info', visible: () => black >= 0 },
          {
            type: 'readout',
            id: 'gg.phase',
            label: L.phase,
            text: () => `${phaseText()} · ${scenario().substations}/5`,
            visible: () => black >= 0,
          },
        ],
      },
      callouts: [
        {
          anchor: at('generator'),
          text: () => `${L.generator} · ${fmtNumber(generatorRpm(p()), { maxDigits: 1 })} rpm`,
          side: 'up',
          priority: 0,
        },
        { anchor: at('thrust'), text: L.thrust, side: 'left', priority: 2 },
        { anchor: at('governor'), text: L.governor, side: 'right', priority: 1 },
        { anchor: at('runner'), text: L.runner, side: 'left', priority: 3 },
      ],
      hotspots: [
        hot(at('excitation'), HOTSPOTS['generator-governor'].excitation),
        hot(at('brakes'), HOTSPOTS['generator-governor'].brakes),
      ],
    },
    update(dt, t) {
      if (p() !== drawnP) rig.setPoles((drawnP = p()));
      // governor event: the model runs in real time, samples feed the chart
      if (run) {
        turbine.step(dt);
        samples.push({ t: turbine.timeS, pm: turbine.mechanicalPower, g: turbine.gate });
        if (turbine.timeS > WINDOW_S) run = false;
      }
      // black start: lamps dark, then our plant, buses, substations one by one
      let speed = 1;
      if (black >= 0) {
        black += dt;
        const s = scenario();
        speed = s.speedPct / 100;
        rig.lamps.forEach(
          (m, i) => (m.visible = i === 0 ? black > 0.4 : i <= 5 ? i <= s.substations : black > 40 + i * 7),
        );
        rig.links.forEach((m, i) => (m.visible = i < s.substations || (i >= 5 && black > 40 + (i + 1) * 7)));
        if (black > BLACK_S) black = -1;
      } else {
        for (const m of [...rig.lamps, ...rig.links]) m.visible = true;
      }
      // n = 3000/p rpm, slowed ×10 on screen
      const omega = ((generatorRpm(p()) / 10) * Math.PI * 2) / 60;
      rig.rotor.rotation.y += dt * omega * speed;
      rig.runner.group.rotation.y = rig.rotor.rotation.y;
      rig.needle.rotation.z = 0.08 * Math.sin(t * 0.7) * (black >= 0 && speed < 0.99 ? 6 : 1);
    },
  };
};
