# UI API — chapter author's guide to the interface

Owner: `F2-ui` (M3 revision: `M3-ui`, see `docs/API_CHANGES.md`). Describes `@/ui3d` (widget kit), `@/hud` (the interface shell and the step UI API) and `@/content`
(content model) **as they are**. All UI is WebGL: SDF text and SDF shapes, batched — there is no DOM UI.

Reference implementations that are compiled with the app and exercised by the QA scripts:

| What | Where |
|---|---|
| Standard step UI of a chapter (controls, readouts, chart, callouts, hotspot) | `app/src/ui3d/examples/step-ui-example.ts` |
| A console in the world next to a machine | `app/src/ui3d/examples/console-example.ts` |
| Kitchen sink: every widget, HUD and world placement, realistic content | `app/src/volumes/_dev/chapters/_sandbox-ui/` |

Contents: 1 what you get for free · 2 content.ts · 3 step UI (`stepUi`) · 4 controls & readouts · 5 callouts &
hotspots · 6 honesty chips · 7 charts · 8 world consoles and custom HUD · 9 journey-map emblem · 10 widget
reference · 11 layout & painting your own widget · 12 formatting numbers · 13 QA · 14 do / don't.

## 1. What a chapter gets without writing UI code

The HUD plugin is always there. For every chapter it shows: the chapter header (part of the volume, title, the
chapter's place on the volume's journey axis — for electricity the scale chip —, progress ring), the **step panel** (title, paged text, terms, formulas, facts, misconceptions, quiz entry), the step
navigator, the spine of the volume's chapters, the system buttons (map, glossary, sound, fullscreen, settings,
help), tooltips for
everything registered with `ctx.input.register(obj, { tooltip })`, the loading pill and the transition choreography.
It reports the area its panels cover to the camera director, so your shots stay framed in the free area.
Keys: the HUD takes keys first through `engine.input.captureKeys` at priority 100 (open overlay, focused control);
a chapter's own `ctx.input.captureKeys` (default priority 0) sees only what the HUD leaves. While the Journey Map or
the home screen fully cover the scene, the HUD calls `runtime.suspendWorld(true)`: the chapter keeps updating but
is not rendered (it renders again as soon as the view starts to close, and always during a chapter transition).

A chapter only has to provide **content** (§2) and, per step, **declare** its controls and annotations (§3).
Do not build panels for step text, do not place generic panels by hand, do not draw your own tooltips.

## 2. `content.ts` — text of the chapter

```ts
import { defineContent } from '@/content';
import raw from '@<volume>/content/generated/atom.json';   // runtime subset of docs/volumes/<volume>/chapters/_export/atom.json (typed)

export default defineContent(raw, { labels: { drag: 'Перетягни електрон' } });
```

**Runtime content files (M1).** `app/src/volumes/<volume>/content/generated/<id>.json` exist for all 25 chapters. They are produced by
`python3 tools/content/export_runtime.py` from the export and contain only on-screen copy, already in the shape of
`ContentSource`: chapter `title`, `group`, `learningGoals`; per step `id`, `title`, `panel`, `terms`,
`formulas.items`, `facts.items`, `hotspots`, `misconceptions`; `glossary`, `quiz`, `crossReferences`. Builder guidance
(`see`, `interaction`, `transition`, `links`, notes, hotspot `note`/`tail`, `formulas.raw`, term `raw`) is not in them.
Never edit them and never copy their text into code: fix the chapter document, run `export_content.py`, then
`export_runtime.py`; `doccheck.py` fails (check `runtime`) while they are stale. The JSON import is typed by
TypeScript (`resolveJsonModule`), and `src/content/__tests__/generated.test.ts` imports every file as a
`ContentSource`, so a shape change of the export breaks `pnpm typecheck`, not a chapter at runtime. The step list of
the manifest must use the same step ids (titles can be taken from the file: `raw.steps.map(s => s.title)`).
Scene labels that are not in the document (callouts, button captions) go into `labels`; UI labels quoted «…» in the
document's `interaction` texts are copy — they are exported per step as `steps[].labels` (string list, document
order): take control captions from there (`raw.steps[i].labels`), do not retype or invent wording.

**Also generated (M3):**
- `generated/<id>.manifest.json` (1–3 kB): `title`, `subtitle` (= first step's title — the documents have none;
  override it), `axisLabel`, `group`, `parent`, `order`, `steps[{ id, title, blurb }]` (blurb = first sentence of
  the step's first page, ≤ 140 chars). In `index.ts`: `import meta from '@<volume>/content/generated/<id>.manifest.json'`
  and `...manifestText(meta)` (from `@/content`; `{ subtitle, blurbs }` overrides). Never import `<id>.json` there.
- Display names (DECISIONS §54): terms and glossary rows carry `name` (the Ukrainian form; «система керування
  батареєю (BMS)» when an international abbreviation is kept) and `intl` (the international form, a small secondary
  line); hotspots carry the display name as `title` (`name` stays the pair as written), plus `intl` and an `id`
  (slug of the international name). `termName(t)` returns the display name (it derives it for hand-written content).
- A fact written as a Markdown table also carries `table: { head, rows, note? }`; the HUD renders a real table.

`defineContent` accepts the machine-readable export of the chapter document as is (DECISIONS §43, §49: never retype
Ukrainian text) and keeps only on-screen copy: `steps[].panel / terms / formulas / facts / hotspots /
misconceptions`, `glossary`, `quiz`, `crossReferences`. Builder guidance (`see`, `interaction`, `transition`, notes)
is ignored. Types: `ChapterContent`, `StepContent`, `Term`, `Fact`, `Hotspot`, `QuizItem` in `@/content`.

- The HUD finds `chapters/<id>/content.ts` by itself (`import.meta.glob`) and loads it lazily — nothing to register.
- Step ids must equal the manifest's step ids. A step without content falls back to the manifest title and blurb.
- Text markup: `**term**`, `_emphasis_`, `` `formula` ``, `x^2`, `10^{-19}`, `U_{rms}`, `{cyan:text}`. Plain document
  notation is typeset automatically: `V_oc` → V with index oc, `A^(1/3)`, `10^-19`. A number and its unit never
  break apart. Short formulas (≤ 28 characters) never wrap.
- The glossary overlay aggregates `glossary` rows and step `terms` of all chapters **of the volume** (with more
  than one volume a switch widens it to the whole library, §11); the term's link goes to the
  first step whose `terms` contain it. It is sorted and letter-indexed by the Ukrainian name (ґ, є, і, ї in their
  places; Latin-only names under `#`), shows `intl` as a secondary line, and its search matches both forms.
  The chapter quiz opens from the last step's panel.
- `crossReferences` become «Див. також» link chips in the panel of the step their `where` names (`` `step-id` `` or
  «крок N»; otherwise the last step). Chips of chapters that are not built yet are dimmed with a tooltip, silent.

### 2.1 Reading level «Просто / Докладно» (L1, docs/briefs/L-simple-level.md)

- Content: a step may carry `simple { title?, panel[], words?, facts?, hotspots?[{id, text}], misconception? }`, the
  chapter `simpleQuiz[]` (generated from the «Просто» block and «## Простий квіз», `docs/CONTENT_EXPORT.md`).
  Chapters never read them: bind hotspots by `content: '<id>'` and the HUD shows the right text.
- Setting `settings.readingLevel: 'simple' | 'detailed'` (persisted; default `DEFAULT_READING_LEVEL` in
  `engine/store.ts`, `'detailed'` during the pilot — one constant to flip). URL flag `?level=simple|detailed`
  overrides it for the session; `engine.readingLevel()` is the level in effect, `engine.setReadingLevel(l)` sets
  it (and ends a `?level=` pin). Control: Settings → «Рівень тексту» (Tabs `reading-level:simple|detailed`).
- Selector (pure, shared with the 2D interface): `stepAtLevel(step, level)` → a `StepContent` with the simple parts
  swapped in and `level` = the level actually shown; `quizAtLevel(content, level)`; `hasSimpleLayer(content)`;
  `LEVEL_LABELS` (chips «Слова» / «Цікаво»). Fallbacks: a step or chapter without a simple layer → detailed copy;
  in a simple step a hotspot without a plain sentence keeps its detailed text; formulas are never shown; other
  missing simple parts are simply absent. The WebGL HUD calls it through `app/src/hud/level.ts` only.
- Switching re-renders the open step (panel, chips) and closes an open hotspot card or quiz.

## 3. Step UI — `stepUi(ctx)`

```ts
import { stepUi } from '@/hud';

const ui = stepUi(ctx);                    // once per scene
ui.define({
  'iv-curve': {
    hint: 'Покрутіть реостат і знайдіть максимум потужності',     // toast on entering the step
    honesty: ['simplified', { slowed: 50 }],                       // chips under the step title (§6)
    controls: [ /* §4 */ ],
    callouts: [ /* §5 */ ],
    hotspots: [ /* §5 */ ],
    board: { title: 'Крива I-V', children: [ /* §3.2 */ ] },          // big chart / table area (§3.2)
    reset: false,                           // true: controls return to their defaults on every entry
  },
});
const r = ui.value('R');                    // number | boolean | string, valid in every step
ui.set('R', 2.48);                          // programmatic change: the widget follows, onChange is not called
ui.set('chem', 'nmc', { notify: true });    // …or exactly like a user gesture (presets, scripted demos)
ui.press('run');                            // a button's onClick, with the press feedback when it is on screen
ui.patch('U', { max: 4.2, label: 'Напруга заряду, NMC' });   // live range / label / disabled, no re-define
ui.toast('Не поглинуто — енергія фотона не та', { tone: 'warning' });   // event message under the header
ui.onChange('closed', (v) => { /* … */ });
```

`stepUi(ctx)` returns `StepUiApi` (`StepUi` + `press`, `patch`, `toast`); `StepUi` keeps the original four members
for chapters that wrap it.

- Declarative and per step: the HUD builds the **control dock** under the step panel (bottom sheet with an
  «Опис / Керування» switch on narrow screens), animates it in and out and disposes it on step change.
- Values live as long as the chapter instance: `ui.value(id)` returns the declared default until the user touches
  the control, also in steps where the control is not shown. Read values in `update()`; drive `ctx.stage` params
  from them yourself.
- `define()` may be called again later (async scenes); unknown step ids throw.
- Layout is automatic: sliders first, toggles in a row, segmented controls, tables, notes and charts full width,
  readouts and radial gauges in a row; **buttons go to the sticky action row** at the bottom of the dock (never
  scrolled away). Keep the dock to inputs and small readouts; big charts and tables belong on the board (§3.2).
- Every control, also inside segmented/tables/readouts/gauges/charts, is named `ctl-<id>`; segmented items are
  `ctl-<id>:<item id>` — `__ui.locate()` finds them in dev and production builds.
- `visible: boolean | () => boolean` (and `disabled` for inputs) on every control: re-evaluated every frame, the
  control fades in / out and gives its room back. Same field on honesty chips, callouts, hotspots and the board.

### 3.1 Height budget of the step column (wide layout, ≥ 16:10)

The column runs from 58 px-eq under the top safe margin to the bottom safe margin: **≈ 908 px-eq at 1280×720**
(1 px-eq = 0,7 CSS px there), 990 at 1920×1080 / 3840×2160 (the HUD scales with the viewport: 2 CSS px per px-eq at
4K). The step panel and the dock share it in this order of yielding: (1) the step text scrolls, down to
`TEXT_MIN` = 130 px-eq (≈ 4 lines); (2) the title switches to the compact size; (3) the dock's controls scroll
inside the dock (wheel over the dock scrolls it unless a slider has the focus). The action row, the page bar and
the title never leave the screen. Narrow / portrait: the bottom sheet takes ≤ 42 % / 45 % of the height, the
«Опис / Керування» tab switches between text and dock. Design for the natural size anyway: ≤ 3 sliders, one
segmented control and a row of readouts fit 720p without scrolling under a two-line title.

### 3.2 Board — big charts, tables, stat grids

```ts
board: {
  title: 'Хімії акумуляторів', size: 'md',                         // sm 380 · md 520 · lg 680 px-eq
  children: [
    { type: 'chart', id: 'cmp', chart: { height: 220, x: …, y: …, series: […] }, init: (c) => … },
    { type: 'table', id: 'tbl', head: ['Хімія', 'U_nom', 'Wh/kg'], rows: () => rows(), highlight: () => sel() },
    { type: 'stats', id: 'res', items: [{ label: 'Енергія', get: () => run.wh, unit: 'Wh', digits: 1 }] },
    { type: 'button', id: 'run', label: 'Запустити', icon: 'play', primary: true, onClick: start },
  ],
},
```

Wide screens: top-left, right of the scale spine, under the header, with its own collapse button (`board-fold`);
narrow / portrait: full width under the header, above the bottom sheet. Its body scrolls when the screen is short.
Its area is reported to the camera director (left inset on wide screens, top otherwise), like the HUD's panels —
frame your shots for it. Board children are ordinary `ControlSpec`s (values, `ui.set`, `ui.press` work the same);
they keep the declared order, consecutive readouts / toggles share a row, buttons go last.

## 4. Controls and readouts (`ControlSpec`)

| `type` | Fields | Notes |
|---|---|---|
| `slider` | `label, min, max, value`, `step`, `unit`, `digits`, `scale: 'log'`, `stops`, `snaps`, `marks`, `format`, `onChange` | log scale needs `min > 0`; with `scale: 'log'`, `step` = significant digits. `stops` = only these values (a "wheel"). `snaps` are magnetic. Arrow keys / wheel adjust a focused slider. |
| `toggle` | `label`, `value`, `onChange` | |
| `segmented` | `items: {id,label}[]`, `value`, `label`, `onChange` | labels share the well in proportion to their length; if they still do not fit, the type shrinks, then the items wrap onto a second row (words are never broken). |
| `button` | `label`, `icon`, `primary`, `onClick` | one `primary` per step at most; in the dock's sticky action row. |
| `readout` | `label`, `unit`, `digits`, `format`, `get()` **or** `text()`, `color(value)` | polled every frame; keep it cheap. `text` shows a string («з втратами»). |
| `table` | `head?`, `rows` (array or function), `highlight()`, `align` | key–value lists, comparison tables, run results; a function is diffed every frame, the table repaints only on change. |
| `stats` | `items: {label, get(), unit, digits, color()}[]`, `columns` | big numbers in a grid (2 per row in the dock, 3 on the board). |
| `note` | `text` (or function), `icon`, `color` (or function) | a status line («Захист від шторму»); combine with `visible`. |
| `gauge` | `kind: 'radial' \| 'linear'`, `label, min, max`, `unit`, `digits`, `zones`, `get()` | zones: `green` OK, `amber` warning, `red` alarm (`STATUS`). |
| `chart` | `chart: ChartProps`, `init(chart)`, `update(chart, t)` | `update` runs every frame: change data only when inputs changed. |
| `custom` | `node: UiNode`, `update(t)` | any widget tree; it is detached, not disposed, when the step is left. |

Every spec has an `id` (unique in the chapter), an optional `hint` (tooltip), `visible` and (inputs) `disabled`.
Labels you write yourself follow DECISIONS §54: plain Ukrainian, an international abbreviation in parentheses only
where it is needed («Рівень заряду (SOC)»), symbols and units international.

## 5. Callouts and hotspots

```ts
callouts: [
  { anchor: rotorMesh, text: 'Ротор', side: 'left' },
  { anchor: () => tip.getWorldPosition(v), text: 'Кінець лопаті', occluders: [tower] },
  { anchor: [0, 2.4, 0], text: () => `Гондола · ${fmtUnit(rpm, 'rpm')}`, color: 'amber' },   // live text
  { anchor: nucleus, text: 'Ядро', visible: () => !ui.value<boolean>('trueScale') },      // fades in place
],
hotspots: [
  { anchor: gearbox, content: 'gearbox' },        // bind to the step content by id (or index, or international name)
  { anchor: [1, 0, 0], title: 'Гальмо', text: '…', onOpen: () => ctx.camera.focusOn(brake) },
],
```

- Anchors: an `Object3D` (its origin), a fixed world point, or a function returning a `Vector3`.
- Callouts and hotspot markers are drawn in screen space with this frame's camera: constant size, never blurred
  by depth of field, on their own dark plate (legible over any backdrop), at least 16 real px tall at every
  window size. They avoid each other and the HUD panels, ease to their spot, and fade when the anchor leaves the
  free area or (with `occluders`) is hidden behind one of the listed objects.
- A hotspot is a pulsing `cyan` ring; clicking opens a card with the hotspot's text (`yellow` while open).
  `content` binds it to a content hotspot (`id` = slug of its international name, e.g. `wind-turbine`; or its index;
  or its `international` name); the card shows the content's display title (§54) and text. A `title` equal to the
  as-written `name` still binds (legacy).
- `visible` hides a callout / hotspot by state: it fades out at its real place (no "anchor behind the camera").
- Plain Ukrainian in every label you write (DECISIONS §54); abbreviations only where needed, in parentheses.

## 6. Honesty chips (DECISIONS §5 — mandatory)

Every slowed-down, scaled or simplified visual carries a chip. Declare it on the step:
`honesty: ['notToScale', 'simplified', 'illustrative', { slowed: 1000 }, { sped: 60 }, { enlarged: 1000 }]`
→ «не в масштабі», «спрощена модель», «ілюстративно», «сповільнено ×1000», «прискорено ×60», «збільшено ×1000»
(factors ≥ 10⁶ print as powers: «сповільнено ×10⁹»).
Document wording and conditions: `{ slowed: 1e9, text: 'сповільнено ≈ у мільярд разів' }`,
`{ kind: 'simplified', text: 'спрощена модель сліду' }`, `{ text: 'збільшено ×2' }` (any model note),
`{ enlarged: 1000, visible: () => !ui.value('trueScale') }`.
For world consoles and custom panels use the same chips from `@/ui3d`: `honesty.slowed(1000, text?)`,
`honesty.note(text)` etc.

## 7. Charts

```ts
const chart = new Chart({
  height: 210,
  x: { min: 0, max: 45, label: 'U, V' },
  y: { min: 0, max: 15, label: 'I, A' },
  y2: { min: 0, max: 500, label: 'P, W' },                       // second Y axis on the right
  series: [{ id: 'iv', label: 'I(U)', color: 'sky' }, { id: 'pv', label: 'P(U)', color: 'yellow', axis: 'y2', kind: 'area' }],
});
chart.setData('iv', us, is);                                       // static curve
chart.setMarker('op', { x: 33.1, y: 13.3, label: 'MPP' });         // operating point with guides to the axes
```

| Need | How |
|---|---|
| live scrolling plot | `window: seconds` + `chart.push(id, t, value)` every sample (30–120 Hz is fine) |
| filled curve / staircase / bars | `kind: 'area' \| 'step' \| 'bars'` |
| stacked areas, also below zero (sources vs sinks over 24 h) | series with the same `stack` id; negative values pile downward |
| logarithmic axis (harmonic spectrum, ρ(T)) | `x` or `y`: `{ log: true }` (min > 0); ticks become decades |
| two Y axes | `y2` + `axis: 'y2'` on the series |
| the user drags a cursor along X | `onScrub: (x) => …` |
| phasor diagram linked to an oscilloscope strip | `new PhasorScope({ phasors })`, `setAngle(ωt)` every frame |
| radar (e.g. battery chemistries on 5 axes) | `new RadarChart({ axes, series, legend? })`, values 0…1; `setSeries(list)`, `setValues(id, v, { duration })` morphs |
| dashed / lighter companion curve (OCV, «поза межами моделі») | series `dash: true` or `[on, off]`, `opacity: 0.5` |
| gaps in the data | put `NaN` in `ys` (or `xs`): the line breaks there, bars are skipped |
| calendar years on X | automatic when all ticks are integers 1000…2999 («2010», no grouping); `years: true / false` forces it |
| heat map with a draggable marker (tilt × azimuth yield) | `new HeatMap({ x, y, value, min, max, marker, onPick })` |

Axis titles are «symbol, unit» in international notation (`U, V` · `P, kW` · `t, s`). Series that encode a plant
type use `PLANT_TYPE` from `@/style` (tokens `plantType.<name>`; `@/ui3d` re-exports it and keeps the old keys
`pumped` / `geo` as deprecated aliases of `pumpedStorage` / `geothermal`), status colours `UI_STATUS` (`ui.ok|warning|
alarm|info`; `STATUS` in `@/ui3d` is the same map), power flow `FLOW` (`flow.active|reactive`), phases
`SEMANTIC.phaseL1…L3`. One draw call per chart for all curves.
A 3D Sankey ribbon is **not** in the kit (it is a scene object, see the report).

## 8. World consoles and chapter-owned HUD

```ts
const surface = worldSurface(ctx, { width: 360, height: 260, unit: 0.01 });   // px-eq size, world units per px-eq
surface.root.add(new Panel({ width: 360, children: [/* any widgets */] }));
surface.position.set(3, 1.2, 0);  surface.rotation.y = -0.4;
ctx.root.add(surface);                       // or add it to the machine it belongs to; disposed with the chapter
```

- Same widgets, real perspective. `mode: 'overlay'` (default) draws after depth of field — crisp, never occluded;
  `mode: 'scene'` makes it a depth-tested object of the scene (may be blurred and hidden).
- Use `stage.define({ step: { show: [surface] } })` to show it per step. Keep text ≥ 16 px on screen at your
  camera distance (a 20-unit label needs `unit × 20 × pixelsPerWorldUnit ≥ 16`).
- **Preset `worldConsole(ctx, { title, width, unit, children })`** (from `@/ui3d`): a titled panel on a world
  surface that turns toward the camera and *keeps its smallest text ≥ 16 CSS px at 1280×720*: it grows up to
  `maxGrow` (×3) when the camera is far, and logs one warning (which fails `chapter-check`) if even that is not
  enough. Returns `{ surface, panel, textPx, grow }`; show it per step with `stage.define({ step: { show: [c.surface] } })`.
  Prefer the board (§3.2) for anything that is read rather than looked at in the scene.
- Embedded meshes (chart curves, radar, phasors) are clipped by scroll views like the rest of the UI.
- `hudSurface(ctx)` gives a full-screen camera-anchored surface for chapter-specific overlays that the step UI
  cannot express (it hides automatically under the map / home screen). Prefer `stepUi` with a `custom` control.

## 9. Journey-map emblem (`emblem.ts`, optional)

`export default () => Object3D` in `chapters/<id>/emblem.ts`, referenced from the manifest (`emblem: () =>
import('./emblem')`). Convention: fits a unit sphere centred on the origin (radius ≤ 1), Y up, front toward +Z,
rounded primitives in palette colours with K materials, static (the map bobs and turns it), ≤ 3 meshes and
≤ 2 000 triangles, no textures, no lights. Until a chapter ships one, the map shows a generic emblem of its group.
The map loads the emblem when it is built, takes ownership of the object (it sets `transparent` on its materials so it
sorts with the rest of the map and drives their `fade`), and each extra mesh is one more draw call of the map.

## 10. Widget reference (`@/ui3d`)

Containers & text: `Panel` (`variant: 'glass' | 'card' | 'inset' | 'plain'`), `row()`, `col()`, `spacer()`,
`Divider`, `Label` (rich text), `Icon`, `FormulaBlock`, `ScrollView`, `Pager`, `Card` (expandable «Детальніше»).
Controls: `Button` (`primary | secondary | ghost | icon`, sizes `sm | md | lg`), `iconButton()`, `Slider`
(`setRange(min, max)`, `label`), `Toggle`, `Tabs` (`disabled`), `Chip` (`term | fact | scale | honesty | status |
plain`; `color` and `setIcon()` change live), `Stepper`, `QuizCard`. Every `Control` has `flash()` (scripted press).
Readouts: `Readout` (count-up; `text` / `setText()` for strings), `Gauge`, `ProgressRing`, `Legend`, `Chart`,
`PhasorScope`, `RadarChart`, `HeatMap`, `Table` (`head`, `rows`, `setRows()`, `highlight`), `StatGrid` (`set(i, text,
colour)`). World: `worldConsole()` (§8).
Feedback: `Toast` / `ToastStack`, `Tooltip`, `reveal()` / `conceal()` / `revealAll()` / `shake()`.
Annotations: `Callout`, `HotspotMarker`, `AnnotationLayer` (the HUD drives them — use §5).
Icons (`IconName`): play, pause, next, prev, chevronUp/Down, arrowLeft/Right, map, settings, soundOn/Off,
fullscreen(Exit), info, help, close, resetView, plus, minus, check, warning, lightning, home, book, layers, eye,
hand, quiz, chart, lock, search, menu, pin, target, star, dot, link, ruler, mouse, touch, keyboard, glossary,
expand, drag, clock, scale.

Every control has hover (120 ms lift + glow), press (80 ms squash), release (spring), disabled (`.disabled = true`)
and keyboard focus (Tab; Enter / Space activate; arrows on sliders and tabs) and calls the sound hook `sfx()`.
Pointer targets are at least 44 px-eq. Theme a subtree with `setAccent(node, 'amber')`; the HUD themes itself
with the chapter accent.

## 11. Layout and your own widget

`UiNode` props: `width / height` = number | `'hug'` | `'fill'`, `minW/maxW/minH/maxH`, `dir: 'row' | 'col' |
'stack'`, `gap`, `pad`, `align` (cross axis), `justify` (main axis), `wrap` (rows), `grow`, `float` (out of flow,
anchored to the parent box: `{ ax, ay, px, py, dx, dy }`), `layer` / `layerUp`, `clip`. Units are px-equivalent
(1 unit = 1 px at 1080p). A `'fill'` child inside a `'hug'` parent expands the parent to what it is offered —
give such parents a width. Presentation properties (`x, y, z, scale, rotX/Y/Z, opacity`) are free to tween and
never affect layout.

```ts
class Lamp extends UiNode {
  on = 0;                                             // tween this, call repaint() in onUpdate
  override paint(p: Painter): void {
    p.circle(0, 0, 28, { fill: lit(rgba('yellow'), 1 + this.on), glow: 12 * this.on, glowAlpha: 0.5, border: rgba('yellow') });
    p.icon('lightning', 0, 0, 16, rgba('bg.void'));
  }
}
```

`Painter`: `rect`, `panel`, `circle`, `arc`, `line`, `icon`, `text` — node-local coordinates, origin at the box
centre, y up. Colours are palette tokens through `rgba(token, alpha)`; `lit(c, k)` with k > 1 makes it bloom.
Call `node.repaint()` after a look-only change and `node.relayout()` after a size change. Text of a paint layer
always draws over that layer's shapes; things that must cover text (popups) go one layer up (`layerUp: 1`).

## 12. Numbers and units (`@/content`)

`fmtNumber(1234.5)` → `1 234,5` · `fmtUnit(230, 'V')` → `230 V` (no-break) · `fmtSI(1500, 'W')` → `1,5 kW` ·
`fmtSci(8.5e22)` → `8,5×10²²` · `fmtScale(-10)` → `10⁻¹⁰ m` · `fmtPercent(0.983, 1)` → `98,3 %` ·
`fmtRange(0.78, 0.83)` · `fmtDuration(65)` → `1:05` · `plural(5, ['крок', 'кроки', 'кроків'])`.
Decimal comma, real minus sign, SI symbols in Latin, Greek μ for micro (DECISIONS §3, §23, §32).

## 13. QA

```bash
node tools/qa/ui-check.mjs --port <port>          # pointer + keyboard acceptance of kit, HUD, map (exit 1 on failure)
node tools/qa/chapter-check.mjs <chapter>         # F1's check — the HUD must stay silent (no console warnings)
```

`ui-check` also sweeps the overflow / board / controls steps of `_sandbox-ui` at 1280×720, 1920×1080, 1024×768,
800×1200, 3840×2160 and 1920×1080 @2x (no hit target off-screen, board beside the column, proportionate panel, real
pointer drag) and measures the HUD cost at the run size and at 4K.

`window.__ui` (QA hook, also in production builds; it relies on node names, never on class names):
`locate(name)` → CSS px of a named node (step controls `ctl-<id>`, segmented items `ctl-<id>:<item>`, `board`,
`dock`, `dock-scroll`, `dock-actions`, `step-panel`, `section-terms|formulas|facts|myths`, `chapter-quiz`, `step-column`, `sheet-tabs:controls`, `xref-<volume/chapter/step>`),
`value(id)` (`value('reading-level')` → the reading level in effect, §2.1), `set(id, v, notify?)`, `press(id)`, **`offscreen({ clipped?, margin? })`** → interactive nodes whose
visible part leaves the viewport (scrolled-out parts of a scroll view are fine; `clipped: true` lists them too) —
assert it is empty in your chapter's QA at 1280×720 —, `overlay()`, `open(name)` / `close()` (`library`, `map`, `home`, `glossary`, `settings`, `help`),
`mapNode(chapterId)` (on the current volume's map), `smallTargets()`,
`setVisible(bool)`.
`?fixture` (dev) draws the Journey Map, spine and glossary from the volume's fixtures (`volume.ts` → `fixtures`;
electricity: the full 25-chapter / 684-term fixture). A node counts as visible only if no ancestor is hidden.
A missing glyph logs one warning (it fails `chapter-check`): ask F1 to add it to the atlas.

## 14. Do / don't

**Do** declare step UI with `stepUi`; put all text in `content.ts`; label every interactive object with a tooltip;
add honesty chips; use `fmt*` for every number; use `UI_STATUS` / `PLANT_TYPE` / `FLOW` / `SEMANTIC` colours; keep one primary
button per step; put big charts and tables on the `board`; write your own labels in plain Ukrainian (§54); test at
1280×720, in portrait and at 4K, with `__ui.offscreen()` empty.

**Don't** create DOM elements; don't hand-place panels for step text or controls; don't use `Text3D` for labels
that must stay legible (use callouts); don't put more than ~450 characters on a panel page; don't write units
with a breaking space or a decimal point; don't change the HUD from a chapter (file a request instead); don't
rebuild chart data every frame when nothing changed; don't hide annotations by moving their anchor (use `visible`);
don't retype titles in `index.ts` (use the manifest JSON) or control captions the document quotes (use `labels`).

## 11. Volumes in the HUD (M4)

The HUD is driven by the volume on screen (`hud.volume`, a `VolumeManifest` — `docs/ENGINE_API.md` §22):

- **Header**: «part · parent chapter» from the volume's groups; the axis chip shows the chapter's `axisLabel`
  with the volume's axis hint as tooltip.
- **Journey map / spine / home**: built per volume from its `Journey`. The map's ruler (range, ticks, labels),
  node heights and spacing come from `volume.journey.axis` and `volume.journey.layout`; generic emblems from
  `volume.journey.groups[].emblem` (names: `micro`, `em`, `plants`, `grid`, `home`, `labs`). The home screen
  shows the volume's `kicker`, `headline`, `lead` and `axis.range`.
- **Glossary**: scoped to the volume; tabs are the volume's groups (`short` names).
- **Library level** — only while `hud.libraryLevel` (more than one published volume, or a listed dev volume on
  screen): the header names the volume, the system row and the home screen get «Бібліотека» (`sys-library`,
  `home-library`, key `L`), the glossary gets the scope switch (`glossary-scope:volume | library`; in library
  scope the tabs are the volumes). The library screen itself (`library` overlay) lists `engine.library.listed`
  as cards (`volume-card-<id>`, `volume-open-<id>`, `volume-progress-<id>`): emblem, title, subtitle, lead,
  progress, sizes. With a single published volume none of this exists and the app looks as it always did.
- **Links**: a `crossReferences` target is a full step address; a target in another volume becomes a normal
  «Див. також» chip (the volume it points to is loaded with the chapter's content).

Chapter code needs none of this: it keeps using `stepUi(ctx)`, `ctx.nav.goto('chapter', 'step')` and the content
of its own chapter. Text of the volume itself (titles, group names, axis words) lives in `volume.json`.

## 15. Phones and tablets (F5 — `docs/MOBILE.md`)

Nothing to code: the same `stepUi` declarations drive the touch shells.

| You declare | Desktop | Phone / tablet |
|---|---|---|
| step text (content) | step panel, paged | «Текст» tab of the sheet, one scroll |
| `controls` | control dock | «Керування» tab (inputs and buttons in one scroll, buttons last) |
| `board` | board panel top-left | «Графіки» tab (its buttons at the end of the scroll) |
| `worldConsole()` | panel in the scene | phone: moved into «Графіки»; tablet: stays in the scene |
| `hotspots` | floating card | card inside the sheet |
| `callouts` | all | the 3 (phone) / 5 (tablet) most important: `priority`, then declaration order |
| chapter quiz | floating card | card inside the sheet |
| `hint`, `ui.toast()` | toast under the header | same, under the compact header |

New in the API: `CalloutSpec.priority` (lower = more important; default: declaration order). Rules that make
the tabs work well: most important control first; short labels (a phone row is ≈ 330 px); charts on the board,
not in the dock; nothing that needs hover. A slider sets its value on tap or horizontal drag — a vertical swipe
across it scrolls the view. Touch targets are ≥ 44 px on phones and ≥ 48 px on tablets automatically.

`window.__ui` additions: `sheet()` → `{ shell, snap, tab, tabs }` (null on desktops), `setSheet({ snap, tab })`,
`smallText(minCssPx = 14)`, `smallTargets(minCssPx)`, `controls()` (id / type / where of the step's controls),
`sounds()` (UI feedback counters), `offscreen({ clipped, partial })` (`partial`: a target cut by its scroll view
is reported as clipped); named nodes `sheet`, `sheet-grip`, `sheet-side-grip`,
`sheet-tabs:text|controls|board`, `sys-menu`, `menu-<item>`, `hotspot-<i>`, `callout-<i>`, `tooltip`,
`glossary-search`, `chapter-quiz`, `quiz-card`. Test with `node tools/qa/mobile-check.mjs <chapter>`.

Widgets (`@/ui3d`): `UiNode.wantsDrag(dx, dy, own)` (touch drag arbitration: override in containers),
`ScrollView` flings and takes over vertical finger drags from its content, `Pager.continuous`, `uiPointer`
(`minHitPx`, `coarse`), `Tooltip.showAt(…, 'touch')`, `worldConsoles` (registry of consoles).
