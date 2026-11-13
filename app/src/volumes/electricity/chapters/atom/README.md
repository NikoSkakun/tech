# Chapter `atom` — structure (reference for chapter builders)

Pilot chapter, refined after the M3 / M4 API changes (`docs/API_CHANGES.md`). Copy the _structure_ below; the
notes say why each piece exists. Script: `docs/volumes/electricity/chapters/atom.md`.

## Files

| File                        | Role                                                                                                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`                  | Manifest (eager, tiny): `...manifestText(meta)` from the generated `atom.manifest.json`, theme, lazy imports. Never imports `atom.json`.                          |
| `chapter.ts`                | The contract: `Chapter { ctx, ui, world }`, `StepFactory`, `StepModule`, the typed `STEP_IDS`.                                                                    |
| `content.ts`                | `defineContent(generated JSON, { labels })` + `formula(step, i)`, `termOf(step, i)`. Hotspots bind by id in the step UI (`content: 'nucleus'`).                   |
| `labels.ts`, `labels-sm.ts` | Captions the export does not carry (plain Ukrainian, DECISIONS §54). Captions the document quotes «…» come from the export: `doc(step, wording)`.                 |
| `shots.ts`                  | Every camera shot, each with `fit` (subject bounds, DECISIONS §57 d).                                                                                             |
| `world.ts`                  | Objects shared by several steps (Cu atom: nucleus + cloud, scale ruler) and their stage handles.                                                                  |
| `scene.ts`                  | Orchestrator only: shots → world → every step factory → routes `update` to the step on screen.                                                                    |
| `steps/NN-<id>.ts`          | **One module per step**, in this order: objects → interaction state and handlers → `stage.define` → `ui.define` → `ctx.qa.probe / expose` → `update`.             |
| `parts/*.ts`                | Models and visuals with no step logic: nucleus, wire + cable end, scales, scoops, periodic wall, SM wall and channels, consoles (`console.ts`), the dock stepper… |
| `sim-bindings/*.ts`         | Glue around `@electricity/sim/atom` without three.js (`nodal.ts`: a point on a nodal surface, found from the sim's ψ).                                            |
| `emblem.ts`                 | Journey-map emblem (≤ 3 meshes).                                                                                                                                  |
| `qa/helpers.mjs`            | Playwright helpers on production hooks only: `__ui.locate('ctl-<id>[:<item>]')`, `__app.locate(probe)`, `__app.read(name)`.                                       |
| `qa/scenario.mjs`           | Screenshot scenario for `shot.mjs --script`: `DO="pick:model:quantum,pick:orbital:3d,wait:7"`.                                                                    |
| `qa/interactions.mjs`       | The interaction test: every control once, one observable assertion each; passes at 720p / 1080p / 4K, dev and production.                                         |
| `__tests__/*.test.ts`       | Manifest = content, labels = document and §54, every shot has `fit`, nodal points lie on zeros of ψ.                                                              |

## Rules that made the steps robust

1. **A step is a pure function of its state.** `stage.define` holds what is declarative (actors, params, poses,
   camera, post). Everything else is plain state in the step's closure, re-derived in `enter(info)` — never
   "what the previous step left". Continuous things are a function of one number (dive-in: wheel position `p`;
   models: `quantum` 0…1 and `a0`), so any state is reachable from any other.
2. **Tweens started by controls use `ctx.stage.scope`** (read at call time): they die when the step is left.
3. **Shared objects are driven by "wanted this frame" fields** (`world.atomZoom`, `nucleusShrink`,
   `nucleusSpin`): `scene.update` resets them, the step on screen overrides them, the world eases and applies.
4. **Physics only from `@electricity/sim/atom`**: the step converts pointer input to model input (fm, eV,
   counts), calls the model and renders the answer. Scene units per physical unit are one named constant.
5. **Conditional things use `visible`** — callouts, hotspots, honesty chips and controls alike
   (`visible: () => ui.value('model') === 'quantum'`). No off-screen anchors, no re-`define`.
6. **Text**: panel copy from the export; hotspots by content id; captions from `labels.ts`; numbers through
   `fmt*`; event messages through `ui.toast`.
7. **Where text lives** (DECISIONS §57 a). Anything that is _read_ goes to the HUD: the element cards of
   `shells` and `atom-builder` are dock tables (+ a coloured `note`), with only a name plate (`Text3D`) in the
   scene. Cards and diagrams that belong beside a model are world consoles (`parts/console.ts` →
   `worldConsole`): the preset keeps 15 px-eq text ≥ 16 px on a 720p screen, so **draw consoles on few
   px-eq** (`level-diagram.ts`: 200 wide) and pick `unit` so that `__app.read('consoles')[name].grow` is 1 in
   the step's default shot. This chapter uses no `board`: its column is where the scale ruler lives.
8. **A control the step UI lacks is a `custom` control** built from `@/ui3d` widgets (`parts/count-stepper.ts`:
   «− N +» with auto-repeat); name its parts `ctl-<id>:<part>` so tests find them like segmented items.
9. **Every interactive scene object** gets `ctx.input.register` with a tooltip and `enabled`; it always has a
   twin in the dock (scoops ↔ buttons, baskets ↔ steppers), nothing depends on hover (tiles also take a tap),
   and a moving impostor orb gets an invisible pick proxy (`colorWrite = false`).
10. **Leave the left 12 % of the frame to the scale ruler** (`parts/ruler.ts`, a `hudSurface`): compose shots
    so that walls and consoles start right of it.

## QA loop used for every step

```bash
export QA_ID=P-atom QA_PORT=5251
DO="click:preset-copper63,wait:2" node tools/qa/shot.mjs atom/atom-builder --size 1280x720 \
  --script app/src/volumes/electricity/chapters/atom/qa/scenario.mjs --out /srv/electricity/qa/P-atom/cu.jpg
node tools/qa/shot.mjs atom/models --size 1280x720 --eval "app.read('consoles')"   # console growth must be 1
tools/qa/sheet.sh out-sheet.jpg --cols 2 --tile 960 a.jpg b.jpg       # look at one sheet, not four images
node tools/qa/chapter-check.mjs atom --sizes all                      # acceptance: 1080p, 720p, 4K, DPR 2
node app/src/volumes/electricity/chapters/atom/qa/interactions.mjs --port 5251 --size 3840x2160
cd app && pnpm build && pnpm preview --port 5351 --strictPort          # then the same test with --port 5351
```
