# plant-wind — «Вітрова електростанція (ВЕС)»

Pilot diorama chapter (11 steps, child of the `plants` hub). Script: `docs/volumes/electricity/chapters/plant-wind.md`.
This directory is meant to be copied as the structure of a diorama / power-plant chapter.

## Layout of the directory

| Path | What lives there |
|---|---|
| `index.ts` | Manifest (eager, tiny). Mirrors title and step titles of the generated content by hand; `__tests__/manifest.test.ts` fails when the mirror drifts (it caught a missing NBSP). |
| `content.ts` | `defineContent(generated JSON, { labels: L })`. `L` = UI labels quoted «…» in the document's «Інтерактив» (verbatim) + short scene labels. `hotspotNames(step)` gives hotspot titles so cards take their text from the content. |
| `layout.ts` | Every position and size of the world in one place, with the toy-scale decisions. |
| `shots.ts` | All camera shots (one per step + variants a control switches to). |
| `state.ts` | `Live`: the state the world eases toward. Targets are reset to defaults every frame, then the current step overrides them — so every step is random-access safe without "undo" code. |
| `scene.ts` | Orchestrator only: build parts → bindings → let steps declare stage + UI → per-frame update. |
| `sound.ts` | Audio loops driven by `Live`; steps play one-shots on their events. |
| `parts/` | Models and effects. Kit assemblies (`world`, `hero`, `grid`, `fleet`, `farm`, `offshore`), chapter hero models built with the kit `Builder` (`nacelle*`, `offshore-models`, `silhouettes`, `role-props`), chapter effects (`wind-field`, `air-column`, `stream-tube`, `airfoil` + `streamlines`, `wakes`, `chain`, `export-cables`), small helpers (`console`, `badge`, `switch`, `lights`). `index.ts` is a barrel. |
| `sim-bindings/` | Glue between `@electricity/sim/plant-wind` and parts (`farm.ts`: wake model → layout, rotor speeds, collector, wake sources). |
| `steps/` | One module per step: `StepFactory(deps) → { id, stage, ui, update }` (`types.ts`). `index.ts` lists them in manifest order. |
| `qa/` | `interaction.mjs` + `interaction-steps.mjs`: every control operated with real pointer input, with an assertion on its effect. |

## Conventions that proved themselves

1. **World in metres** (kit convention) + `ctx.env.setScale(radius, { adaptFrom: LOOK_SCALE.diorama })`. Effects
   from `@/fx` need explicit sizes then (`createWire({ radius, repeat, speed, detail })`, orb radii, arrows).
2. **A step = declaration + a small `update`.** Stage actors / params for everything the *step* decides; `Live`
   targets for everything a *control* decides. Things a control shows inside a step use `parts/switch.ts` and are
   reset in the step's `leave`. Tweens started by a button run on their own `ctx.tweens.scope()` that the step
   kills in `leave` (delayed tweens otherwise fire in the next step).
3. **The dock holds inputs only.** Next to a long step text only ≈ 100–230 px (at 720p) are left for the dock, so
   charts and readouts live on a world console next to the subject (`parts/console.ts`), ≤ 2 honesty chips per
   step, and a third slider becomes direct manipulation where it makes sense (the wind arrow of step 8).
4. **Physics only from `@electricity/sim`.** Parts draw what the bindings hand them; where a part re-evaluates a formula for
   drawing (wake plumes) it calls the sim function per vertex. Fixture values of the document are asserted in
   the interaction test (0.726 → 0.829, 0.639 → 0.679, storm control 0.70 …).
5. **Instancing for fleets.** `parts/fleet.ts` instances turbines with their own yaw and rotor angle from the
   kit's turbine pieces; one `Builder` per static assembly (`offshore-static`, yard) keeps draw calls low.
6. **Lint:** step modules import `from '../parts'` (barrel) — `'../parts/<file>'` trips the cross-chapter rule.

## QA

```bash
export QA_ID=B-plant-wind QA_PORT=5222            # dev server: tools/dev-start.sh B-plant-wind 5222
node tools/qa/chapter-check.mjs plant-wind --also-size 1280x720
node app/src/volumes/electricity/chapters/plant-wind/qa/interaction.mjs
pnpm vitest run src/volumes/electricity/chapters/plant-wind           # in app/
```
`window.__wind` (while the chapter is alive) exposes the live state, the farm result and the nacelle variant.
