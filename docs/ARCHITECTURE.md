# ARCHITECTURE — requirements, boundaries, contracts

This file fixes *what must be true*. The concrete TypeScript API is finalised by the engine agents and
documented in `docs/ENGINE_API.md` (authoring guide for chapter builders, with runnable examples).
If the two disagree, ENGINE_API.md describes reality and this file describes intent — report the mismatch.

## 1. Stack & hard constraints

- Vite + TypeScript (`strict`), three.js (WebGL2 `WebGLRenderer`; no WebGPU dependency), pnpm.
  Pin exact dependency versions. Before using any library API, check the installed version's actual
  source/typings in `node_modules` — do not trust memory for recent three.js/postprocessing changes.
- **No runtime network dependencies**: no CDNs, no remote fonts, no analytics. Everything is bundled or in
  `app/public`. The app is served over plain HTTP on a LAN (`http://<host>:8080/`) — do not rely on
  secure-context-only APIs (WebGPU, service workers, clipboard, SharedArrayBuffer).
- Licences: MIT/Apache/BSD/OFL/CC0 only; record every third-party asset in `docs/THIRD_PARTY.md`.
- Browsers: current Chrome, Edge, Firefox, Safari. **Desktop is the primary target and stays as designed; the
  app also adapts automatically to tablets and phones, portrait included** (user decision 2026-11-13;
  DECISIONS §57 mobile rules; `docs/MOBILE.md` once agent F5 delivers it).
  Pointer Events for mouse + touch + pen. Keyboard navigation for step flow.
- No external 3D model/texture files: geometry, materials and effects are procedural (code + shaders).
  Small generated lookup textures (ramps, noise) are fine.
- Test resolutions (user requirement 2026-11-13): every chapter is rendered, checked and interaction-tested at
  1280×720, 1920×1080 and **3840×2160** (plus 1920×1080 at device pixel ratio 2).
- Performance budget (RTX 5060, quality `high`): avg frame ≤ 8 ms at 1920×1080 and ≤ 14 ms at 3840×2160; ≤ 350 draw calls and
  ≤ 1.5 M triangles per chapter view; chapter chunk ≤ ~350 kB gzip; initial load (engine + home) ≤ ~900 kB gzip.
  Quality tiers `low | medium | high | ultra` scale DPR, shadows, post effects and particle counts; auto-pick
  on first run from a quick GPU benchmark, user-overridable, persisted.

## 2. Repository layout

The project is a **library of volumes** (DECISIONS §58, `docs/VOLUMES.md`). Platform code is volume-agnostic;
everything that belongs to one volume lives in one directory per volume, in the app and in the documents.

```
app/
  index.html, vite.config.ts, package.json, tsconfig.json
  public/fonts/…                 self-hosted fonts (Latin + Cyrillic + Greek + math/symbol coverage)
  src/
    main.ts                      boot
    ── platform (alias `@/…`; knows nothing about any particular volume) ──
    engine/                      renderer, post pipeline, quality, clock, loop, resize, input/raycast,
                                 camera director, chapter runtime, router, transitions, store, debug API;
                                 volume model: volume.ts (manifest), library.ts (registry of volumes),
                                 registry.ts (chapters of one volume), discover.ts (globs)
    style/                       palette tokens, K.* materials, sky/backdrop presets, light rigs, motion presets
    text/                        SDF text primitive + rich-text mini-markup
    ui3d/                        widget kit: panel, button, slider, toggle, tabs, stepper, callout, tooltip,
                                 chart, gauge, formula, layout
    hud/                         main HUD, library screen, journey map, settings, glossary, onboarding
    fx/                          particles, flow-along-curve, field lines, arcs, steam/smoke, water, glow, trails
    kit/                         parametric model kit (islands, trees, clouds, buildings, pipes, tanks, pylons,
                                 wires, transformers, generators, turbines, houses, people, birds…)
    audio/                       procedural WebAudio
    content/                     content types, defineContent, lazy loader, glossary aggregation, progress,
                                 uk-locale formatting (no volume data)
    ── volumes ──
    volumes/
      library.json               library config: umbrella title (null → the only published volume), default volume
      <volume>/                  one directory per volume; alias `@<volume>/…` for published volumes
        volume.json              identity (id, title, subtitle, order, accent, status) + journey order, groups,
                                 parents — the one file also read by vite.config.ts, tools/content and tools/qa
        volume.ts                volume manifest (`defineVolume`): journey axis, formatter, map layout hints,
                                 glossary scope, default environment
        chapters.ts              one line, never edited: globs the chapter manifests into the volume's lazy chunk
        chapters/<id>/           one directory per chapter (auto-discovered; nothing else imports it)
          index.ts               chapter manifest (lightweight; loaded with the volume's manifest chunk)
          scene.ts (+ parts/…)   heavy scene code (lazy chunk `chapter-<volume>-<id>`)
          content.ts             all Ukrainian text of the chapter (from `content/generated/<id>.json`)
          emblem.ts              optional tiny model for the journey map (lightweight)
        sim/                     pure-TS, unit-tested simulation models of the volume: sim/core/** (shared
                                 inside the volume) and sim/<chapter-id>/**; no three.js imports
        content/generated/       <id>.json, <id>.manifest.json — generated by tools/content (never edited)
        fixtures/                optional dev data (`?fixture`: full-size journey / glossary before chapters exist)
      electricity/               volume 1 — «Електроенергія. Від електрона до розетки» (alias `@electricity/…`)
      _demo/                     dev-only demo volume (two placeholder chapters, another journey axis)
      _dev/                      dev-only pseudo-volume: the `_sandbox-*` chapters of the platform agents
docs/
  *.md                           platform documents (this file, STYLE_GUIDE, ENGINE_API, UI_API, VOLUMES, …)
  volumes/<volume>/              documents of one volume
    CURRICULUM.md                curriculum (hand-written)
    chapters/<id>.md             chapter scripts (hand-written) + `_shared-*.md`, `_notes-*.md`
    chapters/_export/<id>.json   machine-readable export (generated)
    INDEX.md, GLOSSARY.md        step index and glossary of the volume (generated)
    terms_allowlist.tsv          optional per-volume additions to tools/content/terms_allowlist.tsv
tools/
  content/                       document pipeline; every tool takes `--volume <id>` (default: library.json)
  qa/                            QA tools; routes are `<volume>/<chapter>/<step>` or `<chapter>/<step>`
```

A directory under `volumes/` whose name starts with `_` is a **dev volume**: it is registered only with
`?debug`, its manifest and chapters stay in lazy chunks that a production session never requests, and it never
appears in production navigation.

Ownership: `engine/`, `style/`, `text/` → F1; `ui3d/`, `hud/`, `content/` → F2; `fx/`, `kit/`, `audio/` → F3;
`volumes/<volume>/chapters/<id>/` → that chapter's builder; `volumes/<volume>/sim/**` → the volume's simulation
agents; `volumes/<volume>/volume.*` → the orchestrator. Nobody edits outside their scope; needs go to
`docs/requests/`.

**Imports.** A chapter may import the platform (`@/engine/api`, `@/style`, `@/text`, `@/ui3d`, `@/hud`, `@/fx`,
`@/kit`, `@/audio`, `@/content`) and its **own** volume's `sim/**` and `content/**`
(`@electricity/sim/atom`, `@electricity/content/generated/atom.json`). It never imports another chapter or
another volume (lint rule `local/chapter-boundary`). Platform code never imports `volumes/**` by name — volumes
are discovered with `import.meta.glob`.

## 3. Chapter system (the core contract)

- **Volumes** (DECISIONS §58, `docs/VOLUMES.md`): the library is a set of volumes; every chapter belongs to
  one. A volume is declared by `volume.json` (identity, groups, journey order — plain data) and `volume.ts`
  (`defineVolume`: journey axis and formatter, map layout hints, glossary scope, default environment). The
  full chapter id is `<volume>/<chapter>`, a step address is `<volume>/<chapter>/<step>`; chapter ids are
  unique inside a volume only. Volume manifests are tiny and eager (dev volumes `_…`: lazy, `?debug` only);
  the chapter manifests of a volume load as one lazy chunk when the volume is first needed.
- **Auto-discovery**: volumes register via `import.meta.glob('../volumes/*/volume.ts')`, chapters via the
  volume's `chapters.ts` (`import.meta.glob('./chapters/*/index.ts', { eager: true })`).
  Adding a chapter = adding a directory. There must be no shared registry file that builders edit.
- **Manifest** (`index.ts`, tiny): `id`, `order`, `group` (one of the volume's groups — electricity:
  `micro | em | plants | grid | home | labs`), optional `parent` (plant types are children of `plants`; labs
  children of `home`), `title`, `subtitle`, `axisLabel` (the chapter's place on the volume's journey axis as
  shown, e.g. `10⁻¹⁰ m`), `axisValue` (the same as a number on that axis — electricity: log₁₀ of the size in
  metres), `theme` (accent token, sky preset, mood), ordered `steps` (id + title + short blurb only — enough
  for menus/map), `load: () => import('./scene')`, optional `emblem`. The `volume` is the directory: discovery
  binds it, authors do not write it.
- **Scene** (lazy chunk) is created with a `ChapterContext` giving access to engine services (renderer info,
  camera director, input, ui3d factory, fx, kit, audio, store, nav, clock, quality, disposables tracker).
  It exposes: async `init()` (may report progress), `enterStep(stepId, info)` , `update(dt, t)`, `dispose()`.
- **Random access is mandatory**: `enterStep` must produce the correct scene state from *any* previous
  state (including none — deep link — and mid-transition interruption). Model each step as a declarative
  target state (visibility, poses, camera shot, simulation params, UI) and tween toward it; never rely on
  having played previous steps. Rapid step spamming must not break state.
- **Time**: all animation runs on the engine clock (`dt`, `t`), which can be paused/stepped/scaled by the
  debug API for deterministic QA. No `Date.now()`/`setTimeout`-driven animation in chapters.
- **Disposal**: everything a chapter allocates (geometries, materials, textures, render targets, listeners,
  audio nodes) is released on `dispose()`; the context's tracker makes this automatic when used.
- **Chapter transitions** are engine-owned and universal: any step → any step of any chapter of any volume
  with a direction-aware zoom, preloading the target chunk, never showing a blank frame. Inside a volume the
  direction follows the journey axis (electricity: zooming out when moving up in scale, in when going down);
  between volumes a later volume is entered zooming in. Within a chapter, steps are continuous camera moves + state tweens.
- **Routing**: hash deep links `#/<volume>/<chapter>/<step>`; back/forward work; the last position is
  persisted (globally and per volume). Links from before the library of volumes (`#/<chapter>/<step>`) still
  work: the chapter is looked up in the default volume first and the address is rewritten. `#/<volume>`
  enters a volume where the user left it. All asset and route handling is relative (`base: './'`, hash
  routes), so the build works from any sub-path or inside an app shell.
- **Simulations** (circuit solvers, grid frequency model, PV/battery/inverter models, 24 h home sim) are pure
  TypeScript modules without three.js imports, unit-tested with vitest, driven by UI params, rendered by the
  scene. Physical formulas and constants are cited in comments.

## 4. Engine services (summary of responsibilities)

- **Render pipeline**: main scene pass + camera-space HUD pass composed so HUD receives bloom/grain but can
  opt out of DOF; post stack per STYLE_GUIDE §4 with per-chapter/per-step parameters tweenable.
- **Camera director**: named shots (position/target/fov/DOF focus), eased moves, constrained damped orbit and
  zoom around the current shot, "focus on object" helper, idle drift, shot-safe framing that accounts for HUD
  panels occupying part of the viewport (subject stays in the free area at any aspect ratio).
- **Input**: unified pointer raycasting for world and HUD layers (HUD first), hover/press/drag/wheel/pinch,
  cursor management, keyboard map (←/→ steps, M map, Esc back, F fullscreen), focus handling.
- **Library / registry**: the registered volumes and, per volume, the chapters in journey order
  (`engine.library`); short chapter ids resolve in the current volume, then the default one, then the others.
- **Store**: small observable state (current volume/chapter/step, transition state, settings, progress,
  quality). Progress is keyed by full chapter id; persisted under `electricity:v2` (a `v1` record from before
  the library of volumes is migrated into the default volume on first load).
- **Debug/QA API** (`window.__app`, enabled always but inert unless called): `ready` promise, `goto(ch, step,
  {instant})` (short or full chapter id, or one step address), `setTime/pause/step`, `stats()` (frame times, draw calls, triangles, memory counts),
  `listVolumes()`, `listChapters()`, `setQuality()`, `errors()` (captured console errors/warnings). URL flags: `?q=<tier>`,
  `?noaudio`, `?debug`, `?freeze=<seconds>` (deterministic clock for screenshots).

## 5. QA tooling (`tools/qa/`, runs on lenovo, Playwright + system Chrome with GPU)

Chrome must be launched with `--use-angle=vulkan --enable-gpu --ignore-gpu-blocklist` (do **not** add
`--enable-features=Vulkan`: in headless mode it makes every WebGL context get lost and restored ~1 s after load)
(verified: renders on the RTX 5060; without flags it silently falls back to SwiftShader — always assert the
`UNMASKED_RENDERER_WEBGL` string contains `NVIDIA`).

- `shot.mjs` — screenshot of a route (size, quality, freeze time, optional scripted interactions) → JPEG.
- `chapter-check.mjs <id>` — every step by deep link and by sequential + random navigation; fails on console
  errors/warnings; saves a screenshot per step and a contact sheet; records perf per step; leak check
  (enter/leave ×3, compare `renderer.info.memory`).
- `perf.mjs` — frame-time statistics per route/quality.
- `sheet.sh` — ImageMagick montage → one contact-sheet image (so reviewers read 1 image, not 12).
- `library-check.mjs` — the library level against the dev-only demo volume: library screen, entering a volume,
  cross-volume link, per-volume progress, glossary scope, legacy links, storage migration, and (against a
  production build) that no dev-volume code is requested without `?debug`.

Routes given to the tools are `<volume>/<chapter>/<step>` or the short `<chapter>/<step>`; `chapter-check`
takes `<chapter>` or `<volume>/<chapter>`.

## 6. Deployment

`tools/deploy.sh` builds `main` (`pnpm build`) and rsyncs `app/dist/` → `/srv/electricity/www/app/`
(nginx, port 8080, gzip, long-cache hashed assets, no-cache `index.html`). Only the orchestrator deploys.
