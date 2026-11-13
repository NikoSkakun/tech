/**
 * Step 9 `capacity-factor` — «Рік вітру: КВВП і змінність». The HUD board shows how a year of wind turns
 * into energy: hours per wind speed (Weibull, k = 2) × the power curve = energy per wind speed, and under
 * them the year day by day. Model M6: `annualEnergy`, `weibullPdf`, `shearMeanSpeed`, `syntheticYear`.
 * Sliders: mean speed, hub height (+ terrain) — the hero's tower grows; «День року» (or scrubbing the year
 * strip) picks a day: the wind of the diorama becomes that day's wind.
 *
 * The year strip shows 365 daily means, not the document's 8760 hourly ticks: an hour would be a twentieth
 * of a pixel on the board; the synoptic waves of 2–5 days and the calm weeks read the same.
 */
import { Vector3 } from 'three';
import { TERRAIN_ALPHA, TURBINE_6MW, annualEnergy, gamma, shearMeanSpeed, syntheticYear, turbinePowerW, weibullPdf } from '@electricity/sim/plant-wind';
import { PLANT_TYPE } from '@/style';
import { Builder } from '@/kit';
import type { Chart } from '@/ui3d';
import { HOTSPOTS } from '../hotspots';
import { hot } from './hot';
import type { StepFactory } from './types';

const BINS = Array.from({ length: 26 }, (_, i) => i + 0.5); // 1 m/s bins, centres
const ETA_LOSS = 0.85; // availability, wakes, electrical (document M6)
const DAYS = Array.from({ length: 365 }, (_, i) => i + 1);
type Terrain = keyof typeof TERRAIN_ALPHA;

export const capacityFactor: StepFactory = ({ ui, L, live, world, hero }) => {
  // a ground lidar by the service road (hotspot): a year of measurements comes before the first foundation
  const lb = new Builder('lidar');
  lb.box(2.6, 1.6, 2.6, { r: 0.3, slot: 'gloss', c: ['mist', 'white'] });
  lb.cyl(0.7, 0.4, { seg: 16, slot: 'gloss', c: 'slate', at: [0, 1.6, 0] });
  lb.sphere(0.5, { seg: 12, slot: 'glow', c: 'cyan', at: [0, 2.05, 0] });
  for (const s of [-1, 1]) lb.cyl(0.12, 1.0, { seg: 6, c: 'slate', at: [s * 1.1, -0.9, s * 1.1] });
  const lidar = lb.build();
  world.island.place(lidar.group, hero.base.x + 30, hero.base.z + 26, 0.4, 0.9);
  const lidarTop = lidar.group.getWorldPosition(new Vector3()).add(new Vector3(0, 3, 0));

  const vMean = (): number => ui.value<number>('cf.vmean');
  const day = (): number => ui.value<number>('cf.day');
  const fromHeight = (): void => ui.set('cf.vmean', Math.round(shearMeanSpeed(ui.value<number>('cf.h'), TERRAIN_ALPHA[ui.value<Terrain>('cf.terrain')]) * 10) / 10);
  ui.onChange('cf.h', fromHeight);
  ui.onChange('cf.terrain', fromHeight);
  // one model sample per mean speed drives the three charts, the numbers and the wind of the diorama
  let sampled = -1;
  let hours: number[] = [];
  let daily = new Float32Array(365);
  let dailyWind = new Float32Array(365);
  const sample = (): void => {
    const v = vMean();
    if (v === sampled) return;
    sampled = v;
    const c = v / gamma(1.5); // Weibull scale for k = 2
    hours = BINS.map((x) => 8760 * weibullPdf(x, 2, c));
    const y = syntheticYear(v);
    daily = new Float32Array(365);
    dailyWind = new Float32Array(365);
    for (let d = 0; d < 365; d++) {
      let p = 0;
      let w = 0;
      for (let h = 0; h < 24; h++) {
        p += y.powerW[d * 24 + h]!;
        w += y.speedMs[d * 24 + h]!;
      }
      daily[d] = p / 24 / TURBINE_6MW.ratedW;
      dailyWind[d] = w / 24;
    }
  };
  /** Redraw a chart only when the sample it shows is stale. */
  const fresh = (): ((chart: Chart, draw: (chart: Chart) => void) => void) => {
    let drawn = '';
    return (chart, draw) => {
      sample();
      const key = `${entries}|${sampled}`; // the board's charts are rebuilt on every entry of the step
      if (drawn === key) return;
      drawn = key;
      draw(chart);
    };
  };
  let entries = 0;
  const [freshHours, freshEnergy, freshYear] = [fresh(), fresh(), fresh()];
  const [cfName, cfUnit] = L.cf.split(', ');
  const [aepName, aepUnit] = L.aep.split(', ');
  return {
    id: 'capacity-factor',
    stage: { camera: 'capacity-factor', enter: () => void entries++ },
    ui: {
      honesty: ['simplified', 'notToScale'],
      hint: L.shearNote,
      controls: [
        { type: 'slider', id: 'cf.vmean', label: L.vMean, min: 4, max: 11, step: 0.1, unit: 'm/s', digits: 1, value: 7 },
        { type: 'slider', id: 'cf.h', label: L.hubHeight, min: 60, max: 200, step: 5, unit: 'm', value: 150 },
        { type: 'segmented', id: 'cf.terrain', items: [{ id: 'sea', label: L.terrainSea }, { id: 'steppe', label: L.terrainSteppe }, { id: 'forest', label: L.terrainForest }], value: 'steppe' },
        { type: 'slider', id: 'cf.day', label: L.dayOfYear, min: 1, max: 365, step: 1, value: 40 },
      ],
      board: {
        title: `${L.histogram} × P(v) = ${L.energyBars}`,
        size: 'md',
        children: [
          {
            type: 'chart',
            id: 'cf.hours',
            chart: { height: 124, legend: true, x: { min: 0, max: 26, label: 'v, m/s' }, y: { min: 0, max: 1200, label: 'h', ticks: [0, 600, 1200] }, y2: { min: 0, max: 7, label: 'P, MW', ticks: [0, 3, 6] }, series: [{ id: 'h', label: L.histogram, color: 'sky', kind: 'bars' }, { id: 'p', label: 'P(v)', color: 'white', axis: 'y2' }] },
            init: (chart) => chart.setData('p', BINS, BINS.map((v) => turbinePowerW(TURBINE_6MW, v) / 1e6)),
            update: (chart) => freshHours(chart, (c) => c.setData('h', BINS, hours)),
          },
          {
            type: 'chart',
            id: 'cf.energy',
            chart: { height: 100, legend: true, x: { min: 0, max: 26, label: 'v, m/s' }, y: { min: 0, max: 3, label: 'W, GWh', ticks: [0, 1.5, 3] }, series: [{ id: 'e', label: L.energyBars, color: 'yellow', kind: 'bars' }] },
            update: (chart) => freshEnergy(chart, (c) => c.setData('e', BINS, BINS.map((x, i) => (hours[i]! * turbinePowerW(TURBINE_6MW, x) * ETA_LOSS) / 1e9))),
          },
          {
            type: 'chart',
            id: 'cf.year',
            chart: {
              height: 84,
              legend: true,
              x: { min: 1, max: 365, label: L.dayOfYear, ticks: [1, 91, 182, 274, 365] },
              y: { min: 0, max: 1, bare: true },
              series: [{ id: 'cf', label: L.yearStrip, color: PLANT_TYPE.wind, kind: 'bars' }],
              onScrub: (x) => ui.set('cf.day', Math.min(365, Math.max(1, Math.round(x)))),
            },
            update: (chart) => {
              freshYear(chart, (c) => c.setData('cf', DAYS, daily));
              chart.setMarker('day', { x: day(), y: daily[day() - 1] ?? 0, color: 'yellow' });
            },
          },
          {
            type: 'stats',
            id: 'cf.res',
            columns: 3,
            items: [
              { label: cfName!, unit: cfUnit, digits: 1, get: () => annualEnergy(TURBINE_6MW, vMean()).capacityFactor * 100 },
              { label: aepName!, unit: aepUnit, digits: 1, get: () => annualEnergy(TURBINE_6MW, vMean()).aepWh / 1e9 },
              { label: L.dayWind, unit: 'm/s', digits: 1, get: () => dailyWind[day() - 1] ?? vMean() },
            ],
          },
        ],
      },
      hotspots: [hot(() => lidarTop, HOTSPOTS['capacity-factor'].lidar)],
    },
    update() {
      sample();
      // the island lives the chosen day: its mean wind speed
      live.windTarget = dailyWind[day() - 1] ?? vMean();
      // the tower grows with the hub height (not to scale: the 150 m default is the hero as built)
      live.towerScaleTarget = 1 + (ui.value<number>('cf.h') - 150) * 0.0045;
    },
  };
};
