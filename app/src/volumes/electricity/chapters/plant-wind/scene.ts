/**
 * «Вітрова електростанція (ВЕС)» — scene orchestrator. It only wires things together:
 *   1. build the world from `parts/*` (kit models, chapter hero models, effects);
 *   2. create the live state (`state.ts`) and the simulation bindings (`sim-bindings/*`);
 *   3. let every step module (`steps/*`) declare its stage state and step UI;
 *   4. each frame: ease the world toward the live state, then run the current step's `update`.
 * See README.md in this directory for the conventions.
 */
import { damp, defineScene } from '@/engine/api';
import { stepUi } from '@/hud';
import { TURBINE_15MW, TURBINE_6MW, pitchDeg, rotorRpm, turbinePowerW, type FarmResult } from '@electricity/sim/plant-wind';
import { LOOK_SCALE } from '@/style';
import { L } from './content';
import { ISLAND, yawInto } from './layout';
import { buildChain } from './parts/chain';
import { buildFarm } from './parts/farm';
import { buildGrid } from './parts/grid';
import { buildHero } from './parts/hero';
import { buildLights } from './parts/lights';
import { rigNacelle } from './parts/nacelle-rig';
import { buildOffshore } from './parts/offshore';
import { buildWindField } from './parts/wind-field';
import { buildWorld } from './parts/world';
import { defineShots } from './shots';
import { bindFarm, type FarmParams } from './sim-bindings/farm';
import { setMood, updateSound } from './sound';
import { createLive, dampAngle, resetTargets, type Live } from './state';
import { STEPS } from './steps';
import type { Deps, StepModule } from './steps/types';

declare global {
  interface Window {
    /** Debug / QA view of the wind chapter (present only while the chapter is alive). */
    __wind?: {
      live: Readonly<Live>;
      farm(): FarmResult;
      farmParams(): Readonly<FarmParams>;
      variant(): string;
    };
  }
}

export default defineScene(async (ctx) => {
  const { root, stage, camera } = ctx;
  // the diorama is built in metres: tell the environment so fog / AO / DOF keep the reference look
  ctx.env.setScale(ISLAND.semiX, { adaptFrom: LOOK_SCALE.diorama });
  ctx.env.setShadow({ extent: 330, center: [60, 0, 0], softness: 3 });

  /* ------------------------------------------------------------------------------------- world */
  const world = buildWorld(ctx);
  root.add(world.island.group);
  ctx.progress(0.25);
  await ctx.breathe();
  const hero = buildHero(world);
  const farm = buildFarm(world);
  const grid = buildGrid(world);
  ctx.progress(0.45);
  await ctx.breathe();
  const offshore = buildOffshore(ctx);
  root.add(offshore.sea.group);
  const wind = buildWindField(ctx);
  root.add(wind.mesh);
  const chain = buildChain(world, hero, farm, grid);
  ctx.progress(0.65);
  await ctx.breathe();

  /* --------------------------------------------------------------------------- state and steps */
  const lit = [...world.lit, ...grid.lit, ...offshore.lit, hero.room.model, chain.kiosk, farm.fleet.model];
  const lights = buildLights(lit, [hero.room.model, farm.fleet.model, ...offshore.lit]);
  const rig = rigNacelle(hero.room, hero.k, ctx.tweens);
  const live = createLive();
  const farmSim = bindFarm(farm, chain, wind, live);
  farmSim.update();
  wind.setWake(0, hero.hub, hero.radius);
  defineShots(camera, hero);
  // where the wind streaks are concentrated: every step may move / resize the box (centre, extent)
  const box = (name: string, initial: number, set: (v: number) => void): void =>
    void stage.param(name, initial, { duration: 1.6, onChange: set });
  box('windX', 40, (v) => (wind.centre.x = v));
  box('windY', 12, (v) => (wind.centre.y = v));
  box('windZ', 0, (v) => (wind.centre.z = v));
  box('windLength', 640, (v) => (wind.size.x = v));
  box('windHeight', 84, (v) => (wind.size.y = v));
  box('windWidth', 330, (v) => (wind.size.z = v));
  // how strongly buried cables shine through the ground (step 8: X-ray)
  box('xray', 0.35, (v) => (chain.xray = v));
  // how far the camera can see into the sea block (step 10)
  let clarity = 0;
  box('clarity', 0, (v) => (clarity = v));
  const ui = stepUi(ctx);
  const deps: Deps = { ctx, ui, L, live, world, hero, farm, farmSim, grid, offshore, wind, chain, lights, rig };
  const steps: StepModule[] = [];
  for (const make of STEPS) {
    steps.push(make(deps));
    await ctx.breathe();
  }
  stage.define(Object.fromEntries(steps.map((s) => [s.id, s.stage])));
  ui.define(Object.fromEntries(steps.map((s) => [s.id, s.ui ?? {}])));
  ctx.progress(1);

  // QA hook for the interaction test (qa/interaction.mjs): read-only view of the live state
  window.__wind = { live, farm: () => farmSim.result, farmParams: () => farmSim.params, variant: () => rig.variant };
  ctx.onDispose(() => delete window.__wind);

  let current: StepModule | undefined;
  let towerApplied = 1;
  return {
    enterStep(stepId) {
      current = steps.find((s) => s.id === stepId);
      setMood(stepId === 'role');
    },
    update(dt, t) {
      // the step first states what it wants (wind, hero control)…
      resetTargets(live);
      farmSim.defaults(live.wind);
      current?.update?.(dt, t);
      // …then the world glides there
      live.wind = damp(live.wind, live.windTarget, 2.2, dt);
      live.windFrom = dampAngle(live.windFrom, live.windFromTarget, 3, dt);
      live.night = damp(live.night, live.nightTarget, 1.6, dt);
      live.rotorScale = damp(live.rotorScale, live.rotorScaleTarget, 4, dt);
      live.towerScale = damp(live.towerScale, live.towerScaleTarget, 3, dt);
      hero.setRotorScale(live.rotorScale);
      if (Math.abs(live.towerScale - towerApplied) > 1e-4) hero.setHeightScale((towerApplied = live.towerScale));
      if (!live.heroManual) {
        // a rotor of another diameter keeps its tip-speed ratio: n ∝ 1/D
        live.heroRpm = damp(live.heroRpm, rotorRpm(TURBINE_6MW, live.wind) / live.rotorScale, 1.6, dt);
        live.heroPitch = damp(live.heroPitch, pitchDeg(TURBINE_6MW, live.wind), 2, dt);
        live.heroPower = turbinePowerW(TURBINE_6MW, live.wind) / TURBINE_6MW.ratedW;
      }
      hero.setRpm(live.heroRpm);
      hero.setPitchDeg(live.heroPitch);
      hero.turbine.setYaw(yawInto(live.windFrom));
      hero.turbine.update(dt, t);
      live.cover = damp(live.cover, live.coverTarget, 3.2, dt);
      hero.room.setOpen(live.cover);
      rig.update(dt, hero.turbine.rotorSpeed, live.wind);
      wind.speed = live.wind;
      wind.fromDeg = live.windFrom;
      wind.opacity = 1 - 0.72 * live.night; // pale streaks would glare against a night sky
      wind.update(dt);
      farmSim.update();
      farm.update(dt);
      // offshore: steadier, slightly stronger wind (document, step 10)
      offshore.speed = (rotorRpm(TURBINE_15MW, live.wind * 1.15) * Math.PI) / 30;
      offshore.update(dt, t);
      live.seaBoost = damp(live.seaBoost, live.seaBoostTarget, 3, dt);
      offshore.sea.setClarity(Math.min(1, clarity + live.seaBoost));
      chain.update(live.heroPower, live.farmPower);
      lights.night = live.night;
      lights.update(t);
      for (const m of world.alive) m.update(dt, t);
      updateSound(current?.id, live);
    },
  };
});
