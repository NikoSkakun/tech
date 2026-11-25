/**
 * Orchestrator only: the copper world → the six step modules → `stage.define` + `stepUi.define` → update routing.
 * Every step is a pure state of the world (random access, deep links); what the reader did inside a step lives
 * in that step's module and is re-derived on entry.
 */
import { defineScene } from '@/engine/api';
import { stepUi, type StepUiApi } from '@/hud';
import { floorLadder } from '@/hud-dom/journey';
import {
  sessionGoals,
  STEP_IDS,
  type Chapter,
  type StepFactory,
  type StepId,
  type StepModule,
} from './chapter';
import { atomsStep } from './steps/01-atoms';
import { insideAtomStep } from './steps/02-inside-atom';
import { outerStep } from './steps/03-outer';
import { sharedStep } from './steps/04-shared';
import { restlessStep } from './steps/05-restless';
import { plasticStep } from './steps/06-plastic';
import { createWireWorld } from './world';

const FACTORIES: Record<StepId, StepFactory> = {
  atoms: atomsStep,
  'inside-atom': insideAtomStep,
  outer: outerStep,
  shared: sharedStep,
  restless: restlessStep,
  plastic: plasticStep,
};

export default defineScene((ctx) => {
  const { stage } = ctx;
  const world = createWireWorld(ctx);
  const { copper } = world;
  const ui = stepUi(ctx) as StepUiApi<StepId>;
  // «де ми» (VISUAL §3): the platform's floor ladder with `floorLabel` names, whenever the reader is below the stand
  const ladder = floorLadder(ctx, { floor: () => (world.world.deep > 0.01 ? world.world.floorId : null) });
  // the chapter on screen while this one loads: from the prologue the reader arrives by the whole dive
  const before = ctx.store.get();
  // the neighbour the reader comes from (null: a deep link) — the first frame is the border frame (shared/world/border.ts)
  let from = before.volumeId === ctx.manifest.volume && before.chapterId !== ctx.manifest.id ? before.chapterId : null;
  /** Walking to the border frame (`leaveChapter`): the step's own motion rests. */
  let leaving = false;

  const chapter: Chapter = {
    ctx,
    ui,
    world,
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

  ctx.qa.expose('wire', () => ({
    step: stage.current,
    depth: copper.depth,
    deep: world.world.deep,
    position: world.world.position,
    flying: world.world.flying,
    lamp: copper.lamp,
    reached: STEP_IDS.filter((s) => sessionGoals.has(s)),
  }));

  return {
    enterStep(id, info) {
      leaving = false;
      world.world.enterStep(id, info);
      if (from === 'prologue' && id === 'atoms' && info.from === null) world.world.flyIn(id, info);
      else if (info.from === null) {
        const again = { ...info, instant: false };
        world.world.border.arrive(id, from, { then: () => steps[id as StepId].enter?.(again) });
      }
      from = null;
      if (!info.instant) return;
      // a deep link opens the middle atom, as on a first visit (`wire/atoms` may have chosen another)
      copper.hero = 0;
      copper.snap();
    },
    leaveChapter(to) {
      steps[stage.current as StepId]?.leave?.();
      leaving = true;
      return world.world.border.leave(to.chapterId);
    },
    update(dt, t) {
      if (!leaving) steps[stage.current as StepId]?.update?.(dt, t);
      world.update(dt, t);
      for (const id of STEP_IDS) steps[id].always?.(dt);
      ladder.update();
    },
  };
});
