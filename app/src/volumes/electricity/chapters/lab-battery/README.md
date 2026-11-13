# `lab-battery` — reference layout for lab / machine chapters

Chapter «Літій-іонні акумулятори» (12 steps, studio mood). Script: `docs/volumes/electricity/chapters/lab-battery.md`;
physics: `@electricity/sim/lab-battery`. This directory is meant to be copied for other chapters with charts and
simulations. It uses only the sanctioned APIs (`docs/API_CHANGES.md`): no chapter-owned HUD surface, no wrapper
around `stepUi`, no `window.__…` test hook.

## Files

| Path | What | Rule |
|---|---|---|
| `index.ts` | manifest (eager, tiny) | text from the generated `lab-battery.manifest.json` through `manifestText(meta)`; only the subtitle is ours |
| `emblem.ts` | Journey Map emblem | ≤ 3 meshes, unit sphere |
| `content.ts` | `defineContent(generated JSON, { labels })` | never retype document text |
| `labels-doc.ts` | `DOC`: UI copy of the document — read by index from `steps[].labels`, the rest verbatim | tested against the export; pinned against index drift |
| `labels.ts` | `OWN`: part names, axis titles, hints (plain Ukrainian, DECISIONS §54); `spedUp(factor)` | never inline a Ukrainian string in code |
| `lab.ts` | contract `Lab` / `StepModule` / `StepFactory` | read this first |
| `scene.ts` | wiring only: podium, build steps, shots, `stage.define`, `ui.define`, `ctx.qa.expose('probe')`, update loop | no models, no step logic |
| `shots.ts` | `frame(center, width, height)` — a shot declared by the box it must show | every shot of the chapter; gives `frameAspect` and `fit` |
| `world.ts` | podium, shared materials, `mesh` / `group` / `tag` helpers | |
| `notes.ts` | `note(id, text, tone, visible?)` — status lines as `note` controls | the chapter's five tones in one place |
| `chem-data.ts` | step 5: the document's table (`facts.items[].table`) + illustrative radar scores | |
| `parts/*` | hero models and rigs — pure builders (`create…(ctx, mats)` → `{ group, …handles, update }`) | no stage, no UI; close-up cells and level tubes come from the kit (`parts/cells.ts`) |
| `sim-bindings/*` | stateful glue around `@electricity/sim/lab-battery` (replays, sessions) | no three.js |
| `steps/NN-<id>.ts` | one `StepFactory` per step | owns its set, shots, stage spec, step UI, probes, update |
| `qa/interaction.mjs`, `qa/helpers.mjs` | Playwright interaction test (production hooks only) | every control once, one observable assertion each |
| `__tests__/*` | vitest: manifest, labels = document, hotspots bound by id, no off-screen anchors | |

## How a step is put together

```ts
export const myStep: StepFactory = (lab) => {
  const { ctx, ui, mats } = lab;
  const rig = createRig(ctx, mats);                        // parts/: geometry + handles, no state machine
  lab.stageRoot.add(group('set:my-step', 0, 0, 0, [rig.group]));
  const session = createSession();                          // sim-bindings/: model in accelerated time
  ctx.qa.probe('rig-button', rig.button);                   // scene objects the test clicks → __app.locate
  let painted = -1;                                         // what the chart on screen already shows
  const paint = (chart: Chart): void => { /* setData only when the session has new samples */ };
  return {
    id: 'my-step',
    shots: { 'my-step': frame([0.5, 1.8, 0], 7.4, 4.1) },   // the box of the scene that must be visible
    stage: { show: [rig.group], envTune: { … }, enter: (info) => { … } },   // complete state
    ui: {
      honesty: ['illustrative', { sped: 30, visible: () => session.speed() === 30 }],
      controls: [/* ≤ 3 sliders */, note('warn', L.warn, 'warning', () => over), { type: 'button', id: 'run', … }],
      board: { title: L.board, size: 'md', children: [
        { type: 'chart', id: 'chart', chart: { … }, init: () => (painted = -1), update: paint },
        { type: 'stats', id: 'stats', items: [{ label: L.time, get: () => … }] },
      ] },
      callouts: [{ anchor: rig.part, text: L.part, visible: () => rig.open }],
      hotspots: [{ anchor: rig.vent, content: 'vent' }],     // bound to the content by id: Ukrainian title
    },
    probe: () => ({ soc: session.soc }),                    // what the interaction test asserts on
    update(dt, t) { session.tick(dt); rig.apply(session.state, t); },   // model → scene, every frame
  };
};
```

Rules that kept this chapter random-access safe and honest:

- **State is a function, not a history.** Unrolling, ion positions, level tubes, lenses are pure functions of a
  few numbers (`amount`, `soc`, replay head). Anything else is re-derived in `enter`.
- **One sample drives everything.** The chart, the readouts and the 3D rig read the same model sample
  (`replay.at()`, `session.state`), so numbers and picture cannot disagree.
- **The HUD owns the chart.** A `chart` control is built anew on every entry: the step keeps the model state and
  paints in the spec's `update(chart)`; `init` only marks "nothing painted yet". Never keep a `Chart` reference.
- **Flow ∝ quantity.** Electron / ion flow speed ∝ current, wire pulses ∝ power, glow ∝ I·(U_OCV − U), level ∝ SOC.
- **Dock = parameters and the run button, board = instrument.** ≤ 3 sliders (4 where the script demands) in the
  dock; chart, results and model notes on the board. The camera frames around both (`frame()` boxes).
- **Honest time.** A chip states the real time lapse. Where it depends on the scenario, several chips with
  `visible`; where it depends on sliders, a `note` with `spedUp(factor)` computed from the run.
- **Touch.** Nothing is hover-only; every scene gesture has a HUD route (ladder chips, «Розбалансувати», «Старт»);
  small scene targets get an invisible, larger hit mesh.
- **Shared objects.** Consecutive steps may share a rig through `lab.share(key, make)` (bench of steps 6–7);
  then only the current step drives it (`if (!lab.isCurrent(ID)) return`).
- **Per-state annotations** use `visible` — never an anchor parked off screen.

## QA

```bash
export QA_ID=P-lab-battery QA_PORT=5252
node tools/qa/chapter-check.mjs lab-battery --sizes all
node app/src/volumes/electricity/chapters/lab-battery/qa/interaction.mjs --size 1280x720   # also 1920x1080, 3840x2160
pnpm vitest run src/volumes/electricity/chapters/lab-battery                                  # in app/
```

Look-dev: `node tools/qa/shot.mjs lab-battery/safety --eval "__ui.set('oven11', 200, true); __ui.press('start11'); await app.step(1/60, 900); return app.read('probe')"`.
