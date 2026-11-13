# Chapter `atom` — structure (reference for chapter builders)

Pilot chapter. Copy the _structure_ below; the notes say why each piece exists. Script: `docs/volumes/electricity/chapters/atom.md`.

## Files

| File                         | Role                                                                                                                                                                                |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`                   | Manifest (eager, tiny): ids, titles, blurbs, theme. Does **not** import the generated content.                                                                                      |
| `content.ts`                 | `defineContent(generated JSON, { labels })` + helpers `hotspotName(step, i)`, `termName`, `formula`.                                                                                |
| `labels.ts`, `labels-sm.ts`  | Captions the export does not carry: control labels quoted «…» in the document, callouts, data-table text. Never panel copy.                                                         |
| `chapter.ts`                 | The contract: `Chapter { ctx, ui, world }`, `StepFactory`, `StepModule`; helpers `anchorWhen`, `qaProbe`.                                                                           |
| `world.ts`                   | Objects shared by several steps (Cu atom: nucleus + cloud, scale ruler) and their stage handles.                                                                                    |
| `scene.ts`                   | 40 lines: creates the world, calls every step factory, routes `update` to the step on screen.                                                                                       |
| `step-<step-id>.ts`          | **One module per step** — everything about that step, in this order: objects → interaction state and handlers → camera shot + `stage.define` → `ui.define` → `qaProbe`s → `update`. |
| `parts/*.ts`                 | Models and visuals with no step logic (reusable between steps): nucleus, cloud, wire, scales, cards…                                                                                |
| `emblem.ts`                  | Journey-map emblem (≤ 3 meshes).                                                                                                                                                    |
| `qa/helpers.mjs`             | Playwright helpers (`advance`, `click`, `slide`, `pickTab`, `project`).                                                                                                             |
| `qa/<step>.mjs`              | Screenshot scenarios for `tools/qa/shot.mjs --script` (env vars choose the state).                                                                                                  |
| `qa/interactions.mjs`        | The interaction test: every control once, one observable assertion each.                                                                                                            |
| `__tests__/manifest.test.ts` | Manifest ids / titles equal the generated content.                                                                                                                                  |

The layout is flat (`step-*.ts` beside `scene.ts`) because ESLint's `no-restricted-imports` pattern `../*/**`
forbids `steps/x.ts` → `../parts/y`. Parts may import `../labels`, `../content`, `../chapter` (one level up).

## Rules that made the steps robust

1. **A step is a pure function of its state.** `stage.define` holds what is declarative (actors, params, poses,
   camera, post). Everything else is plain state in the step's closure, re-derived in `enter(info)` — never
   "what the previous step left". Continuous things are a function of one number (dive-in: wheel position `p`;
   models: `quantum` 0…1 and `a0`), so any state is reachable from any other.
2. **Interaction tweens use the step's scope** (`scope = info.scope` in `enter`): they die when the step is left.
3. **Shared objects are driven by "wanted this frame" fields** (`world.atomZoom`, `nucleusShrink`,
   `nucleusSpin`): `scene.update` resets them, the step on screen overrides them, the world eases and applies.
   No step has to clean up after itself.
4. **An object is either a stage actor or a pose target, not both** (both write `scale`): wrap it —
   holder (actor) › pose group › model.
5. **Physics only from `@electricity/sim/atom`**: the step converts pointer input to model input (fm, eV, counts), calls
   the model and renders the answer. Scene units per physical unit are one named constant per step.
6. **Text**: panel copy from the export; hotspot cards by `hotspotName(step, i)`; captions from `labels.ts`;
   numbers through `fmt*`.
7. **Conditional callouts / hotspots**: `anchorWhen(ctx, () => condition, anchor)`.
8. **Dock budget at 1280×720**: under a 3-line step title there is room for about 300 units — e.g. 2 sliders +
   2 segmented, or 1 chart (≤ 180 high) + 1 button row. Check the deep-link sheet at 720p.
9. **World text** goes on a `worldSurface` console (`parts/element-card.ts`, `level-diagram.ts`); keep it
   ≥ 16 px-eq on screen. Additive point clouds go to the overlay layer (`toOverlay`) so DOF does not smear them.
10. **Every interactive scene object** gets `ctx.input.register` with a tooltip and `enabled: () => on()`;
    impostor orbs that move get an invisible pick proxy (`colorWrite = false`).

## QA loop used for every step

```bash
export QA_ID=B-atom QA_PORT=5221
MODE=drag PULL=150 node tools/qa/shot.mjs atom/nucleus --size 1280x720 \
  --script app/src/volumes/electricity/chapters/atom/qa/nucleus.mjs --out /srv/electricity/qa/B-atom/nuc-drag.jpg
tools/qa/sheet.sh out-sheet.jpg --cols 2 --tile 960 a.jpg b.jpg       # look at one sheet, not four images
node tools/qa/chapter-check.mjs atom --also-size 1280x720             # acceptance
node app/src/volumes/electricity/chapters/atom/qa/interactions.mjs [--only nucleus,quarks] [--size 1920x1080]
```
