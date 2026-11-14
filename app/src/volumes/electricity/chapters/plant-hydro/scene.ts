/**
 * «ГЕС і ГАЕС: енергія води» — scene orchestrator. It only wires things together:
 *   1. build the valley from `parts/*` (terrain, reservoir, dam, powerhouse, grid, pumped storage, water fx, stand);
 *   2. create the live state (`state.ts`);
 *   3. let every step module (`steps/*`) declare its stage state and step UI;
 *   4. each frame: ease the world toward the live state, then run the current step's `update`.
 * See README.md in this directory for the conventions.
 */
import { damp, defineScene } from '@/engine/api';
import { stepUi } from '@/hud';
import { LOOK_SCALE } from '@/style';
import { L } from './content';
import { ISLAND } from './layout';
import { buildGrid } from './parts/grid';
import { buildPsh } from './parts/psh';
import { buildStand } from './parts/stand';
import { buildWaterFx } from './parts/water-fx';
import { buildWorld } from './parts/world';
import { defineShots } from './shots';
import { setMood, updateSound } from './sound';
import { createLive, resetTargets } from './state';
import { STEPS } from './steps';
import { watchHotspots } from './steps/hot';
import type { Deps, StepModule } from './steps/types';

export default defineScene(async (ctx) => {
  const { root, stage, camera } = ctx;
  // the diorama is built in metres: tell the environment so fog / AO / DOF keep the reference look
  ctx.env.setScale(ISLAND.semiX, { adaptFrom: LOOK_SCALE.diorama });
  ctx.env.setShadow({ extent: 420, center: [0, 0, 0], softness: 3 });

  const world = buildWorld(ctx);
  root.add(world.island.group);
  ctx.progress(0.3);
  await ctx.breathe();
  const grid = buildGrid(world);
  const psh = buildPsh(world);
  world.island.group.add(psh.group);
  const fx = buildWaterFx(ctx);
  world.island.group.add(fx.group);
  const stand = buildStand();
  root.add(stand.group);
  // the stand appears only in the steps that use it (they list `stand.group` in `show`)
  stage.actor(stand.group, { appear: 'fade' });
  ctx.progress(0.55);
  await ctx.breathe();

  const live = createLive();
  defineShots(camera);
  const ui = stepUi(ctx);
  watchHotspots(ctx);
  const deps: Deps = { ctx, ui, L, live, world, grid, psh, stand, fx };
  const steps: StepModule[] = [];
  for (const make of STEPS) {
    steps.push(make(deps));
    await ctx.breathe();
  }
  stage.define(Object.fromEntries(steps.map((s) => [s.id, s.stage])));
  ui.define(Object.fromEntries(steps.map((s) => [s.id, s.ui ?? {}])));
  ctx.progress(1);

  ctx.qa.expose('live', () => ({ ...live }));
  const lit = [...world.lit, ...grid.lit, psh.model];
  let current: StepModule | undefined;
  return {
    enterStep(stepId) {
      current = steps.find((s) => s.id === stepId);
      setMood(stepId === 'pumped-storage');
    },
    update(dt, t) {
      resetTargets(live);
      current?.update?.(dt, t);
      live.level = damp(live.level, live.levelTarget, 1.6, dt);
      live.spill = damp(live.spill, live.spillTarget, 1.4, dt);
      live.turbine = damp(live.turbine, live.turbineTarget, 1.6, dt);
      live.night = damp(live.night, live.nightTarget, 1.4, dt);
      live.storm = damp(live.storm, live.stormTarget, 1.2, dt);
      live.mountainRain = damp(live.mountainRain, live.mountainRainTarget, 1.2, dt);
      live.psh = damp(live.psh, live.pshTarget, 2.5, dt);
      live.bowl = damp(live.bowl, live.bowlTarget, 2, dt);
      live.town = damp(live.town, live.townTarget, 2, dt);
      world.reservoir.setLevel(live.level);
      world.dam.setGates(live.spill > 0.02 ? 0.25 + 0.75 * live.spill : 0);
      fx.set(live.spill, live.turbine, live.storm, live.mountainRain, live.level);
      world.powerhouse.spin = 0.4 + 1.4 * live.turbine;
      grid.setPower(0.25 + 0.75 * live.turbine);
      psh.setLevel(live.bowl);
      psh.setFlow(live.psh);
      for (const m of lit) m.night = live.night;
      world.town.night = live.night * (0.35 + 0.65 * live.town);
      for (const m of world.alive) m.update?.(dt, t);
      updateSound(current?.id, live);
    },
  };
});
