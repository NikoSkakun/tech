# API changes after the pilots (M3)

Shared file: each M3 agent appends under its own heading. Everything listed is backward compatible — the pilot
chapters build and pass unchanged; "pilots should switch" lists what in them is now a superseded workaround.

## M3-ui — HUD, step UI, widget kit, content pipeline

Full reference: `docs/UI_API.md` (§2, §3.1 height budget, §3.2 board, §4–§8, §13). Live examples:
`app/src/chapters/_sandbox-ui/parts/step-overflow.ts`, `step-board.ts`.

### Layout and testability
- **Step column fits the screen** (bug fix, no API): the dock's buttons sit in a sticky action row; text yields
  first (≥ 4 lines, scrolls), then the title gets compact, then the dock scrolls inside. Budget ≈ 908 px-eq at
  1280×720. Root cause of the pilots' overflow: the old fit set `maxH` without invalidating the layout.
- **`ctl-<id>` on every control**, segmented items `ctl-<id>:<item id>`:
  `await click('ctl-chem:nmc')` · `__ui.locate('ctl-run6')` · works in production builds.
- **`__ui.offscreen()`** — interactive nodes whose visible part leaves the viewport (empty = all reachable):
  `expect(await page.evaluate(() => window.__ui.offscreen())).toEqual([])` · also `__ui.press(id)`, `__ui.set(id, v, true)`.

### `stepUi` additions (`stepUi(ctx)` now returns `StepUiApi`; `StepUi` keeps its four members)
- `ui.set(id, v, { notify: true })` — like a user gesture: `ui.set('chem', 'nmc', { notify: true })`.
- `ui.press(id)` — runs `onClick`, flashes the button: `ui.press('run')`.
- `ui.patch(id, { min, max, value, label, disabled })` — live slider range:
  `ui.onChange('chem', () => ui.patch('U', { max: limit(), label: 'Напруга заряду' }))`.
- `ui.toast(text, { icon, tone, duration })` — event messages: `ui.toast('Не поглинуто — енергія не та', { tone: 'warning' })`.
- `visible` / `disabled` (`boolean | () => boolean`) on every control:
  `{ type: 'segmented', id: 'orient', items, visible: () => ui.value('orbital') !== 's' }`.
- **`board`** — HUD-placed panel for big charts / tables / stats, insets reported to the camera:
  `board: { title: 'Хімії', size: 'md', children: [{ type: 'chart', … }, { type: 'table', id: 't', head, rows }] }`.
- New control types: `table` (`head`, `rows` or `() => rows`, `highlight()`), `stats` (big numbers grid),
  `note` (status line): `{ type: 'note', id: 'storm', text: 'Захист від шторму', icon: 'warning', visible: () => v > 25 }`.
- `readout` with `text: () => string`: `{ type: 'readout', id: 'mode', label: 'Режим', text: () => mode }`.
- Honesty chips: custom text and conditions —
  `honesty: [{ slowed: 1e9, text: 'сповільнено ≈ у мільярд разів' }, { enlarged: 1000, visible: () => !ui.value('true') }]`;
  `{ kind: 'simplified', text: 'спрощена модель сліду' }`, `{ text: 'збільшено ×2' }`; factors ≥ 10⁶ print as 10ⁿ.
- Callouts: `text: () => string`, `visible`: `{ anchor: nucleus, text: 'Ядро', visible: () => !trueScale }`.
- Hotspots bind by id / index: `{ anchor: gearbox, content: 'gearbox' }` (`id` = slug of the international name);
  `title` is optional; `visible` as above.

### Widgets (`@/ui3d`)
- `Table`, `StatGrid`: `new Table({ head: ['Хімія', 'U'], rows })` · `table.setRows(next)` · `table.highlight = 2`.
- `Readout` text values: `new Readout({ label: 'Режим', text: 'заряд' })` · `readout.setText('на межі')`.
- `Chip.color` / `Chip.setIcon()` live: `chip.color = STATUS.alarm; chip.setIcon('warning')`.
- `Slider.setRange(min, max)`, `Slider.label`; `Tabs.disabled`; `Control.flash()`.
- `Tabs`: labels share the well by length, then smaller type, then wrap to rows (no broken words, no overlaps).
- Charts: `series: [{ id: 'ocv', color: 'mist', dash: true, opacity: 0.5 }]` · `NaN` in data = a gap ·
  year axes print «2010» (auto; `years: true|false`).
- `RadarChart`: `legend: false`, `radar.setSeries(list)`, `radar.setValues(id, values, { duration: 0.6 })` (morph).
- `honesty.slowed(n, text?)` … and `honesty.note(text)`.
- `worldConsole(ctx, { title, unit, children })` — billboard console that keeps text ≥ 16 px at 720p (grows ×3,
  then warns → `chapter-check` fails): `const c = worldConsole(ctx, { title: 'Пульт', unit: 0.01, children: [chart] })`.
- Chart / radar / phasor meshes are clipped inside scroll views; the wheel over a scrollable dock scrolls it
  (a slider takes the wheel only when focused there).

### Content (`@/content`, `tools/content/export_runtime.py`)
- `generated/<id>.manifest.json` + `manifestText(meta)`:
  `import meta from '@/content/generated/plant-wind.manifest.json'` →
  `defineChapter({ id, order, group, parent, ...manifestText(meta), scaleExp, theme, load })`.
- `steps[].labels` — UI labels quoted «…» in «Інтерактив»: `label: raw.steps[1].labels[1] // «×2 швидкості»`.
- `facts.items[].table: { head, rows, note? }` — rendered as a table in «Цифри і факти»; read it instead of parsing pipes.
- `crossReferences` → «Див. також» chips in the step their `where` names (dimmed + tooltip when not built).
- DECISIONS §54: terms / glossary rows get `name` (Ukrainian display name, «… (BMS)» for kept abbreviations) and
  `intl`; hotspots get `title` (display), `intl`, `id`. `termName(t)` returns the display name; the glossary is
  sorted and indexed by the Ukrainian alphabet, `intl` is a secondary line, search matches both.
  Labels builders write themselves (callouts, console titles, control labels) follow §54 too.

### Pilots should switch (superseded workarounds)
- **all three**: hand-mirrored manifest titles / blurbs and their guard tests → `manifestText(meta)`; retyped
  control labels (`atom/labels.ts` parts, `plant-wind/content.ts` `L`, `lab-battery/labels.ts` DOC) → `steps[].labels`;
  hotspot `title` strings matched against content names (`plant-wind` `hotspotNames`, `atom` `hotspotName`,
  `lab-battery` step titles + `labels.test.ts`) → `content: '<id>'`; English-first callout / hotspot / chip texts
  → plain Ukrainian (§54); QA clicks relative to neighbours / class-name walks → `ctl-<id>:<item>` and `__ui.offscreen()`.
- **atom**: `anchorWhen()` (anchor behind the camera) → `visible`; static «збільшено ×1000» → `{ enlarged, visible }`;
  «сповільнено ≈ у мільярд разів» → `{ slowed: 1e9, text }`; `hud()?.toast()` → `ui.toast()`;
  `qa/helpers.mjs locateWidget()` → `__ui.locate('ctl-…')`; «Електромагн.» shortening → full label (segmented fits);
  controls cut from `nucleus` / `models` for lack of room may come back (dock scrolls, buttons stay).
- **lab-battery**: `holo.ts` (hudSurface board) → `board`; `lab-ui.ts` `drive` / `press` / `external` / `action` →
  `ui.set(…, { notify })`, `ui.press`, board controls; `hud-bits.ts` `factTable` / `statGrid` / `notices` → `table`,
  `stats`, `note` (+ `visible`); `chem-data.ts` table parsing → `facts.items[].table`; voltage limit re-`define` →
  `ui.patch`; last-step link chips → automatic «Див. також»; `world.ts` `nowhere` anchors → `visible`; radar with
  7 pre-declared series scaled to 0 → `setSeries` / `setValues(…, { duration })`; dashed OCV / NaN / year `format`
  workarounds → `dash`, NaN gaps, auto years.
- **plant-wind**: dock = inputs only + `parts/console.ts` world consoles → `board` (or `worldConsole`); off-screen
  anchors → `visible`; `parts/badge.ts` Text3D status badges → `note` controls / callout `text: () => …`; chart
  marker labels as status → `note`; ≤ 2 honesty chips → as many as needed, with `{ kind: 'simplified', text }`;
  `blurb: ''` → manifest blurbs; step 11 portals stay (they are scene objects), but cross-references now also show
  as chips.

## M3-core

### Lint
- **Intra-chapter imports are allowed** (`local/chapter-boundary` replaces the `'../*/**'` pattern):
  ```ts
  // steps/blade.ts
  import { createBlade } from '../parts/blade';     // OK now (was a lint error)
  import { x } from '../../other-chapter/parts/x';  // still an error: leaves the chapter
  ```

### Stage (`ctx.stage`)
- **`stage.scope`** — tween / timer scope of the current step, for control handlers:
  ```ts
  onPress: () => {
    ctx.stage.scope.delay(1.2, () => spark());      // killed if the user changes step first
  },
  ```
- **Sub-states inside a step** — reverted automatically by the next step entry:
  ```ts
  ctx.stage.toggle(cutaway, on);                     // animated like a step change; omitted `on` = toggle
  ctx.stage.setParam('flow', 2.5, { duration: 0.6 }); // tween a registered param from a control
  ctx.stage.setColor('tint', 'coral');
  ```
- **Pose + pop actor on the same object** no longer fight over `scale` (the pose scales the actor's base):
  ```ts
  stage.actor(rotor);  stage.pose('rotor', rotor);
  stage.define({ big: { show: [rotor], poses: { rotor: { scale: 2 } } } });   // shows at 2×, pops in
  ```
- **Per-step environment** that deep links reproduce:
  ```ts
  ctx.env.base({ harmony: 0.2, fogDensity: 0.004 });          // factory: chapter look, survives every step
  stage.define({ offshore: { env: 'day', envTune: { harmony: 0.35 }, camera: 'sea' } });
  ```

### Camera
- **`Shot.fit`** — subject bounds for the mobile reframing of F5 (DECISIONS §57 d); a no-op hint today:
  ```ts
  ctx.camera.shots({ nacelle: { position: [40, 95, 60], target: [0, 90, 0], fit: { center: [0, 90, 0], radius: 12 } } });
  ```

### Text
- **`Text3D` text may outgrow its buffer at any time** (it used to vanish); **colour setter**:
  ```ts
  const badge = new Text3D('', { size: 18, screenSpace: true, billboard: true });
  badge.text = 'Захист від шторму: 25 m/s';   // fine after the first render
  badge.color = 'amber';                        // or badge.setColor('amber')
  ```

### Materials
- **`K.toon({ keepHue: true })`** — bright emissive keeps its hue (kit `window` material uses it now):
  ```ts
  const led = K.toon({ color: 'grey', emissive: 'cyan', emissiveIntensity: 1.6, keepHue: true });
  ```
- **`K.water({ followLook: true })`** — pattern follows `env.setScale(r, { adaptFrom })`; kit helpers pass it:
  ```ts
  ctx.env.setScale(60, { adaptFrom: LOOK_SCALE.diorama });
  const lake = waterDisc(40, 0, { followLook: true });        // island({ waterFollowLook: true }) likewise
  ```
  Convention: `K.water` meshes are built in their local XY plane and laid flat (`rotation.x = −π/2`).

### QA hooks and tools
- **Probes** (production builds included), replacing per-chapter `window.__…` globals:
  ```ts
  ctx.qa.probe('rotor', rotorMesh);               // test: await page.evaluate(() => __app.locate('rotor'))
  ctx.qa.expose('soc', () => ({ soc: bms.soc })); // test: await page.evaluate(() => __app.read('soc'))
  ```
  `__app.locate(name)` → `{ x, y, visible, shown, world }` (CSS px) or null; `__app.probes()` lists names.
- **`shot.mjs --eval` prints the value**: `node tools/qa/shot.mjs lab-battery/bms --eval "app.read('soc')"` →
  `eval → {"soc":55}`. Statement bodies print what they `return`.
- **`chapter-check`**: per deep-linked step at 1280×720 and 1920×1080 fails on controls outside the viewport
  (`__ui.offscreen()` — the HUD hook from M3-ui; skipped with a note while absent) and on world `Text3D`
  smaller than 16 px-eq at 1280×720 (`__app.textSizes()`). Frame time = min of 3 interleaved rounds per step,
  spread reported (`--perf-rounds`, `--perf-frames`, `--min-text`, `--skip layout`).

- **4K and DPR 2** (orchestrator addition): `chapter-check --sizes all` = 1920×1080 + 1280×720 + 3840×2160
  (screenshots, sheets, layout / text checks at each; 4K perf: warn > 14 ms, fail > 16.6 ms) + a 1920×1080
  DPR 2 pass comparing HUD rectangles, probes and hit targets with DPR 1. `--also-size` still works.
  ```bash
  node tools/qa/chapter-check.mjs plant-wind --sizes all
  node tools/qa/chapter-check.mjs plant-wind --size 1920x1080 --also-size 3840x2160 --skip dpr2
  ```
  `__app.textSizes()` also reports `magnification` (SDF zoom); > 4× is a warning (soft corners).

### Kit
- **Anchors / paths inside `b.part()` are prefixed** `<part>.<name>`; the bare name stays as an alias:
  ```ts
  const t = windTurbine();
  t.anchorWorld('blade0.tip');   t.anchorWorld('blade2.tip');   // were all 'tip' (last one won)
  ```
- **`windFleet(placements, turbineOptions)`** — instanced farm whose rotors spin (per-instance yaw / phase / speed):
  ```ts
  const fleet = windFleet(sites.map((p) => ({ at: [p.x, 0, p.z], yaw: windDir, speed: 1.2 })), { rotorDiameter: 120 });
  ctx.root.add(fleet.group);   // in update(): fleet.update(dt); fleet.turbines[i].yaw = …; fleet.hubOf(i)
  ```
- **`windTurbine({ interior })`** — `false` (empty nacelle) or a chapter `Object3D` mounted in the nacelle frame;
  drive-train anchors always exist. `addTurbineHub(rotorBuilder, k, accent)` and `addDriveTrainAnchors` exported.
- **`substation({ …, detail: 'light' })`** — breaker → disconnector → gantry / breaker → transformer, low-detail
  insulators, no fence: ≈ 1/3 of the triangles (110 kV, 2 bays: 59k vs 186k). `gantryPort(model, prefix, kV)`
  turns any `addGantry` into a `powerLine` support; `withLowDetail(() => …)` for own assemblies.
- **Offshore models** `addJacket`, `addFloater`, `addScour`, `addTopside('ac' | 'hvdc')`, `addJackUp`
  (`kit/energy/offshore.ts`, copied from `plant-wind/parts/offshore-models.ts` — the chapter keeps its copy; two
  copies exist until plant-wind switches):
  ```ts
  const b = new Builder('export-platform');
  b.frame({ at: [0, 0, 0] }, () => { addJacket(b, 30); addTopside(b, 'hvdc'); });
  ```
- **Close-up cells and a level tube** (copied from `lab-battery`'s `hero-cell.ts` / `lfpBrick()`):
  ```ts
  const hero = cylinderCellDetailed({ format: '21700', scale: 34 });   // parts gasket/cid/ptc/vent/cap, window cutaway
  const brick = prismaticCellDetailed({ scale: 6, cut: true });        // studs, nuts, vent, stepped electrode stack
  const soc = levelTube({ height: 1.2, color: 'lime' });  soc.level = 0.62;
  ```

### FX
- **`createProbabilityCloud`** (from `atom`'s `parts/cloud.ts`): `cloud.fill(n, sample)` / `cloud.sync(pos, ages)`.
- **`RibbonLines({ blend: 'normal' })`** — alpha-blended lines that stay visible on a bright sky.
- **`flow.setPaths(paths)` / `flow.setPath(row, path)`** — reshape a flow at run time (same path count).
- **`createOrbs({ instanceColors: true })`** + `orbs.setInstanceColor(i, colour, brightness)` + `commit()`.
- **`createSparks(ctx, { color: 'cyan' })`** — a single colour is accepted.
- FX_API §0 now gives metre-scale sizes (`createWire` `detail`, `radius`, `repeat`, flows, sparks).

### Simulation helpers (`@/sim/lab-battery`, additive)
```ts
const run = discharge(CELLS['LFP-100'], 0.5);  run.curve[k].wh; run.curve[k].heatJ;    // running totals per sample
bms.setCellSoc(5, 20);                                                                // one weak cell
const mod = createLiveModule('NMC', { barrier: false });  mod.step(dt * 30);  mod.tempsC;
runOvercharge('NMC', true).cutoffS;            // 240 model s (illustrative)
nailScenarioC('LFP', 100, t).vent;             // valve open (stays open)
```

### Pilots should switch
- `atom`: flat `step-*.ts` layout and the "actor or pose, not both" holder groups are no longer needed;
  `qaProbe` / `window.__atomQa` → `ctx.qa.probe` / `ctx.qa.expose`; interaction tweens may use `ctx.stage.scope`.
- `lab-battery`: `parts/index.ts` / `sim/index.ts` / `steps` barrels are optional now; the per-step
  `ctx.env.tune(...)` in `enterStep` (`scene.ts`) → `StepSpec.envTune`; `window.__lab.probe` →
  `ctx.qa.expose('probe', …)` + `__app.read('probe')`.
- `atom` (fx): `parts/cloud.ts` → `createProbabilityCloud`; two `Orbs` sets for "one brighter electron" / mixed
  swarms → `instanceColors`; `createSparks` triples → a single colour where that was the intent.
- `lab-battery` (sim): `sim/runs.ts` re-integration of Wh / heat → `CellSample.wh` / `.heatJ`; copied SOC + `set()`
  in `bms-session.ts` → `setCellSoc`; the coupling loop in `sim/thermal-session.ts` → `createLiveModule`; the
  240 s constant → `runOvercharge(chem, true).cutoffS`; own vent at ≥ 90 °C → `nailScenarioC(...).vent`.
- `lab-battery` (kit): `parts/hero-cell.ts` → `cylinderCellDetailed`; `lfpBrick()` → `prismaticCellDetailed`; the
  three hand-built level tubes → `levelTube`.
- `plant-wind` (kit / fx): `parts/fleet.ts` → `windFleet`; own `blade0` tip markers → `anchor('bladeN.tip')`; hiding
  nacelle meshes → `windTurbine({ interior: machineRoom })`; hand-built substation + copied `LineSupport` port →
  `substation({ detail: 'light' })` / `gantryPort`; `parts/offshore-models.ts` → the kit copy; chapter shaders for
  wind streaks / streamlines / wakes → `RibbonLines({ blend: 'normal' })`; CPU-advected `Orbs` → `flow.setPaths`.
- **Found by the new checks (fix, not just switch):** `atom`'s interaction test locates tabs by class name and
  gets 34/38 on a production build → `__ui.locate('ctl-<id>:<item>')`; `lab-battery` step `scale-and-future`
  label «500 Wh» is 13.6 px-eq at 1280×720 (< 16) → `chapter-check lab-battery` fails on that item.
- `plant-wind`: barrels (`parts/index.ts`, `sim-bindings/index.ts`) optional; `parts/switch.ts` + reset in
  `leave` → `ctx.stage.toggle` / `setParam`; own button tween scopes → `ctx.stage.scope`; `createBadge(…, reserve)`
  placeholder → plain `Text3D` (buffer grows); `qa/B-plant-wind/eval.mjs` → `shot.mjs --eval`; `window.__wind` →
  `ctx.qa.expose`.

## M4 — the project is a library of volumes (2026-11-13, agent M4-volumes; DECISIONS §58)

Electricity is volume 1 (`electricity`). Nothing changed in how it looks, reads or behaves; paths, ids and a few
names did. Full account: `docs/VOLUMES.md`, `docs/ENGINE_API.md` §22, `docs/UI_API.md` §11.

### What moved

| Before | Now |
|---|---|
| `app/src/chapters/<id>/` | `app/src/volumes/electricity/chapters/<id>/` |
| `app/src/chapters/_sandbox-*/` | `app/src/volumes/_dev/chapters/_sandbox-*/` (dev-only pseudo-volume) |
| `app/src/sim/**` (`@/sim/…`) | `app/src/volumes/electricity/sim/**` (`@electricity/sim/…`) |
| `app/src/content/generated/` (`@/content/generated/…`) | `app/src/volumes/electricity/content/generated/` (`@electricity/content/generated/…`) |
| `app/src/hud/fixtures/` | `app/src/volumes/electricity/fixtures/` (given to the HUD by `volume.ts`) |
| `docs/CURRICULUM.md`, `docs/GLOSSARY.md` | `docs/volumes/electricity/CURRICULUM.md`, `…/GLOSSARY.md` |
| `docs/chapters/<id>.md`, `_shared-house.md`, `_notes-*.md` | `docs/volumes/electricity/chapters/…` |
| `docs/chapters/INDEX.md` | `docs/volumes/electricity/INDEX.md` |
| `docs/chapters/_export/<id>.json` | `docs/volumes/electricity/chapters/_export/<id>.json` |
| `docs/chapters/_export/schema.json`, `README.md` | `tools/content/export.schema.json`, `docs/CONTENT_EXPORT.md` |

New: `app/src/volumes/library.json`, `app/src/volumes/<volume>/{volume.json, volume.ts, chapters.ts}`,
`app/src/engine/{volume.ts, library.ts}`, `app/src/hud/library.ts`, `app/src/volumes/_demo/` +
`docs/volumes/_demo/` (dev-only demo volume), `tools/qa/library-check.mjs`, `docs/VOLUMES.md`.

### Renamed / changed API (breaking for code written against M3)

- `ChapterManifest.scaleLabel` → **`axisLabel`**, `scaleExp` → **`axisValue`** (also in
  `<id>.manifest.json` and `manifestText()`); `ChapterManifest.volume` is new and filled in by discovery.
  `ChapterGroup` is a `string` checked against the volume's groups at registration.
- `Position` and router `Route` have **`volumeId`**; store: `volumeId`, `lastIn`, `markVisited(position)`,
  `settle(position)`; `progress.visited` keys are `volume/chapter`; storage key `electricity:v2` (v1 migrated).
- `engine.registry` → **`engine.library`** (`library.registry(volumeId)` is the per-volume `Registry`;
  `new Registry(volume, manifests, opts)`). `discoverChapters()` → `discoverVolumes({ includeDev })`.
- Runtime events carry `volumeId`; `transition.from/to` and `transitionStart/End.from/to` are full chapter ids.
- `Nav`: `goto(chapter, step)` accepts `chapter` or `volume/chapter`; new `open(address)`, `locate(address)`,
  `gotoVolume(id)`, `volume`, `volumes`, `library`; `chapters` is the current volume's list.
- `@/content`: `loadContent(key)` / `contentIds(volume?)` use the key `volume/chapter`; `linkTarget()` returns
  `{ volumeId, chapterId, stepId }` and accepts three-part addresses; new `contentKey()`, `recordKey()`;
  `GlossaryRecord.volumeId`, `alsoIn` holds content keys; `filterGlossary({ volume })`; `ChapterMeta.volume`,
  `ChapterMeta.axisLabel`; `ChapterContent.volume`.
- Generated content and export: `volume` field; **`crossReferences[].targets` are full addresses**
  (`electricity/current/drift`); export `schemaVersion` 2 (`axisLabel` / `axisRaw` instead of `scaleLabel` /
  `scaleRaw`; `group` is any group of the volume).
- HUD: `GROUP_LABEL` is gone → `groupLabel(volume, group)` from `@/engine/api`; `Journey.volume`,
  `JourneyChapter.volume / axisLabel / axisValue`; `loadJourney(engine, volume)`; `HudContext.volume`,
  `libraryLevel`; `HudModule.onVolume`; overlay name `library`; chip names `xref-<volume/chapter/step>`;
  `__ui.open(name)` / `close()`; `__ui.names()` / `locate()` ignore nodes under a hidden ancestor.
- Debug API: `__app.position()` has `volumeId`; `listChapters()` entries have `volume` and `fullId`;
  `listVolumes()`; `goto('volume/chapter/step')`.
- Lint: `local/chapter-boundary` now allows the own volume's `sim/**` and `content/**`;
  new `local/volume-boundary`.
- Tools: every `tools/content/*.py` takes `--volume <id>` (default: `library.json → defaultVolume`) or `--all`;
  `doccheck.py` checks all volumes by default; `regen.sh` regenerates all (`--volume <id>` for one);
  journey order / groups / parents / extra documents / extra checks live in `volume.json`.
  `chapter-check` takes `<chapter>` or `<volume>/<chapter>`.

### Chapter builders: what to do differently

1. Your directory is `app/src/volumes/electricity/chapters/<id>/`; documents are under
   `docs/volumes/electricity/`.
2. Import simulations and generated content through the volume alias: `@electricity/sim/<id>`,
   `@electricity/content/generated/<id>.json`, `@electricity/content/generated/<id>.manifest.json`.
3. In `index.ts` write `axisLabel` / `axisValue` (or `...manifestText(meta)` + `axisValue`). Do not write `volume`.
4. Navigation inside the volume is unchanged: `ctx.nav.goto('grid', 'grid-intro')`,
   `ctx.nav.chapter('plants')`. When you take a target from `content.crossReferences`, it is a full address:
   use `ctx.nav.locate(target)` / `ctx.nav.open(target)` (or `linkTarget(target)`), not `target.split('/')`.
5. Old QA commands keep working (`chapter-check atom`, `shot.mjs atom/quarks`, `__app.goto('atom', 'quarks')`);
   positions now print as `electricity/atom/quarks`.

### Pilots: what was changed by the move (nothing else)

`atom`, `lab-battery`, `plant-wind`: directory, `@/sim` → `@electricity/sim`, `@/content/generated` →
`@electricity/content/generated`, `scaleLabel` / `scaleExp` → `axisLabel` / `axisValue` in `index.ts`, test paths
to the export. `atom/step-standard-model.ts`: the bridge to `charge-field` reads the full address
(`linkTarget` + `ctx.nav.locate` / `open` instead of `split('/')`).

## L1-simple-format — reading level «Просто / Докладно» (2026-11-14; docs/briefs/L-simple-level.md)

All additive; chapters need no change (a chapter shows its simple layer once its document has one).
- **Content** (`@/content`): `StepContent.simple?: SimpleStep`, `ChapterContent.simpleQuiz?`, types `SimpleStep`, `SimpleHotspot`,
  `SimpleWord`; selector `stepAtLevel`, `quizAtLevel`, `hasSimpleLayer`, `READING_LEVELS`, `LEVEL_LABELS`,
  `LeveledStep`, `LevelLabels` (`app/src/content/level.ts`, pure — the 2D interface reuses it).
- **Engine**: `Settings.readingLevel` (`'simple' | 'detailed'`, persisted), `ReadingLevel`, `DEFAULT_READING_LEVEL`
  (`'detailed'` during the pilot), `isReadingLevel` in `engine/store.ts` / `@/engine/api`; `UrlFlags.level`
  (`?level=simple|detailed`, session override); `Engine.readingLevel()` (level in effect), `Engine.setReadingLevel()`.
- **HUD**: `app/src/hud/level.ts` (`readingLevel`, `stepCopy`, `quizCopy`, `onReadingLevel`) — the only place the
  WebGL HUD asks for the level; `buildSections` takes a `LeveledStep` (chips «Слова» / «Цікаво», no glossary button
  on a simple word card); Settings «Рівень тексту»; `__ui.value('reading-level')`; node names `chapter-quiz`,
  Tabs segments `reading-level:simple|detailed`.
- **Pipeline**: `tools/content/simple_layer.py` (parser), `simple_check.py` (doccheck group `simple`),
  `test_simple_layer.py`; `export_content.parse_quiz(text, section, marks)`; export keys `steps[].simple`,
  `simpleQuiz`, misconception `scene` (only when present); `terms_check` and `font-coverage` read the simple layer.
- **Fixture**: `_demo/wave` has a full simple layer, a `bead` hotspot and a `[Сцена: …]` misconception.

## D0b-no-3d-ui — no 3D effects on the 2D interface (2026-11-14; DECISIONS §59 p)

- `@/hud`: `installParallax` (`hud/keys.ts`) is removed — the HUD plane no longer leans toward the pointer.
- `@/ui3d`: `RevealOptions.tilt` is removed (`reveal()` slides, scales and fades; no swing around the vertical
  axis). Callers passing `tilt` get a type error — drop the option.
- HUD layout: the step column (`dock.ts`) and the board (`board.ts`) are flat on wide screens (their static
  `rotY` of ∓0.03 rad is gone). `__ui.locate` rectangles of HUD nodes no longer change with the pointer.
- Rule for everyone (STYLE_GUIDE §5): interface elements never follow the pointer and get no perspective, tilt or
  fake depth; `UiNode.rotX/rotY` remain in the API, but HUD code must not use them for a 3D look.
