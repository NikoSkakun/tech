/**
 * Orchestrator only: the world → the five step modules → `world.define` + `stepUi.define` → update routing.
 * Every step re-derives its state on entry (deep links = the frame a reader arrives at).
 */
import { Vector3 } from 'three';
import { defineScene } from '@/engine/api';
import { stepUi, type StepUiApi } from '@/hud';
import {
  sessionGoals,
  STEP_IDS,
  type Chapter,
  type StepFactory,
  type StepId,
  type StepModule,
} from './chapter';
import { caption } from './content';
import { switchControl } from './parts/switch';
import { hoursStep } from './steps/01-hours';
import { spentStep } from './steps/02-spent';
import { ghostStep, ghostSwitchLive } from './steps/03-ghost';
import { innerStep } from './steps/04-inner';
import { lifeStep } from './steps/05-life';
import { createDrainWorld } from './world';

const FACTORIES: Record<StepId, StepFactory> = {
  hours: hoursStep,
  spent: spentStep,
  ghost: ghostStep,
  inner: innerStep,
  life: lifeStep,
};

export default defineScene((ctx) => {
  const { stage } = ctx;
  const world = createDrainWorld(ctx);
  const ui = stepUi(ctx) as StepUiApi<StepId>;
  const switcher = switchControl(
    ctx,
    world.world,
    caption('ghost', 1),
    () => stage.current === 'ghost' && ghostSwitchLive(world),
  );
  const chapter: Chapter = {
    ctx,
    ui,
    world,
    switcher,
    here: (id) => stage.current === id,
    reached: (s) => sessionGoals.has(s),
    reach: (s) => sessionGoals.add(s),
  };
  const steps = Object.fromEntries(STEP_IDS.map((id) => [id, FACTORIES[id](chapter)])) as Record<
    StepId,
    StepModule
  >;
  world.world.define(
    Object.fromEntries(
      STEP_IDS.map((id) => {
        const m = steps[id];
        return [id, { ...m.spec, enter: m.enter?.bind(m), leave: m.leave?.bind(m) }];
      }),
    ),
  );
  ui.define(Object.fromEntries(STEP_IDS.map((id) => [id, steps[id].ui])));

  ctx.qa.expose('drain', () => ({
    step: stage.current,
    hours: world.hours.shown,
    life: world.life,
    volts: world.volts,
    amps: world.amps,
    glow: world.stand.glow,
    cut: world.cut.shown,
    closed: switcher.closed,
    touching: world.gauge.touching,
    meter: world.gauge.shown,
    frame: world.frame.shown,
    cradle: { ...world.cradle },
    reached: STEP_IDS.filter((s) => sessionGoals.has(s)),
    camera: ctx.camera.camera.position.toArray().map((v) => Math.round(v * 1000) / 1000),
    cameraRaw: ctx.camera.camera.position.toArray(),
    lens: world.stand.tools.lens.group.getWorldPosition(new Vector3()).toArray(),
    battery: world.stand.stand.battery.group.getWorldPosition(new Vector3()).toArray(),
    moving: ctx.camera.moving,
  }));

  // the neighbour the reader comes from (null: a deep link): the first frame is the border frame (shared/world/border.ts)
  const before = ctx.store.get();
  let from = before.volumeId === ctx.manifest.volume && before.chapterId !== ctx.manifest.id ? before.chapterId : null;
  let leaving = false;
  return {
    enterStep(id, info) {
      leaving = false;
      world.world.enterStep(id, info);
      const again = { ...info, instant: false };
      const back = from === 'build';
      const then = (): void => {
        steps[id as StepId].enter?.(again);
        if (back) steps[id as StepId].rewind?.(true);
      };
      if (info.from === null && world.world.border.arrive(id, from, { then })) {
        // the meter and the counter frame off the table, the cut closed; from the practicum: the new battery in
        // the cradle, the swap plays back
        world.gauge.shown = 0;
        world.frame.shown = 0;
        world.meter.want = 0;
        world.meter.probes = 0;
        world.counter.want = 0;
        world.cut.shown = 0;
        if (back) steps[id as StepId].rewind?.(false);
      }
      from = null;
    },
    leaveChapter(to) {
      const step = steps[stage.current as StepId];
      step?.leave?.();
      leaving = true;
      world.meter.want = 0;
      world.meter.probes = 0;
      world.counter.want = 0;
      world.cut.target = 0;
      // to the practicum: the chapter's end — the new battery in the cradle, the dead one gone; back to the
      // lamp: the battery fresh again (the hours run back to 0 — the border's battery is the fresh one)
      const end = to.chapterId === 'build' ? step?.finish?.() : undefined;
      if (to.chapterId === 'lamp') world.hours.target = 0;
      const fresh = (): boolean => to.chapterId !== 'lamp' || world.hours.shown < 0.01;
      const there = world.world.border.leave(to.chapterId);
      return there
        ? () => there() && (end?.() ?? true) && fresh() && world.gauge.shown < 0.01 && world.frame.shown < 0.01
        : null;
    },
    update(dt, t) {
      if (!leaving) steps[stage.current as StepId]?.update?.(dt, t);
      world.update(dt, t);
      for (const id of STEP_IDS) steps[id].late?.(dt, t);
      switcher.update(dt);
    },
  };
});
