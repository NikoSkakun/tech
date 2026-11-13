# `lab-pv` — «Сонячні панелі: від фотона до масиву»

Lab chapter, 11 steps, studio mood (the roof steps 8–9 tune the studio backdrop into a day sky). Script:
`docs/volumes/electricity/chapters/lab-pv.md`; physics: `@electricity/sim/lab-pv` (never re-derived here).
Structure follows the `lab-battery` pilot with the post-pilot APIs (`board`, `ui.set/press`, `ctx.qa`, `envTune`,
`stage.toggle`, `manifestText`).

## Files

| Path | What | Rule |
|---|---|---|
| `index.ts` | manifest (eager, tiny): `manifestText(meta)` | no content import |
| `emblem.ts` | Journey Map emblem (3 meshes) | unit sphere, static |
| `content.ts` | `defineContent(generated JSON, { labels })`; `doc(step, i)` / `docPair` / `cap` = captions the document quotes; `xref()` | never retype document text |
| `labels.ts` | own labels `L` (callouts, readouts, toasts), `fill()` | plain Ukrainian (DECISIONS §54); no Ukrainian string in step code |
| `chapter.ts` | contract `Lab` / `StepModule` / `StepFactory` | read this first |
| `scene.ts` | wiring only: podium, steps, shots, `stage.define`, `ui.define`, update routing | no models, no step logic |
| `world.ts` | podium, shared materials, `MODULE_SCALE` / `HOUSE_SCALE`, `group` / `shadows` / `tag` | |
| `sound.ts` | loops driven by what the step publishes each frame (`sound.power`, `.hot`, `.wind`), `blip()` | |
| `data/cell-tech.ts` | step 3: layers and chip numbers of the five cell generations (document numbers) | |
| `sim-bindings/bench-model.ts` | **the one model sample** of steps 4–7: inputs → I-V analysis, operating point, section voltages, branch currents, diode currents, hot spots | no three.js |
| `sim-bindings/shade-state.ts`, `string-design.ts` | step 7 shade (painted cells × silhouettes), step 9 string assignment + `checkString` | no three.js |
| `ui-bits/curve-chart.ts` | I-V / P-V chart spec for the HUD board (redraws on `curveVersion` only) | |
| `parts/lm440*.ts` | hero module: layout (cell ↔ index, electron routes), layered model, live look (cells, flow, diodes, hot spots) | pure builders |
| `parts/rig.ts` | shared bench rig (`lab.share('rig')`): `rig.group` = module + easel + sun-lamp, `rig.desk` = bench + cables; `rig.show(sample)` | steps 5, 6, 7 |
| `parts/roof-world.ts` | shared roof diorama (`lab.share('roof')`): island, kit house, slope frame, compass | steps 8, 9 |
| `parts/*` | everything else: one model / effect per file (`create…() → { group, anchors, set/update }`) | no stage, no UI |
| `steps/NN-<id>.ts` | one `StepFactory` per step: set → input → probes → shots → stage → ui → update | |
| `qa/interaction.mjs` | Playwright: every control once, asserted through `__app.read` / `__app.locate` / `__ui.locate` | dev and production builds |
| `__tests__/chapter.test.ts` | manifest = content, document labels found, hotspots placed, control points of the bindings | |

## Rules that keep it honest and random-access safe

- **One sample drives everything.** `rig.model.sample(input)` → chart (`curveChart`), stats, table, cell
  brightness, electron routes (density ∝ branch current), diode glow, hot-spot halo, needles, cable pulses, lamp.
- **A step is a function of a few numbers** read from `ui.value(...)` every frame; history lives only in the
  simulation sessions (`createMpptSim`, the 20 s game, snow slide, frosty sunrise) and is reset in `enter()`.
- **Sub-states** (string of ten, optimisers, loss pie, dismantled module) use `ctx.stage.toggle` — the next step
  entry restores the declared state; `applied` flags are reset in `enter()`.
- **Shared objects** (`rig`, `roof`) are listed in several steps' `show`; only the current step drives them
  (`if (!lab.isCurrent(ID)) return`).
- **HUD first** (DECISIONS §57): charts, tables and numbers are on the `board`; world text is limited to short
  tags (counter over the 1 m² frame, volts under the mountain, compass letters).
- Module frame = kit frame (XZ plane, +Y glass, long side Z); half-cell index = simulation index
  (`halfCellLocation`), row 0 at −Z. Roof: south = +Z, west = −X; azimuth from south, + west.

## QA

```bash
export QA_ID=B-lab-pv QA_PORT=5243
node tools/qa/chapter-check.mjs lab-pv --sizes all
node app/src/volumes/electricity/chapters/lab-pv/qa/interaction.mjs --size 1280x720   # also 1920x1080, 3840x2160; --port 5343 for the preview
pnpm vitest run src/volumes/electricity/chapters/lab-pv                               # in app/
node tools/qa/shot.mjs lab-pv/shading --eval "__ui.set('sh-bird', true, true); await app.step(1/60, 90); return app.read('shade7')"
```

Readable state per step: `sun1`, `pv2`, `cell3`, `module4`, `bench5`, `bench6`, `shade7`, `orient8`, `array9`,
`mppt10`, `life11` (`__app.read`); probes: `bar1-<i>`, `tile3-<tech>`, `module4`, `knob5`, `cell7-<i>`,
`shape7-<kind>`, `module8`, `mod9-<i>`, `climber10`, `rider11` (`__app.locate`).
