# `generator-ac` — «Генератор, змінний струм, три фази»

Machine chapter, 11 steps, studio mood («студія-машинна зала»: a slate turntable floor with a 0…360° scale, teal
rim light). Script: `docs/volumes/electricity/chapters/generator-ac.md`; physics: `@electricity/sim/generator-ac`.
Structure follows `lab-inverter` (contract + one module per step) with the post-pilot APIs (HUD `board`, `ctx.qa`
probes, `stage.toggle` / `setParam`, `manifestText`, quoted labels from the export).

## Files

| Path | What | Rule |
| --- | --- | --- |
| `index.ts` | manifest: `manifestText(meta)` + theme (eager, tiny) | never import the content JSON here |
| `emblem.ts` | Journey Map emblem: stator ring with three phase coils, 2-pole rotor, one glowing sine period | ≤ 3 meshes |
| `content.ts` | `defineContent(generated JSON, { labels: OWN })` | never retype document text |
| `labels.ts` / `labels-own.ts` | `doc(step, i)` quoted captions; `OWN` = part names, tags, status words | plain Ukrainian (§54) |
| `chapter.ts` | contract `Hall` / `StepModule` / `StepFactory`, `STEP_IDS` | read this first |
| `scene.ts` | wiring only: floor, step factories, shots, `stage.define`, `ui.define`, probe, update loop | no models, no step logic |
| `world.ts` | shared materials, `mesh` / `group` / `tag` / `pickBox`, phase colours | |
| `sound.ts` | hum (100 Hz machine hum), turbine whoosh, buzz — "wanted this frame" levels | steps raise levels in `update` |
| `parts/*` | models without step logic | no stage, no UI |
| `sim-bindings/trace.ts` | signal history for the scope traces (newest left, flowing right) | no three.js |
| `steps/NN-<id>.ts` | one `StepFactory` per step: set → handlers → shots → stage → ui → probe → update | |
| `qa/interaction.mjs` | Playwright: every control once, asserted through `__app.read('step')` | production hooks only |
| `__tests__/manifest.test.ts` | manifest = content, quoted labels exist, hotspot counts, own labels | |

## Parts worth knowing

- `holo-scope.ts`: the chapter's hologram language — `fx` Scope on a slim frame + polar dial; value 1 on the scope
  equals the dial radius, so the dashed guide from a phasor tip to the newest point of its curve is horizontal.
- `phasor-rig.ts`: dial + three-phase scope + Σ plate (tail-to-head triangle, blue gap = neutral) + p(t) strip.
- `stator.ts` (flat stator, `3·p` phase coils, magnet rotor), `cage-rotor.ts` (cutaway squirrel cage with current
  dots), `turbo-gen.ts` (own cutaway turbogenerator with removable `housing` / `stator` / `rotor` / `cooling`
  parts), `toy-generator.ts` (horseshoe + loop + slip rings + crank), `war-diorama.ts`, `dc-shelf.ts`,
  `star-delta-board.ts` (Y ⇄ Δ morph), `terminal-box.ts` (jumper slots), `sync-console.ts`, `rlc-board.ts`,
  `canal.ts`, `world-map.ts`, `meter.ts`, `bulb.ts`, `turntable.ts`.
- `stator.ts` keeps the yoke low and winds each coil as separate turns, so the three coloured windings read from the
  usual ~30° camera (steps 4 and 6).
- `war-diorama.ts`: the neighbourhoods stand at the front and stay put; the stations slide up the streets with the
  distance (the comparison of the lamps is the subject).
- `canal.ts`: the horse walks an arc path of fixed rope length around the bow; the canal ends in land ahead of the
  barge, so the drawn rope keeps the exact angle φ for every value 0…80° (probe `ropeDeg`).

## Composition (refinement P-generator-ac)

- One mise-en-scène at a time where a step has two: step 10 shows the canal analogy (default; rope-angle control,
  horse drag) or the real circuit with the motor's power triangle beside it (cos φ / capacitor controls) — the
  other set fades out and the camera moves (`ac-power` / `ac-power:circuit`).
- Step 7: «Пролетіти вздовж зазору» replays the gap fly-through on demand (turbo and hydro shots), so deep links and
  hydro mode reach it.
- Every shot declares `fit`; callouts that carry the point are listed first (phones show three).

## Rules that keep it random-access safe and honest

- A step states its whole state in `enter()`; sub-states (`crank`, LED demo, six returns, stator variants, compass /
  cage, turbo / hydro, layers, stage-2 springs) are registered actors toggled with `ctx.stage.toggle`.
- One model sample drives the scene, the scope and the readouts. Physics only from the sim library; the scene
  never re-derives formulas (the step-11 teaser is a plain ratio, as the sim README says).
- Time bases are declared: 50 Hz is shown at 1 Hz («сповільнено ×50»), the generator rotor ×100 / hydro ×10, RLC
  scopes ×100, the LED swing ×10; the synchroscope and the rotor swing (step 8 stage 2) run in real time.
- Colours: phases L1/L2/L3 `yellow`/`green`/`red`, neutral `blue`, **B** `magenta`, poles N `coral` / S `blue`,
  energy `yellow` pulses, reactive `sky` pulses (`flow.reactive`), electrons `cyan`, primary coil coral-tinted
  copper / secondary sky-tinted (DECISIONS §8).

## QA

```bash
export QA_ID=P-generator-ac QA_PORT=5258
node tools/qa/chapter-check.mjs generator-ac --sizes all --mobile
QA_PORT=5258 node app/src/volumes/electricity/chapters/generator-ac/qa/interaction.mjs --size 1280x720   # also 1920x1080, 3840x2160
QA_PORT=5358 node app/src/volumes/electricity/chapters/generator-ac/qa/interaction.mjs                   # production preview
pnpm vitest run src/volumes/electricity/chapters/generator-ac                                             # in app/
```
