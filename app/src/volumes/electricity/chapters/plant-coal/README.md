# plant-coal — «ТЕС на вугіллі (і ТЕЦ)»

Diorama chapter (11 steps, child of the `plants` hub). Script: `docs/volumes/electricity/chapters/plant-coal.md`.
Built by `B-plant-coal` on the structure of `plant-wind` (the reference for plant chapters).

## Layout of the directory

| Path | What lives there |
|---|---|
| `index.ts` · `emblem.ts` | Manifest (`...manifestText(meta)`), Journey-Map emblem (boiler house, striped stack, tower; 3 meshes). |
| `content.ts` · `labels.ts` | `defineContent(raw)`; `DOC` = captions from `steps[].labels` (pinned by `__tests__/labels.test.ts`); `QUOTED` = segment names / states the document writes as `code`; `OWN` = the chapter's own short labels (plain Ukrainian, §54). |
| `hotspots.ts` | Content ids of all hotspots; steps bind with `hot(anchor, HOTSPOTS.<step>.<key>)` (`steps/hot.ts`, probe `hs.<id>`). |
| `layout.ts` · `shots.ts` | Every position (metres, +X east, +Z south) and every camera shot with its `fit`. |
| `state.ts` | `Live`: night, load, stack smoke / vapour, tower plumes — targets reset each frame, the step on screen overrides. |
| `scene.ts` | Orchestrator: world → plant → stage params (`boilerOpen`, `hallOpen`, `turboOpen`, `gasOpen`) → steps → per-frame easing. |
| `sound.ts` | Loops per step (fire, turbine, hum, steam, water, wind) scaled by the unit load. |
| `parts/` | `world` (island, rail loop, coal train, life), `yard` (car dumper, stacker-reclaimer, ridges, belts, gallery), `main-building` (boiler-house shell that opens north, bunker bay, turbine hall, turbo-set, step-up transformer), `boiler-core` + `boiler-fx` (furnace, water walls, platens, banks, drum / separators; flames, media streams), `gas-path` + `gas-fx` (SCR, air heater, precipitator, fans, absorber, stack; species streams), `site` (cooling towers, 330 kV yard + line, gypsum, ash pond, capture plant), `plant` (all of the above + plumes, beacons). Step set pieces: `capsule`, `coal-props` (step 2), `mill` (3), `pipe-capsule` (5), `turbine-fx` (6), `feed-train` (7), `carbon` (9), `chp` (10), `ukraine-map` (11). `shadows.ts` = `noShadow()` for the draw-call budget. |
| `steps/` | One module per step: `StepFactory(deps) → { id, stage, ui, update }` (`types.ts`); `index.ts` lists them. |
| `qa/` | `interaction.mjs` + `interaction-steps.mjs`: every control, every hotspot card, taps on buildings / lumps / plant dots, the share-chart scrub (59 checks); any size, dev or production build. |
| `__tests__/` | manifest = generated manifest, hotspot ids = content, labels = document, simulation checkpoints. |

## Conventions

1. **Physics only from `@electricity/sim/plant-coal`** (models M1–M6); one call per input drives board, readouts and 3D.
2. Shells open through registered stage params; sub-states inside a step use `ctx.stage.toggle` / `setParam`; button
   timers run on `ctx.stage.scope` (trip of step 3, «Без екранів» of step 4).
3. Reading and operating happen in the HUD: dock for inputs and small readouts, `board` for charts / tables, callouts
   for names (with `priority` for phones). No world text panels.
4. Step-only set pieces are stage actors (hidden — and not drawn — elsewhere); the city islet only in step 10.
5. QA hooks: `__app.read('live' | 'overview' | 'coal' | 'dust' | 'boiler' | 'steam' | 'turbine' | 'feed' | 'fluegas' |
   'carbon' | 'chp' | 'role' | 'hotspot')`; probes `hs.<id>`, `ov.boiler`, `coal.anthracite`, `station.<key>`.

## QA

```bash
export QA_ID=B-plant-coal QA_PORT=5250            # dev server: tools/dev-start.sh B-plant-coal 5250
node tools/qa/chapter-check.mjs plant-coal --sizes all
node app/src/volumes/electricity/chapters/plant-coal/qa/interaction.mjs --size 1280x720   # also 1920x1080, 3840x2160
pnpm vitest run src/volumes/electricity/chapters/plant-coal                               # in app/
```
