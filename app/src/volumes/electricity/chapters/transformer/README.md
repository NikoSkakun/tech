# `transformer` — «Трансформатор»

Machine chapter, 9 steps, studio mood (evening tint in steps 3–5 and 9 through `envTune`). Script:
`docs/volumes/electricity/chapters/transformer.md`; physics: `@electricity/sim/transformer` (models Т1–Т6).
Structure follows `lab-inverter` (contract `chapter.ts`, one factory per step, `tx.share` for shared objects).

## Files

| Path | What | Rule |
| --- | --- | --- |
| `index.ts` | manifest: `manifestText(meta)` + theme (eager, tiny) | never import the content JSON here |
| `emblem.ts` | Journey Map emblem: rectangular core, coral and sky coils | ≤ 3 meshes |
| `content.ts` | `defineContent(generated JSON, { labels: OWN })` | never retype document text |
| `labels.ts` | `doc(step, i)` quoted labels, `splitList` / `splitCaps` / `pairTitle`, `hot(step, i)` hotspot names | captions come from here |
| `labels-own.ts` | `OWN` (labels the document does not carry) and `OWN_LISTS` (exhibit names, rung facts) | plain Ukrainian (§54) |
| `chapter.ts` | contract `Tx` / `StepModule` / `StepFactory`, `STEP_IDS` | read first |
| `scene.ts` | wiring: step factories, shots, `stage.define`, `ui.define`, probe, update routing | no models |
| `world.ts` | shared materials, winding copper colours, `mesh` / `group` / `tag` / `pickBox` | |
| `sound.ts` | hum (100 Hz = pitch 2 of the mains loop) / buzz levels per frame + one-shots | steps raise levels in `update` |
| `parts/*` | models without step logic | no stage, no UI |
| `steps/NN-<id>.ts` | one `StepFactory` per step | |
| `steps/shared-*.ts` | the teaching transformer (steps 1–2, stage param `coreMorph`), the power transformer (step 4) | only the current step drives them |
| `qa/interaction.mjs` | Playwright: every control once, 60 checks through `__app.read('step')` | production hooks only |
| `__tests__/*` | manifest = content, `doc()` indices exist, every hotspot placed, own labels sane | |

## Parts worth knowing

- `core-path.ts` + `coil.ts` + `teaching.ts`: the ring → rectangle morph (both outlines sampled by arc length from the
  same point; the core is a stack of swept sheets), coils whose rings are wound on / off through `drawRange`, flux /
  electron / energy flows. Hotspots and the misconception: electrons never enter the iron, energy crosses the core.
- `power-exterior.ts` + `power-layers.ts` + `active-part.ts`: the 330/110 kV transformer in metres; each layer (tank,
  oil, HV, LV, core) is its own kit model so it fades alone. Kit lathe: φ = 0 is +X, cut windows are centred on +Z.
- `line-diorama.ts`: one line per voltage class on instanced supports (`powerLine` with `LineSite.matrix`), one shared
  `K.energy` wire material (colour = temperature, pulses = power).
- `tap-selector.ts`, `eddy-bar.ts`, `domains.ts`, `clock-dial.ts`, `three-limb.ts`, `gallery.ts`, `turntable.ts`,
  `ladder.ts`: the props of steps 5–9.

## Rules that keep it random-access safe and honest

- Every step re-derives its state in `enter` (spark sequence, regulator timers, chart memo keys, layer toggles).
- Shared objects are driven only by the current step: `scene.ts` runs a fading-out step's `update` only while one of
  its *own* actors is visible.
- Slowed / not-to-scale / simplified visuals carry chips (×50 for all mains-frequency motion, turn counts and sheet
  thickness drawn «не в масштабі», «прискорено» for the oil time constant and the regulator delay).
- Colours: primary winding `coral` copper, secondary `sky` copper, flux `magenta`, electrons `cyan`, energy `yellow`,
  phases `yellow` / `green` / `red`, voltage ramp `blue → pink → coral`, heat `orange` / `red`, oil `amber`.

## QA

```bash
export QA_ID=B-transformer QA_PORT=5248
node tools/qa/chapter-check.mjs transformer --sizes all
node app/src/volumes/electricity/chapters/transformer/qa/interaction.mjs --size 1280x720   # also 1920x1080, 3840x2160
QA_PORT=5348 node app/src/volumes/electricity/chapters/transformer/qa/interaction.mjs      # production preview
pnpm vitest run src/volumes/electricity/chapters/transformer                               # in app/
```
