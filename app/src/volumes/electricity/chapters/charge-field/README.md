# Chapter `charge-field` — «Заряд і електричне поле»

Script: `docs/volumes/electricity/chapters/charge-field.md`. Physics: `@electricity/sim/charge-field` only.
Scene scale: `M = 30` units per metre (`layout.ts`); the field table is a disc of radius 6, its top is y = 0.

| File                         | Role                                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `index.ts`                   | Manifest (eager, tiny): `manifestText(meta)` from the generated manifest, theme, lazy scene / emblem.                                |
| `content.ts`                 | `defineContent(generated JSON, { labels })`; `docLabel` / `docItems` (captions the document quotes «…»), `factPairs`, `crossTarget`. |
| `labels.ts`                  | Captions the export does not carry: `DOC` (verbatim quotes, tested against the document) and `L` (authored, plain Ukrainian).        |
| `chapter.ts`                 | Contract: `Chapter { ctx, ui, world }`, `StepModule { id, stage, ui, update }`, `StepFactory`.                                       |
| `layout.ts`, `shots.ts`      | Every position / size; every camera shot (with `fit`).                                                                               |
| `world.ts`                   | Shared objects: field table (glass top = `fade` actor), charge sandbox, sandbox field lines.                                         |
| `scene.ts`                   | Orchestrator: env → world → step factories → `stage.define` / `ui.define` → update routing.                                          |
| `sound.ts`                   | "Wanted this frame" loop levels (`sound.hum / buzz / wind`), applied after the step's update.                                        |
| `fmt.ts`                     | Number formatting on top of `@/content` (aC…nC prefixes, scientific with unit).                                                      |
| `parts/*.ts`                 | Models and effects without step logic (table, charge ball, sandbox, landscape, conductors, balloon set, storm, capacitor, bench …).  |
| `steps/NN-<id>.ts`           | One `StepFactory` per step: objects → handlers → stage spec → ui → QA probes → update.                                               |
| `qa/interaction.mjs`         | Playwright: every control once, one observable assertion each (dev and production builds).                                           |
| `__tests__/manifest.test.ts` | Manifest = content, `DOC` labels = document, every hotspot bound by id.                                                              |

## Conventions that keep the steps random-access safe

1. Everything a step toggles is a stage actor **registered in the factory** (`stage.actor(obj)`), never on first
   use — a deep link to another step must find it hidden. Sub-states use `stage.toggle` / `stage.setParam`.
2. A step keeps its own state in its closure and re-derives the scene in `stage.enter(info)` (honours
   `info.instant`). Steps 3 and 4 share the sandbox: each keeps `mine` (its arrangement) and hands it over in
   `enter`; `sandbox.version` tells when to re-trace (≤ 30 Hz).
3. Field lines: sim `traceFieldLines` → `parts/sim-lines.ts` (fx `RibbonLines`). Landscape: fx
   `createPotentialSurface` fed with g⁻¹(tanh) so that the drawn height is the sim's `landscapeHeight`; iso-lines:
   fx `contourLines` at true multiples of ΔU (`parts/landscape.ts`).
4. Captions: quoted in the document → `docLabel(step, i)`; otherwise `labels.ts`. Numbers through `fmt*`.
5. A control whose caption changes is two controls with `visible` (`ui.patch({ label })` relabels sliders only).

## QA loop

```bash
export QA_ID=P-charge-field QA_PORT=5254
node tools/qa/shot.mjs charge-field/potential --size 1280x720 --eval "window.__ui.set('potPreset','twoHills',true); await app.step(1/60, 60)"
node tools/qa/chapter-check.mjs charge-field --sizes all
node app/src/volumes/electricity/chapters/charge-field/qa/interaction.mjs [--size 1920x1080] [--port 5341] [--only field,potential]
```
