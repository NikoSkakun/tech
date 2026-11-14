# `plants` — «Електростанції: як первинна енергія стає струмом» (hub of part III)

Diorama chapter, 11 steps, golden hour (steps 4–6: a deep-indigo «studio» tune of the `dusk` preset — env kinds
cannot switch from `sky` to `studio`). Script: `docs/volumes/electricity/chapters/plants.md`; physics:
`@electricity/sim/plants` (M1–M6, comparison table) and `@electricity/sim/plant-gas` (real gas turbine, combined
cycle), `@electricity/sim/generator-ac` (`generatorSpeedRpm`).

## Files

| Path | What | Rule |
| --- | --- | --- |
| `index.ts` | manifest: `manifestText(meta)` + theme | never import the content JSON here |
| `emblem.ts` | Journey-map emblem: floating island with a cooling tower and a stack, circled by the glowing ring | ≤ 3 meshes |
| `content.ts` | `defineContent(generated JSON, { labels: OWN })` | never retype document text |
| `labels.ts` | `doc(step, i)` quoted captions, `fact(step, i)`, `plantTitle/plantBlurb(id)` from the plant chapters' manifests | |
| `labels-own.ts` | `OWN` scene labels; `LISTS` segmented items copied verbatim from the document's backticks, table names; `FORM_NAMES` | plain Ukrainian (§54) |
| `chapter.ts` | contract `Hub` / `StepModule` / `StepFactory`, `STEP_IDS` | read this first |
| `scene.ts` | wiring: archipelago, shared actors (turbo set, hall, island lines), step factories, `step` / `cost` probes | no models |
| `layout.ts` | every position of the archipelago (hub, hall, ring, island orbit, gallery arc) | metres |
| `shots.ts` | `STUDIO_TUNE` (env overrides of steps 4–6) | |
| `plants-data.ts`, `mix-data.ts` | island ids, plant-type colours, chapter routes; generation mix of step 10 (document figures) | pure data |
| `sound.ts` | hum / turbine / steam / water / fire / wind loops, "wanted this frame" | steps raise levels in `update` |
| `parts/archipelago.ts` | hub island, open machine hall + kit `turboSet`, 9 plant islands, world ring, island lines, picker | "wanted" fields: ring, lines, shaft |
| `parts/plant-islands.ts`, `plant-dioramas*.ts`, `diorama-util.ts` | the nine toy dioramas (authored at 60 m, shown at 0,3) | one Builder per island |
| `parts/island-picker.ts` | hover / select / open on the islands (steps 1 and 11) | `mode` is reset every frame |
| `parts/*` (rigs) | `drives` + `exceptions-shelf` (2), `band` + `sankey` (3), `heat-engine` (4), `rankine-rig` (5, and the mini loop of 6), `brayton-rig` (6), `heat-sources` + `cooling` (7), `day-tiles` (8), `race-lanes` (9), `donut` (10) | no stage, no UI |
| `sim-bindings/ts-diagram.ts`, `weather.ts` | illustrative T–s points (steam tables, ideal Brayton); deterministic weather of the race | no three.js |
| `steps/NN-<id>.ts` | one `StepFactory` per step | |
| `qa/interaction.mjs` | Playwright: every control once, asserted through `__app.read('step')` | production hooks only |
| `__tests__/manifest.test.ts` | manifest = content, quoted labels exist, hotspot ids, own labels | |

## Rules that keep it random-access safe and honest

- A step states its whole state in `enter()`; sub-states (drives, Sankey types, heat sources, cooling, HRSG,
  superheater / reheater / condenser) are actors toggled with `ctx.stage.toggle` from the control values.
- The archipelago is shared scenery; steps only write its "wanted this frame" fields (`arch.want`, `picker.mode`).
  The gallery moves the islands with stage poses (`sat-<id>`), so every other step gets them back on the circle.
- Colours: plant types `plantType.*` everywhere (islands' callouts, race lanes, donut sectors); Sankey bands encode
  the form of energy (fuel ink/slate, gas violet-tinted, nuclear violet, water blue, wind sky, light yellow-white,
  heat orange, mechanical mist, electricity yellow with pulses, losses pale red).
- Links to plant chapters that are not built are quiet: the button is disabled, a click on the island does nothing.

## QA

```bash
export QA_ID=B-plants QA_PORT=5249
node tools/qa/chapter-check.mjs plants --sizes all --no-perf-fail
QA_PORT=5249 node app/src/volumes/electricity/chapters/plants/qa/interaction.mjs --size 1280x720   # also 1920x1080, 3840x2160
QA_PORT=5349 node app/src/volumes/electricity/chapters/plants/qa/interaction.mjs                   # production preview
pnpm vitest run src/volumes/electricity/chapters/plants                                             # in app/
```
