/**
 * «Атомна електростанція (АЕС)» — scene orchestrator. It only wires things together:
 *   1. build the island and the power unit (`parts/*`) and the inner sets below it;
 *   2. create the live state (`state.ts`);
 *   3. let every step module (`steps/*`) declare its stage state and step UI;
 *   4. each frame: ease the world toward the live state, then run the current step's `update`.
 * See README.md in this directory for the conventions.
 */
import { damp, defineScene } from '@/engine/api';
import { stepUi } from '@/hud';
import { LOOK_SCALE } from '@/style';
import { L } from './content';
import { CONTAINMENT, ISLAND } from './layout';
import { buildInner } from './parts/inner';
import { buildPlant } from './parts/plant';
import { buildWorld } from './parts/world';
import { defineShots } from './shots';
import { setMood, updateSound } from './sound';
import { createLive, resetTargets } from './state';
import { STEPS } from './steps';
import { buildingStep, watchHotspots } from './steps/hot';
import type { Deps, StepModule } from './steps/types';

export default defineScene(async (ctx) => {
  const { root, stage, camera } = ctx;
  ctx.env.setScale(ISLAND.radius, { adaptFrom: LOOK_SCALE.diorama });
  ctx.env.setShadow({ extent: 300, center: [0, 0, 0], softness: 3 });

  const world = buildWorld(ctx);
  root.add(world.island.group);
  ctx.progress(0.25);
  await ctx.breathe();
  const plant = buildPlant(ctx, world);
  ctx.progress(0.45);
  await ctx.breathe();
  const inner = buildInner(ctx);
  ctx.progress(0.6);
  await ctx.breathe();

  const live = createLive();
  defineShots(camera, world.y(CONTAINMENT.x, CONTAINMENT.z));
  const ui = stepUi(ctx);
  watchHotspots(ctx);
  const frontY = plant.containment.front.group.position.y;
  const actors = {
    // the front half of the containment sinks into the ground (a doll's house opening) and rises back
    front: stage.actor(plant.containment.front.group, {
      appear: (obj, v) => {
        obj.position.y = frontY - (1 - v) * 62;
        obj.visible = v > 0.01;
      },
    }),
    interior: stage.actor(plant.interior.group, { appear: 'none' }),
    island: stage.actor(plant.island.group, { appear: 'none' }),
  };
  const deps: Deps = { ctx, ui, L, live, world, plant, inner, actors };
  const steps: StepModule[] = [];
  for (const [i, make] of STEPS.entries()) {
    buildingStep(ctx.manifest.steps[i]!.id);
    steps.push(make(deps));
    await ctx.breathe();
  }
  stage.define(Object.fromEntries(steps.map((s) => [s.id, s.stage])));
  ui.define(Object.fromEntries(steps.map((s) => [s.id, s.ui ?? {}])));
  ctx.progress(1);
  ctx.qa.expose('live', () => ({ ...live }));

  let current: StepModule | undefined;
  let hallApplied = true;
  plant.hall.setOpen(true, true);
  return {
    enterStep(stepId) {
      current = steps.find((s) => s.id === stepId);
      setMood(stepId);
    },
    update(dt, t) {
      resetTargets(live);
      current?.update?.(dt, t);
      live.power = damp(live.power, live.powerTarget, 2, dt);
      live.cooling = damp(live.cooling, live.coolingTarget, 1.2, dt);
      plant.wire.power = 0.15 + 0.85 * live.power;
      if (live.hallOpen !== hallApplied) plant.hall.setOpen((hallApplied = live.hallOpen), live.hallOpen);
      plant.island.turbine.speed = 157 * live.power * 0.02; // 1500 rpm machine, slowed ×50
      for (const p of plant.plumes) p.rate = 0.25 + 0.75 * live.cooling;
      for (const m of world.alive) m.update(dt, t);
      for (const m of plant.lit) m.update(dt, t);
      // the polar crane turns slowly; the main circulation pumps spin
      plant.interior.crane.group.rotation.y = t * 0.03;
      for (const imp of plant.interior.loops.impellers) imp.rotation.y = t * 6;
      updateSound(current?.id, live);
    },
  };
});
