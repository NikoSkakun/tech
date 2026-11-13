# `lab-battery` — reference layout for lab / machine chapters

Chapter «Літій-іонні акумулятори» (12 steps, studio mood). Script: `docs/volumes/electricity/chapters/lab-battery.md`; physics:
`@electricity/sim/lab-battery`. This directory is meant to be copied for other chapters with heavy charts and simulations.

## Files

| Path | What | Rule |
|---|---|---|
| `index.ts` | manifest (eager, tiny) | step ids / titles repeated, `__tests__/manifest.test.ts` compares them with the generated content |
| `emblem.ts` | Journey Map emblem | ≤ 3 meshes, unit sphere |
| `content.ts` | `defineContent(generated JSON, { labels })` | never retype document text |
| `labels.ts` | scene labels: `DOC` (verbatim «…» of the document's «Інтерактив», tested) + `OWN` (part names, axes) | add a label here, never inline a Ukrainian string in code; plain Ukrainian (DECISIONS §54) |
| `lab.ts` | contract `Lab` / `StepModule` / `StepFactory` | read this first |
| `scene.ts` | wiring only: podium, build steps, shots, `stage.define`, `ui.define`, per-step env, update loop | no models, no step logic |
| `world.ts` | podium, shared materials, `mesh` / `group` / `tag` / `nowhere` helpers | |
| `lab-ui.ts` | `labUi` = `stepUi` + `drive` / `press` / `external` / `action`; exposes `window.__lab` | |
| `holo.ts` | holographic instrument board (chapter-owned `hudSurface`) for big charts | one board per step, top-left |
| `hud-bits.ts` | dock / board widgets: `notices`, `factTable`, `statGrid` | |
| `chem-data.ts` | data of step 5 parsed from the content (+ illustrative radar scores) | |
| `parts/*` | hero models and rigs — pure builders (`create…(ctx, mats)` → `{ group, …handles, update }`) | no stage, no UI, no sim imports beyond types |
| `sim/*` | stateful bindings around `@electricity/sim/lab-battery` (replays, sessions) | no three.js |
| `steps/NN-<id>.ts` | one `StepFactory` per step | owns its set, shots, stage spec, step UI, probe, update |
| `qa/interaction.mjs` | Playwright interaction test (every control, asserted through `__lab.probe()`) | |
| `__tests__/*` | vitest: manifest = content, `DOC` labels = document, every hotspot placed | |

ESLint forbids `../dir/file` imports inside a chapter, so `parts/`, `sim/` and `steps/` each have an `index.ts`
barrel and are imported as `'../parts'`.

## How a step is put together

```ts
export const myStep: StepFactory = (lab) => {
  const rig = createRig(lab.ctx, lab.mats);              // parts/: geometry + handles, no state machine
  lab.stageRoot.add(group('set:my-step', 0, 0, 0, [rig.group]));
  const session = createSession();                        // sim/: model in accelerated time
  const chart = new Chart({ … });
  lab.holo.add('my-step', { title: L.board, width: 540, children: [chart] });   // big chart → board
  return {
    id: 'my-step',
    shots: { 'my-step': { position: […], target: […] } }, // subject lower-right: the board is top-left
    stage: { show: [rig.group], enter: (info) => { … } }, // complete state; honour info.instant
    ui: { honesty: ['illustrative'], controls: [/* ≤ 3 sliders */], callouts: […], hotspots: […] },
    probe: () => ({ soc: session.soc }),                  // what the interaction test asserts on
    update(dt, t) {                                       // model → chart AND scene, every frame
      session.tick(dt);
      rig.apply(session.state, t);
    },
  };
};
```

Rules that kept this chapter random-access safe and honest:

- **State is a function, not a history.** Unrolling, ion positions, level tubes, lenses are pure functions of a
  few numbers (`amount`, `soc`, replay head). Anything else is re-derived in `enter`.
- **One sample drives everything.** The chart, the readouts and the 3D rig read the same model sample
  (`replay.at()`, `session.state`), so numbers and picture cannot disagree.
- **Flow ∝ quantity.** Electron / ion flow speed ∝ current, wire pulses ∝ power, glow ∝ I·(U_OCV − U), level ∝ SOC.
- **Dock = parameters, board = instrument.** ≤ 3 sliders (+ a toggle row) in the dock; chart, result table,
  run button and model notes on the holo board. A long dock overflows the screen (see docs/requests).
- **Honesty.** Step-level chips through `honesty`; model notes of the document as permanent `notices`.
- **Shared objects.** Consecutive steps may share a rig through `lab.share(key, make)` (bench of steps 6–7);
  then only the current step drives it (`if (!lab.isCurrent(ID)) return`).
- **Hotspot titles** are the document's name pair verbatim (`'Vent — клапан'`): the HUD finds the text by it and
  decides what to display (DECISIONS §54 g). Callouts and labels are the chapter's own and are plain Ukrainian.
- **Hidden annotations.** A callout / hotspot that does not apply returns `nowhere(ctx, v)` as its anchor.

## QA

```bash
export QA_ID=B-lab-battery QA_PORT=5223
node tools/qa/chapter-check.mjs lab-battery --also-size 1280x720
node app/src/volumes/electricity/chapters/lab-battery/qa/interaction.mjs            # 54 checks, real pointer + __lab hooks
pnpm vitest run src/volumes/electricity/chapters/lab-battery                        # in app/
```

`window.__lab`: `drive(id, value)`, `press(id)`, `value(id)`, `probe()` — for look-dev shots too:
`node tools/qa/shot.mjs lab-battery/safety --eval "__lab.drive('oven11', 200); __lab.press('start11'); await app.step(1/60, 900)"`.
