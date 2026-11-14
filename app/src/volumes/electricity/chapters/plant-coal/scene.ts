/**
 * «ТЕС на вугіллі (і ТЕЦ)» — scene orchestrator. It only wires things together:
 *   1. build the world from `parts/*` (kit models, chapter hero models, effects);
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
import { buildPlant } from './parts/plant';
import { buildWorld } from './parts/world';
import { defineShots } from './shots';
import { updateSound } from './sound';
import { createLive, resetTargets } from './state';
import { STEPS } from './steps';
import { createHot } from './steps/hot';
import type { Deps, StepModule } from './steps/types';

export default defineScene(async (ctx) => {
  const { root, stage, camera } = ctx;
  // the diorama is built in metres: tell the environment so fog / AO / DOF keep the reference look
  ctx.env.setScale(ISLAND.semiX, { adaptFrom: LOOK_SCALE.diorama });
  ctx.env.setShadow({ extent: 360, center: [0, 0, 0], softness: 3 });

  /* ------------------------------------------------------------------------------------- world */
  const world = buildWorld(ctx);
  root.add(world.island.group);
  ctx.progress(0.3);
  await ctx.breathe();
  const plant = buildPlant(ctx, world);
  ctx.progress(0.6);
  await ctx.breathe();

  /* --------------------------------------------------------------------------- state and steps */
  const live = createLive();
  defineShots(camera);
  // shells that open per step (stage params: random-access safe, eased by the stage)
  stage.param('boilerOpen', 0, { duration: 1.4, ease: 'power2.inOut', onChange: (v) => plant.main.setOpen(v) });
  stage.param('hallOpen', 0, { duration: 1.4, ease: 'power2.inOut', onChange: (v) => plant.main.setHallOpen(v) });
  stage.param('turboOpen', 0, { duration: 1.2, onChange: (v) => plant.main.turbo.setOpen(v) });
  stage.param('gasOpen', 0, { duration: 1.2, onChange: (v) => plant.gas.setOpen(v) });
  plant.main.setOpen(0);
  const ui = stepUi(ctx);
  const hot = createHot(ctx);
  const deps: Deps = { ctx, ui, L, live, world, plant, hot };
  const steps: StepModule[] = [];
  for (const make of STEPS) {
    steps.push(make(deps));
    await ctx.breathe();
  }
  stage.define(Object.fromEntries(steps.map((s) => [s.id, s.stage])));
  ui.define(Object.fromEntries(steps.map((s) => [s.id, s.ui ?? {}])));
  ctx.progress(1);
  ctx.qa.expose('live', () => ({ ...live }));

  let current: StepModule | undefined;
  return {
    enterStep(stepId) {
      current = steps.find((s) => s.id === stepId);
    },
    update(dt, t) {
      resetTargets(live);
      current?.update?.(dt, t);
      live.night = damp(live.night, live.nightTarget, 1.6, dt);
      live.load = damp(live.load, live.loadTarget, 1.4, dt);
      live.smoke = damp(live.smoke, live.smokeTarget, 1.2, dt);
      live.vapour = damp(live.vapour, live.vapourTarget, 1.2, dt);
      live.towerPlume = damp(live.towerPlume, live.towerPlumeTarget, 1, dt);
      for (const m of plant.lit) m.night = live.night;
      plant.main.shell.night = Math.max(0.65, live.night); // the furnace glows through the windows at any hour
      for (const p of plant.plumes) p.rate = live.towerPlume;
      plant.stackSmoke.setEmitting(live.smoke > 0.05);
      plant.stackSmoke.rate = live.smoke;
      plant.stackVapour.rate = live.vapour * (1 - live.smoke);
      for (const b of plant.yard.belts) b.speed = 3 * live.load;
      plant.main.turbo.speed = 2.2;
      plant.site.wire.power = live.load;
      plant.update(dt, t);
      for (const m of world.alive) m.update(dt, t);
      updateSound(current?.id, live);
    },
  };
});
