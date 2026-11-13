/**
 * «Заряд і електричне поле» — scene orchestrator. It only wires things together: build the shared world
 * (`world.ts`), let every step module (`steps/*`) declare its stage state and step UI, then each frame run the
 * shared world and the `update` of the step on screen. See README.md for the conventions.
 */
import { defineScene } from '@/engine/api';
import { stepUi } from '@/hud';
import type { Chapter, StepModule } from './chapter';
import { defineShots } from './shots';
import { updateSound } from './sound';
import { STEPS } from './steps';
import { createWorld } from './world';

export default defineScene(async (ctx) => {
  ctx.env.setScale(6);
  // «світліше й лабораторніше»: lifted indigo backdrop, sparser motes, no fog
  ctx.env.base({ top: 'bg.deep', mid: 'bg.indigo', bottom: 'bg.deep', motes: 0.45, bokeh: 0.7, stars: 0.18 });
  ctx.env.setShadow({ extent: 9, center: [0, 0, 0], softness: 3 });
  // a table-top lab: everything on the table matters, so the depth of field stays mild
  ctx.post.base({ dofAperture: 0.22 });
  defineShots(ctx.camera);

  const world = createWorld(ctx);
  const chapter: Chapter = { ctx, ui: stepUi(ctx), world };
  const steps: StepModule[] = [];
  for (const [i, make] of STEPS.entries()) {
    steps.push(make(chapter));
    ctx.progress((i + 1) / STEPS.length);
    await ctx.breathe(); // keep the outgoing chapter animating while this one is built
  }
  ctx.stage.define(Object.fromEntries(steps.map((s) => [s.id, s.stage])));
  chapter.ui.define(Object.fromEntries(steps.map((s) => [s.id, s.ui ?? {}])));

  let current: StepModule | undefined;
  return {
    enterStep(stepId) {
      current = steps.find((s) => s.id === stepId);
    },
    update(dt, t) {
      world.update(dt, t);
      current?.update?.(dt, t);
      updateSound(current?.id ?? null);
    },
  };
});
