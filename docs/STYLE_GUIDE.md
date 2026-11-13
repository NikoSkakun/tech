# STYLE GUIDE — visual, motion, UI and audio bible

Binding for every agent. Reference: the *feeling* of Kurzgesagt (flat, saturated, friendly, clever, alive),
translated into real-time 3D at AAA polish. We are inspired by the style; we do not copy their characters,
logos or specific artwork. When in doubt: **simpler shapes, richer colour, more life, smoother motion.**

The engine exposes these rules as code (`style/` tokens, materials, sky presets, lighting rigs, motion
presets). Always use the tokens; never hard-code ad-hoc colours or easings in chapter code.

## 1. Pillars

1. **Readable first.** Every frame must explain something. One clear focal point; supporting detail recedes
   (darker, desaturated, blurred by DOF). Colour encodes meaning consistently across the whole app.
2. **Flat-shaded 3D, not realistic.** Smooth, rounded, chunky geometry; cel-banded soft lighting; coloured
   shadows; no photo textures, no PBR realism, no noisy normal maps. Detail comes from *layered simple
   shapes* (panel lines, bolts, vents, railings, ladders, windows, cables), not from textures.
3. **Alive.** Nothing is static: idle bobbing, breathing, drifting particles, blinking indicator lights,
   tiny birds/clouds/people for scale in dioramas. Every interactable reacts to hover and press.
4. **Polished.** No popping, no z-fighting, no aliasing crawl, no clipped text, no default-looking anything.
   Every appearance/disappearance is animated. 60 fps.
5. **Technically honest.** Stylised ≠ wrong. Proportions may be toy-like, but structure, order of
   components, flow directions and physics must be correct.

## 2. Colour

### 2.1 Core palette (token → hex)

Backgrounds (deep space/indigo family — the canvas of the whole app):
`bg.void #070A1F`, `bg.deep #0D1136`, `bg.indigo #1A1657`, `bg.violet #2E1F7A`, `bg.plum #4A2A8F`

Accents (saturated, slightly warm; use 1 dominant + 1–2 supporting per shot):
`cyan #2DE2E6`, `teal #1CC8A5`, `green #7BE36B`, `lime #C6F24E`, `yellow #FFD23F`, `amber #FFB02E`,
`orange #FF8A3D`, `coral #FF5E5B`, `red #F0355C`, `pink #FF6FB5`, `magenta #E34BD0`, `violet #8E5CF7`,
`blue #3D7BFF`, `sky #6EC6FF`

Neutrals: `white #F6F3FF`, `mist #C9C6EA`, `steel #8D8FB8`, `slate #4B4F7A`, `ink #1B1D3A`

Each accent has derived `*.light` (+18 % L, −8 % S) and `*.dark` (hue shifted ~12° toward violet, −30 % L)
variants for cel bands; shadows always shift toward indigo/violet, never toward grey/black.

### 2.2 Semantic colour code (never violate — this is the visual language of the library)

The palette (§2.1) and the engine materials are global. The semantic code has two layers (DECISIONS §58 e):
a **global core** that means the same in every volume, and one **semantic table per volume** for the things
that volume is about. A volume's table adds meanings; it never redefines the core, and a token that the core
uses for a state (cyan = "you can touch this", green / amber / red = ok / caution / alarm) keeps that meaning
wherever it is used as a state signal.

#### 2.2.1 Global core (all volumes)

| Meaning | Colour |
|---|---|
| Interactive affordance | `cyan` outline/glow + cursor change; selected = `yellow` |
| Safe / OK / efficiency | `green` |
| Warning / caution state (UI gauges, status) | `amber` (token `ui.warning`); OK = `green`, alarm = `red` |
| Danger / fault / loss | `red` (pulsing) |
| Heat | `orange`→`red`; hot steam `white`+`pink` tint |
| Cold / water / coolant | `blue`/`sky`; wet steam/vapour `white`/`mist` |

#### 2.2.2 Volume 1 «Електроенергія» (`electricity`)

| Meaning | Colour |
|---|---|
| Electron / negative charge | `cyan` (glowing) |
| Proton / positive charge / hole (h⁺) | `coral` |
| Neutron / neutral | `mist`→`steel` |
| Up quark / down quark / gluon | `amber` / `violet` / `lime` springy |
| Photon / light | `yellow`→white, wavy |
| Electric field **E** | `amber` |
| Magnetic field **B** | `magenta` |
| Current / energy flow (power) | `yellow` pulses (brightness ∝ power) |
| Voltage / potential | ramp `blue` (low) → `pink` → `coral` (high) |
| Fuel (coal, gas, biomass) | `ink`/`slate`, gas `violet`-tinted |
| Three phases L1 / L2 / L3 | `yellow` / `green` / `red` (A-B-C convention used in UA power engineering) |
| Home wiring L / N / PE | brown `#B5651D` / `blue` / green-yellow stripes (IEC 60445) |
| Li⁺ ion | `lime` |
| Magnet poles N / S | `coral` / `blue` |
| DC poles + / − (batteries, HVDC) | `coral` / `blue` |
| Reactive / charging current | `sky` dashed pulses (token `flow.reactive`); reverse active flow = `yellow` with reversed chevrons |
| Semiconductor doping | donor atoms / n-region `teal`; acceptor atoms / p-region `pink` |
| Band diagram | valence band `violet`, conduction band `sky`, gap `bg.deep` |
| Nuclear | nuclear energy / radioactivity marker `violet`; core and pool glow `sky`→`white` |

Plant-type colours for charts, stacked areas, map chips (token group `plantType.*`, constant across the app):
nuclear `violet`, coal `slate`, CHP `steel`, gas `pink`, hydro `blue`, pumped storage `sky`, wind `teal`,
solar `amber`, biomass/biogas `green`, geothermal `orange`, ocean `cyan`, BESS `lime`, fuel cells / H₂ `mist`,
import/export `white` with `sky` outline, load shedding = `red` hatching.

A new volume writes its own table as §2.2.3, §2.2.4 … (and, where chapters need tokens for it, a token group
in `app/src/style` next to `SEMANTIC`) when its curriculum is reconciled — see `docs/VOLUMES.md` §4.

### 2.3 Chapter moods

Each chapter gets an accent + sky preset: micro-world chapters live in deep violet/indigo "inner space"
with soft bokeh, drifting motes and nebula gradients; machine chapters (magnetism, generator,
transformer, labs) in a clean "studio" void with a soft floor disc and gradient backdrop; diorama chapters
(plants, transmission, grid, distribution, home) are floating islands / tabletop worlds with gradient sky
(day, golden hour, dusk, night variants), stylised clouds, layered distant silhouettes and tilt-shift DOF.

## 3. Shape language & modelling

- Rounded and chunky. **Every hard edge is bevelled/rounded** (rounded boxes, capped cylinders, lathe
  profiles with fillets). Silhouettes read at thumbnail size.
- Proportions: slightly exaggerated (thicker pipes, bigger bolts, shorter towers) for charm and legibility.
- Detail hierarchy: primary form (1 colour) → secondary forms (2–3 colours) → tertiary accents (small
  emissive lights, stripes, labels). At least three levels on any hero object.
- Machines get cutaways (animated clipping or removable shells) to show internals; internals are colour
  coded by function per §2.2.
- Nature: trees = rounded blobs/cones on short trunks; clouds = merged soft spheres; water = flat stylised
  surface with gentle shader waves, foam rings and gradient depth; terrain = smooth low-frequency forms
  with layered colour bands; islands have a sculpted underside.
- People/animals (for scale and charm): very simple capsule figures, small birds; never detailed faces.
- Particles are *characters*: electrons, protons, photons, ions have consistent shapes and glows everywhere.
- No visible polygon faceting on curved hero surfaces (enough segments, smooth normals). Flat facets only
  where intentional (crystals, low-poly rocks).

## 4. Lighting, materials, post

- Lighting rig per mood: soft key (warm white) + sky/hemisphere fill (indigo/violet) + coloured rim light.
  Shadows: soft, tinted `bg.indigo`, never black. Subtle ambient occlusion in contact areas only.
- Materials (engine-provided): `K.toon` (2–3 soft cel bands + rim + optional object-space vertical gradient),
  `K.glow` (emissive, bloom-driving; for particles, plasma, indicators), `K.glass` (tinted translucent, fresnel
  edge, no real refraction needed), `K.metal` (toon with a sharp stylised specular streak), `K.water`,
  `K.energy` (animated flowing stripes/pulses along UVs for cables, pipes, beams), `K.hologram` (UI panels).
- Post stack (order fixed by engine): AO (subtle) → bloom (soft, wide, threshold so only emissive/`K.glow`
  blooms) → DOF or tilt-shift (dioramas; focus on the subject) → colour grade (slight lift in shadows toward
  violet, gentle S-curve, vibrance) → vignette (soft) → film grain (very subtle, animated) → AA.
  Chromatic aberration only during transitions. No lens dirt, no heavy motion blur.
- Bloom is seasoning: emissive elements glow; white surfaces must not blow out.

## 5. Motion

- Camera: always eased (`cinematic` = cubic/quintic in-out), 1.2–2.4 s for shot changes, slight overshoot-free
  settle, subtle continuous drift/breathing when idle. Orbit by the user is damped and constrained to the
  shot's range. Never cut; chapter changes use the engine's scale-zoom transition.
- Objects appear with scale-up + `back.out` overshoot (0.35–0.6 s), staggered 30–80 ms; disappear faster
  (0.2–0.3 s, `power2.in`). State changes interpolate; numbers count up.
- Flows (electrons, water, steam, energy pulses) loop seamlessly; speed and density map to real quantities
  where a simulation drives them (more current → faster/denser/brighter).
- UI: hover = 120 ms lift/glow, press = 80 ms squash, release = spring. Panels open 0.35 s with slight tilt.
- Respect `reducedMotion` setting (shorter camera moves, no parallax, no shake).

## 6. UI — diegetic, in-scene

- **All UI is rendered in WebGL** as part of the 3D world (SDF text + shader panels), in two layers:
  (a) *world-anchored*: labels, callouts with leader lines, hotspots, gauges and control consoles attached
  to objects; (b) *camera-anchored HUD*: holographic panels floating in front of the camera with slight
  perspective tilt, depth layering and pointer parallax. HTML is allowed only for the boot loader and for
  accessibility/fallback plumbing (invisible live region, native file/fullscreen APIs).
- Panel look ("hologlass"): rounded rectangle (radius 16–24 px eq.), `bg.deep` at 78–88 % opacity with
  subtle vertical gradient, 1.5 px inner border in the chapter accent at 60 % → fading, soft outer glow,
  faint animated scan/grain. Depth: title chips and buttons float a few mm above the panel.
- Typography: display = rounded bold geometric with Cyrillic (headings, numbers); body = highly legible
  humanist sans with Cyrillic; mono/math = for formulas and units. Sizes (px-equivalent at 1080p):
  hero 56–72, H1 34–40, H2 24–28, body 18–20, caption 14–15 (never smaller). Line length ≤ 46 characters
  in side panels; line height 1.35–1.5. Text is `white`/`mist` on dark panels; key terms highlighted in the
  chapter accent; formulas in `yellow` on a darker inset; numbers/units never wrap apart (non-breaking).
- Controls: big, tactile, toy-like: pill buttons, round icon buttons, sliders with a glowing track and a
  chunky knob (value bubble while dragging), toggles, segmented tabs, steppers. Minimum hit target 44 px eq.
- Icons: simple geometric, 2 px eq. stroke or solid, drawn procedurally (SDF/geometry), consistent set.
- Information density: a step's side panel shows ≤ ~450 characters per page; more depth lives in
  hotspots/expandable cards ("Детальніше"), glossary, and "Цифри і факти" chips.
- Every interactive 3D object shows affordance: gentle pulsing outline or handle glyph in `cyan`, cursor
  change, tooltip on hover with its name; drag handles show direction arrows.
- Layout is responsive: wide (≥16:10) = side panel right, stepper bottom, spine left; narrow/portrait =
  panel docks to bottom third, spine collapses into the map button. Safe margins 3 % of the short side.

## 7. Audio (procedural, WebAudio; off until first user gesture; mute toggle always visible)

Soft UI ticks/pops, whoosh on transitions, low evolving ambient pad per mood, pitched "sparkle" for
electrons/energy, mains hum (50 Hz + harmonics, very subtle) where thematically relevant. Master ≤ −14 LUFS
feel; nothing harsh. Sound is seasoning, never required for understanding.

## 8. Quality bar checklist (self-review on screenshots before you call anything done)

- [ ] Clear focal point; colour code per §2.2; background recedes.
- [ ] No hard-edged primitive looks "default" (bevels, segments, shading bands OK).
- [ ] ≥ 3 levels of detail on hero objects; something moves in every shot.
- [ ] Text fully legible at 1280×720 and 1920×1080; no overlaps, no clipping, no orphan units.
- [ ] Hover/press feedback on every interactable; affordances visible.
- [ ] Transitions in/out are animated; step can be entered from any other step and by deep link.
- [ ] No z-fighting, shadow acne, banding, bloom blow-out, aliasing shimmer.
- [ ] Frame time within budget; no console errors.
