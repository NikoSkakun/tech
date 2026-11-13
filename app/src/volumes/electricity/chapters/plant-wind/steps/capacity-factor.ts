/**
 * Step 9 `capacity-factor` — «Рік вітру: КВВП і змінність». A hologram over the island shows how a year of
 * wind turns into energy: hours per wind speed (Weibull, k = 2) × the power curve = energy per wind speed,
 * and under them the year day by day. Model M6: `annualEnergy`, `weibullPdf`, `shearMeanSpeed`,
 * `syntheticYear`. Sliders: mean speed, hub height (+ terrain) — the hero's tower grows; scrub the year strip
 * to pick a day: the wind of the diorama becomes that day's wind.
 */
import { Vector3 } from 'three';
import { Chart, col as column } from '@/ui3d';
import { TERRAIN_ALPHA, TURBINE_6MW, annualEnergy, gamma, shearMeanSpeed, syntheticYear, turbinePowerW, weibullPdf } from '@electricity/sim/plant-wind';
import { PLANT_TYPE } from '@/style';
import { Builder } from '@/kit';
import { hotspotNames } from '../content';
import { buildConsole } from '../parts';
import type { StepFactory } from './types';

const BINS = Array.from({ length: 26 }, (_, i) => i + 0.5); // 1 m/s bins, centres
const ETA_LOSS = 0.85; // availability, wakes, electrical (document M6)
const DAYS = Array.from({ length: 365 }, (_, i) => i + 1);
type Terrain = keyof typeof TERRAIN_ALPHA;

export const capacityFactor: StepFactory = ({ ctx, ui, L, live, world, hero }) => {
  const energy = new Chart({ height: 104, x: { min: 0, max: 26, label: 'v, m/s' }, y: { min: 0, max: 3, label: 'W, GWh' }, series: [{ id: 'e', label: L.energyBars, color: 'yellow', kind: 'bars' }] });
  let day = 40;
  const year = new Chart({
    height: 84,
    x: { min: 1, max: 365, label: L.dayOfYear, ticks: [1, 91, 182, 274, 365] },
    y: { min: 0, max: 1, bare: true },
    series: [{ id: 'cf', color: PLANT_TYPE.wind, kind: 'bars' }],
    onScrub: (x) => (day = Math.min(365, Math.max(1, Math.round(x)))),
  });
  const panel = buildConsole(ctx, {
    title: `${L.histogram} × P(v) = ${L.energyBars}`,
    width: 540,
    unit: 0.2,
    chart: { height: 132, x: { min: 0, max: 26, label: 'v, m/s' }, y: { min: 0, max: 1200, label: 'h' }, y2: { min: 0, max: 7, label: 'P, MW' }, series: [{ id: 'h', label: L.histogram, color: 'sky', kind: 'bars' }, { id: 'p', label: 'P(v)', color: 'white', axis: 'y2' }] },
    extra: column({ gap: 10 }, energy, year),
    readouts: [
      { label: L.cf, unit: '%', digits: 1, get: () => annualEnergy(TURBINE_6MW, vMean()).capacityFactor * 100 },
      { label: L.aep, unit: 'GWh', digits: 1, get: () => annualEnergy(TURBINE_6MW, vMean()).aepWh / 1e9 },
    ],
  });
  panel.chart.setData('p', BINS, BINS.map((v) => turbinePowerW(TURBINE_6MW, v) / 1e6));
  panel.surface.position.set(-12, 96, 40);
  ctx.root.add(panel.surface);
  const aPanel = ctx.stage.actor(panel.surface, { appear: 'pop' });
  // a ground lidar by the service road (hotspot): a year of measurements comes before the first foundation
  const lb = new Builder('lidar');
  lb.box(2.6, 1.6, 2.6, { r: 0.3, slot: 'gloss', c: ['mist', 'white'] });
  lb.cyl(0.7, 0.4, { seg: 16, slot: 'gloss', c: 'slate', at: [0, 1.6, 0] });
  lb.sphere(0.5, { seg: 12, slot: 'glow', c: 'cyan', at: [0, 2.05, 0] });
  for (const s of [-1, 1]) lb.cyl(0.12, 1.0, { seg: 6, c: 'slate', at: [s * 1.1, -0.9, s * 1.1] });
  const lidar = lb.build();
  world.island.place(lidar.group, hero.base.x + 30, hero.base.z + 26, 0.4, 0.9);

  const vMean = (): number => ui.value<number>('cf.vmean');
  const fromHeight = (): void => ui.set('cf.vmean', Math.round(shearMeanSpeed(ui.value<number>('cf.h'), TERRAIN_ALPHA[ui.value<Terrain>('cf.terrain')]) * 10) / 10);
  ui.onChange('cf.h', fromHeight);
  ui.onChange('cf.terrain', fromHeight);
  let drawn = -1;
  let daily = new Float32Array(365);
  let dailyWind = new Float32Array(365);
  const redraw = (): void => {
    const v = vMean();
    if (v === drawn) return;
    drawn = v;
    const c = v / gamma(1.5); // Weibull scale for k = 2
    const hours = BINS.map((x) => 8760 * weibullPdf(x, 2, c));
    panel.chart.setData('h', BINS, hours);
    energy.setData('e', BINS, BINS.map((x, i) => (hours[i]! * turbinePowerW(TURBINE_6MW, x) * ETA_LOSS) / 1e9));
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
    year.setData('cf', DAYS, daily);
  };
  const [hsLidar] = hotspotNames('capacity-factor');
  return {
    id: 'capacity-factor',
    stage: { camera: 'capacity-factor', show: [aPanel] },
    ui: {
      honesty: ['simplified', 'notToScale'],
      hint: L.shearNote,
      controls: [
        { type: 'slider', id: 'cf.vmean', label: L.vMean, min: 4, max: 11, step: 0.1, unit: 'm/s', digits: 1, value: 7 },
        { type: 'slider', id: 'cf.h', label: L.hubHeight, min: 60, max: 200, step: 5, unit: 'm', value: 150 },
        { type: 'segmented', id: 'cf.terrain', items: [{ id: 'sea', label: L.terrainSea }, { id: 'steppe', label: L.terrainSteppe }, { id: 'forest', label: L.terrainForest }], value: 'steppe' },
      ],
      hotspots: [{ anchor: () => lidar.group.getWorldPosition(new Vector3()).add(new Vector3(0, 3, 0)), title: hsLidar! }],
    },
    update() {
      redraw();
      year.setMarker('day', { x: day, y: daily[day - 1] ?? 0, color: 'yellow', label: String(day) });
      // the island lives the chosen day: its mean wind speed
      live.windTarget = dailyWind[day - 1] ?? vMean();
      // the tower grows with the hub height (not to scale: the 150 m default is the hero as built)
      live.towerScaleTarget = 1 + (ui.value<number>('cf.h') - 150) * 0.0045;
      panel.update();
      panel.surface.quaternion.copy(ctx.camera.camera.quaternion);
    },
  };
};
