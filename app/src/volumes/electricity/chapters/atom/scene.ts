/**
 * Scene of the chapter `atom`: builds the shared world, lets every step module register itself and routes the
 * frame update to the step on screen. All step logic lives in `steps/NN-<step-id>.ts` (see README.md).
 */
import { defineScene } from '@/engine/api';
import { stepUi } from '@/hud';
import type { Chapter, StepFactory, StepId, StepModule } from './chapter';
import { SHOTS } from './shots';
import { diveIn } from './steps/01-dive-in';
import { anatomy } from './steps/02-anatomy';
import { nucleusStep } from './steps/03-nucleus';
import { quarksStep } from './steps/04-quarks';
import { electronStep } from './steps/05-electron';
import { modelsStep } from './steps/06-models';
import { shellsStep } from './steps/07-shells';
import { ionsPhotonsStep } from './steps/08-ions-photons';
import { atomBuilderStep } from './steps/09-atom-builder';
import { standardModelStep } from './steps/10-standard-model';
import { createWorld } from './world';

/** One factory per manifest step, in order. */
const STEPS: Record<StepId, StepFactory> = {
  'dive-in': diveIn,
  anatomy,
  nucleus: nucleusStep,
  quarks: quarksStep,
  electron: electronStep,
  models: modelsStep,
  shells: shellsStep,
  'ions-photons': ionsPhotonsStep,
  'atom-builder': atomBuilderStep,
  'standard-model': standardModelStep,
};

export default defineScene(async (ctx) => {
  ctx.env.setScale(6);
  ctx.camera.shots(SHOTS);
  const world = createWorld(ctx);
  const chapter: Chapter = { ctx, ui: stepUi(ctx), world };

  const modules = {} as Record<StepId, StepModule>;
  const ids = Object.keys(STEPS) as StepId[];
  for (const [i, id] of ids.entries()) {
    modules[id] = STEPS[id](chapter);
    ctx.progress((i + 1) / ids.length);
    await ctx.breathe(); // keep the outgoing chapter animating while this one is built
  }

  return {
    enterStep(_id, info) {
      if (info.instant) world.snap();
    },
    update(dt, t) {
      // defaults first, then the step on screen may override them, then the shared world applies them
      world.atomZoom = 1;
      world.nucleusShrink = 1;
      world.nucleusSpin = 1;
      world.ruler.set(world.scaleExp.value);
      const current = ctx.stage.current as StepId | null;
      if (current) modules[current].update?.(dt, t);
      world.update(dt, t);
    },
  };
});
