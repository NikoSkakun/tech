/**
 * Step 7 `power-curve` — «Крива потужності: від штилю до шторму». A holographic power curve stands at the
 * foot of the hero with its four zones; the working point runs along it while the turbine answers in real
 * time (rotor speed, blade pitch, yellow pulses in the tower). Model M4 in the time domain:
 * `createTurbineSim` — «Порив» (+6 m/s, the pitch lags with τ = 0.5 s), «Шторм» (ramp to 28 m/s: feathered
 * blades, stop), «Пряме вимкнення / Storm control».
 */
import { Vector3 } from 'three';
import { audio } from '@/audio';
import { TURBINE_6MW, createTurbineSim, ratedSpeed, turbinePowerW, windPowerW } from '@electricity/sim/plant-wind';
import { hotspotNames } from '../content';
import { buildConsole, createBadge } from '../parts';
import type { StepFactory } from './types';

const VR = ratedSpeed(TURBINE_6MW);
const MW = 1e-6;
const ETA_DT = 0.93; // drivetrain efficiency inside κ = C_p·η (document M4)
const range = (a: number, b: number, n = 24): number[] => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);

export const powerCurve: StepFactory = ({ ctx, ui, L, live, hero }) => {
  const sim = createTurbineSim({ vMs: 7 });
  const panel = buildConsole(ctx, {
    title: 'P(v)',
    width: 560,
    unit: 0.105,
    chart: {
      height: 250,
      legend: true,
      x: { min: 0, max: 30, label: 'v, m/s' },
      y: { min: 0, max: 7, label: 'P, MW' },
      series: [
        { id: 'z1', label: L.zone1, color: 'slate', kind: 'area' },
        { id: 'z2', label: L.zone2, color: 'teal', kind: 'area' },
        { id: 'z3', label: L.zone3, color: 'green', kind: 'area' },
        { id: 'z4', label: L.zone4, color: 'red', kind: 'area' },
      ],
    },
    readouts: [
      { label: L.power, unit: 'MW', digits: 2, get: () => sim.state.powerW * MW },
      { label: L.rotorRpm, unit: 'rpm', digits: 1, get: () => sim.state.rpm },
      { label: L.pitch, unit: '°', digits: 0, get: () => sim.state.pitchDeg },
      { label: L.v, unit: 'm/s', digits: 1, get: () => sim.state.vMs },
      { label: L.cp, digits: 2, get: () => (sim.state.vMs > 0.5 ? sim.state.powerW / (windPowerW(sim.state.vMs, TURBINE_6MW.diameterM) * ETA_DT) : 0) },
    ],
  });
  panel.surface.position.copy(hero.base).add(new Vector3(52, 30, 6));
  ctx.root.add(panel.surface);
  const aPanel = ctx.stage.actor(panel.surface, { appear: 'pop' });
  const storm = createBadge(L.stormChip, 'red', 24);
  storm.fade = 0;
  storm.position.set(0, hero.radius * 0.55, 0);
  hero.nacelle.add(storm);

  let curveFor: boolean | null = null;
  const drawCurve = (sc: boolean): void => {
    const p = (v: number): number => turbinePowerW(TURBINE_6MW, v, sc) * MW;
    const fill = (id: string, xs: number[], floor = 0): void => panel.chart.setData(id, xs, xs.map((v) => Math.max(floor, p(v))));
    // zone I is drawn as a low plinth so that «штиль» is visible on the axis
    panel.chart.setData('z1', [0, TURBINE_6MW.vInMs], [0.12, 0.12]);
    fill('z2', range(TURBINE_6MW.vInMs, VR));
    fill('z3', range(VR, TURBINE_6MW.vOutMs - 1e-3, 4));
    fill('z4', range(TURBINE_6MW.vOutMs, 30, 12), 0.12);
  };
  const [hsLight] = hotspotNames('power-curve');
  let last = 7;
  let stormy = false;
  let zone = 'II';
  return {
    id: 'power-curve',
    stage: {
      camera: 'power-curve',
      show: [aPanel],
      params: { windX: hero.base.x + 10, windY: hero.base.y + 6, windZ: hero.base.z, windLength: 330, windHeight: 96, windWidth: 190 },
      enter: () => {
        sim.reset();
        sim.setWind(ui.value<number>('pc.v'));
        last = ui.value<number>('pc.v');
        stormy = false;
      },
      leave: () => (storm.fade = 0),
    },
    ui: {
      reset: true,
      honesty: ['simplified', 'notToScale'],
      controls: [
        { type: 'slider', id: 'pc.v', label: L.v, min: 0, max: 30, step: 0.1, unit: 'm/s', digits: 1, value: 7, marks: [{ value: 3, label: 'cut-in' }, { value: 25, label: 'cut-out' }] },
        { type: 'toggle', id: 'pc.sc', label: L.stormControl, value: false },
        { type: 'button', id: 'pc.gust', label: L.gust, icon: 'lightning', onClick: () => (sim.gust(), audio.play('whooshUp', { gain: 0.7 })) },
        { type: 'button', id: 'pc.storm', label: L.storm, icon: 'warning', onClick: () => (sim.storm(), (stormy = true)) },
      ],
      hotspots: [{ anchor: hero.room.at('light'), title: hsLight! }],
    },
    update(dt) {
      const sc = ui.value<boolean>('pc.sc');
      const v = ui.value<number>('pc.v');
      if (sc !== curveFor) drawCurve((curveFor = sc));
      sim.setStormControl(sc);
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
      panel.chart.setMarker('now', { x: Math.min(30, s.vMs), y: s.powerW * MW, color: 'yellow' });
      if (s.zone === 'IV' && zone !== 'IV') audio.play('breaker'); // cut-out
      zone = s.zone;
      storm.fade += ((s.zone === 'IV' ? 1 : 0) - storm.fade) * Math.min(1, dt * 4);
      panel.surface.quaternion.copy(ctx.camera.camera.quaternion);
      panel.update();
    },
  };
};
