/**
 * Scene of `plants` — wiring only. The shared archipelago comes from `parts/archipelago.ts`, materials from
 * `world.ts`; each of the 11 steps is a module in `steps/` (see `chapter.ts` for the contract and `README.md`
 * for the layout).
 */
import type { InstancedMesh, Mesh, Object3D } from 'three';
import { defineScene, type Actor, type StepSpec } from '@/engine/api';
import { stepUi, type StepUiSpec } from '@/hud';
import { LOOK_SCALE } from '@/style';
import type { Hub, StepId, StepModule } from './chapter';
import { createArchipelago } from './parts/archipelago';
import { createSound } from './sound';
import { STEPS } from './steps';
import { createMats, group } from './world';

export default defineScene(async (ctx) => {
  const { stage, camera } = ctx;
  // a metre-scale diorama ≈ 150 m in radius (the plant islands orbit at 132 m)
  ctx.env.setScale(150, { adaptFrom: LOOK_SCALE.diorama });
  ctx.env.setShadow({ extent: 200, center: [0, 0, 0], softness: 3 });
  // golden hour, but lighter: the plant colours must survive the grade (harmony 0.52 → 0.3, thinner haze)
  ctx.env.base({ rimColor: 'amber', rimIntensity: 0.6, harmony: 0.3, gradeTintAmount: 0.35, fogDensity: 0.0045 });

  const world = group('world');
  const stageRoot = group('stage');
  ctx.root.add(world, stageRoot);
  const arch = createArchipelago(ctx, world);
  await ctx.breathe();
  const ui = stepUi(ctx);
  const sound = createSound();
  const turboSet = stage.actor(arch.turboGroup, { appear: 'grow', inDuration: 0.7, outDuration: 0.4 });
  const lines = stage.actor(arch.lines, { appear: 'fade' });
  const hall = stage.actor(arch.hall.group, { appear: 'fade', inDuration: 0.8, outDuration: 0.6 });
  const hub: Hub = {
    ctx,
    ui,
    sound,
    stageRoot,
    arch,
    turboSet,
    hall,
    mats: createMats(),
    isCurrent: (id) => stage.current === id,
  };

  // build the sets one by one, yielding to the outgoing chapter's frames in between
  const modules: StepModule[] = [];
  for (const make of STEPS) {
    modules.push(make(hub));
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
    const shared = [...(m.turboSet ? [turboSet] : []), ...(m.hall ? [hall] : []), ...(m.noLines ? [] : [lines])];
    specs[m.id] = { ...m.stage, show: [...own, ...shared], camera: m.stage.camera ?? m.id };
    if (m.ui) uis[m.id] = m.ui;
  }
  stage.define(specs);
  ui.define(uis);

  // one probe for the interaction test: the current step's observable state (production builds too)
  ctx.qa.expose('step', () => ({ id: stage.current, ...(byId.get(stage.current ?? '')?.probe?.() ?? {}) }));
  // triangle budget per top-level group of the world and per step set (QA: `__app.read('cost')`)
  ctx.qa.expose('cost', () => Object.fromEntries([...world.children, ...stageRoot.children].map((o) => [o.name || o.type, triangles(o)])));

  return {
    update(dt, t) {
      sound.begin();
      arch.begin();
      for (const m of modules) {
        if (!m.update) continue;
        // the current step, plus a set that is still animating out
        if (stage.current === m.id || actors.get(m.id)!.some((a) => a.value > 0.001)) m.update(dt, t);
      }
      arch.apply();
      arch.update(dt, t);
      sound.apply();
    },
  };
});

/** Visible triangles under an object (instanced meshes count every instance), in thousands. */
function triangles(root: Object3D): number {
  let n = 0;
  root.traverseVisible((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const g = m.geometry;
    const tris = (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    n += tris * ((m as InstancedMesh).isInstancedMesh ? (m as InstancedMesh).count : 1);
  });
  return Math.round(n / 1000);
}
