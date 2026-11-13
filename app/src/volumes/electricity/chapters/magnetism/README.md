# `magnetism` — «Магнетизм та електромагнітна індукція»

Chapter 5 of volume `electricity` (11 steps, studio mood, accent `magenta`): «Майстерня Фарадея» — one round
workshop table on which every step assembles its apparatus, with the live «килим компасів» under several of them.
Script: `docs/volumes/electricity/chapters/magnetism.md`; physics: `@electricity/sim/magnetism` (models М1–М8).

Units: **1 world unit = 10 cm** (`S` in `world.ts`); the simulation's table plane (x east, y north, metres) maps to
world (x·S, h, −y·S) — north is "away from the camera". Kit lathe angles: x = r·cos φ, z = r·sin φ.

## Files

| Path | What | Rule |
|---|---|---|
| `index.ts` | manifest (eager, tiny): `manifestText(meta)` from the generated manifest JSON | no content import |
| `emblem.ts` | Journey Map emblem: a horseshoe magnet with a glowing field arc | ≤ 3 meshes |
| `content.ts` | `defineContent(generated JSON, { labels })` | never retype document text |
| `labels.ts` | `DOC`: captions quoted «…» in the document (`steps[].labels`, by index) | indexes pinned by `__tests__/manifest.test.ts` |
| `labels-own.ts` | `OWN`: labels the document does not carry | plain Ukrainian (DECISIONS §54) |
| `chapter.ts` | the contract: `Bench`, `StepModule`, `StepFactory`, `LiveState` | read this first |
| `world.ts` | the workshop table, shared materials, `S`, `simToWorld`, `glow`, `tag` | |
| `scene.ts` | wiring only: table + carpet → step factories → shots → `stage.define` → `ui.define` → update routing | |
| `sound.ts` | loops `buzz`, `turbine` (whir), `hum` from `bench.live` (reset every frame) | |
| `parts/*` | models and effects without step logic | no stage, no UI |
| `steps/NN-<id>.ts` | one `StepFactory` per step | |
| `qa/interaction.mjs` | Playwright: every control once, one observable assertion each (70 checks) | dev and production builds |
| `__tests__/*` | manifest = content, label indexes, every hotspot placed, every shot has `fit` | |

## Shared parts worth knowing

- `parts/carpet.ts` — the compass carpet (24×24 instanced needles, М1 critically damped follower). A step sets
  `carpet.field(x, z, out)` (sim components, T, Earth included), `carpet.mask`, `carpet.layout()` in `enter`, and lists
  `carpet.group` in `stage.show` (the scene makes it one shared `fade` actor).
- `parts/b-lines.ts` — `magenta` ribbons with sliding beads; `fromSim(streamlines, h)` maps sim lines to the table.
- `parts/bar-magnet.ts`, `compass.ts` (+ instanced needles), `coil.ts` (helix + `COPPER`), `supply.ts`, `lamp.ts`,
  `galvanometer.ts`, `memory.ts` (the last frame of `current/dc-ac`), `hand.ts` (grip / left hands).
- Step heroes: `domain-slab.ts` (weighted Voronoi of tiles: walls slide), `crane.ts`, `beam-tube.ts`, `swing.ts`,
  `motor-model.ts`, `tubes.ts`, `rl-board.ts`, `eq-views.ts`, `wave-view.ts`, `poynting-view.ts`, `generator-model.ts`.

## QA

```bash
export QA_ID=B-magnetism QA_PORT=5246
node tools/qa/chapter-check.mjs magnetism --sizes all
node app/src/volumes/electricity/chapters/magnetism/qa/interaction.mjs --size 1280x720   # also 1920x1080, 3840x2160
QA_PORT=5346 node app/src/volumes/electricity/chapters/magnetism/qa/interaction.mjs       # against `pnpm preview`
pnpm vitest run src/volumes/electricity/chapters/magnetism                                # in app/
```

`__app.read(<step id>)` returns each step's observable state; probes: `magnetB1`, `nPole1`, `slab2`, `probe3`,
`wire3`, `rod4`, `coil4`, `bulb5`, `bar5`, `commutator6`, `magnet7`, `coil7`, `cuMagnet8`, `ringMagnet8`, `s1-9`, `s2-9`,
`resistor10`, `crank11`.
