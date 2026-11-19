/**
 * Orchestrator only: the bench (`bench.ts`) → the four step modules → `world.define` + `stepUi.define` → update
 * routing. Every step is a state of the stand reached by travel (random access, deep links); what the reader did
 * inside a step lives in that step's module and is re-derived on entry.
 */
import { defineScene } from '@/engine/api';
import { stepUi, type StepUiApi } from '@/hud';
import { createBench } from './bench';
import {
  sessionGoals,
  STEP_IDS,
  type Chapter,
  type StepFactory,
  type StepId,
  type StepModule,
} from './chapter';
import type { EndKey } from './parts/ends';
import { lensKeeper } from './parts/lens-keeper';
import { createMagnifier } from './parts/magnifier';
import { firstLightStep } from './steps/01-first-light';
import { findFaultStep } from './steps/02-find-fault';
import { shortStep } from './steps/03-short';
import { flashlightStep } from './steps/04-flashlight';

const FACTORIES: Record<StepId, StepFactory> = {
  'first-light': firstLightStep,
  'find-fault': findFaultStep,
  short: shortStep,
  flashlight: flashlightStep,
};

export default defineScene((ctx) => {
  const { stage } = ctx;
  const bench = createBench(ctx);
  const ui = stepUi(ctx) as StepUiApi<StepId>;
  const lens = lensKeeper(bench.stage);
  const magnifier = createMagnifier(ctx, bench.stage);
  const chapter: Chapter = {
    ctx,
    ui,
    bench,
    lens,
    magnifier,
    reached: (s) => sessionGoals.has(s),
    reach: (s) => sessionGoals.add(s),
    here: (s) => stage.current === s,
  };
  const steps = Object.fromEntries(STEP_IDS.map((id) => [id, FACTORIES[id](chapter)])) as Record<
    StepId,
    StepModule
  >;
  // the magnifier is registered once; the step on screen says what it does
  const lensUse = (): StepModule['lensInput'] => steps[stage.current as StepId]?.lensInput;
  ctx.input.register(bench.stage.tools.lens.group, {
    cursor: 'grab',
    tooltip: () => {
      const t = lensUse()?.tooltip;
      return typeof t === 'function' ? t() : (t ?? '');
    },
    enabled: () => !!lensUse() && (lensUse()?.enabled?.() ?? true),
    hover: (on, e) => lensUse()?.hover?.(on, e),
    click: (e) => lensUse()?.click?.(e),
    dragStart: (e) => lensUse()?.dragStart?.(e),
    drag: (e) => lensUse()?.drag?.(e),
    dragEnd: (e) => lensUse()?.dragEnd?.(e),
  });
  bench.world.define(
    Object.fromEntries(
      STEP_IDS.map((id) => {
        const m = steps[id];
        return [id, { ...m.spec, enter: m.enter?.bind(m), leave: m.leave?.bind(m) }];
      }),
    ),
  );
  ui.define(Object.fromEntries(STEP_IDS.map((id) => [id, steps[id].ui])));
  // QA: every number that must travel, never jump (continuity checks sample it frame by frame)
  const tip = (k: EndKey): number[] => bench.wiring.ends[k].pos.toArray();
  ctx.qa.expose('motion', () => ({
    camera: ctx.camera.camera.position.toArray(),
    a0: tip('a0'),
    a1: tip('a1'),
    b0: tip('b0'),
    b1: tip('b1'),
    c0: tip('c0'),
    c1: tip('c1'),
    lens: lens.shown.position.toArray(),
    magnifier: magnifier.amount,
    frame: bench.stage.tools.frame.shown,
    thermal: bench.stage.lamp.thermal,
    unfold: bench.stage.unfold,
    moon: bench.world.value('moon'),
  }));
  ctx.qa.expose('build', () => ({
    step: stage.current,
    verdict: bench.verdict,
    glow: bench.stage.glow,
    unfold: bench.stage.unfold,
    switchClosed: bench.sw.closed,
    camera: ctx.camera.camera.position.toArray().map((v) => Math.round(v * 100) / 100),
    reached: STEP_IDS.filter((s) => sessionGoals.has(s)),
  }));
  /** Walking back to the border with `drain` (shared/world/border.ts): the step's own motion rests. */
  let leaving = false;
  return {
    enterStep(id, info) {
      leaving = false;
      bench.world.enterStep(id, info);
      if (info.instant) {
        bench.snap();
        bench.stage.snap();
      }
    },
    leaveChapter(to) {
      // «Назад» to `drain`: the stand as `drain` left it — every end home, the lamp lit (the dead battery has left the picture)
      steps[stage.current as StepId]?.leave?.();
      leaving = true;
      bench.restore(1.2);
      bench.sw.closed = true;
      const there = bench.world.border.leave(to.chapterId);
      return there ? () => there() && !bench.wiring.moving : null;
    },
    update(dt, t) {
      if (!leaving) steps[stage.current as StepId]?.update?.(dt, t);
      bench.update(dt, t);
      bench.world.update(dt, t);
      for (const id of STEP_IDS) steps[id].late?.(dt, t);
      bench.late(dt, t);
      lens.late(dt, t);
      magnifier.update();
    },
  };
});
