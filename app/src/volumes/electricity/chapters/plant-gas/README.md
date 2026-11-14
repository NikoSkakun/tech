# plant-gas — «Газові електростанції: ГТУ, ПГУ, газопоршневі»

Diorama chapter (10 steps, child of the `plants` hub). Script: `docs/volumes/electricity/chapters/plant-gas.md`.
Built by `B-plant-gas` on the structure of `plant-wind` (see its README) with the sanctioned APIs of
`docs/API_CHANGES.md`.

## Layout of the directory

| Path | What lives there |
|---|---|
| `index.ts` | Manifest (eager, tiny): `...manifestText(meta)` from the generated manifest file. |
| `content.ts` | `defineContent(generated JSON, { labels })`. `DOC` = control captions read from `steps[].labels` (by position, pinned by `__tests__/labels.test.ts`); `crossTargets()` = full addresses of the cross-references. |
| `labels.ts` | `QUOTED` = the document's `code`-quoted switch items (the test checks they stand in the document); `SCENE` = own short labels (plain Ukrainian, DECISIONS §54); `fill()` puts numbers into `{}` slots. |
| `hotspots.ts` | Content ids of all hotspots; steps bind markers with `hot(anchor, HOTSPOTS.step.key)` (`steps/hot.ts`). |
| `layout.ts` · `shots.ts` | Every position / size of the island; every camera shot with its `fit` (DECISIONS §57 d). |
| `state.ts` | `Live`: loads of the machines, damper, night, shaft speed — targets reset every frame, the step on screen overrides them. |
| `scene.ts` | Orchestrator: world → island → GT rig → shell actors → steps → per-frame update → `ctx.qa.expose('live')`. |
| `sound.ts` | Loops driven by `Live` (turbine roar near the hall, engines in step 8, wind outside, hum in step 3). |
| `parts/` | Kit assemblies: `world` (island, nature, people), `ccgt` (machine hall + kit steam turbine + generator, intake, exhaust duct, bypass stack, main stack, steam line), `gas-station`, `peaker`, `yard` (`substation({ detail: 'light' })` + line with `K.energy`). Chapter hero models (kit `Builder`): `gt-model` + `gas-turbine` (three section models, `Cutaway` on the casings, section focus), `hrsg`, `acc` (instanced fans), `engine` + `engine-anim` (V-engine, slider-crank pistons, flashes), `engine-hall`, `town` (20 quarters merged by `merge.ts` into one mesh per slot, per-quarter window light through the `kEmissive` slice), `blade` (macro blade), `molecules` + `reaction`, `turbofan`, `emissions` (clouds, well, leaks, H₂ mixer), `ukraine` (map hologram). Effects: `gt-flow` (air / gas coloured by temperature), `hrsg-flow`, `work-arrows`. |
| `sim-bindings/` | `gt.ts`: one M1 sample → flows, arrows, charts; T–s contour. `island.ts`: island power from M3. |
| `steps/` | One module per step: `StepFactory(deps) → { id, stage, ui, update }` (`types.ts`); `index.ts` lists them. |
| `qa/` | `interaction.mjs` + `interaction-steps.mjs`: every control, scene clicks, every hotspot card; runs at any size, dev and production. |
| `__tests__/` | manifest = generated manifest, hotspot ids = content, labels = document, scene numbers (520 / 940 MW, T–s contour). |

## Conventions specific to this chapter

1. **Parts share their model's materials**, so a part (hall roof, south walls, boiler wall) cannot fade alone: the
   scene registers them as actors that *slide* (roofs up, walls into the ground) — `scene.ts` `slide()`.
2. **Interiors are actors** (`shell.inside`, `shell.engines`): the machines of the main hall and the eight engines
   are drawn only in the steps that open the roof (draw-call budget).
3. **r and TIT are shared**: step 4 owns `br.r` / `br.tit`; step 3's table, step 5's linked slider `hs.tit` and
   step 6's combined-cycle model read them.
4. **QA hooks**: `__app.read('live' | 'overview' | 'fuel' | 'gt' | 'blade' | 'cc' | 'race' | 'engine' | 'emis' |
   'role' | 'hotspot')`; probes `fac.<facility>`, `gt.turbine`, `hs.<hotspot id>`.

## QA

```bash
export QA_ID=B-plant-gas QA_PORT=5241                 # tools/dev-start.sh B-plant-gas 5241
node tools/qa/chapter-check.mjs plant-gas --sizes all
node app/src/volumes/electricity/chapters/plant-gas/qa/interaction.mjs --size 1280x720   # also 1920x1080, 3840x2160
pnpm vitest run src/volumes/electricity/chapters/plant-gas        # in app/
# production: (cd app && pnpm build && pnpm preview --port 5341 --strictPort) then QA_PORT=5341 … interaction.mjs
```
