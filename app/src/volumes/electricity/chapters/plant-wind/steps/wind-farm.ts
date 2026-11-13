/**
 * Step 8 `wind-farm` — «ВЕС як команда: аеродинамічний слід і збірна мережа». Bird's-eye view of the 4 × 4
 * farm: wake plumes and per-turbine power from the wake model M5 (`simulateFarm` through
 * sim-bindings/farm.ts), turbines in a wake turn slower; the ground goes X-ray and shows the 33 kV collector
 * strings running to the substation. Controls: wind direction, row spacing, wake steering, wind speed.
 */
import { CylinderGeometry, Mesh, Vector3 } from 'three';
import { createVectorArrow } from '@/fx';
import { WAKE_K, simulateFarm } from '@electricity/sim/plant-wind';
import { K } from '@/style';
import { hotspotNames } from '../content';
import { FARM, flowDir } from '../layout';
import { buildConsole, buildWakes, createBadge } from '../parts';
import type { StepFactory } from './types';

const V = 8; // m/s

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
  // «керування слідом вмикають тільки для „поганих“ напрямків»
  const hint = createBadge(L.steeringHint, 'amber', 18);
  hint.position.copy(centre).setY(centre.y + 26);
  hint.fade = 0;
  wakes.group.add(hint);
  // the «compass»: drag the wind arrow round the farm (direct manipulation instead of a third slider)
  let dir = 270;
  const handle = new Mesh(new CylinderGeometry(9, 9, 3, 24), K.glow({ color: 'cyan', intensity: 0.9, whiten: 0, keepHue: true, opacity: 0.35 }));
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
      dir = Math.abs(deg - 270) < 4 ? 270 : Math.round(deg / 5) * 5; // soft magnet on «along the rows»
    },
  });
  const board = buildConsole(ctx, {
    title: L.farmEff,
    width: 430,
    unit: 0.115,
    readouts: [
      { label: 'η', unit: '%', digits: 1, get: () => farmSim.result.efficiency * 100 },
      { label: L.farmPower, unit: 'MW', digits: 1, get: () => farmSim.result.totalW / 1e6 },
      { label: L.windDir, unit: '°', digits: 0, get: () => dir },
    ],
  });
  board.surface.position.set(FARM.x - 82, FARM.y + 12, FARM.z + 70);
  ctx.root.add(board.surface);
  const aBoard = ctx.stage.actor(board.surface, { appear: 'pop' });
  const grip = new Vector3();
  const spacing = (): number => ui.value<number>('wf.s');
  const steering = (): boolean => ui.value<boolean>('wf.steer');
  let useless = false;
  let checked = '';
  const [hsTransformer, hsCable] = hotspotNames('wind-farm');
  const cable = new Vector3();
  return {
    id: 'wind-farm',
    stage: {
      camera: 'wind-farm',
      show: [aWakes, aArrow, aBoard],
      params: { xray: 1, windX: FARM.x, windY: FARM.y + 4, windZ: FARM.z, windLength: 420, windHeight: 30, windWidth: 210 },
      // the whole field must stay sharp: no miniature blur band across the rows
      post: { tiltAmount: 0, dofAperture: 0.2 },
    },
    ui: {
      honesty: ['simplified', { enlarged: FARM.enlarged }],
      hint: L.windDir,
      controls: [
        { type: 'slider', id: 'wf.s', label: L.rowSpacing, min: 3, max: 12, step: 0.5, unit: 'D', digits: 1, value: 7 },
        { type: 'toggle', id: 'wf.steer', label: L.steering, value: false },
      ],
      callouts: [{ anchor: () => handle.getWorldPosition(grip), text: `${L.windDir} ↻`, color: 'cyan', side: 'up' }],
      hotspots: [
        { anchor: () => grid.transformer, title: hsTransformer! },
        { anchor: () => cable.set(grid.feed.x - 10, FARM.y, grid.feed.z - 6), title: hsCable! },
      ],
    },
    update(dt) {
      live.windFromTarget = dir;
      live.windTarget = V;
      // the farm follows the eased direction, so the wakes swing round instead of jumping
      const w = farmSim.want;
      w.windFromDeg = Math.round((((live.windFrom % 360) + 360) % 360) * 2) / 2;
      w.rowSpacingD = spacing();
      w.steering = steering();
      w.vMs = V; // below rated, where the wake effect is strongest (document)
      const key = `${w.windFromDeg}|${w.rowSpacingD}|${w.vMs}|${w.steering}`;
      if (key !== checked) {
        checked = key;
        // steering only pays when the wakes hit the next rows: compare with the same farm unsteered
        useless = w.steering && simulateFarm({ ...w, steering: false }).efficiency >= simulateFarm(w).efficiency;
      }
      hint.fade += ((useless ? 1 : 0) - hint.fade) * Math.min(1, dt * 4);
      const f = flowDir(live.windFrom);
      const from = centre.clone().add(new Vector3(-f.x * 30, 0, -f.z * 30));
      arrow.set(from, new Vector3(f.x * 34, 0, f.z * 34));
      handle.position.set(0, 0, 0);
      arrow.material.intensity = 1.2 + grab.hover * 1.2;
      board.update();
      board.surface.quaternion.copy(ctx.camera.camera.quaternion);
    },
  };
};
