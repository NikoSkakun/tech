/**
 * Scene of `transformer` — wiring only. Each of the 9 steps is a module in `steps/` (see `chapter.ts` for the
 * contract and `README.md` for the layout); every set stands on the studio disc at the origin.
 */
import type { Object3D } from 'three';
import { defineScene, type Actor, type StepSpec } from '@/engine/api';
import { stepUi, type StepUiSpec } from '@/hud';
import { LOOK_SCALE } from '@/style';
import type { StepId, StepModule, Tx } from './chapter';
import { createSound } from './sound';
import { STEPS } from './steps';
import { createMats, group } from './world';

export default defineScene(async (ctx) => {
  const { stage, camera } = ctx;
  // the look presets are tuned for a 3.4-unit subject; the sets here are ≈ 5 units across
  ctx.env.setScale(5, { adaptFrom: LOOK_SCALE.studio });
  ctx.env.setGrounding(6, 0.45);
  ctx.env.setShadow({ extent: 9, center: [0, 1.5, 0], softness: 3 });
  ctx.env.base({ rimColor: 'violet', rimIntensity: 0.9 });

  const stageRoot = group('stage');
  ctx.root.add(stageRoot);
  const ui = stepUi(ctx);
  const sound = createSound();
  const shared = new Map<string, unknown>();
  const tx: Tx = {
    ctx,
    ui,
    sound,
    stageRoot,
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
    modules.push(make(tx));
    ctx.progress(modules.length / STEPS.length);
    await ctx.breathe();
  }
  const byId = new Map<string, StepModule>(modules.map((m) => [m.id, m]));

  camera.shots(Object.assign({}, ...modules.map((m) => m.shots)));
  const actors = new Map<StepId, Actor[]>();
  const specs: Record<string, StepSpec> = {};
  const uis: Partial<Record<StepId, StepUiSpec>> = {};
  const known = new Map<Object3D, Actor>();
  for (const m of modules) {
    const own = m.stage.show.map((o) => {
      if (!('isObject3D' in o)) return o as Actor;
      const obj = o as Object3D;
      if (!known.has(obj)) known.set(obj, stage.actor(obj));
      return known.get(obj)!;
    });
    actors.set(m.id, own);
    specs[m.id] = { ...m.stage, show: own, camera: m.stage.camera ?? m.id };
    if (m.ui) uis[m.id] = m.ui;
  }
  stage.define(specs);
  // actors that belong to one step only: a shared object (the teaching transformer of steps 1–2)
  // must not keep the *other* step's update running while it is on screen
  const count = new Map<Actor, number>();
  for (const list of actors.values()) for (const a of list) count.set(a, (count.get(a) ?? 0) + 1);
  const ownActors = new Map<StepId, Actor[]>([...actors].map(([id, list]) => [id, list.filter((a) => count.get(a) === 1)]));
  ui.define(uis);

  // one probe for the interaction test: the current step's observable state (production builds too)
  ctx.qa.expose('step', () => ({ id: stage.current, ...(byId.get(stage.current ?? '')?.probe?.() ?? {}) }));
  // the loop levels the chapter asked for this frame (qa/sound.mjs)
  ctx.qa.expose('sound', () => ({ hum: sound.hum, humPitch: sound.humPitch, buzz: sound.buzz, buzzPitch: sound.buzzPitch }));

  return {
    update(dt, t) {
      sound.begin();
      for (const m of modules) {
        if (!m.update) continue;
        // the current step, plus a set that is still animating out
        if (stage.current === m.id || ownActors.get(m.id)!.some((a) => a.value > 0.001)) m.update(dt, t);
      }
      sound.apply();
    },
  };
});
