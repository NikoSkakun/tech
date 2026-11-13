/**
 * Scene of `lab-inverter` — wiring only. The bench and materials come from `parts/bench.ts` / `world.ts`; each
 * of the 12 steps is a module in `steps/` (see `chapter.ts` for the contract and `README.md` for the layout).
 */
import type { Object3D } from 'three';
import { defineScene, type Actor, type StepSpec } from '@/engine/api';
import { stepUi, type StepUiSpec } from '@/hud';
import { LOOK_SCALE } from '@/style';
import type { Lab, StepId, StepModule } from './chapter';
import { createBench } from './parts/bench';
import { createSound } from './sound';
import { STEPS } from './steps';
import { BENCH_H, createMats, group } from './world';

export default defineScene(async (ctx) => {
  const { stage, camera } = ctx;
  // the look presets are tuned for a 3.4-unit subject; the bench is wider
  ctx.env.setScale(5.6, { adaptFrom: LOOK_SCALE.studio });
  ctx.env.setGrounding(6.4, 0.5);
  ctx.env.setShadow({ extent: 8.5, center: [0, 1.4, 0], softness: 3 });
  ctx.env.base({ rimColor: 'violet', rimIntensity: 0.9 });

  const bench = createBench(ctx);
  bench.model.group.position.y = BENCH_H;
  const stageRoot = group('stage', 0, BENCH_H, 0);
  ctx.root.add(bench.model.group, stageRoot);
  const ui = stepUi(ctx);
  const sound = createSound();
  const shared = new Map<string, unknown>();
  const lab: Lab = {
    ctx,
    ui,
    sound,
    stageRoot,
    bench: stage.actor(bench.model.group, { appear: 'fade', inDuration: 0.6, outDuration: 0.45 }),
    mats: createMats(),
    share: <T>(key: string, make: () => T): T => {
      if (!shared.has(key)) shared.set(key, make());
      return shared.get(key) as T;
    },
    isCurrent: (id) => stage.current === id,
  };

  // build the sets one by one, yielding to the outgoing chapter's frames in between
  const modules: StepModule[] = [];
  for (const make of STEPS) {
    modules.push(make(lab));
    ctx.progress(modules.length / STEPS.length);
    await ctx.breathe();
  }
  const byId = new Map<string, StepModule>(modules.map((m) => [m.id, m]));

  camera.shots(Object.assign({}, ...modules.map((m) => m.shots)));
  const actors = new Map<StepId, Actor[]>();
  const specs: Record<string, StepSpec> = {};
  const uis: Partial<Record<StepId, StepUiSpec>> = {};
  for (const m of modules) {
    const own = m.stage.show.map((o) => ('isObject3D' in o ? stage.actor(o as Object3D) : (o as Actor)));
    actors.set(m.id, own);
    specs[m.id] = { ...m.stage, show: m.noBench ? own : [...own, lab.bench], camera: m.stage.camera ?? m.id };
    if (m.ui) uis[m.id] = m.ui;
  }
  stage.define(specs);
  ui.define(uis);

  // one probe for the interaction test: the current step's observable state (production builds too)
  ctx.qa.expose('step', () => ({ id: stage.current, ...(byId.get(stage.current ?? '')?.probe?.() ?? {}) }));

  return {
    update(dt, t) {
      bench.update(t);
      sound.begin();
      for (const m of modules) {
        if (!m.update) continue;
        // the current step, plus a set that is still animating out
        if (stage.current === m.id || actors.get(m.id)!.some((a) => a.value > 0.001)) m.update(dt, t);
      }
      sound.apply();
    },
  };
});
