/**
 * Scene of `matter` — wiring only. The podium comes from `world.ts`; each of the 9 steps is a module in
 * `steps/` (see `chapter.ts` for the contract and `README.md` for the layout of this directory).
 */
import type { Object3D } from 'three';
import { defineScene, type Actor, type StepSpec } from '@/engine/api';
import { stepUi, type StepUiSpec } from '@/hud';
import type { Lab, StepId, StepModule } from './chapter';
import { group } from './chapter';
import { createSound } from './sound';
import { STEPS } from './steps';
import { createPodium } from './world';

export default defineScene(async (ctx) => {
  const { stage, camera } = ctx;
  ctx.env.setScale(6);
  // micro «inner space» (document: bg.void → bg.indigo, cold `sky` rim on the crystals, sparser motes)
  ctx.env.base({
    top: 'bg.void',
    mid: 'bg.deep',
    bottom: 'bg.indigo',
    rimColor: 'sky',
    rimIntensity: 1.1,
    motes: 0.4,
    bokeh: 0.8,
    stars: 0.2,
  });
  ctx.env.setShadow({ extent: 8, center: [0, 1.5, 0], softness: 3 });
  // the crystal is the subject: keep depth of field mild so the lattice reads in depth
  ctx.post.base({ dofAperture: 0.3 });

  const podium = createPodium(ctx);
  const stand = group('stand');
  ctx.root.add(podium.group, stand);
  const lab: Lab = {
    ctx,
    ui: stepUi(ctx),
    stand,
    live: { buzz: 0, hum: 0, crackle: 0, crackleRate: 0 },
    isCurrent: (id) => stage.current === id,
  };

  // build the sets one by one, yielding to the outgoing chapter's frames in between
  const modules: StepModule[] = [];
  for (const make of STEPS) {
    modules.push(make(lab));
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
  lab.ui.define(uis);
  const sound = createSound(lab.live);

  return {
    update(dt, t) {
      podium.update(t);
      for (const m of modules) {
        if (!m.update) continue;
        // the current step, plus a set that is still animating out
        if (stage.current === m.id || actors.get(m.id)!.some((a) => a.value > 0.001)) m.update(dt, t);
      }
      sound.update(dt);
    },
  };
});
