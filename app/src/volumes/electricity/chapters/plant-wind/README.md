# plant-wind — «Вітрова електростанція (ВЕС)»

Diorama chapter (11 steps, child of the `plants` hub). Script: `docs/volumes/electricity/chapters/plant-wind.md`.
This directory is the reference structure for diorama / power-plant chapters; it uses the sanctioned APIs of
`docs/API_CHANGES.md` throughout (pilot built by `B-plant-wind`, refined by `P-plant-wind`).

## Layout of the directory

| Path | What lives there |
|---|---|
| `index.ts` | Manifest (eager, tiny): `...manifestText(meta)` from the generated manifest file. |
| `content.ts` | `defineContent(generated JSON, { labels })`. `DOC` = control captions read from `steps[].labels` (by position, pinned by `__tests__/labels.test.ts`); `crossTargets()` = full addresses of the document's cross-references. |
| `labels.ts` | Scene labels the content does not carry (plain Ukrainian, DECISIONS §54); `QUOTED` = wordings of «Бачимо». |
| `hotspots.ts` | Content ids of all hotspots; steps bind markers with `hot(anchor, HOTSPOTS.step.key)` (`steps/hot.ts`). |
| `layout.ts` · `shots.ts` | Every position / size; every camera shot, each with its `fit` sphere (DECISIONS §57 d). |
| `state.ts` | `Live`: the state the world eases toward. Targets are reset every frame, then the current step overrides them — every step is random-access safe without "undo" code. |
| `scene.ts` | Orchestrator only: build parts → bindings → steps declare stage + UI → per-frame update → `ctx.qa.expose`. |
| `sound.ts` | Audio loops driven by `Live`; steps play one-shots on their events. |
| `parts/` | Models and effects without step logic. Kit assemblies: `world`, `hero` (`windTurbine({ interior })`), `farm` (`windFleet`, one fleet per row), `grid` (`substation({ detail: 'light' })`), `offshore` (`windFleet` + kit offshore models). Chapter hero models (kit `Builder`): `nacelle*`, `blade-section`, `silhouettes`, `role-props`. Effects on `RibbonLines({ blend: 'normal' })`: `wind-field`, `wakes`, `flow-lines` (+ `panel-flow`: the potential-flow solution behind the streamlines), `twist-view`. Others: `air-column`, `stream-tube`, `chain`, `export-cables`, `beacons` (pulse orbs), `scopes`, `label`. |
| `sim-bindings/` | Glue between `@electricity/sim/plant-wind` and parts (`farm.ts`: wake model → layout, rotor speeds, collector, wake sources). |
| `steps/` | One module per step: `StepFactory(deps) → { id, stage, ui, update }` (`types.ts`); `index.ts` lists them. |
| `qa/` | `interaction.mjs` + `interaction-steps.mjs`: every control, the year strip, portals, chips and hotspot cards, with an assertion each; runs at any size, on dev and production builds. |
| `__tests__/` | manifest = generated manifest, hotspot ids = content, labels = document, panel-flow = textbook values. |

## Conventions

1. **World in metres** (kit convention) + `ctx.env.setScale(radius, { adaptFrom: LOOK_SCALE.diorama })`; fx sizes
   are given explicitly (FX_API §0).
2. **A step = declaration + a small `update`.** Stage actors / params for what the *step* decides; `Live` targets
   for what a *control* decides. A control that switches something inside a step uses a registered stage param
   and `ctx.stage.setParam` (`offshore`); tweens / delays started by a button run on `ctx.stage.scope`
   (`nacelle`, `overview`, `wind-power`); per-step look = `StepSpec.envTune` (`offshore`, `role`).
3. **Reading and operating happen in the HUD** (DECISIONS §57 a–c): sliders, toggles, segmented controls in the
   dock, most important first; charts, numbers and status notes on the `board`; names of things as callouts
   (`visible` / live `text`). World text is limited to short `createLabel`s (≥ 16 px-eq) — % over the farm
   turbines, «корінь / кінчик». Nothing is hover-only: tooltips repeat what a callout already says, and every
   direct manipulation has a dock control (wind arrow ↔ «Напрямок вітру», year strip ↔ «День року»).
4. **Physics only from `@electricity/sim`**, one sample per input drives chart, numbers and 3D alike. Drawing
   aids that need a field (wake darkness, streak slow-down) call the sim per point. The streamlines of `blade`
   come from `parts/panel-flow.ts` (potential flow, unit-tested against textbook values) with the circulation
   scaled by the lift the sim keeps — a request asks to move that solver into the sim library.
5. **Links** use full addresses from `crossReferences` through `ctx.nav.locate` / `ctx.nav.open`; a portal whose
   chapter is not built is dark and silent, the HUD's «Див. також» chips cover the same targets.
6. **QA hooks**: `ctx.qa.expose('live' | 'farm' | 'variant' | 'blade' | 'offshore' | 'role' | 'portals' |
   'hotspot')` → `__app.read(name)`; probes `hero.hub`, `farm.arrow`, `portal0…2`, `hs.<hotspot id>` →
   `__app.locate(name)`.

## QA

```bash
export QA_ID=P-plant-wind QA_PORT=5253            # dev server: tools/dev-start.sh P-plant-wind 5253
node tools/qa/chapter-check.mjs plant-wind --sizes all
node app/src/volumes/electricity/chapters/plant-wind/qa/interaction.mjs --size 1280x720   # also 1920x1080, 3840x2160
pnpm vitest run src/volumes/electricity/chapters/plant-wind           # in app/
# production: (cd app && pnpm build && pnpm preview --port 5353 --strictPort) then QA_PORT=5353 … interaction.mjs
```
