/**
 * Scene of `current` — wiring only. The workbench and materials come from `world.ts`; each of the 10 steps is
 * a module in `steps/` (see `chapter.ts` for the contract and `README.md` for the layout of this directory).
 */
import type { Object3D } from 'three';
import { defineScene, type Actor, type StepSpec } from '@/engine/api';
import { stepUi, type StepUiSpec } from '@/hud';
import { LOOK_SCALE } from '@/style';
import type { Bench, StepId, StepModule } from './chapter';
import { createSound } from './sound';
import { STEPS } from './steps';
import { TABLE_H, TABLE_R, createMats, createWorkbench, group } from './world';

export default defineScene(async (ctx) => {
  const { stage, camera } = ctx;
  // the look presets are tuned for a 3.4-unit subject; the workbench is a little larger
  ctx.env.setScale(TABLE_R, { adaptFrom: LOOK_SCALE.studio });
  ctx.env.setGrounding(TABLE_R + 0.3);
  ctx.env.setShadow({ extent: 6.6, center: [0, 1.2, 0], softness: 3 });
  // a drop of "inner space": we have just left the micro-world (document: «крапля inner space-порошинок»)
  ctx.env.base({ motes: 0.35 });

  const table = createWorkbench(ctx);
  const top = group('top', 0, TABLE_H + 0.012, 0);
  ctx.root.add(table.group, top);
  const bench: Bench = {
    ctx,
    ui: stepUi(ctx),
    top,
    mats: createMats(),
    live: { hum: 0, buzz: 0, water: 0, steam: 0 },
    isCurrent: (id) => stage.current === id,
  };

  // build the sets one by one, yielding to the outgoing chapter's frames in between
  const modules: StepModule[] = [];
  for (const make of STEPS) {
    modules.push(make(bench));
    ctx.progress(modules.length / STEPS.length);
    await ctx.breathe();
  }

  camera.shots(Object.assign({}, ...modules.map((m) => m.shots)));
  const actors = new Map<StepId, Actor[]>();
  const specs: Record<string, StepSpec> = {};
  const uis: Partial<Record<StepId, StepUiSpec>> = {};
  for (const m of modules) {
    const own = m.stage.show.map((o) => ('isObject3D' in o ? stage.actor(o as Object3D) : (o as Actor)));
    actors.set(m.id, own);
    specs[m.id] = { ...m.stage, show: own, camera: m.stage.camera ?? m.id };
    if (m.ui) uis[m.id] = m.ui;
  }
  stage.define(specs);
  bench.ui.define(uis);
  const sound = createSound(bench.live);

  return {
    update(dt, t) {
      table.update(t);
      for (const m of modules) {
        if (!m.update) continue;
        // the current step, plus a set that is still animating out
        if (stage.current === m.id || actors.get(m.id)!.some((a) => a.value > 0.001)) m.update(dt, t);
      }
      sound.update(dt);
    },
  };
});
