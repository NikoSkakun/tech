# `current` — «Струм, напруга, опір: електричне коло»

Chapter 4 of volume `electricity` (10 steps, studio mood, accent `yellow`): a workbench chapter that zooms
between the inside of a wire (the lens) and a tabletop circuit. Script: `docs/volumes/electricity/chapters/current.md`;
physics: `@electricity/sim/current` (every circuit readout comes from the shared MNA solver through it).

## Files

| Path | What | Rule |
|---|---|---|
| `index.ts` | manifest (eager, tiny): `manifestText(meta)` from the generated manifest JSON | no content import |
| `emblem.ts` | Journey Map emblem: a loop of wire, a lit lamp, one electron | ≤ 3 meshes, unit sphere |
| `content.ts` | `defineContent(generated JSON, { labels })` | never retype document text |
| `labels.ts` | `DOC`: captions quoted «…» in the document, picked by index from `steps[].labels` | indexes pinned by `__tests__/manifest.test.ts` |
| `labels-own.ts` | `OWN`: labels the document does not carry (part names, short captions) | plain Ukrainian (DECISIONS §54) |
| `chapter.ts` | the contract: `Bench`, `StepModule`, `StepFactory`, `LiveState` | read this first |
| `world.ts` | the round perforated workbench, shared materials, `mesh` / `group` / `tag` helpers | |
| `scene.ts` | wiring only: workbench → step factories → shots → `stage.define` → `ui.define` → update routing | no models, no step logic |
| `sound.ts` | audio loops from `bench.live` ("wanted this frame", reset every frame) | |
| `parts/*` | models without step logic: `create…()` → `{ group, anchors, state fields, update }` | no stage, no UI |
| `sim-bindings/builder-edit.ts` | editing glue of the constructor around `solveBuilder` (placement rules, loops, KCL balance) | no three.js |
| `steps/NN-<id>.ts` | one `StepFactory` per step: set → handlers → shots → stage → ui → qa probes → update | |
| `qa/interaction.mjs` | Playwright: every control once, one observable assertion each (97 checks) | dev and production builds |
| `__tests__/*` | vitest: manifest = content, label indexes, every hotspot placed, every shot has `fit` | |

## Shared parts worth knowing

- `parts/leads.ts` — `createLead(points)`: a `createWire` tube on the table; `drive(flow, power)` maps current
  → pulse speed (sign = direction) and power → brightness; `tint()` for the potential ramp / heat.
- `parts/lens.ts` — the magnifier: camera-facing head showing the copper lattice and drifting electrons;
  `drift`, `ac`, `agitation`, `heat`; `dir` = wire direction so the drift on screen follows the wire.
- `parts/battery.ts`, `bulb.ts`, `switch.ts`, `fuse.ts`, `meter.ts`, `supply.ts` — bench components with
  terminals `a` / `b` (or `plus` / `minus`) 1.16 (2.24) apart, so sets can swap them without re-routing leads.
- `parts/circuit-grid.ts` + `circuit-parts.ts` — the constructor's board: views are created / disposed as the
  circuit is edited and display a `BuilderSolution`.
- `parts/schematic.ts`, `sankey.ts` — custom `UiNode`s painted on the HUD `board` (IEC diagram, energy ribbon).

## How a step is put together

```ts
export const myStep: StepFactory = (bench) => {
  const set = group('set:my-step');            // everything under bench.top (table surface = y 0)
  bench.top.add(set);
  const bulb = createBulb();                    // parts/: geometry + handles
  const lead = createLead(route(anchorIn(set, a), anchorIn(set, b), [[x, z]]));
  ctx.qa.expose('my-step', () => ({ ...model() }));   // what the interaction test asserts on
  return {
    id: 'my-step',
    shots: { 'my-step': { position, target, fit: { center, radius } } },
    stage: { show: [bulb.group, lead.mesh], enter: () => { /* re-derive non-tween state */ } },
    ui: { reset: true, honesty: [...], board: {...}, controls: [...], callouts: [...], hotspots: [{ anchor, content: '<id>' }] },
    update(dt, t) {                             // one model sample drives readouts, board and 3D alike
      const m = model();
      lead.drive(k * m.currentA, p * m.powerW);
      bulb.brightness = m.brightness;
      bulb.update(t);
    },
  };
};
```

Rules that keep it random-access safe: a step's picture is a function of the control values and a few numbers
re-derived in `enter`; sub-states inside a step use `ctx.stage.toggle` (battery ↔ lab supply ↔ water loop);
simulations with history (`createShortCircuit`, the kettle boil, the Oersted needle) are reset in `enter`;
steps with a board use a squarer `frameAspect` (≈ 1.05–1.2) because the board takes the left of the screen.

## QA

```bash
export QA_ID=B-current QA_PORT=5242
node tools/qa/chapter-check.mjs current --sizes all
node app/src/volumes/electricity/chapters/current/qa/interaction.mjs --size 1280x720     # also 1920x1080, 3840x2160
node app/src/volumes/electricity/chapters/current/qa/interaction.mjs --port 5342          # against `pnpm preview`
pnpm vitest run src/volumes/electricity/chapters/current                                  # in app/
```

Look-dev: `node tools/qa/shot.mjs current/measure --eval "__ui.set('place9','battery',true); await app.step(1/60,60); return app.read('measure')"`.
`__app.read(<step id>)` returns the step's observable state (`builder` for the constructor); probes:
`lens1`, `switch2`, `switch5`, `jumper5`, `drop5:<place>`, `appliance6:<id>`, `node7:<c>,<r>`, `probe9:red|black`,
`term9:<terminal>`, `switch9`, `compass10`.
