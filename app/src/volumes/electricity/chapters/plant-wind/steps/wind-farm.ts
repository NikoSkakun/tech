/**
 * Step 8 `wind-farm` — «ВЕС як команда: аеродинамічний слід і збірна мережа». Bird's-eye view of the 4 × 4
 * farm: wake plumes and per-turbine power from the wake model M5 (`simulateFarm` through
 * sim-bindings/farm.ts), turbines in a wake turn slower; the ground goes X-ray and shows the 33 kV collector
 * strings running to the substation. Controls: wind direction (drag the arrow in the scene or use the slider),
 * row spacing, wind speed, wake steering. The farm's scoreboard («табло ВЕС») is the HUD board.
 */
import { CylinderGeometry, Mesh, Vector3 } from 'three';
import { createVectorArrow } from '@/fx';
import { TURBINE_6MW, WAKE_K, simulateFarm, turbinePowerW } from '@electricity/sim/plant-wind';
import { K } from '@/style';
import { STATUS } from '@/ui3d';
import { HOTSPOTS } from '../hotspots';
import { FARM, flowDir } from '../layout';
import { buildWakes } from '../parts/wakes';
import { hot } from './hot';
import type { StepFactory } from './types';

const TURBINES = Array.from({ length: FARM.rows * FARM.perRow }, (_, i) => i + 1);

export const windFarm: StepFactory = ({ ctx, ui, L, live, world, farm, farmSim, grid }) => {
  const wakes = buildWakes(farm);
  world.island.group.add(wakes.group);
  const aWakes = ctx.stage.actor(wakes.group, { appear: 'fade' });
  farmSim.onChange = () => wakes.set(farmSim.result, farmSim.params.windFromDeg, WAKE_K.onshore, farmSim.params.vMs);
  farmSim.onChange();
  // wind arrow lying over the field, upwind of the farm
  const arrow = createVectorArrow({ color: 'sky', radius: 0.9, headLength: 7, headRadius: 2.6, intensity: 1.2 });
  world.island.group.add(arrow);
  const aArrow = ctx.stage.actor(arrow, { appear: 'pop' });
  const centre = new Vector3(FARM.x, FARM.y + FARM.hubHeight + 22, FARM.z);
  // the «compass»: drag the wind arrow round the farm (direct manipulation instead of a third slider)
  const dir = (): number => ui.value<number>('wf.dir');
  const handle = new Mesh(new CylinderGeometry(14, 14, 3, 28), K.glow({ color: 'cyan', intensity: 0.9, whiten: 0, keepHue: true, opacity: 0.35 }));
  arrow.add(handle);
  const up = new Vector3(0, 1, 0);
  const grab = { hover: 0 };
  ctx.input.register(handle, {
    tooltip: L.windDir,
    cursor: 'grab',
    enabled: () => ctx.stage.current === 'wind-farm',
    hover: (over) => ctx.tweens.to(grab, { hover: over ? 1 : 0 }, { duration: 0.12 }),
    drag: (e) => {
      const p = e.planePoint(up, centre);
      if (!p) return;
      // compass bearing of the point the arrow is dragged to = where the wind comes from
      const deg = ((Math.atan2(p.x - centre.x, -(p.z - centre.z)) * 180) / Math.PI + 360) % 360;
      ui.set('wf.dir', Math.abs(deg - 270) < 4 ? 270 : Math.round(deg / 5) * 5); // soft magnet on «along the rows»
    },
  });
  const grip = new Vector3();
  const spacing = (): number => ui.value<number>('wf.s');
  const steering = (): boolean => ui.value<boolean>('wf.steer');
  let useless = false;
  let checked = '';
  let charted: typeof farmSim.result | null = null;
  ctx.qa.probe('farm.arrow', handle, { origin: true });
  const cable = new Vector3();
  const trunk = new Vector3();
  return {
    id: 'wind-farm',
    stage: {
      camera: 'wind-farm',
      show: [aWakes, aArrow],
      params: { xray: 1, windLevel: 0.5, windX: FARM.x, windY: FARM.y + 4, windZ: FARM.z, windLength: 420, windHeight: 30, windWidth: 210 },
      // the whole field must stay sharp: no miniature blur band across the rows
      post: { tiltAmount: 0, dofAperture: 0.2 },
      enter: () => (charted = null),
    },
    ui: {
      honesty: [{ kind: 'simplified', text: L.wakeModel }, { enlarged: FARM.enlarged }],
      hint: L.windDirDrag,
      controls: [
        { type: 'slider', id: 'wf.dir', label: L.windDir, min: 0, max: 360, step: 5, unit: '°', value: 270, marks: [{ value: 270, label: '270°' }] },
        { type: 'slider', id: 'wf.s', label: L.rowSpacing, min: 3, max: 12, step: 0.5, unit: 'D', digits: 1, value: 7 },
        { type: 'slider', id: 'wf.v', label: L.v, min: 4, max: 14, step: 0.5, unit: 'm/s', digits: 1, value: 8 },
        { type: 'toggle', id: 'wf.steer', label: L.steering, value: false },
      ],
      board: {
        title: L.farmBoard,
        size: 'sm',
        children: [
          {
            type: 'stats',
            id: 'wf.res',
            columns: 2,
            items: [
              { label: L.farmEffShort, unit: '%', digits: 1, get: () => farmSim.result.efficiency * 100 },
              { label: L.farmPower, unit: 'MW', digits: 1, get: () => farmSim.result.totalW / 1e6 },
            ],
          },
          { type: 'note', id: 'wf.formula', text: L.farmEff, icon: 'info' },
          {
            type: 'chart',
            id: 'wf.bars',
            chart: { height: 120, x: { min: 0.5, max: 16.5, label: L.perTurbine, ticks: [1, 4, 8, 12, 16] }, y: { min: 0, max: 100, label: '%', ticks: [0, 50, 100] }, series: [{ id: 'p', color: 'yellow', kind: 'bars' }] },
            update: (chart) => {
              if (charted === farmSim.result) return;
              charted = farmSim.result;
              const single = turbinePowerW(TURBINE_6MW, farmSim.params.vMs) || 1;
              chart.setData('p', TURBINES, charted.turbines.map((t) => (100 * t.powerW) / single));
            },
          },
          // «керування слідом вмикають тільки для „поганих“ напрямків»
          { type: 'note', id: 'wf.useless', text: L.steeringHint, icon: 'warning', color: STATUS.warning, visible: () => useless },
        ],
      },
      callouts: [
        { anchor: () => handle.getWorldPosition(grip), text: `${L.windDir} ↻`, color: 'cyan', side: 'up' },
        { anchor: () => trunk.set(grid.feed.x - 6, FARM.y, FARM.z + 30), text: L.xray, color: 'yellow', side: 'right' },
      ],
      hotspots: [
        hot(() => grid.transformer, HOTSPOTS['wind-farm'].transformer),
        hot(() => cable.set(grid.feed.x - 10, FARM.y, grid.feed.z - 6), HOTSPOTS['wind-farm'].cable),
      ],
    },
    update() {
      const v = ui.value<number>('wf.v');
      live.windFromTarget = dir();
      live.windTarget = v;
      // the farm follows the eased direction, so the wakes swing round instead of jumping
      const w = farmSim.want;
      w.windFromDeg = Math.round((((live.windFrom % 360) + 360) % 360) * 2) / 2;
      w.rowSpacingD = spacing();
      w.steering = steering();
      w.vMs = v; // default 8 m/s: below rated, where the wake effect is strongest (document)
      const key = `${w.windFromDeg}|${w.rowSpacingD}|${w.vMs}|${w.steering}`;
      if (key !== checked) {
        checked = key;
        // steering only pays when the wakes hit the next rows: compare with the same farm unsteered
        useless = w.steering && simulateFarm({ ...w, steering: false }).efficiency >= simulateFarm(w).efficiency;
      }
      const f = flowDir(live.windFrom);
      const from = centre.clone().add(new Vector3(-f.x * 30, 0, -f.z * 30));
      arrow.set(from, new Vector3(f.x * 34, 0, f.z * 34));
      handle.position.set(0, 0, 0);
      arrow.material.intensity = 1.2 + grab.hover * 1.2;
    },
  };
};
