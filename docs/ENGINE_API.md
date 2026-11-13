# ENGINE API — chapter author's guide

Owner: `F1-core`. This file describes the engine **as it is**; if it disagrees with `ARCHITECTURE.md`, this
file wins for "how", `ARCHITECTURE.md` for "what must be true" (report the mismatch).
Reference implementations that are compiled and run in CI-style checks:

| What | Where |
|---|---|
| Minimal chapter template (60 lines, type-checked, copy it) | `app/src/engine/examples/minimal-chapter/` |
| Full micro-world chapter (instancing, labels, drag, `content.ts` → HUD step panel) | `app/src/volumes/_dev/chapters/_sandbox-micro/` |
| Full diorama chapter (async init, env blending, K.energy, point lights) | `app/src/volumes/_dev/chapters/_sandbox-diorama/` |

Contents: 1 mental model · 2 file template · 3 manifest · 4 scene & context · 5 step states (`ctx.stage`) ·
6 camera · 7 materials & palette · 8 environment · 9 post · 10 text · 11 input · 12 tweens & clock ·
13 disposal · 14 HUD layer & overlay layer (for `F2`) · 15 plugins, store, nav, events (for `F2`/`F3`) ·
16 quality & perf budget · 17 debug API & URL flags · 18 QA tools · 19 do / don't.

---

## 1. Mental model

```
main.ts ─► Engine ─┬─ Clock ── Tweens            every animation runs on the engine clock
                   ├─ Store ── Router ── Nav     state, hash deep links, navigation
                   ├─ RenderPipeline             world (MSAA, HDR) → AO → DOF → overlay → HUD → bloom → grade → FXAA
                   ├─ HudLayer                   camera-space UI scene (not blurred by DOF)
                   ├─ InputSystem                pointer/keyboard, HUD first, then world, else camera orbit
                   └─ ChapterRuntime             lazy load, lifecycle, step changes, chapter transitions
                         └─ per chapter: Scene + root Group + CameraDirector + Environment + Stage + PostControl
```

- The project is a library of **volumes** (§22); electricity is volume 1 (`<volume>` = `electricity`).
- A **chapter** = directory `app/src/volumes/<volume>/chapters/<id>/`. Existing = registered (auto-discovery);
  there is no registry file to edit. `index.ts` (manifest) is tiny and loads with the volume's manifest chunk,
  `scene.ts` is a lazy chunk.
- A chapter has ordered **steps**. A step is a *complete target state* (what is visible, parameter values,
  camera shot, environment, post). The engine tweens from whatever the current state is, so every step can be
  entered from any other step, by deep link, or in the middle of another transition.
- Between chapters the engine plays the universal scale-zoom (the outgoing frame is frozen to a texture, the
  incoming scene is live); within a chapter steps are continuous camera moves + tweens.
- Chapters import libraries directly (`@/style`, `@/text`, `@/ui3d`, `@/fx`, `@/kit`) and get engine services
  only through `ChapterContext`. From the engine they may import **only** `@/engine/api` (ESLint enforces it,
  together with: no `Date.now`, `performance.now`, `window.setTimeout`, `Math.random` in chapters).

Units: world units are arbitrary per chapter (pick a scale where the subject is ~5–20 units across and tell the
environment: `ctx.env.setScale(radius)`). Y is up. Colours are linear-sRGB `THREE.Color`s made from tokens.

## 2. File template

```
app/src/volumes/<volume>/chapters/<id>/
  index.ts      manifest — `export default defineChapter({...})`
  scene.ts      `export default defineScene((ctx) => {...})`   (+ parts/*.ts for bigger scenes)
  content.ts    all Ukrainian text of the chapter
  emblem.ts     optional tiny model for the journey map
```

Copy `app/src/engine/examples/minimal-chapter/` — it is kept compiling by `pnpm typecheck` and was run in the
app (`/srv/electricity/qa/F1-core/example/sheet.jpg`). Its scene, abridged:

```ts
import { Mesh, SphereGeometry } from 'three';
import { defineScene, toOverlay } from '@/engine/api';
import { K, SEMANTIC } from '@/style';
import { Text3D } from '@/text';

export default defineScene((ctx) => {
  const { root, stage, camera } = ctx;
  const sphere = new SphereGeometry(0.5, 48, 32);
  const electron = new Mesh(sphere, K.glow({ color: SEMANTIC.electron, intensity: 1.9, falloff: 2 }));
  const proton = new Mesh(sphere, K.toon({ color: SEMANTIC.proton, gloss: 0.6 }));
  root.add(electron, proton);                                   // everything under root is auto-disposed

  camera.shots({
    single: { position: [-1.6, 0.6, 5], target: [-1.6, 0, 0], focus: electron },
    both: { position: [0, 1.2, 8.5], target: [0, 0, 0] },
  });
  const pull = stage.param('pull', 0);
  stage.define({                                                // one entry per manifest step
    intro: { show: [electron], camera: 'single' },
    pair: { show: [electron, proton], params: { pull: 1 }, camera: 'both', post: { bloomIntensity: 1.3 } },
  });
  ctx.input.register(electron, { tooltip: 'Electron — електрон', click: () => void ctx.nav.next() });
  return {
    update(_dt, t) {                                            // engine-clock seconds
      const gap = 1.6 - 0.55 * pull.value;
      electron.position.set(-gap, Math.sin(t * 1.6) * 0.08, 0);
      proton.position.set(gap, 0, 0);
    },
  };
});
```

## 3. Manifest — `defineChapter`

```ts
export default defineChapter({
  id: 'atom',                 // = directory name; URL-safe [A-Za-z0-9_-]; unique inside the volume
  order: 1,                   // position on the main path (children: order among siblings)
  group: 'micro',             // a group of the volume (volume.json → groups); electricity:
                              // 'micro' | 'em' | 'plants' | 'grid' | 'home' | 'labs'
  parent: 'plants',           // optional: plant types → 'plants', labs → 'home'
  title: 'Атом', subtitle: '…',
  axisLabel: '10⁻¹⁰ m',       // place on the volume's journey axis, as shown (was `scaleLabel` before M4)
  axisValue: -10,             // the same as a number on that axis (was `scaleExp`). Electricity: log10(size
                              // in m) — transitions zoom OUT when it grows, IN when it shrinks
  theme: { accent: 'cyan', sky: 'micro', mood: 'micro' },
  steps: [{ id: 'intro', title: '…', blurb: '…' }, …],   // ≥ 1; ids unique; full text lives in content.ts
  load: () => import('./scene'),
  emblem: () => import('./emblem'),   // optional
  dev: true,                  // optional: hidden unless ?debug
});
```

- `theme.sky`: `micro` (space backdrop) · `studio` · `day` | `golden` | `dusk` | `night` (sky backdrop). The
  backdrop *kind* is fixed per chapter; presets of the same kind can be blended per step (§8).
- `theme.mood`: post defaults — `micro` (shallow DOF, stronger bloom) · `studio` (restrained) · `diorama` (tilt-shift).
- Journey order = roots by `order`, each followed by its children (depth-first). `nav.next()` walks it.
- Validation errors (bad ids, duplicate steps, id ≠ directory, unknown group) are thrown / logged at startup.
- The chapter's **volume** is its directory (`src/volumes/<volume>/chapters/<id>/`): discovery sets
  `manifest.volume`, you do not write it. Full chapter id = `<volume>/<id>` (`fullChapterId(manifest)`). §22.
- With the generated manifest (`@<volume>/content/generated/<id>.manifest.json`) most of this is one spread:
  `...manifestText(meta)` gives `title`, `subtitle`, `axisLabel`, `steps`.

## 4. Scene & `ChapterContext`

`defineScene(factory)`: the factory builds the scene (may be `async`) and optionally returns hooks:

```ts
interface SceneHooks {
  enterStep?(stepId: string, info: StepInfo): void;  // after ctx.stage applied the step; safe from ANY state
  update?(dt: number, t: number): void;              // every engine update; engine-clock seconds
  dispose?(): void;                                  // extras only — see §13
}
interface StepInfo { from: string | null; instant: boolean; direction: 1 | -1 | 0; index: number; scope: TweenScope }
```

`ChapterContext` (small on purpose):

| Member | Purpose |
|---|---|
| `manifest`, `scene`, `root` | your manifest; the world `Scene`; **add objects to `root`** |
| `camera: CameraDirector` | shots, moves, focus (§6) |
| `env: Environment` | backdrop + light rig + fog (§8) |
| `post: PostControl` | chapter-level post overrides (§9) |
| `stage: Stage` | declarative step states (§5) |
| `input: ScopedInput` | interaction registration (§11) |
| `tweens: TweenScope`, `clock` | animation on the engine clock (§12) |
| `quality: QualityView` | tier, `count(n)` budget scaling, `onChange` (§16) |
| `store`, `nav` | app state and navigation (§15) |
| `hud: HudLayer` | camera-space UI layer — pass to `@/ui3d` widgets (§14) |
| `random: Rng` | seeded RNG — use instead of `Math.random()` |
| `viewport`, `onResize(fn)` | CSS size, aspect, dpr |
| `renderer` | capabilities / render targets only; never call `render()` |
| `reducedMotion`, `gesture` | user preference; promise of the first user gesture (audio unlock) |
| `track(x)`, `onDispose(fn)`, `disposed` | lifetime management (§13) |
| `progress(0…1)`, `breathe()` | loading progress; `await ctx.breathe()` between heavy build steps so loading never freezes the outgoing scene (no-op while the frame budget is not used up) |

Loading order: chunk import → factory (your build code) → `stage.validate` against the manifest → the target
step is applied instantly → shader programs compiled → outgoing frame frozen → swap + zoom.
If the factory throws, the error is logged, the previous chapter stays on screen.

## 5. Step states — `ctx.stage`

Register what differs between steps, then describe each step completely:

```ts
const aLabel = stage.actor(label, { appear: 'fade' });   // 'pop' (default) | 'grow' | 'fade' | 'none' | (obj, v) => void
const flow   = stage.param('flow', 0, { duration: 1.2, ease: 'power2.inOut', onChange: (v) => (mat.power = v) });
const tint   = stage.color('tint', 'blue');              // .value is a live THREE.Color — bind it to a uniform once
stage.pose('rotor', rotor);                              // current transform = default pose

stage.define({
  overview: { show: [island, aLabel], camera: 'wide' },
  detail: {
    show: [island, cutaway],                 // every other actor hides (animated)
    params: { flow: 1 },                     // unspecified params return to their initial value
    colors: { tint: 'coral' },
    poses: { rotor: { position: [0, 2, 0], rotation: [0, Math.PI / 2, 0], scale: 1.2 } },
    camera: 'close', cameraMove: { duration: 2.2 },
    env: 'dusk',                             // default: manifest.theme.sky
    post: { dofAperture: 1.8, bloomIntensity: 1.2 },   // default: mood + ctx.post.base()
    duration: 0.9, ease: 'power2.inOut',     // for params / colours / poses of this step
    enter(info) { info.scope.delay(1.2, () => spark()); },   // imperative extras; info.scope dies with the step
    leave() {},
  },
});
```

Rules:

- **Everything not mentioned returns to its default**: actors hidden, params/colours/poses at their registered
  values, env = chapter sky, post = chapter base. That is what makes random access work — do not rely on
  "the previous step showed X".
- Objects listed in `show` are auto-registered as `pop` actors; register explicitly to choose the appear mode.
  Scenery that is always visible is simply not an actor.
- Appear = scale-up with `back.out` overshoot, staggered 55 ms; disappear = fast `power2.in` (STYLE_GUIDE §5).
  `fade` drives the dithered `fade` of K materials and `Text3D.fade` under the object.
- Read `param.value` in `update()` (or use `onChange`). Never animate a registered value yourself.
- Give **every step a `camera`**. Step ids must match the manifest exactly (`validate` throws otherwise).
- `info.instant` is true for deep links / chapter entry: the stage already applied values without tweens;
  your own `enterStep` code must honour it too (skip intro sequences).
- State that is not a tween target (simulation phases, particle positions) must be re-derived in `enterStep`
  or be independent of history.

## 6. Camera — `ctx.camera` (`CameraDirector`)

```ts
camera.shots({
  wide:  { position: [10, 7, 24], target: [0, -1, 0], fov: 30,
           orbit: { azimuth: 1.2, polar: 0.4, zoom: [0.6, 1.4] } },
  close: { position: [3, 2, 6], target: [0, 1, 0], focus: rotorMesh, drift: 0.5 },
});
camera.go('close', { duration: 2 });        // normally done by stage via `camera: 'close'`
camera.focusOn(object, { padding: 1.4 });   // frame any object from the current direction
```

- `fit` (M3, DECISIONS §57 d): subject bounds that must stay in frame on any aspect ratio — `{ center, radius }`
  or an object (its bounding box). **A hint only for now** (the director ignores it; F5 will reframe phones /
  portrait from it) — declare it on every shot: `close: { position, target, fit: { center: [0, 1, 0], radius: 1.4 } }`.
- `Shot`: `position`, `target`, `fov` (vertical FOV of the *safe frame*, default 32°), `frameAspect` (default
  1.5), `focus` (point or object the depth of field tracks; default `target`), `orbit` limits
  (`azimuth` ±0.7 rad, `polar` ±0.35 rad, `zoom` [0.65, 1.5], `enabled`), `drift` (idle motion, default 1),
  `near`/`far` (auto from distance).
- Moves arc around the target (direction slerp, log-distance) with the `cinematic` ease, default 1.8 s
  (`MOTION.camera`). A new `go()` mid-move starts from the pose on screen (including the user's orbit).
- **HUD-aware framing**: the safe frame (aspect × fov) is always fully visible inside the viewport area the
  HUD leaves free, at any window aspect ratio — compose the subject inside the safe frame and it will never
  hide under a panel. (Implementation: off-axis projection; `camera.camera` is a `PerspectiveCamera` subclass.)
- The user orbits/zooms around the current shot within its limits (damped); it unwinds on the next move.
- Idle drift keeps the frame alive; `reducedMotion` shortens moves (×0.35) and disables drift.
- `camera.camera` is the three.js camera (read it for billboards, projections); do not move it yourself.

## 7. Materials & palette — `@/style`

Palette tokens (`STYLE_GUIDE §2`) resolve with `col(token)` → new linear `THREE.Color`:
`'cyan' | 'cyan.light' | 'cyan.dark' | 'bg.indigo' | 'white' | 'wireBrown' …` (`ColorToken`), or any
`ColorLike` (token, `Color`, hex). `SEMANTIC.electron`, `.proton`, `.current`, `.fieldE`, `.phaseL1` … are the
semantic map (§2.2) — use them for anything that has a physical meaning (also `.poleN/.poleS`, `.dcPlus/.dcMinus`,
`.donor/.nRegion`, `.acceptor/.pRegion`, `.valenceBand/.conductionBand/.bandGap`, `.nuclear`, `.coreGlow`,
`.reactive`, `.warning/.ok/.alarm`). Token groups (M1): `plantType.<nuclear|coal|chp|gas|hydro|pumpedStorage|wind|
solar|bio|geothermal|ocean|bess|hydrogen|exchange|shedding>` (map `PLANT_TYPE`), `ui.<ok|warning|alarm|info>`
(`UI_STATUS`), `flow.<active|reactive>` (`FLOW`) are valid `ColorToken`s everywhere a colour is accepted. Ramps: `voltageRamp(t)`,
`heatRamp(t)`, `temperatureRamp(t)`. Motion tokens: `MOTION.camera / appear / disappear / state / mood / hover /
press / release / panel / transition`, `STAGGER`.

The **K family** — the only materials to use (no `MeshStandardMaterial`: PBR is off-style and bypasses the
tinted-shadow model). All work with `InstancedMesh` (incl. `setColorAt`) and `BatchedMesh`, scene fog and
local `clippingPlanes` (cutaways); all have a tweenable `fade` (0…1 dithered dissolve).

| Factory | Use | Key params |
|---|---|---|
| `K.toon({…})` | everything solid | `color`, `gradient {bottom, top, range, space}`, `emissive` + `emissiveIntensity`, `softness` (0.1), `terminator`, `highlight` (0.55), `gloss` (0…1 crisp spot), `rim`, `vertexColors`, `flatShading`, `vertexEmissive` (M1: per-vertex glow from the `kEmissive` attribute — `paintEmissive(geometry, colour, intensity)` each part before merging; × `vertexEmissiveIntensity`, tweenable) |
| `K.metal({…})` | machined metal | toon params + `shininess` (48), `specular` (0.7) |
| `K.energy({…})` | cables, pipes, beams carrying flow | toon body + `pulseColor` (yellow), `repeat` (pulses per unit of `uv.x`), `speed`, `length`, `intensity`, `power`; tween `.power` / `.speed` (brightness ∝ power) |
| `K.glow({…})` | emissive, bloom-driving | `color`, `intensity` (2.2; > ~1.2 blooms), `core`, `whiten` (0…1, default 0.55: how far the default core goes toward white; 0 = keep the hue), `keepHue` (small coloured lights / LEDs keep their hue under bloom; peak capped at 1.8), `falloff`, `edge`, `additive` |
| `K.flat(color)` | unlit exact palette colour | — |
| `K.glass({…})` | tinted translucent, fresnel edge | `color`, `opacity`, `edgeOpacity`, `specular` |
| `K.water({…})` | stylised water surface | `shallow`, `deep`, `foam`, `shape: 'disc' \| 'strip' \| 'open'` (UV convention), `scale`, `glints`, `waveHeight` |
| `K.hologram({ size, … })` | "hologlass" UI panel | `size [w,h]`, `radius`, `margin` (mesh = size + 2·margin), `accent`, `fillOpacity`, `border`, `glow`; `.setSize()`, `.highlight`, `.fade` |

Lighting model (lit K materials): `light = fill + key − fill·key`, `colour = base × light`. So a fully lit
surface shows **exactly the palette colour**, the shade side is `base × fill` (the hemisphere fill is
indigo/violet ⇒ tinted shadows, never grey), a highlight band pushes toward the `*.light` variant, plus a
coloured rim. Lit results are clamped to 1 — only emissive terms exceed 1 and bloom. Extra `PointLight`s work
(same cel banding) — keep them few (each one is a loop iteration in every lit shader) and keep them in the
scene permanently (tween `intensity`, do not toggle `visible`: that recompiles programs).

Coloured lights (M1): above ≈ 1 every pixel bleeds toward white in the display transform (white-hot core inside a
saturated halo). For semantic hues that must read as a colour — phase lamps, LEDs, SOC bars, field arrows — use
`K.glow({ color, whiten: 0, keepHue: true, intensity: 1.4…1.8 })`.

Stencil (M1): the world target has an 8-bit stencil (DEPTH24_STENCIL8, cleared every frame; rendering without
stencil use is pixel-identical to before). Materials may use three's `stencilWrite / stencilRef / stencilFunc /
stencil*Op` in the world pass (e.g. planar cutaway caps). The overlay layer and the HUD have no stencil.

Shadows: set `mesh.castShadow` / `receiveShadow` as usual. Fit the key light's frustum to your subject once:
`ctx.env.setShadow({ extent, center, softness })`. Geometry rules: enough segments for smooth silhouettes;
`LatheGeometry` profiles must run bottom → top (otherwise normals point inward).

## 8. Environment — `ctx.env`

Created from `manifest.theme.sky`. Contains the gradient dome, the key `DirectionalLight` (soft PCF shadow),
the hemisphere fill, rim values, fog, and per kind: bokeh discs + drifting motes (`space`), soft floor disc
(`studio`), sun glow / stars / painted cloud bands / "sea of clouds" / layered silhouettes (`sky`).

```ts
ctx.env.setScale(11);                               // subject radius: scales bokeh/motes/floor
ctx.env.setShadow({ extent: 15, center: [0, -1, 0], softness: 3 });
ctx.env.set('dusk', { duration: 2 });               // blend to another preset of the same kind (stage: `env: 'dusk'`)
ctx.env.tune({ fogDensity: 0.012, rimColor: 'pink', keyIntensity: 0.9 }, { duration: 1 });
```

`EnvParams` (all blendable): `top/mid/bottom`, `horizon`, `horizonWidth`, `sunDir/sunColor/sunSize/sunGlow`,
`stars`, `clouds`, `cloudColor(B)`, `silhouettes`, `silhouetteColor`, `bokeh`, `motes`, `moteColor`,
`keyColor/keyIntensity`, `fillSky/fillGround/fillIntensity`, `rimColor/rimIntensity/rimDir`, `shadowStrength`,
`fogColor/fogDensity`, `floor`, `floorColor`. Do not add your own ambient/hemisphere lights; tune the rig.

**Unit scale convention (M1).** The presets and post moods are tuned for subjects of the reference sandboxes:
radius ≈ `LOOK_SCALE.studio` 3.4, `.micro` 6, `.diorama` 11 world units (`@/style`). Fog density, `aoRadius` and
`dofRange` are in world units, so a scene built at another scale must say so — e.g. a kit diorama in metres
(island radius 60): `ctx.env.setScale(60, { adaptFrom: LOOK_SCALE.diorama })` → fog density ÷ 5.45, AO radius
and DOF sharp range × 5.45; the look then matches `_sandbox-diorama` without scaling the world group. Without
`adaptFrom` (default) nothing but bokeh/motes/floor/shadow defaults follows the radius — existing scenes are
unchanged. `ctx.env.tune({ fogDensity })` values stay in reference units (they are divided by the same factor).

## 9. Post — `ctx.post`

Stack order (fixed): AO → DOF / tilt-shift → [overlay layer] → [chapter transition] → HUD → bloom →
display transform → grade → vignette → grain → FXAA. Parameters (`PostParams`, all numeric, all tweenable):
`exposure`, `aoIntensity`, `aoRadius` (world units ≈ 3–5 % of the subject), `bloomIntensity`,
`bloomThreshold` (1.0), `bloomKnee`, `bloomRadius`, `dofAmount`, `dofAperture`, `dofRange`, `dofMaxBlur`
(px @1080p), `tiltAmount`, `tiltCenter`, `tiltSpread`, `tiltFalloff`, `gradeLift`, `gradeContrast`,
`gradeVibrance`, `gradeSaturation`, `vignette`, `vignetteRadius`, `vignetteSoftness`, `grain`.
(`dofFocus` and `chroma` are engine-owned: focus tracks the shot's `focus`; chromatic aberration only during
transitions.)

```ts
ctx.post.base({ aoRadius: 0.55, dofAperture: 1.1 });   // chapter-wide, once in init
// per step: stage.define({ step: { post: { bloomIntensity: 1.3 } } })
```

Colour management: linear HDR until the last pass. Values ≤ 1 are passed through the display transform
unchanged (no filmic curve), then a deliberately mild grade. Measured on palette swatches:
see `docs/reports/F1-core.md`. Overflow > 1 bleeds toward white (white-hot glow cores) and clips.
Transparent, non-depth-writing objects (additive glows, particles) take the depth of what is behind them for
DOF — keep important ones near the focus plane or give them an opaque core.

## 10. Text — `@/text`

Offline SDF atlases (4 faces), synchronous layout, one draw call per text block, no font loading at runtime.

```ts
const t = new Text3D('**AC** — _змінний_ струм, `U = I·R`, 10^{-19} C, {cyan:електрон}', {
  font: 'body',              // 'display' (Nunito ExtraBold) | 'body' (Fira Sans) | 'bodyBold' | 'mono' (JetBrains Mono)
  size: 19,                  // 1 em in your units (HUD units, world units, or px-eq with screenSpace)
  maxWidth: 380, align: 'left', lineHeight: 1.45, letterSpacing: 0,
  anchorX: 'left', anchorY: 'top',     // 'left'|'center'|'right'  ×  'top'|'middle'|'bottom'|'baseline'
  color: 'mist', accent: 'cyan', formulaColor: 'yellow',
  opacity: 1, intensity: 1,            // intensity > 1 = emissive text (blooms)
  outline: { width: 0.06, color: 'bg.void' }, halo: { radius: 0.11, opacity: 0.6 }, weight: 0,
  billboard: false, screenSpace: false, depthTest: true, depthWrite: true, rich: true,
});
t.text = 'новий текст';      // re-layout is lazy and synchronous
const m = t.metrics;         // { width, height, lineCount, lineHeight, baseline, left, right, top, bottom, lineWidths, spans }
measureText('230 V', { font: 'mono', size: 20 });   // metrics without an object
```

Markup: `**term**` (accent + semibold) · `_emphasis_` (italic) · `` `formula` `` (mono, yellow) · `x^2`,
`10^{-19}` superscript · `U_{rms}` subscript · `{token:text}` palette colour · `\*` escapes. Unicode
super/subscripts (`⁰…⁹ ⁺ ⁻ ₀…₉ …`) work in every face. A space between a number and a unit
(`230 V`, `1,5 mm²`, `25 °C`, `98 %`, `3 m/s`) becomes non-breaking automatically. `metrics.spans` lists the
rectangles of formula/term spans so panels can draw insets behind formulas.
Coverage: Basic Latin, Latin-1, Latin Ext-A, Ukrainian/Russian Cyrillic (ґ є і ї), Greek, arrows
(← ↑ → ↓ ↔ ⇄ ⇌ ⇒ ⇔ ↺ ↻), math (× · ± ≈ ≠ ≤ ≥ √ ∞ ∆ ∂ ∑ ∫ ∏ ∝ ∇ ∥ ⊥ ≡ ≪ ≫ …), ° ‰ µ Ω ℏ № € ₴, shapes
(● ○ ■ □ ▲ ▼ ◀ ▶ ★ ✓ ✗ ⚡), and (M1) every character of the chapter copy: ℰ ṁ ṅ ᴬ ᵢ ₓ ₐ…ₜ ⅓ ⅔ ⅛ ↩ ⌈ ⌉
⎓ ⟂ ⟨ ⟩ ⧈ ℃ ἤ. Glyphs that no bundled font has (index letters, ⎓, ℃, U+2011) are composed by the builder from
glyphs of the same face. Combining marks (U+0300…036F, U+20D0…20FF: `ν̄`, `V̇`, `E⃗`) take no advance and are
centred over the previous glyph, lifted above capitals. A missing glyph logs one `console.warn` (which fails
`chapter-check`) — add it to `charset()` in `app/scripts/build-fonts.mjs` and run `pnpm fonts`;
`pnpm fonts:check` checks every on-screen field of `docs/volumes/<volume>/chapters/_export/*.json` against the atlas.
For own batching (the UI kit): `fontAtlas()` (the `DataArrayTexture`, null before `loadFonts`), `fontData()`,
`layoutText(…)` → `LayoutResult { glyphs: LaidGlyph[], metrics }` are all exported from `@/text`.

World labels: `billboard: true` (faces the camera) + `screenSpace: true` (`size` in px-equivalent units,
constant on screen) and put them on the overlay layer with `toOverlay(obj)` (§14) so depth of field never
blurs them. Transparent objects are sorted by the centre of their bounds: when a text sits on a (tilted) panel
give it a higher `renderOrder` than the panel.

## 11. Input — `ctx.input`

```ts
const off = ctx.input.register(mesh, {
  tooltip: 'Wind turbine — вітрова турбіна',     // emitted in the 'hover' event; the HUD renders it
  cursor: 'grab',
  hover: (over, e) => ctx.tweens.to(state, { glow: over ? 1 : 0 }, { duration: MOTION.hover.duration }),
  press, release, click,
  dragStart, dragEnd,
  drag: (e) => {                                  // e.dx/dy px, e.totalX/Y, e.ray, e.startPoint
    const p = e.planePoint(planeNormal, pointOnPlane);   // ray ∩ plane: drag across a surface
  },
  wheel: (deltaY) => true,                        // true = consumed (otherwise the camera zooms)
  enabled: () => stage.current === 'sandbox',
});                                               // third argument 'hud' for objects in the HUD scene
ctx.input.on('hover', ({ object, tooltip, x, y }) => {});
ctx.input.on('action', (a) => {});                // 'next'|'prev'|'first'|'last'|'map'|'back'|'fullscreen'
```

- Pointer Events for mouse, touch and pen; the registered object's whole subtree is pickable; invisible
  objects are skipped. HUD-layer objects are picked first and block the world (register a panel with `{}` to
  make it a blocker). Use a simple invisible proxy mesh for thin/moving targets (see the turbine `hit` disc).
- Anything not claimed orbits/zooms the camera (drag, wheel, two-finger pinch) within the shot's limits.
- Keys: ←/→ (also PgUp/PgDn/Space) steps — handled by the engine; Home/End first/last step; `F` fullscreen;
  `M` (map) and `Esc` (back) are emitted for the HUD. Physical key codes are used (layout independent).
- Taking keys first (M1): `input.captureKeys((e) => boolean, { priority })` sees every `keydown` before the
  engine maps it (modifiers included, never while a DOM text field has focus); return true to consume it — the
  engine calls `preventDefault()` and emits no action. Higher priority first (HUD: 100, chapters: default 0),
  equal priority newest first. On `ctx.input` it is removed with the chapter. Use it instead of a capturing
  DOM listener.
- Every interactable must show affordance and react to hover/press (STYLE_GUIDE §6).

## 12. Tweens & clock

```ts
ctx.tweens.to(obj, { x: 1, y: 2 }, { duration: 0.6, ease: 'back.out', delay: 0.1, onUpdate, onComplete });
ctx.tweens.value(0, 1, { duration: 1 }, (v) => {});      // detached number
ctx.tweens.delay(1.5, fn);   await ctx.tweens.wait(0.5); // engine-time timers (never setTimeout)
ctx.tweens.timeline().to(a, { x: 1 }, { duration: 0.4 }).to(b, { y: 2 }, {}, '<+0.1').call(fn).wait(0.3);
const scope = ctx.tweens.scope();  scope.killAll();      // sub-scopes; `info.scope` is one per step
```

- Numeric properties only (`mesh.position`, `color` r/g/b, material accessors like `emissiveIntensity`,
  `fade`, `power`, `intensity`). Start values are captured when the tween starts; a newer tween on the same
  property takes it over without a jump. `tween.finished` resolves `true` (completed) / `false` (killed).
- Eases (`EaseName`): `linear`, `power1…4.in|out|inOut`, `sine.*`, `expo.*`, `back.*`, `elastic.out`,
  `cinematic`, `spring`; or any `(t) => number`. `damp(current, target, lambda, dt)` for smoothing in `update`.
- `ctx.clock.time / dt / frame`: engine time. It can be paused, stepped, scaled and fast-forwarded (QA), so
  **all** animation must derive from `update(dt, t)`, tweens or `uKTime` (`kGlobals.uKTime` uniform for custom
  shaders). Custom `ShaderMaterial`s may share it: `uniforms: { uKTime: kGlobals.uKTime }`.

## 13. Disposal

Automatic when the chapter is left: every geometry / material / texture reachable from `ctx.root` (incl.
shader-uniform textures, instanced meshes, `Text3D`), the environment, all `ctx.tweens`, all `ctx.input`
registrations, `ctx.onResize` listeners. Register the rest:

```ts
const rt = ctx.track(new WebGLRenderTarget(256, 256));     // anything with dispose() that is not under root
ctx.onDispose(() => window.removeEventListener('x', fn));  // listeners, audio nodes, HUD objects you added
```

Objects you add to `ctx.hud.root` are *not* under `ctx.root`: remove and dispose them in `onDispose` (see
`_sandbox-*/parts/panel.ts`). Engine-lifetime shared resources (kit caches) must be marked with
`markShared(resource)` so chapter disposal skips them. `chapter-check` enters/leaves the chapter three times
and fails if `renderer.info.memory` geometries/textures or the program count grow.

## 14. HUD layer & overlay layer (primarily for `F2-ui`)

**HUD layer** — `engine.hud` / `ctx.hud`: own `Scene` + perspective camera (FOV 24°), rendered after DOF and
before bloom: it receives bloom, grade and grain, never blur. Add objects to `hud.root`.

- Coordinates: plane z = 0 of `hud.root` is the screen; origin at the centre, +x right, +y up;
  **1 unit = 1 px-equivalent** (px at 1080p). z > 0 floats toward the viewer (perspective depth layering).
- `hud.metrics`: `{ width, height (units), pxPerUnit (CSS px per unit), cssWidth, cssHeight,
  layout: 'wide' | 'narrow' | 'portrait', safeMargin }`; `hud.onResize(fn)`. `pxPerUnit =
  clamp(min(h, w·9/16)/1080, 0.7, 3) × settings.textScale` — e.g. 1280×720 → 0.7, so the plane is 1829×1029 units.
- `hud.setInsets({ left, right, top, bottom })` in HUD units from each edge: the camera director keeps world
  subjects inside the remaining area (eased). Report 0 when a panel closes.
- The HUD scene has a neutral key + fill, so `K.toon` buttons work; `hud.rig` holds its rim values.
- Input: `engine.input.register(obj, handlers, 'hud')`.
- Transparent sorting pitfall: see §10 (`renderOrder`).

**Overlay layer** — world-anchored UI that must stay crisp: `toOverlay(object)` moves an object subtree to
`OVERLAY_LAYER`. Such objects are rendered with the world camera after DOF/AO, on top of the world (no
occlusion by scene geometry), are included in chapter-transition frames, and are pickable. Call `toOverlay`
after the subtree is built (three.js layers are not inherited). The rig lights illuminate both layers.

## 15. Plugins, store, navigation, events (for `F2-ui` / `F3-fxkit`)

**Plugins**: `src/hud/index.ts`, `src/audio/index.ts`, `src/fx/index.ts` (or a tiny `src/<lib>/plugin.ts`) may export
`plugin: EnginePlugin = { name, mount(engine) { … return cleanup } }`; `main.ts` mounts them after the engine
and fonts are ready and before the first chapter loads. `engine` exposes: `renderer`, `clock`, `tweens.root`,
`store`, `quality`, `pipeline` (`params`), `hud`, `input`, `library` (volumes and their chapter registries, §22),
`router`, `nav`, `runtime`, `flags`,
`viewport`, `reducedMotion`, `onUpdate(fn(dt))`, `onResize`, `nextFrame()`, `setQuality()`, `stats()`.

**Store** (`engine.store` / `ctx.store`): `get()`, `set(patch)`, `subscribe(selector, listener, { immediate })`,
`updateSettings(patch)`, `markVisited(position)`, `settle(position)`. `AppState`: `volumeId`, `chapterId`,
`stepId` (on screen), `target` (heading to),
`transition { phase: 'idle'|'loading'|'animating', from, to, direction, progress }`, `quality`,
`settings { quality, benchmarkTier, dynamicResolution, audio, volume, reducedMotion, textScale }`,
`progress { visited: Record<'<volume>/<chapter>', stepId[]> }`, `last`, `lastIn[volumeId]` (last position inside
each volume). A `Position` is `{ volumeId, chapterId, stepId }`. Settings/progress/last persist in localStorage
(`electricity:v2`; a `v1` record is migrated into the default volume). `transition.from/to` are full chapter ids.

**Navigation** (`engine.nav` / `ctx.nav`): `goto(chapter, stepId?, { instant, replace })` — `chapter` is a
short id (`'atom'`: current volume, else the default volume, else any other) or a full id
(`'electricity/atom'`); `open(address)` / `locate(address)` take a step address (`volume/chapter/step`,
`chapter/step`, …) — `locate` returns the `Position` or null when the target is not available;
`gotoVolume(volumeId)`; `next()`, `prev()` (inside the volume), `up()` (to parent), `canNext/canPrev`,
`position`, `volume`, `volumes`, `chapters` (the current volume's, journey order), `chapter(ref)`,
`childrenOf(ref)`, `parentOf(ref)`, `journeyProgress`. Hash deep links `#/<volume>/<chapter>/<step>` (the old
`#/<chapter>/<step>` still works and is rewritten); back/forward work.

**Runtime events** (`engine.runtime.on(...)`): `loading { volumeId, chapterId, progress }`,
`transitionStart { from, to, direction, duration }` (animate HUD out/in here; `from`/`to` are full chapter
ids), `transitionEnd`, `chapter { volumeId, chapterId, from }`,
`step { volumeId, chapterId, stepId, from, instant }`, `error`.
Also `engine.runtime.chapter` (manifest on screen), `.director`, `.busy`, `.settled()`.
`engine.runtime.suspendWorld(true | false)` / `.worldSuspended` (M1): while a full-screen view covers the scene
(Journey Map, home) the frame renders only the HUD over the void colour (micro sandbox: 42 → 15 draw calls); the
chapter keeps updating, and during a load / transition the world renders anyway so transition captures are
valid. Call `suspendWorld(false)` when the view starts to close (before its fade-out reveals the scene).

**Plugin loading** (M1): `main.ts` imports the plugins dynamically, in the order fx → audio → hud, while the fonts
load. A library that ships a tiny `src/<lib>/plugin.ts` (exporting only `plugin`) is picked up automatically
(`import.meta.glob`) and then only that module loads at boot; otherwise its barrel is imported. Entry chunk:
130.1 → 49.4 kB gzip. **Time base**: `kGlobals.uKTime` is also set in `Engine.update()`, so fixed steps
(`advance`, `?freeze`, `__app.step`) see the time of the step being simulated.

**Audio**: start only after `engine.input.gesture` resolves; stay silent when `engine.flags.noaudio`;
follow `settings.audio` / `settings.volume`.

## 16. Quality tiers & performance budget

Tiers `low | medium | high | ultra` (`QUALITY_PROFILES`): DPR cap 1 / 1.25 / 1.5 / 2, MSAA 0 / 2 / 4 / 4,
shadow map 1024 / 2048 / 2048 / 4096, AO off / 6 / 10 / 16 samples, DOF off / 16 / 28 / 44 taps,
`particles` multiplier 0.35 / 0.6 / 1 / 1.5. Auto-picked on first run by a GPU benchmark, user-overridable
(persisted), `?q=<tier>` per session. Optional dynamic resolution lowers the render scale when frames miss vsync.

- Scale heavy effects: `ctx.quality.count(nominal, min)`; react to changes with `ctx.quality.onChange`.
- Budget per chapter view at 1080p `high` (ARCHITECTURE §1): frame ≤ 8 ms, ≤ 350 draw calls, ≤ 1.5 M
  triangles, chunk ≤ ~350 kB gzip. The post stack itself costs ≈ 30 draw calls. Instance everything repeated
  (trees, bolts, windows); share materials; shadows double the draw calls of casters.
- `await ctx.breathe()` between build phases; avoid > 10 ms synchronous blocks in `update`.
- **4K (M3)**: at 3840×2160 `high` the budget is avg ≤ 14 ms (warning above, failure above 16.6 ms). What
  scales with pixel count: every full-screen post pass — DOF (taps × pixels), bloom (mip chain), AO (its
  buffer is a fraction of the render resolution), FXAA / MSAA resolve, the mood grade — plus fill-heavy
  transparent / additive effects (glass, halos, point clouds, ribbons near the camera). Geometry, draw calls
  and CPU do not scale. The tier's DPR cap bounds the internal resolution, and dynamic resolution may lower
  the render scale when frames miss vsync, so a 4K measurement can come out cheaper than its pixel count
  suggests (`stats().resolution` shows what was rendered). 1920×1080 at DPR 2 renders the same pixel count.

## 17. Debug / QA API and URL flags

URL flags: `?q=<tier>` · `?debug` (dev volumes and dev chapters + HTML overlay; `&overlay=0` hides the overlay) ·
`?noaudio` ·
`?freeze=<seconds>` (deterministic clock: no real-time advance; after every navigation exactly N seconds are
simulated in 1/60 s steps, then the picture holds; chapter transitions are instant).

`window.__app`: `ready` · `goto(ch, step?, { instant })` (`ch`: short or full chapter id; or one step address
`goto('electricity/atom/quarks')`) · `next()` · `prev()` · `settled()` · `pause()` ·
`resume()` · `step(dt, frames)` · `setTime(s)` · `stats()` (cpu ms, fps, draw calls, triangles, geometries,
textures, programs, tweens, resolution, tier, time) · `measure(frames)` (GPU-inclusive frame time) ·
`listVolumes()` · `listChapters(volumeId?)` (each with `volume`, `id`, `fullId`) · `position()`
(`{ volumeId, chapterId, stepId }`) · `setQuality(tier)` · `errors()` / `clearErrors()` (console errors + warnings,
uncaught errors, unhandled rejections) · `gpu()` · `simulateContextLoss(ms)` · `project(x, y, z)` (world → CSS px,
for scripted pointer input) · `locate(name)` / `read(name)` / `probes()` (chapter QA probes, §21) · `textSizes()`
(on-screen size of world `Text3D`) · `engine`. Everything here exists in production builds too.

## 18. QA tools (`tools/qa/`, run on lenovo)

```bash
tools/dev-start.sh <agent-id> <port>                       # dev server in tmux (session dev-<id>)
export QA_ID=<agent-id> QA_PORT=<port>                     # output → /srv/electricity/qa/$QA_ID

node tools/qa/shot.mjs <chapter>/<step> --size 1280x720    # one screenshot (deterministic, freeze 3 s)
node tools/qa/shot.mjs atom/quarks --eval "await app.step(1/60, 90)" --out /srv/electricity/qa/me/x.jpg
node tools/qa/chapter-check.mjs <chapter> --sizes all            # the acceptance check: 1080p, 720p, 4K, DPR 2
node tools/qa/perf.mjs <chapter>/<step> … --q high,ultra [--uncapped]
node tools/qa/transition.mjs <fromChapter>/<step> <toChapter>/<step>   # frame-sequence sheet + hitch check
tools/qa/sheet.sh out.jpg --cols 3 --tile 640 a.jpg b.jpg …            # contact sheet
node tools/qa/library-check.mjs [--base <production build>]            # the library level (demo volume `_demo`)
```

Routes: the full `<volume>/<chapter>/<step>` or the short `<chapter>/<step>` (default volume first, then the
others — `atom/quarks`, `_sandbox-ui/controls`); `chapter-check` takes `<chapter>` or `<volume>/<chapter>`.

**Three sizes (M3):** renders and interactions are verified at 1920×1080 (primary), 1280×720 and 3840×2160.
`chapter-check --sizes all` takes deep-link screenshots + a contact sheet and runs the console / layout /
text-size checks at all three, measures frame time at 1080p (≤ 8 ms) and at 4K (warn > 14 ms, fail > 16.6 ms),
and re-opens every step at 1920×1080 with deviceScaleFactor 2, failing if HUD node rectangles, probe positions
or the small-hit-target list differ from DPR 1 by more than 2 CSS px. Interaction tests run at the same three
sizes (`__app.locate` / `__ui.locate` return CSS px, so the same script works at any size and DPR).

`chapter-check` = deep link per step (screenshot + contact sheet) → sequential → seeded random access with
step spamming (second sheet for comparison) → frame time per step → leave/return ×3 leak check. It fails on any
console error/warning, wrong position, > 350 draw calls, > 1.5 M triangles, frame avg > 8 ms, leaks, or
third-party network requests; report in `<out>/<chapter>/report.json`. All tools assert that WebGL runs on the
NVIDIA GPU. Scripted pointer interaction: `--script file.mjs` exporting `default async (page) => {…}`; get
screen positions with `await page.evaluate(() => __app.project(x, y, z))`, then `page.mouse.move/down/up`.

Chrome is launched with `--use-angle=vulkan --enable-gpu --ignore-gpu-blocklist` (without
`--enable-features=Vulkan`, which makes headless Chrome lose every WebGL context ~1 s after load).

## 19. Do / don't

**Do**
- describe steps declaratively; test with `chapter-check` (random access + spamming) early;
- use palette tokens, `SEMANTIC`, K materials, `MOTION` presets, `ctx.random`, `ctx.tweens`;
- keep something moving in every shot (idle bob, drift, flow) — on the engine clock;
- put world labels on the overlay layer; give every interactable hover/press feedback and a tooltip;
- instance repeated geometry; `await ctx.breathe()` in long builds; fit the shadow frustum;
- keep all user-visible text in `content.ts`, Ukrainian, international term first, SI symbols in Latin.

**Don't**
- no `MeshStandardMaterial`/`MeshBasicMaterial`, no hard-coded hex colours or ad-hoc easings in chapters;
- no `Date.now`, `performance.now`, `setTimeout`, `setInterval`, `requestAnimationFrame`, `Math.random`;
- no imports from `@/engine/*` except `@/engine/api`; no imports between chapters; no editing outside your scope;
- do not add lights for ambience (tune `ctx.env`), do not toggle light visibility, do not touch
  `renderer` state, `scene.fog`, `scene.background` or the camera transform;
- do not rely on a previous step having run; do not keep state in module-level variables (a chapter can be
  created and disposed many times);
- no network requests, no remote fonts/CDNs (ARCHITECTURE §1).

## 20. Additions in F1b (look polish and robustness pass)

All additive; existing chapter code keeps compiling. Defaults changed where the look required it (noted).

**Depth of field (§9).** New `PostParams`: `dofNearMax` (0.3) caps the foreground circle of confusion as a
fraction of `dofMaxBlur`; `dofReference` (0 = auto: 2.2 × `ctx.env.setScale` radius) is the "overview"
distance at which DOF and tilt-shift reach full strength; `dofCloseup` (0.3) is the share of the aperture
left in the closest close-ups. Effect: close shots get mild DOF and no tilt-shift band without tuning;
overview shots keep the miniature look. Diorama mood defaults are calmer (`dofAperture` 1.0, `dofRange` 2.5).

**Colour discipline (§8).** `EnvParams` gained a mood grade: `gradeTint` (raw display-space RGB multiplier),
`gradeTintAmount`, `harmonyColor`, `harmony`, `accentColor`. With `harmony` > 0 the final pass pulls the frame
into a palette analogous to `harmonyColor`: other hues are desaturated and partly rotated toward it (greens
go olive, blues slate), luma is kept, `accentColor` hues are exempt. Set for `golden` (0.52), `dusk` (0.58),
`night` (0.35); zero for `day`, `studio`, `micro`, where palette tokens land exactly (`color-check.mjs`).
**Rule:** one dominant hue + 1–2 accents per shot. `chapter-check` measures it: a deep-link frame with more
than `--max-hues` (default 4) strong hue families (six 60° families, ≥ 8 % of the coloured pixels each) fails.

**Cel shading (§7).** `K.toon` / `K.metal` / `K.energy` now use three key-light bands by default:
shadow / half-tone / light (+ the highlight band). New params: `bands: 2 | 3` (3), `midThreshold` (0.42),
`midLevel` (0.5); `softness` default is now 0.035 (crisp, antialiased). Opt out for soft forms such as clouds
with `{ bands: 2, softness: 0.25 }`. Curved meshes need enough segments or the band edge shows the facets
(use ≥ 32 radial segments on hero forms).

**Terrain and strata (§7).** `K.toon({ layers, slope })`:
```ts
K.toon({
  layers: { stops: [[-99, 'bg.indigo'], [-2.3, 'wireBrown'], [-0.3, 'green'], [1.2, 'lime']],  // ≤ 8, ascending y
            wobble: 0.24, wobbleScale: 2.4, softness: 0, space: 'world' },                     // crisp 1-px borders
  slope: { color: 'slate', from: 0.8, to: 0.6 },   // steep faces (world normal.y below `to`) take this colour
});
```
Use height bands instead of vertex-colour gradients for terrain; borders stay one antialiased pixel wide at any
zoom. See `_sandbox-diorama/parts/island.ts` (`ISLAND_LAYERS`).

**Panels (§7, §14).** `K.hologram`: `fillOpacity` default 0.9 and new `backdropDim` (default 0.8; also a
tweenable property). Effective opacity = 1 − (1 − fillOpacity)·(1 − backdropDim) = 0.98: measured contrast of
`mist` body text over a pure white scene 7.6:1. Use `backdropDim: 0` only for decorative panels without text.

**World labels (§10).** `Text3D` with `screenSpace: true` never gets smaller than `minScreenPx` (default 16)
CSS px per em and has a dark halo by default (`halo: false` removes it).

**Shadows and grounding (§8).** `ctx.env.fitShadow(object, padding = 1.1, softness = 3)` fits the key-light
frustum to an object; `ctx.env.setGrounding(radius, strength = 0.55)` adds a soft contact shadow on the
`studio` floor disc (for low, wide bases); `ctx.env.subjectScale`. Shadow biases are now about one shadow
texel, so thin props keep a shadow that touches their base — fit the frustum tightly.
`worldBounds(object)` (from `@/engine/api`) = bounds of visible world-layer meshes only (labels and pick
proxies ignored); `camera.focusOn` and `fitShadow` use it.

**Runtime.** `engine.setQuality(tier)` / `__app.setQuality` now also end the session pin of a `?q=` flag.
Chapter transitions render three warm-up frames of the incoming scene behind the frozen picture before the
zoom starts; `transitionStart` (and `transition.phase === 'animating'`) fire after them. All post-pass
programs are compiled at start-up. `ctx.breathe()` guidance stands: it yields only when ≥ 7 ms of the current
slice are used and never in `?freeze` mode; shader programs of the new chapter are compiled with
`KHR_parallel_shader_compile` where the browser has it (WebKit, Chrome on GL/D3D) and synchronously otherwise.

**QA tools (§18).**
```bash
xvfb-run -a node tools/qa/xbrowser.mjs            # every step in Playwright Firefox + WebKit (Firefox needs a display)
node tools/qa/robustness.mjs [--only touch,focus,tiers,dynres,dpr]
node tools/qa/color-check.mjs                     # palette accuracy (dev server only)
QA_CHROME_ARGS="--use-gl=angle --use-angle=gl-egl --enable-gpu --ignore-gpu-blocklist --no-sandbox" \
  QA_ALLOW_SOFTWARE=1 node tools/qa/transition.mjs a/x b/y     # another GPU backend (async shader compile)
```
A third reference chapter exists: `app/src/volumes/_dev/chapters/_sandbox-studio/` (studio mood, product-shot framing).

## 21. Additions in M3 (pilot feedback; all backward compatible)

**Lint — chapter boundary.** `local/chapter-boundary` (`app/eslint-rules/chapter-boundary.js`) replaces the
`'../*/**'` pattern: a chapter's files may import each other at any depth (`steps/x.ts → ../parts/y` is fine,
no barrels needed); imports that leave the chapter directory (`../other/…`, `../../kit`) or reach into another
chapter (`@<volume>/chapters/<other>/…`) fail. Libraries are imported through `@/…` aliases; since M4 a chapter
may also import its own volume's `sim/**` and `content/**` (`@<volume>/sim/…`), and the companion rule
`local/volume-boundary` keeps volumes independent of each other and the platform free of volume names. Test:
`src/engine/__tests__/lint-chapter-boundary.test.ts`.

**Stage (§5).**
- `ctx.stage.scope` — the current step's `TweenScope` (same object as `info.scope`). Use it in control handlers
  and anything else that starts tweens / `delay()` later inside a step: it is killed on the next step change.
  Read it at call time (`ctx.stage.scope.delay(…)`), never cache it.
- Sub-states inside a step (a control shows / hides / changes something): `stage.toggle(actorOrObject, shown?,
  { instant? })`, `stage.shown(x)`, `stage.setParam(name, value, { duration?, ease?, instant? })`,
  `stage.setColor(name, colour, opts)`. The next step entry restores the declared state — no `leave()` clean-up.
  This is the sanctioned exception to "never animate a registered value yourself".
- A `pose` on an object that is also a `pop` / `grow` actor now scales the actor's full-size scale (the actor
  multiplies it by its visibility) instead of fighting over `object.scale`. `fade` / `none` / custom actors
  never touch scale.
- `StepSpec.envTune: EnvOverrides` — per-step environment overrides on top of `env` and the chapter base;
  applied on every entry, deep link included. `ctx.env.base(overrides)` (call once in the factory) sets the
  chapter-level look that every `set` / `tune` / step is layered on, so it survives deep links.

**Text (§10).** `Text3D` grows its glyph buffer safely when a longer text is assigned after the first render
(it used to vanish for good; no more `reserve` placeholders). New: `text3d.color = 'amber'` / `setColor(c)`
(base colour, lazy re-colour), read-only `fontSize` and `screenSpace`.

**Materials (§7).** `K.toon({ keepHue: true })` — emissive pixels above 1 keep their hue on screen (same maths
as `K.glow({ keepHue })`); the kit `window` material uses it, so lit windows stay warm / cool at night instead of
cream-white. `K.water({ followLook: true })` — the glint / tone pattern size follows
`env.setScale(r, { adaptFrom })` (world size = `scale × env.lookScale`, via `kGlobals.uKLookScale`). Opt-in; the
kit water helpers take `followLook` / `waterFollowLook`. **Convention:** `K.water` meshes are built in their
local XY plane and laid flat (`rotation.x = −π/2`); `scale` is in world units unless `followLook`.

**QA hooks (§17).** `ctx.qa.probe(name, objectOrPointOrGetter, { origin? })` → `__app.locate(name)` →
`{ x, y, visible, shown, world }` (CSS px of the current viewport, independent of DPR and render scale — the
same test works at 720p, 1080p and 4K; null if unknown). `ctx.qa.expose(name, () => state)` →
`__app.read(name)` for observable state. `__app.probes()` lists both. Cleared with the chapter; present in
production builds. `__app.textSizes()` → on-screen em (CSS px + px-eq) of every visible world `Text3D`.
Interaction tests must use these (and `__ui.locate` for HUD controls) and must pass against a production build:
`pnpm build && pnpm preview --port <port>` then run the test with `--port <port>`.

**QA tools (§18).**
- `shot.mjs --eval` prints the value (`eval → …`): an expression's value or what a statement body `return`s,
  e.g. `--eval "app.locate('rotor')"`.
- `chapter-check --sizes all` (1920×1080 + 1280×720 + 3840×2160, plus a DPR 2 pass; see §16, §18); SDF text
  magnified more than 4× the atlas (soft corners, typical for world text in 4K close-ups) is a warning.
- `chapter-check` adds per deep-linked step, at 1280×720 **and** 1920×1080: controls outside the viewport
  (`__ui.offscreen()`, skipped with a note while the HUD lacks the hook) and, at 1280×720, world text
  below `--min-text` (16) px-eq (`__app.textSizes()`; ui3d surfaces only through `__ui.worldTextSizes()` if the
  HUD offers it). `--skip layout` turns both off.
- A step over budget gets up to 3 confirmation samples, 4 s apart, before it is reported (sustained load from
  other agents' runs doubled 4K frame times for minutes at a time).
- Frame time is now the **minimum of `--perf-rounds` (3) interleaved passes** over all steps
  (`--perf-frames` 90 each), with the spread printed — other agents' GPU load inflates single samples ~2×.

## 22. Volumes (M4 — the project is a library of volumes)

Read `docs/VOLUMES.md` for the whole picture; this is what code needs to know.

**Where things live.** Platform (`@/engine`, `@/style`, `@/text`, `@/ui3d`, `@/hud`, `@/fx`, `@/kit`, `@/audio`,
`@/content`) knows no volume. Everything of one volume is in `app/src/volumes/<volume>/`:

```
volume.json            identity + journey order + groups (data; also read by vite, tools/content, tools/qa)
volume.ts              export default defineVolume(identity, { journey: { axis, emblems, layout }, glossary, theme, fixtures })
chapters.ts            one line, never edited (globs the chapter manifests into the chunk `volume-<id>`)
chapters/<id>/…        chapters
sim/core/**, sim/<chapter>/**      simulations of the volume
content/generated/<id>.json, <id>.manifest.json      generated by tools/content
```

Published volumes have an alias `@<volume>/…` (`@electricity/sim/atom`,
`@electricity/content/generated/atom.json`); it is one line in `tsconfig.json` → `paths` (vite derives its
aliases from the directory names). A chapter may import the platform and its own volume's `sim/**` and
`content/**` — nothing of another chapter or another volume (lint).

**Volume manifest** (`defineVolume(identity, spec)` → `VolumeManifest`): `id`, `title`, `subtitle`, `headline`
(the big line of the home screen: the title or the subtitle, `volume.json → headline`), `kicker`, `lead`,
`order`, `accent`, `emblem` (icon name), `status` (`published` | `draft` | `dev`), `listed`,
`journey { axis, groups, layout, planned }`, `glossary { scope }`, `theme` (default environment), `fixtures`.
`journey.axis`: `label`, `unit`, `hint`, `range` (from `volume.json`) and `min`, `max`, `origin`, `tick`,
`majorEvery`, `format(value)`, `ascending: 'out' | 'in'` (from `volume.ts`). A chapter's `axisValue` is a
number on this axis: it sets the node's height on the journey map and the zoom direction of transitions.
Electricity: scale, log₁₀ m, −18 … 6, zoom out when it grows. The demo volume: frequency, log₁₀ Hz.

**Library** (`engine.library`): `volumes` (registered, in order), `listed`, `defaultVolume`, `title`, `multi`
(more than one published volume), `get(id)`, `registry(id)` (the volume's chapter `Registry`, once loaded),
`load(id)` / `loadAll()` (lazy, once), `chapter(ref)`, `resolve(address)` / `resolveLoaded(address)`,
`showsLibrary(volumeId)`. Dev volumes (directory `_…`) are registered only with `?debug`; with `?debug` every
volume is loaded at boot.

**Addresses.** Step: `<volume>/<chapter>/<step>`. Chapter: `<volume>/<chapter>`. The short forms `<chapter>` and
`<chapter>/<step>` are resolved in the current volume, then the default volume (`library.json`), then the other
volumes — so `ctx.nav.goto('plants', 'gallery')` and old links keep working. A two-segment address whose first
segment is a volume id is `volume/chapter`; therefore a chapter of the default volume must not have the id of a
volume (logged as an error). Cross-reference targets in the generated content are always full addresses:

```ts
import { linkTarget } from '@/content';
const target = content.crossReferences?.flatMap((x) => x.targets).find((t) => linkTarget(t)?.chapterId === 'charge-field');
if (target && ctx.nav.locate(target)) void ctx.nav.open(target);   // only when that chapter exists in this build
```

**Progress and content keys.** `store.progress.visited` and the `@/content` helpers (`chapterProgress`,
`isVisited`, `loadContent`, glossary `alsoIn` / filters) use the content key `volume/chapter`
(`contentKey(chapterOrContent)`, `fullChapterId(manifest)`).

**HUD.** `hud.volume`, `hud.libraryLevel`. The library screen (`library` overlay, key `L`) and the in-volume
chrome that leads to it (volume name in the header, «Бібліотека» buttons, the glossary's scope switch) exist
only while `library.showsLibrary(volume)` — more than one published volume, or the volume on screen is a listed
dev volume. A single published volume looks exactly like a stand-alone course. Spine, journey map, home and
glossary are built per volume from `Journey` (`journey.volume` carries the axis, groups and layout hints).

**Starting a volume** (checklist with all steps: `docs/VOLUMES.md` §4): copy `volume.json`, `volume.ts`,
`chapters.ts` from `volumes/_demo/`, add the alias line to `tsconfig.json`, write the documents under
`docs/volumes/<id>/`, run `tools/content/regen.sh --volume <id>`.
