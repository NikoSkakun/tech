/**
 * «Вітрова електростанція (ВЕС)» — scene orchestrator. It only wires things together:
 *   1. build the world from `parts/*` (kit models, chapter hero models, effects);
 *   2. create the live state (`state.ts`) and the simulation bindings (`sim-bindings/*`);
 *   3. let every step module (`steps/*`) declare its stage state and step UI;
 *   4. each frame: ease the world toward the live state, then run the current step's `update`.
 * See README.md in this directory for the conventions.
 */
import { Vector3 } from 'three';
import { damp, defineScene } from '@/engine/api';
import { stepUi } from '@/hud';
import { TURBINE_15MW, TURBINE_6MW, pitchDeg, rotorRpm, turbinePowerW } from '@electricity/sim/plant-wind';
import { LOOK_SCALE } from '@/style';
import { L } from './content';
import { ISLAND, yawInto } from './layout';
import { buildBeacons } from './parts/beacons';
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
import { bindFarm } from './sim-bindings/farm';
import { setMood, updateSound } from './sound';
import { createLive, dampAngle, resetTargets } from './state';
import { STEPS } from './steps';
import { watchHotspots } from './steps/hot';
import type { Deps, StepModule } from './steps/types';

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
  root.add(wind.group);
  const chain = buildChain(world, hero, farm, grid);
  ctx.progress(0.65);
  await ctx.breathe();

  /* --------------------------------------------------------------------------- state and steps */
  // aviation lights: hero, 16 farm turbines, 20 offshore turbines — one synchronous flash
  const beacons = buildBeacons(1 + farm.count + offshore.tops.length);
  root.add(beacons.orbs);
  const seaTops = offshore.tops.map((p) => offshore.sea.group.localToWorld(p.clone()));
  const lights = buildLights([...world.lit, ...grid.lit, ...offshore.lit, hero.room.model, chain.kiosk], beacons);
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
  // overall strength of the streaks (a step that draws its own flow picture over them turns them down)
  let windLevel = 1;
  box('windLevel', 1, (v) => (windLevel = v));
  // how strongly buried cables shine through the ground (step 8: X-ray)
  box('xray', 0.35, (v) => (chain.xray = v));
  // how far the camera can see into the sea block (step 10)
  let clarity = 0;
  box('clarity', 0, (v) => (clarity = v));
  const ui = stepUi(ctx);
  watchHotspots(ctx);
  const deps: Deps = { ctx, ui, L, live, world, hero, farm, farmSim, grid, offshore, wind, chain, lights, rig };
  const steps: StepModule[] = [];
  for (const make of STEPS) {
    steps.push(make(deps));
    await ctx.breathe();
  }
  stage.define(Object.fromEntries(steps.map((s) => [s.id, s.stage])));
  ui.define(Object.fromEntries(steps.map((s) => [s.id, s.ui ?? {}])));
  ctx.progress(1);

  // QA (qa/interaction.mjs, production builds included): observable state and a few named scene points
  ctx.qa.expose('live', () => ({ ...live }));
  ctx.qa.expose('farm', () => ({ efficiency: farmSim.result.efficiency, totalW: farmSim.result.totalW, ...farmSim.params }));
  ctx.qa.expose('variant', () => rig.variant);
  ctx.qa.probe('hero.hub', () => hero.hub);

  let current: StepModule | undefined;
  let towerApplied = 1;
  const lamp = new Vector3();
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
      live.spinDip = damp(live.spinDip, live.spinDipTarget, 5, dt);
      const spin = 1 - live.spinDip;
      hero.setRpm(live.heroRpm * spin);
      hero.setPitchDeg(live.heroPitch);
      hero.turbine.setYaw(yawInto(live.windFrom));
      hero.turbine.update(dt, t);
      live.cover = damp(live.cover, live.coverTarget, 3.2, dt);
      hero.room.setOpen(live.cover);
      rig.update(dt, hero.turbine.rotorSpeed, live.wind);
      wind.speed = live.wind;
      wind.fromDeg = live.windFrom;
      wind.opacity = windLevel * (1 - 0.72 * live.night); // pale streaks would glare against a night sky
      wind.update(dt);
      farmSim.update();
      farm.update(dt * spin);
      // offshore: steadier, slightly stronger wind (document, step 10)
      offshore.speed = ((rotorRpm(TURBINE_15MW, live.wind * 1.15) * Math.PI) / 30) * spin;
      offshore.update(dt, t);
      live.seaBoost = damp(live.seaBoost, live.seaBoostTarget, 3, dt);
      offshore.sea.setClarity(Math.min(1, clarity + live.seaBoost));
      chain.update(live.heroPower, live.farmPower);
      grid.wire.power *= 1 - live.lineDim;
      // lamps ride on the nacelle roofs: the hero's follows its tower height, the farm's follow the rows
      // drawn with a near-constant size on screen: a lamp in the close-ups, a readable dot from 500 m
      const eye = camera.camera.position;
      const reach = 0.0048 * (1 + 0.8 * live.night); // a bigger glow at night
      const lampSize = (p: Vector3): number => Math.min(6, Math.max(0.42, eye.distanceTo(p) * reach));
      hero.room.at('light').getWorldPosition(lamp);
      beacons.set(0, lamp, lampSize(lamp));
      for (let i = 0; i < farm.count; i++) beacons.set(1 + i, farm.top(i, lamp), lampSize(lamp));
      seaTops.forEach((p, i) => beacons.set(1 + farm.count + i, p, lampSize(p)));
      beacons.commit();
      lights.night = live.night;
      lights.update(t);
      for (const m of world.alive) m.update(dt, t);
      updateSound(current?.id, live);
    },
  };
});
