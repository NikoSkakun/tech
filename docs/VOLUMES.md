# VOLUMES — the project as a library of volumes

Decision: DECISIONS §58. The project is an interactive 3D **library**; a **volume** («том») is one subject
taught as a journey of chapters. Volume 1 is `electricity` — «Електроенергія. Від електрона до розетки». More
volumes (radio, microprocessors, geodesy and GNSS, cars, aircraft, the internet …) are added by *adding a
volume*, never by restructuring. This file says what is shared, what belongs to a volume, how the pieces are
named, and how to start a volume. Code-level API: `docs/ENGINE_API.md` §22, `docs/UI_API.md` §11.

## 1. Names and addresses

| Thing | Form | Example |
|---|---|---|
| volume id | kebab-case Latin; a leading `_` marks a dev-only volume | `electricity`, `_demo` |
| chapter id | kebab-case, unique **inside its volume** | `atom` |
| full chapter id (content key) | `<volume>/<chapter>` | `electricity/atom` |
| step address | `<volume>/<chapter>/<step>` | `electricity/atom/quarks` |
| route | `#/<volume>/<chapter>/<step>` | `#/electricity/atom/quarks` |

- Inside a volume the short forms `<chapter>` and `<chapter>/<step>` stay valid everywhere — chapter code
  (`ctx.nav.goto('grid', 'grid-intro')`), chapter documents (`` `grid/grid-intro` ``), QA commands
  (`chapter-check atom`). A short chapter id is looked up in the current volume, then in the default volume,
  then in the others. A reference **into another volume** is always written in full
  (`` `electricity/atom/ions-photons` `` in a document, `ctx.nav.open('electricity/atom/ions-photons')` in code).
- Old links `#/<chapter>/<step>` keep working: they resolve in the default volume and the address bar is
  rewritten. Because a two-part address whose first part is a volume id means `volume/chapter`, **a volume id
  must not equal a chapter id of the default volume** (checked at startup, logged as an error).
- The names a learner sees — volume title, subtitle, group names, axis words — live in the volume's
  `volume.json` and nowhere else. The umbrella name of the library is `app/src/volumes/library.json → title`;
  while it is `null` the default volume's headline is shown (splash, browser tab, library screen).
- Progress, last positions, glossary records and cross-references use full ids. Saved data from before the
  library (`electricity:v1`) is migrated into the default volume on first load.

## 2. What is shared and what is per volume

| | Shared by all volumes (platform) | Per volume |
|---|---|---|
| Code | `app/src/{engine,style,text,ui3d,hud,fx,kit,audio,content}`, `app/public/fonts` | `app/src/volumes/<volume>/`: `volume.json`, `volume.ts`, `chapters.ts`, `chapters/<id>/`, `sim/`, `content/generated/`, optional `fixtures/` |
| Documents | `docs/*.md` (ARCHITECTURE, STYLE_GUIDE, ENGINE/UI/FX/KIT API, DECISIONS, AGENT_GUIDE, CONTENT_EXPORT, this file), `docs/briefs/` | `docs/volumes/<volume>/`: `CURRICULUM.md`, `chapters/<id>.md` (+ `_shared-*.md`, `_notes-*.md`), `chapters/_export/` (generated), `INDEX.md`, `GLOSSARY.md` (generated), optional `terms_allowlist.tsv` |
| Visual language | palette, K materials, environments, motion, UI kit; the **global core** of the semantic colour code (STYLE_GUIDE §2.2.1) | the volume's semantic table (STYLE_GUIDE §2.2.2 for electricity), its accent and default environment |
| Navigation | library screen, HUD, glossary overlay, journey-map renderer | journey axis (label, unit, range, formatter, zoom direction), groups, map layout hints, emblems, home-screen text |
| Tools | `tools/content/*` (take `--volume`), `tools/qa/*`, export schema, global `terms_allowlist.tsv` | journey order / groups / parents / extra documents / extra checks in `volume.json` |
| Rules | AGENT_GUIDE, term rule (DECISIONS §54), mobile rules (§57), honesty chips, QA budgets | rulings that concern one subject (recorded in DECISIONS, marked with the volume) |

`sim/**` is per volume on purpose (a chapter may import only its own volume's simulations). When a second
volume needs a model that already exists in another one, promote that model to the platform through a
request — do not import across volumes (lint `local/volume-boundary` forbids it).

A chapter has one home volume. Other volumes link to it with a full address; listing a chapter of another
volume as a guest node on a journey map is not implemented yet (§58 d) — the data model (`VolumeManifest.
journey.planned`, full ids everywhere) leaves room for it.

## 3. How the library behaves

- **One published volume** (today): there is no library level. `#/` opens the volume's home screen over its
  journey map, exactly as a stand-alone course. No volume name in the header, no «Бібліотека» button, the
  glossary has no scope switch, the key `L` does nothing.
- **More than one published volume**: `#/` still restores the last position; the header names the volume, the
  system row and every home screen have «Бібліотека», the glossary can be widened to the whole library, and
  the library screen lists the volumes (emblem, title, subtitle, progress, size). Entering a volume resumes it
  where it was left; a first visit lands on its home screen.
- **Volume status** (`volume.json → status`): `published` — in production; `draft` — a volume in the making,
  registered only with `?debug` (flip to `published` when it ships); `dev` — development only, directory name
  starts with `_`, its manifest and chapters are lazy chunks that a production session never requests.
  `listed: false` keeps a registered volume off the library screen.
- **Dev volumes**: `_demo` («Радіохвилі» — two placeholder chapters, frequency axis, own documents and
  glossary, a link into `electricity`) proves the library level and is what `tools/qa/library-check.mjs`
  drives; `_dev` holds the platform sandboxes (`_sandbox-*`). Inside a listed dev volume the library chrome is
  shown, so it can be developed and tested before a second real volume exists.
- **Loading**: volume manifests are tiny and in the entry chunk; the chapter manifests of a volume are one
  lazy chunk (`volume-<id>`), each chapter scene another (`chapter-<volume>-<id>`).
- **Hosting**: asset URLs are relative (`base: './'`) and routes are hash routes, so the same build works from
  the web root, from a sub-folder (`/library/app/`) or inside an app shell (verified by the M4 report).

## 4. Starting a new volume — checklist

The production pipeline is the one volume 1 went through (PLAN §4–§8), parameterised by the volume id.
`<v>` is the new id. Every brief named here is reused as it is: give the agent the volume id in its prompt
(«Volume: `<v>`»); agent ids and scratch directories get the volume in their name (`C-<v>-1`, `B-<v>-<chapter>`).

**0. Decide the identity** (orchestrator with the user): id, title, subtitle, accent, emblem icon, the
journey axis (what does "up" mean for this subject — scale, frequency, time, level of abstraction?), the
groups (parts). Check the id against the chapter ids of the default volume. If this is the second published
volume, choose the umbrella title of the library (`library.json → title`).

**1. Skeleton** (orchestrator or a short `M`-type agent; ~30 minutes):
- `app/src/volumes/<v>/volume.json` — copy `_demo/volume.json`; set `status: "draft"`, the axis words, groups
  (`label`, optional `short`, `part` = the title of the part in the documents), the planned `journey`
  (chapter ids in order with group and optional parent), `docs.extra` (shared documents such as
  `_shared-*.md`), `docs.checks` (reference-model checks to run in `doccheck`).
- `app/src/volumes/<v>/volume.ts` — copy `_demo/volume.ts`; define the axis (`min`, `max`, `origin`, `tick`,
  `majorEvery`, `format`, `ascending`), emblems per group, layout hints, default `theme`.
- `app/src/volumes/<v>/chapters.ts` — copy unchanged. Add `"@<v>/*": ["./src/volumes/<v>/*"]` to
  `app/tsconfig.json → paths` (vite picks the alias up from the directory name).
- `docs/volumes/<v>/CURRICULUM.md` (start from the structure of volume 1's), empty `chapters/`.
- STYLE_GUIDE §2.2: reserve the volume's semantic table (filled in at step 4).

**2. Curriculum and chapter scripts** — brief `C-content` (several agents, one group of chapters each):
`docs/volumes/<v>/CURRICULUM.md`, then `docs/volumes/<v>/chapters/<id>.md` in the document format that
`tools/content/doccheck.py --volume <v>` enforces (header with the axis field named in `volume.json →
axis.label`, steps, panel pages, terms, glossary, quiz, cross-references).

**3. Review** — brief `R-review` (independent reviewers per group: facts, pedagogy, language, consistency).

**4. Reconciliation** — brief `E1-reconcile`: one agent rules on the reviewers' proposals, unifies terms and
ids, writes the volume's rulings into DECISIONS and its semantic colour table into STYLE_GUIDE §2.2.x, then
`tools/content/regen.sh --volume <v>` until `doccheck[<v>]: ALL GREEN`. Term rule check: brief `T-terms`
(global allowlist `tools/content/terms_allowlist.tsv`; words only this volume needs go to
`docs/volumes/<v>/terms_allowlist.tsv`).

**5. Simulations** — brief `S-sim`: pure TypeScript models with unit tests in
`app/src/volumes/<v>/sim/core/**` and `sim/<chapter>/**`, each with a README for the chapter builder;
reference models (if any) under `tools/ref-models/` and listed in `volume.json → docs.checks`.

**6. Platform gaps** — whatever the subject needs that the platform lacks (kit models, effects, widgets, a new
emblem, semantic tokens) is requested from the platform owners (`F3`/`F4`-type briefs); nothing volume-specific
goes into `app/src/{engine,hud,…}` — the platform reads it from the volume manifest.

**7. Pilot chapters** — brief `B-chapter`, two or three chapters that stress different parts of the platform.
Until the volume is published it is visible only with `?debug`: `#/<v>/<chapter>/<step>`,
`node tools/qa/chapter-check.mjs <v>/<chapter> --sizes all`. Fold the pilots' requests back into the platform
(as `M3-core` did) and record the changes in `docs/API_CHANGES.md` before mass production.

**8. Production** — brief `B-chapter` for every remaining chapter (parallel agents), mobile rules included
(DECISIONS §57). Merge gate per chapter: typecheck, lint, tests, build, `chapter-check --sizes all`, the
chapter's interaction test, `doccheck`.

**9. Refinement and audits** — visual refinement passes on the built chapters, then the audits volume 1 has
(content against documents, physics / facts, accessibility and mobile profiles, performance budgets, bundle
sizes), plus `node tools/qa/library-check.mjs` (library level) and a before/after sweep of the *other* volumes
(a new volume must not change them).

**10. Publish** — `volume.json → status: "published"`, set `order`; if the library now has two published
volumes the library level switches itself on (review the library screen and the in-volume chrome at all test
sizes). Deploy.

## 5. Rules of thumb

- Platform code never names a volume (lint: `local/volume-boundary`); a volume never imports another volume;
  a chapter imports the platform and its own volume's `sim/**` and `content/**` only.
- Anything a volume wants to look or read differently is a field of its manifest, not an `if (volume === …)`.
- Text of the volume shell (titles, group names, axis words, home-screen lines) is data in `volume.json`;
  chapter text comes from the documents through `tools/content` — never typed in code.
- A change to the platform is verified against **every** volume: `pnpm test`, `chapter-check` of the sandboxes
  and of at least the pilots of each volume, `ui-check`, `library-check`, `doccheck` (all volumes by default).
- Dev volumes must stay cheap and green: `_demo` is part of the test surface (`doccheck`, `library-check`).

## 6. Not built yet (deliberately)

- Guest nodes: showing a chapter of another volume on a journey map (shared foundations such as `atom`,
  `matter`, `charge-field` — §58 d). Today other volumes link to them.
- A dedicated backdrop / 3D shelf for the library screen: it reuses the journey map of the volume on screen
  as its backdrop. Worth designing when the second real volume is near.
- Releasing the HUD views (map, spine, home, glossary) of volumes the user has left: they are built once per
  visited volume and kept. Fine for a handful of volumes; revisit before the library has many.
- Per-volume settings: all settings are global today (quality, sound, text scale, motion).
