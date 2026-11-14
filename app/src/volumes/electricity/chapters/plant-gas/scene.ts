/**
 * «Газові електростанції» — scene orchestrator. It only wires things together:
 *   1. build the world from `parts/*` (kit models, chapter hero models, effects);
 *   2. create the live state (`state.ts`);
 *   3. let every step module (`steps/*`) declare its stage state and step UI;
 *   4. each frame: ease the world toward the live state, then run the current step's `update`.
 * See README.md in this directory for the conventions.
 */
import type { Object3D } from 'three';
import { damp, defineScene, type Actor } from '@/engine/api';
import { stepUi } from '@/hud';
import { LOOK_SCALE } from '@/style';
import { L } from './content';
import { ENGINES, HALL, HRSG, ISLAND } from './layout';
import { buildGtFlow } from './parts/gt-flow';
import { buildIsland } from './parts/island';
import { buildTurbofan } from './parts/turbofan';
import { buildWorkArrows } from './parts/work-arrows';
import { bindGt } from './sim-bindings/gt';
import { buildWorld } from './parts/world';
import { defineShots } from './shots';
import { setMood, updateSound } from './sound';
import { createLive, resetTargets } from './state';
import { STEPS, STEP_IDS } from './steps';
import { activateHotspots, hotspotsOf, watchHotspots } from './steps/hot';
import type { Deps, StepModule } from './steps/types';

export default defineScene(async (ctx) => {
  const { root, stage, camera } = ctx;
  // the diorama is built in metres: tell the environment so fog / AO / DOF keep the reference look
  ctx.env.setScale(ISLAND.semiX, { adaptFrom: LOOK_SCALE.diorama });
  ctx.env.setShadow({ extent: 380, center: [0, 0, 0], softness: 3 });

  const world = buildWorld(ctx);
  root.add(world.island.group);
  ctx.progress(0.3);
  await ctx.breathe();
  const isl = await buildIsland(ctx);
  ctx.progress(0.7);
  await ctx.breathe();

  const live = createLive();
  defineShots(camera, isl);
  const { hall, hrsg } = isl.ccgt;
  // parts share their model's materials, so they cannot fade alone: they slide away (roofs up, walls down)
  const slide = (obj: Object3D, dy: number): Actor => {
    const y0 = obj.position.y;
    return stage.actor(obj, {
      appear: (o, v) => {
        o.position.y = y0 + (1 - v) * dy;
        o.visible = v > 0.01;
      },
    });
  };
  const roof = slide(hall.part('roof'), 40);
  const front = slide(hall.part('front'), -HALL.height - 1);
  const hrsgFront = slide(hrsg.part('front'), -HRSG.height - 2);
  const intake = stage.actor(isl.ccgt.intake.group, { appear: 'fade' });
  const duct = stage.actor(isl.ccgt.exhaustDuct.group, { appear: 'fade' });
  const inside = stage.actor(isl.ccgt.interior, { appear: 'none' });
  const engines = stage.actor(isl.engines.interior, { appear: 'none' });
  const engineRoof = slide(isl.engines.hall.part('roof'), 30);
  const engineFront = slide(isl.engines.hall.part('front'), -ENGINES.height - 1);
  const outside = [roof, front, hrsgFront, intake, duct, engineRoof, engineFront];
  const shell = { roof, front, hrsgFront, intake, duct, outside, inside, engines, engineRoof, engineFront };
  // the hero gas turbine's insides: flows, flame, work arrows; the turbofan for comparison
  const gtGroup = isl.ccgt.gt.group;
  const flow = buildGtFlow(ctx, gtGroup);
  const arrows = buildWorkArrows();
  gtGroup.add(arrows.group);
  const fan = buildTurbofan();
  root.add(fan.group);
  const gtSim = bindGt();
  gtSim.apply(flow, arrows);
  const flows = [...Object.values(flow.flows), flow.fuel, flow.flame].map((o) => stage.actor(o, { appear: 'fade' }));
  const gt = { flow, arrows, sim: gtSim, fan, flows, arrowActor: stage.actor(arrows.group, { appear: 'grow' }) };
  const ui = stepUi(ctx);
  watchHotspots(ctx);
  const deps: Deps = { ctx, ui, L, live, world, isl, gt, shell };
  const steps: StepModule[] = [];
  for (const [i, make] of STEPS.entries()) {
    hotspotsOf(STEP_IDS[i]!);
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
      activateHotspots(stepId);
      setMood(stepId === 'gas-engines');
    },
    update(dt, t) {
      // the step first states what it wants…
      resetTargets(live);
      current?.update?.(dt, t);
      // …then the world glides there
      live.gt = damp(live.gt, live.gtTarget, 1.6, dt);
      live.st = damp(live.st, live.stTarget, 0.8, dt);
      live.peaker = damp(live.peaker, live.peakerTarget, 1.2, dt);
      live.engines = damp(live.engines, live.enginesTarget, 1.5, dt);
      live.bypass = damp(live.bypass, live.bypassTarget, 2.5, dt);
      live.night = damp(live.night, live.nightTarget, 1.6, dt);
      live.spin = damp(live.spin, live.spinTarget, 2, dt);
      isl.ccgt.gt.speed = live.spin;
      isl.ccgt.stSpin = Math.min(1, live.st * 1.2);
      isl.ccgt.damper.rotation.y = live.bypass * (Math.PI / 2);
      for (const m of isl.lit) m.night = live.night;
      isl.town.night = live.night;
      isl.engines.running = live.engines;
      isl.haze.main.fade = live.gt * (1 - live.bypass);
      isl.haze.bypass.fade = live.gt * live.bypass;
      isl.haze.peaker.fade = live.peaker;
      isl.yard.wire.power = 0.35 + 0.65 * Math.min(1, (live.gt + live.peaker * 0.1 + live.engines * 0.02) / 1.1);
      flow.setLoad(Math.min(1, live.gt * 1.2) * Math.min(1, live.spin / 1.5));
      flow.update(t);
      isl.update(dt, t);
      for (const m of world.alive) m.update?.(dt, t);
      updateSound(current?.id, live);
    },
  };
});
