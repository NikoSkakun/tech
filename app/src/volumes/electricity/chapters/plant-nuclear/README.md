# plant-nuclear — «Атомна електростанція (АЕС)»

Diorama chapter (12 steps, child of the `plants` hub). Script: `docs/volumes/electricity/chapters/plant-nuclear.md`.
Built by `B-plant-nuclear` on the structure of `plant-wind` (see its README for the conventions this one follows).

## Layout of the directory

| Path | What lives there |
|---|---|
| `index.ts` | Manifest (eager, tiny): `...manifestText(meta)` from the generated manifest file. |
| `content.ts` | `defineContent(generated JSON, { labels })`; `DOC` = control captions from `steps[].labels` (pinned by `__tests__/labels.test.ts`); `crossTargets()`. |
| `labels.ts` | `QUOTED` (wordings the document gives in `…` / «Бачимо», tested to stand in it) and `OWN` scene labels. |
| `hotspots.ts` | Content ids of all 24 hotspots; steps bind markers with `hot(anchor, id)` (`steps/hot.ts`). |
| `layout.ts` · `shots.ts` · `looks.ts` | Positions; camera shots (each with `fit`); per-step `envTune` / `post` (inner space, dark hall, opened containment). |
| `state.ts` · `scene.ts` · `sound.ts` | `Live` targets (line power, cooling, hall open); orchestrator; loops / moods. |
| `parts/` | Island and unit: `world`, `plant`, `containment` (two halves), `site` (diesels, dry storage, spray ponds), `interior` (vessel `rpv`, `loops`, crane, pool, coolant flows), `turbine-island`. Micro-world: `nucleus` (packed nucleon clusters, fission pose), `fission-rig` + `fission-props` (step 2), `sandbox` (step 3), `moderation` + `delayed` (step 4). Exhibits: `fuel-models` + `fuel-zoom` (step 5), `control-room` (8), `safety-exhibit` (9), `reactor-shelf` (10), `cycle-belt` (11), `ukraine-map` (12). `label`, `inner` (the sets below the island). |
| `sim-bindings/sandbox-run.ts` | Turns the M2 generation counts of `neutronGenerations` into individual flights (no three.js). |
| `steps/` | One `StepFactory` per step; `index.ts` lists them in manifest order. |
| `qa/` | `interaction.mjs` (harness, copied from `plant-wind`) + `interaction-steps.mjs` (every control, the handles in the scene and every hotspot card). |
| `__tests__/` | manifest = generated manifest, hotspot ids = content, links, lattices (163 / 331 / 61), labels = document. |

## Conventions specific to this chapter

1. **The island is at the origin; the inner sets float at y = −2600** (`layout.ts` → `SETS`): the camera dives down to
   them («inward and down»); no island shot looks that far down. Their looks are re-tunes of the `day` dome
   (`looks.ts`): `MICRO_TUNE` (steps 2–4), `HALL_TUNE` (5, 8–11), `CONTAINMENT_TUNE` (6–7).
2. **The kit's lathe convention is x = r·cos φ, z = r·sin φ**: the halves facing the cameras (+Z) are φ ∈ [0, π].
3. **Shared actors** (`Deps.actors`): the containment's front half sinks into the ground in steps 6–7 (custom appear),
   the interior and the turbine island are shown only there (they cost ≈ 100 draw calls).
4. **Physics only from `@electricity/sim/plant-nuclear`**: M1 `shoot`, M2 `kEff` / `neutronGenerations`, M3
   `createReactor` / `delayedStepResponse` / `promptOnlyPower`, M4 `createPressurizer` / `saturationTempC`, M5
   `decayHeatFraction`, M6 `feedPerProduct`. The moderation walk (step 4) uses the textbook 1/e energy loss per
   collision on hydrogen, normalised to end at 0,025 eV after 19 collisions (a drawing aid).
5. **QA hooks**: `__app.read('live' | 'fission' | 'sandbox' | 'control' | 'fuel' | 'reactor' | 'loop' | 'console' |
   'safety' | 'types' | 'cycle' | 'role' | 'hotspot')`; probes `hs.<id>`, `fission.handle`, `fuel.pellet`,
   `reactor.core`, `rs.lever|knob|button`, `type.<kind>`, `npp.<plant>`.

## QA

```bash
export QA_ID=B-plant-nuclear QA_PORT=5242            # dev server: tools/dev-start.sh B-plant-nuclear 5242
node tools/qa/chapter-check.mjs plant-nuclear --sizes all --mobile
node app/src/volumes/electricity/chapters/plant-nuclear/qa/interaction.mjs --size 1280x720   # also 1920x1080, 3840x2160
pnpm vitest run src/volumes/electricity/chapters/plant-nuclear           # in app/
```
