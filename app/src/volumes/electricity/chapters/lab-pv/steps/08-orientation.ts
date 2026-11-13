/**
 * Step 8 `orientation` — the Sun-path dome over the house with a test module you can turn. Tilt and azimuth
 * (sliders, dragging the module, or picking a point on the yield map) feed `orientationYield` (PVGIS table for
 * Kyiv); the Sun runs along the arc of the chosen date and `sunArc` gives the incidence angle and the beam the
 * module catches. Board: yield heat map with the marker, monthly bars, yearly numbers, cities.
 */
import { Vector3 } from 'three';
import { fmtNumber } from '@/content';
import { CITY_YIELDS, KYIV_OPTIMUM_YIELD, SEASON_DAYS, orientationYield, snowBehaviour, type ArcSample, type SeasonDay } from '@electricity/sim/lab-pv';
import { HeatMap } from '@/ui3d';
import type { StepFactory } from '../chapter';
import { doc } from '../content';
import { L, fill } from '../labels';
import { SLOPE, createRoofWorld } from '../parts/roof-world';
import { DAYS, createSunDome } from '../parts/sun-dome';
import { createTestModule } from '../parts/test-module';
import { sound } from '../sound';

const ID = 'orientation';
const DAY_S = 12; // one day of the Sun's run, seconds (document)
/** The studio backdrop turned into a deep clear sky for the roof steps (the backdrop kind is fixed per chapter). */
export const ROOF_ENV = { top: 'bg.indigo', mid: 'blue', bottom: 'blue.dark', floor: 0, bokeh: 0, motes: 0.15 } as const;

export const orientation: StepFactory = (lab) => {
  const { ctx, ui } = lab;
  const world = lab.share('roof', () => createRoofWorld(ctx));
  lab.stageRoot.add(world.group);
  const test = createTestModule();
  test.group.position.set(SLOPE.x, SLOPE.y + 0.1, SLOPE.z - 0.6);
  const dome = createSunDome(new Vector3(0, 3.5, 0), 15.5);
  const own = test.group;
  world.house.group.add(own, dome.group);
  const tilt = (): number => ui.value<number>('tilt8');
  const azimuth = (): number => ui.value<number>('az8');
  const day = (): SeasonDay => ui.value<string>('day8') as SeasonDay;
  const yieldNow = () => orientationYield(tilt(), azimuth());
  let sample: ArcSample | null = null;
  let snow = { slide: 0, on: false };
  const monthsKey = new WeakMap<object, string>(); // what each chart instance currently shows
  const heat = new HeatMap({
    height: 150,
    x: { min: -180, max: 180, label: L.heatX },
    y: { min: 0, max: 90, label: L.heatY },
    nx: 36,
    ny: 18,
    value: (x, y) => orientationYield(y, x).specificYield,
    min: 180,
    max: KYIV_OPTIMUM_YIELD,
    marker: { x: 0, y: 30 },
    unit: 'kWh/kWp',
    onPick: (x, y) => {
      ui.set('az8', Math.round(x / 5) * 5, { notify: true });
      ui.set('tilt8', Math.round(y), { notify: true });
    },
  });
  ctx.input.register(test.grip, {
    tooltip: L.dragTip,
    cursor: 'grab',
    enabled: () => lab.isCurrent(ID),
    drag: (e) => {
      ui.set('az8', Math.min(180, Math.max(-180, Math.round((azimuth() - e.dx * 0.6) / 5) * 5)), { notify: true });
      ui.set('tilt8', Math.min(90, Math.max(0, Math.round(tilt() + e.dy * 0.3))), { notify: true });
    },
  });
  const dayLabels = doc(ID, 8).split(' / ');
  const v = new Vector3();
  ctx.qa.probe('module8', test.grip);
  ctx.qa.expose('orient8', () => ({ tilt: tilt(), azimuth: azimuth(), day: day(), ...yieldNow(), incidence: sample?.incidenceDeg ?? null, snow: snow.on ? snow.slide : -1 }));

  return {
    id: ID,
    noPodium: true,
    shots: {
      [ID]: { position: [5.5, 7.4, 16.5], target: [0.2, 3.6, 0], frameAspect: 1.05, fov: 34, fit: { center: [0, 3.6, 0], radius: 7.5 }, orbit: { azimuth: 0.9, polar: 0.3 } },
    },
    stage: { show: [world.group, own, dome.group], envTune: ROOF_ENV, post: { bloomIntensity: 0.85 } },
    ui: {
      hint: L.hint8,
      honesty: [{ kind: 'notToScale', text: L.enlarged8 }, { kind: 'simplified', text: L.monthlyApprox }, { sped: 3600 }],
      board: {
        title: L.board8,
        size: 'md',
        children: [
          { type: 'custom', id: 'heat8', node: heat, update: () => heat.setMarker(azimuth(), tilt()) },
          {
            type: 'stats',
            id: 'yield8',
            columns: 2,
            items: [
              { label: L.yieldY, get: () => yieldNow().specificYield, unit: 'kWh/kWp', digits: 0, color: () => 'yellow' },
              { label: L.ofOptimum, get: () => yieldNow().fractionOfOptimum * 100, unit: '%', digits: 0, color: () => (yieldNow().fractionOfOptimum > 0.95 ? 'green' : yieldNow().fractionOfOptimum > 0.75 ? 'amber' : 'coral') },
            ],
          },
          {
            type: 'chart',
            id: 'months8',
            chart: {
              height: 170,
              x: { min: 0.5, max: 12.5, label: L.monthAxis },
              y: { min: 0, max: 150, label: 'W, kWh/kWp' },
              series: [{ id: 'm', label: L.monthSeries, color: 'amber', kind: 'bars' }, { id: 'now', label: L.monthNow, color: 'yellow', kind: 'bars' }],
            },
            update: (chart) => {
              const key = `${tilt()}|${azimuth()}|${day()}`;
              if (key === monthsKey.get(chart)) return;
              monthsKey.set(chart, key);
              const m = yieldNow().monthly;
              const sel = SEASON_DAYS[day()].month;
              const xs = m.map((_, i) => i + 1);
              chart.setData('m', xs, m.map((y, i) => (i === sel ? NaN : y)));
              chart.setData('now', xs, m.map((y, i) => (i === sel ? y : NaN)));
            },
          },
          { type: 'table', id: 'cities8', head: [L.city, 'kWh/kWp', L.cityTilt], rows: CITY_YIELDS.map((c) => [c.city, fmtNumber(c.yield), `${c.optimumTiltDeg}°`]), highlight: () => 1, visible: () => ui.value<boolean>('cities8-on') },
          { type: 'note', id: 'dust8', icon: 'info', text: L.dust, visible: () => ui.value<boolean>('snow8') },
        ],
      },
      controls: [
        { type: 'slider', id: 'tilt8', label: doc(ID, 4), min: 0, max: 90, step: 1, value: 30, unit: '°' },
        { type: 'slider', id: 'az8', label: doc(ID, 5), min: -180, max: 180, step: 5, value: 0, unit: '°', marks: [{ value: -90, label: L.east }, { value: 0, label: L.south }, { value: 90, label: L.west }] },
        { type: 'segmented', id: 'day8', items: DAYS.map((d, i) => ({ id: d, label: dayLabels[i] ?? d })), value: 'june21' },
        { type: 'toggle', id: 'cities8-on', label: doc(ID, 9), value: false },
        { type: 'toggle', id: 'snow8', label: doc(ID, 11), value: false },
      ],
      callouts: [
        { anchor: test.centre, text: () => (sample && sample.incidenceDeg < 90 ? fill(L.incidence, { a: fmtNumber(Math.round(sample.incidenceDeg)) }) : L.sunBehind), side: 'right', color: 'yellow' },
        { anchor: test.centre, side: 'left', color: 'sky', visible: () => snow.on, text: () => ({ stays: L.snowStays, 'slides-slowly': L.snowSlow, slides: L.snowSlides })[snowBehaviour(tilt())] },
      ],
      hotspots: [
        { anchor: () => world.house.group.localToWorld(v.copy(dome.top)), content: 'sun-path' },
        { anchor: () => world.house.group.localToWorld(v.set(-3.4, 8.7, 0)), content: 'east-west-roof' },
        { anchor: () => test.group.localToWorld(v.set(0, 1.2, 0)), content: 'tracker' },
      ],
    },
    update(dt, t) {
      if (!lab.isCurrent(ID)) return;
      world.update(dt, t);
      test.set(tilt(), azimuth());
      sample = dome.set(day(), (t % DAY_S) / DAY_S, tilt(), azimuth(), world.house.group.worldToLocal(test.centre.getWorldPosition(v)));
      // snow: stays on a flat module, creeps or slides off a steep one (`snowBehaviour`)
      const wantSnow = ui.value<boolean>('snow8');
      if (wantSnow !== snow.on) snow = { slide: 0, on: wantSnow };
      const mode = snowBehaviour(tilt());
      if (snow.on) snow.slide = mode === 'stays' ? 0 : Math.min(1, snow.slide + dt / (mode === 'slides' ? 2.5 : 7));
      test.snow(snow.on ? 1 : 0, snow.slide);
      sound.wind = 0.5;
    },
  };
};
