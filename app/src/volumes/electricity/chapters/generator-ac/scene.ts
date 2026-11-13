/**
 * Scene of `generator-ac` — wiring only. The floor and materials come from `parts/turntable.ts` / `world.ts`;
 * each of the 11 steps is a module in `steps/` (see `chapter.ts` for the contract and `README.md` for the
 * layout).
 */
import type { Object3D } from 'three';
import { defineScene, type Actor, type StepSpec } from '@/engine/api';
import { stepUi, type StepUiSpec } from '@/hud';
import { LOOK_SCALE } from '@/style';
import type { Hall, StepId, StepModule } from './chapter';
import { createTurntable } from './parts/turntable';
import { createSound } from './sound';
import { STEPS } from './steps';
import { createMats, group } from './world';

export default defineScene(async (ctx) => {
  const { stage, camera } = ctx;
  // the studio look is tuned for a 3.4-unit subject; the machines here are ≈ 4–5 units
  ctx.env.setScale(4.6, { adaptFrom: LOOK_SCALE.studio });
  ctx.env.setGrounding(5.4, 0.45);
  ctx.env.setShadow({ extent: 8, center: [0, 1.2, 0], softness: 3 });
  ctx.env.base({ rimColor: 'teal', rimIntensity: 0.9, keyColor: 'white' });

  const floor = createTurntable();
  const stageRoot = group('stage');
  ctx.root.add(floor.group, stageRoot);
  const ui = stepUi(ctx);
  const sound = createSound();
  const hall: Hall = {
    ctx,
    ui,
    sound,
    stageRoot,
    floor: stage.actor(floor.group, { appear: 'fade', inDuration: 0.6, outDuration: 0.45 }),
    mats: createMats(),
    isCurrent: (id) => stage.current === id,
  };

  // build the sets one by one, yielding to the outgoing chapter's frames in between
  const modules: StepModule[] = [];
  for (const make of STEPS) {
    modules.push(make(hall));
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
    specs[m.id] = { ...m.stage, show: m.noFloor ? own : [...own, hall.floor], camera: m.stage.camera ?? m.id };
    if (m.ui) uis[m.id] = m.ui;
  }
  stage.define(specs);
  ui.define(uis);

  // one probe for the interaction test: the current step's observable state (production builds too)
  ctx.qa.expose('step', () => ({ id: stage.current, ...(byId.get(stage.current ?? '')?.probe?.() ?? {}) }));

  return {
    update(dt, t) {
      floor.ring.rotation.y = -t * 0.02;
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
