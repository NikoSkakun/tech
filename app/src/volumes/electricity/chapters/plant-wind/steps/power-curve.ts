/**
 * Step 7 `power-curve` — «Крива потужності: від штилю до шторму». The power curve with its four zones is on
 * the HUD board; the working point runs along it while the turbine answers in real time (rotor speed, blade
 * pitch, yellow pulses in the tower). Model M4 in the time domain: `createTurbineSim` — «Порив» (+6 m/s, the
 * pitch lags with τ = 0.5 s), «Шторм» (ramp to 28 m/s: feathered blades, stop), «Пряме вимкнення /
 * Штормове регулювання».
 */
import { audio } from '@/audio';
import { TURBINE_6MW, createTurbineSim, ratedSpeed, turbinePowerW, windPowerW } from '@electricity/sim/plant-wind';
import { STATUS, type Chart } from '@/ui3d';
import { HOTSPOTS } from '../hotspots';
import { hot } from './hot';
import type { StepFactory } from './types';

const VR = ratedSpeed(TURBINE_6MW);
const MW = 1e-6;
const ETA_DT = 0.93; // drivetrain efficiency inside κ = C_p·η (document M4)
const range = (a: number, b: number, n = 24): number[] => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);

export const powerCurve: StepFactory = ({ ui, L, live, hero }) => {
  const sim = createTurbineSim({ vMs: 7 });
  const stormControl = (): boolean => ui.value<string>('pc.sc') === 'control';
  let curveFor: boolean | null = null;
  const drawCurve = (chart: Chart, sc: boolean): void => {
    const p = (v: number): number => turbinePowerW(TURBINE_6MW, v, sc) * MW;
    const fill = (id: string, xs: number[], floor = 0): void => chart.setData(id, xs, xs.map((v) => Math.max(floor, p(v))));
    // zone I is drawn as a low plinth so that «штиль» is visible on the axis
    chart.setData('z1', [0, TURBINE_6MW.vInMs], [0.12, 0.12]);
    fill('z2', range(TURBINE_6MW.vInMs, VR));
    fill('z3', range(VR, TURBINE_6MW.vOutMs - 1e-3, 4));
    fill('z4', range(TURBINE_6MW.vOutMs, 30, 12), 0.12);
  };
  let last = 7;
  let stormy = false;
  let zone = 'II';
  return {
    id: 'power-curve',
    stage: {
      camera: 'power-curve',
      params: { windX: hero.base.x + 10, windY: hero.base.y + 6, windZ: hero.base.z, windLength: 330, windHeight: 96, windWidth: 190 },
      enter: () => {
        sim.reset();
        sim.setWind(ui.value<number>('pc.v'));
        last = ui.value<number>('pc.v');
        stormy = false;
        curveFor = null;
      },
    },
    ui: {
      reset: true,
      honesty: ['simplified', 'notToScale'],
      controls: [
        { type: 'slider', id: 'pc.v', label: L.v, min: 0, max: 30, step: 0.1, unit: 'm/s', digits: 1, value: 7, marks: [{ value: 3, label: L.cutIn }, { value: 25, label: L.cutOut }] },
        { type: 'segmented', id: 'pc.sc', items: [{ id: 'cut', label: L.stormModes[0] }, { id: 'control', label: L.stormModes[1] }], value: 'cut' },
        { type: 'button', id: 'pc.gust', label: L.gust, icon: 'lightning', onClick: () => (sim.gust(), audio.play('whooshUp', { gain: 0.7 })) },
        { type: 'button', id: 'pc.storm', label: L.storm, icon: 'warning', onClick: () => (sim.storm(), (stormy = true)) },
      ],
      board: {
        title: L.curve,
        size: 'md',
        children: [
          {
            type: 'chart',
            id: 'pc.curve',
            chart: {
              height: 210,
              legend: true,
              x: { min: 0, max: 30, label: 'v, m/s' },
              y: { min: 0, max: 7, label: 'P, MW', ticks: [0, 2, 4, 6] },
              series: [
                { id: 'z1', label: L.zone1, color: 'slate', kind: 'area' },
                { id: 'z2', label: L.zone2, color: 'teal', kind: 'area' },
                { id: 'z3', label: L.zone3, color: 'green', kind: 'area' },
                { id: 'z4', label: L.zone4, color: 'red', kind: 'area' },
              ],
            },
            update: (chart) => {
              const sc = stormControl();
              if (sc !== curveFor) drawCurve(chart, (curveFor = sc));
              chart.setMarker('now', { x: Math.min(30, sim.state.vMs), y: sim.state.powerW * MW, color: 'yellow' });
            },
          },
          { type: 'note', id: 'pc.stormNote', text: L.stormChip, icon: 'warning', color: STATUS.alarm, visible: () => sim.state.zone === 'IV' },
          {
            type: 'stats',
            id: 'pc.dash',
            columns: 3,
            items: [
              { label: L.power, unit: 'MW', digits: 2, get: () => sim.state.powerW * MW },
              { label: L.rpm, unit: 'rpm', digits: 1, get: () => sim.state.rpm },
              { label: L.pitch, unit: '°', digits: 0, get: () => sim.state.pitchDeg },
              { label: L.v, unit: 'm/s', digits: 1, get: () => sim.state.vMs },
              { label: L.cp, digits: 2, get: () => (sim.state.vMs > 0.5 ? sim.state.powerW / (windPowerW(sim.state.vMs, TURBINE_6MW.diameterM) * ETA_DT) : 0) },
            ],
          },
        ],
      },
      hotspots: [hot(hero.room.at('light'), HOTSPOTS['power-curve'].light)],
    },
    update(dt) {
      const v = ui.value<number>('pc.v');
      sim.setStormControl(stormControl());
      if (v !== last) {
        // the user took the slider: that ends a storm ramp
        sim.setWind(v);
        stormy = false;
      }
      sim.step(dt);
      const s = sim.state;
      if (stormy) ui.set('pc.v', Math.round(Math.min(30, s.vMs) * 10) / 10); // the slider follows the storm
      last = ui.value<number>('pc.v');
      // the world follows the simulated wind directly (a gust must not be smoothed away)
      live.windTarget = live.wind = s.vMs;
      live.heroManual = true;
      live.heroRpm += (s.rpm - live.heroRpm) * Math.min(1, dt * 1.2); // rotor inertia
      live.heroPitch = s.pitchDeg;
      live.heroPower = s.powerW / TURBINE_6MW.ratedW;
      if (s.zone === 'IV' && zone !== 'IV') audio.play('breaker'); // cut-out
      zone = s.zone;
    },
  };
};
