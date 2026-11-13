/**
 * Scene of `lab-battery` — wiring only. The podium and materials come from `world.ts`; each of the 12 steps is
 * a module in `steps/` (see `lab.ts` for the contract and `README.md` for the layout of this directory).
 */
import type { Object3D } from 'three';
import { defineScene, type Actor, type StepSpec } from '@/engine/api';
import { stepUi, type StepUiApi, type StepUiSpec } from '@/hud';
import { LOOK_SCALE } from '@/style';
import type { Lab, StepId, StepModule } from './lab';
import { STEPS } from './steps';
import { PODIUM_H, PODIUM_R, createMats, createPodium, group } from './world';

export default defineScene(async (ctx) => {
  const { stage, camera } = ctx;
  // the look presets are tuned for a 3.4-unit subject; the podium is a little larger
  ctx.env.setScale(PODIUM_R, { adaptFrom: LOOK_SCALE.studio });
  ctx.env.setGrounding(PODIUM_R + 0.25);
  ctx.env.setShadow({ extent: 6.2, center: [0, 1.6, 0], softness: 3 });

  const podium = createPodium(ctx);
  const stageRoot = group('stage', 0, PODIUM_H + 0.014, 0);
  ctx.root.add(podium.group, stageRoot);
  const ui: StepUiApi<StepId> = stepUi(ctx);
  const shared = new Map<string, unknown>();
  const lab: Lab = {
    ctx,
    ui,
    stageRoot,
    podium: stage.actor(podium.group, { appear: 'fade', inDuration: 0.6, outDuration: 0.45 }),
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
    specs[m.id] = {
      ...m.stage,
      show: m.noPodium ? own : [...own, lab.podium],
      camera: m.stage.camera ?? m.id,
    };
    if (m.ui) uis[m.id] = m.ui;
  }
  stage.define(specs);
  ui.define(uis);

  // one read-out for the interaction test: the observable state of the step on screen
  ctx.qa.expose('probe', () => byId.get(stage.current ?? '')?.probe?.() ?? {});

  return {
    update(dt, t) {
      podium.update(t);
      for (const m of modules) {
        if (!m.update) continue;
        // the current step, plus a set that is still animating out
        if (stage.current === m.id || actors.get(m.id)!.some((a) => a.value > 0.001)) m.update(dt, t);
      }
    },
  };
});
