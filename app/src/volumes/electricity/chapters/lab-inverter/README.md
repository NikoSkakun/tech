# `lab-inverter` — «Інвертори: як постійний струм стає змінним»

Lab chapter, 12 steps, studio mood («studio-workshop»: a dark bench lit from below, holographic instruments).
Script: `docs/volumes/electricity/chapters/lab-inverter.md`; physics: `@electricity/sim/lab-inverter`.
Structure follows the `lab-battery` pilot with the post-pilot APIs (HUD `board`, `ctx.qa` probes, `stage.setParam`,
`manifestText`, quoted labels from the export).

## Files

| Path                 | What                                                                                             | Rule                               |
| -------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------- |
| `index.ts`           | manifest: `manifestText(meta)` + theme (eager, tiny)                                             | never import the content JSON here |
| `emblem.ts`          | Journey Map emblem (wall box + a glowing period of the sine)                                     | ≤ 3 meshes, unit sphere            |
| `content.ts`         | `defineContent(generated JSON, { labels: OWN })`                                                 | never retype document text         |
| `labels.ts`          | `doc(step, i)` — the i-th caption the document quotes «…»; `splitPair` / `pairTitle`             | control captions come from here    |
| `labels-own.ts`      | `OWN` — labels the document does not carry (part names, axes, status words)                      | plain Ukrainian (DECISIONS §54)    |
| `chapter.ts`         | contract `Lab` / `StepModule` / `StepFactory`, `STEP_IDS`                                        | read this first                    |
| `scene.ts`           | wiring only: bench, step factories, shots, `stage.define`, `ui.define`, probe, update loop       | no models, no step logic           |
| `world.ts`           | shared materials, `mesh` / `group` / `tag` / `pickBox`, bench size                               |                                    |
| `sound.ts`           | hum / buzz levels "wanted this frame" + one-shots                                                | steps raise levels in `update`     |
| `parts/*`            | models and instruments without step logic (`create…()` → handles)                                | no stage, no UI                    |
| `sim-bindings/*`     | stateful glue around the simulation library (sessions, slow motion, events)                      | no three.js                        |
| `steps/NN-<id>.ts`   | one `StepFactory` per step: set → handlers → shots → stage → ui → probe → update                 |                                    |
| `steps/shared-*.ts`  | objects shared by several steps (`lab.share`): the bench set (1, 6, 7), the scope station (4, 5) | only the current step drives them  |
| `qa/interaction.mjs` | Playwright: every control once, asserted through `__app.read('step')`                            | production hooks only              |
| `__tests__/*`        | vitest: manifest = content, `doc()` indices exist, every hotspot placed, own labels sane         |                                    |

## Parts worth knowing

- `inverter-layout.ts` → `inverter-open.ts` → `inverter-live.ts`: the hero «ЛІ-6» opened up. Layout (every position
  and the current paths) → kit `Builder` model (tray, PV / battery / AC terminals, two boost chokes, DC-link cans,
  H-bridge on its heat sink with gate drivers, LC filter, relays, battery converter with the ferrite transformer,
  control board, lifting cover) → living layer (energy wires, switch outlines, link glow, signal "nerves", LEDs,
  holographic cables, «Рентген»).
- `bench-scope.ts`: two-track scope with crisp pulse edges, a dense "fence" mode and log-binned spectrum rows.
- `hbridge-rig.ts`: the teaching bridge; `loopPath(conducting)` gives the closed current path for the electron flow.
- `components.ts`: toroid choke, TO-247 transistor, electrolytic can, heat sink, relay — for any `Builder`.

## Rules that keep it random-access safe and honest

- A step states its whole state: stage params (`coverOpen`, `coverAway`, `xray`, pose `miniBridge`), `enter()`
  resets its session; controls with history use `reset: true` (steps 1, 3).
- One model sample drives the scene, the chart and the readouts (`WaveLab`, sessions' `state`).
- Shared controls: steps 4 and 5 share the waveform settings (`fc4`, `ma4`, `width4`, `wave4` ⇄ `wave5`); each
  applies them only while it is the current step.
- Slow motion is always declared: every step with a time base carries a «сповільнено» chip with its factor
  (`SLOWDOWN`, `SLOWED`, `EVENT_SLOW`, `UPS_SLOW`); stretched or not-to-scale things carry their own chip.
- Boards cost horizontal room (their column becomes a camera inset): wide scenes keep readouts in the dock and
  show the board on demand (steps 8, 9); tall compositions use `frameAspect` ≈ 1.1–1.3 (steps 4–7).
- Colours: DC + `coral` / − `blue`, energy `yellow`, phases `yellow` / `green` / `red`, reactive `sky`, fields
  **E** `amber` / **B** `magenta`, electrons `cyan`, n `teal` / p `pink`, scope: before the filter `violet`,
  after `yellow`, carrier `cyan`.

## QA

```bash
export QA_ID=B-lab-inverter QA_PORT=5244
node tools/qa/chapter-check.mjs lab-inverter --sizes all
node app/src/volumes/electricity/chapters/lab-inverter/qa/interaction.mjs --size 1280x720   # also 1920x1080, 3840x2160
QA_PORT=5344 node app/src/volumes/electricity/chapters/lab-inverter/qa/interaction.mjs      # production preview
pnpm vitest run src/volumes/electricity/chapters/lab-inverter                               # in app/
node tools/qa/shot.mjs lab-inverter/h-bridge --eval "window.__ui.set('s1', true, true); window.__ui.set('s4', true, true); await app.step(1/60, 90); return app.read('step')"
```
