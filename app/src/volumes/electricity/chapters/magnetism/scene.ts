/**
 * Scene of `magnetism` — wiring only. The workshop table, the compass carpet and materials come from
 * `world.ts` / `parts/carpet.ts`; each of the 11 steps is a module in `steps/` (see `chapter.ts` for the contract
 * and `README.md` for the layout of this directory).
 */
import type { Object3D } from 'three';
import { defineScene, type Actor, type StepSpec } from '@/engine/api';
import { stepUi, type StepUiSpec } from '@/hud';
import { LOOK_SCALE } from '@/style';
import type { Bench, StepId, StepModule } from './chapter';
import { createCarpet } from './parts/carpet';
import { createSound, silent } from './sound';
import { STEPS } from './steps';
import { TABLE_H, TABLE_R, createMats, createWorkbench, group } from './world';

export default defineScene(async (ctx) => {
  const { stage, camera } = ctx;
  // the studio look is tuned for a 3.4-unit subject; the workshop table is a little larger
  ctx.env.setScale(TABLE_R, { adaptFrom: LOOK_SCALE.studio });
  ctx.env.setGrounding(TABLE_R + 0.3);
  ctx.env.setShadow({ extent: 8.5, center: [0, 1.5, 0], softness: 3 });
  ctx.env.base({ motes: 0.25 });

  const table = createWorkbench(ctx);
  const top = group('top', 0, TABLE_H + 0.012, 0);
  ctx.root.add(table.group, top);
  const carpet = createCarpet();
  top.add(carpet.group);
  const bench: Bench = {
    ctx,
    ui: stepUi(ctx),
    top,
    mats: createMats(),
    carpet,
    live: silent(),
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
  const carpetActor = stage.actor(carpet.group, { appear: 'fade' });
  for (const m of modules) {
    const own = m.stage.show.map((o) =>
      o === carpet.group ? carpetActor : 'isObject3D' in o ? stage.actor(o as Object3D) : (o as Actor),
    );
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
      if (carpetActor.value > 0.001) carpet.update(dt, t);
      for (const m of modules) {
        if (!m.update) continue;
        // the current step, plus a set that is still animating out
        if (stage.current === m.id || actors.get(m.id)!.some((a) => a !== carpetActor && a.value > 0.001))
          m.update(dt, t);
      }
      sound.update(dt);
    },
  };
});
