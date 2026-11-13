# DECISIONS — cross-cutting conventions (orchestrator rulings)

Binding for all content, UI and chapter code. Collected from agents' notes/requests; newest at the bottom.
If a chapter document contradicts this file, this file wins and the document must be fixed.

## Notation & language

1. **Energy symbol.** Electrical energy and work are `W` (ISO/IEC 80000-6): `W = P·t`, `W = C·U²/2`, `W = L·I²/2`,
   `W = q·U`. `E` is reserved for electric field strength. Canonical physics formulas keep their usual form:
   `E = h·ν`, `E = m·c²`, band gap `E_g`, kinetic energy `E_k`. EMF is written `EMF` (symbol `ℰ` only inside
   formulas, introduced once).
2. **Voltage symbol** is `U` in formulas (IEC); `V` is the unit. In named quantities from datasheets the
   international labels are kept as-is: `V_oc`, `I_sc`, `V_mp`, `I_mp`, `V_DC`.
3. **Term rule** (CURRICULUM top): international term/abbreviation/symbol first at first mention in a chapter,
   then the Ukrainian equivalent; SI unit symbols in Latin; decimal comma in Ukrainian prose; thousands
   separated by a thin/non-breaking space; `×10ⁿ` for powers of ten.
4. **Ukrainian terminology** — one variant course-wide: «розподільні мережі», «сила струму»/«струм», «напруга»,
   «опір», «потужність», «трансформаторна олива», «магнітна індукція» (B), «автоматичний вимикач» (MCB),
   «ПЗВ» (RCD), «заземлення», «реклоузер», «СІП», «ОПН», «припливний», «мультиплікатор» (wind gearbox),
   «бозон Гіґґса». Chemical elements in the atom builder: nomenclature name + substance in brackets
   («Купрум (мідь)»); in prose — substance names (мідь, кремній, залізо).
5. **Honesty labels.** Any slowed-down, scaled or simplified visual/model carries an on-screen chip
   («сповільнено ×N», «не в масштабі», «спрощена модель»).
6. **Superlatives and volatile statistics** always carry a year («станом на 2025 р.»); where sources disagree,
   use a range and avoid "the largest in the world" unless undisputed.
7. **Maps.** Ukraine is shown in its internationally recognised borders; no front lines or damage imagery.

## Colour (additions to STYLE_GUIDE §2.2 — already merged there)

8. Warning state `amber` (`ui.warning`); magnet poles N `coral` / S `blue`; DC poles + `coral` / − `blue`;
   plant-type palette `plantType.*` (see STYLE_GUIDE). Transformer windings: primary `coral`-tinted copper,
   secondary `sky`-tinted copper. In-world SCADA screens may use the real dispatcher convention (red = closed /
   energised, green = open) only if a hotspot explains it.

## Models

9. **One frequency model** for `grid` and `plant-future`: АЧР (UFLS) starts at 49,0 Hz; FCR fully activated at
   ±200 mHz deviation within 30 s; normal band ±50 mHz; reference incident 3000 MW (Continental Europe).
10. **Shared simulation library.** Cross-chapter models (DC circuit MNA solver, grid frequency/swing model,
    PV I-V model and sun position, battery OCV/CC-CV/pack, SPWM/THD, hybrid-home 24 h energy flow, load
    profiles) live in `app/src/sim/` as pure, unit-tested TypeScript and are reused by chapters; chapter
    documents' control-point values are the test fixtures.

## Shared world

13. **One house.** The house in `home`, `distribution` (service entrance) and all four labs is the same
    cutaway house model from the kit («дім-лабораторія»), with the labs' shared fictional equipment: 440 W PV
    module «ЛМ-440», 6 kW hybrid inverter «ЛІ-6», 10,24 kWh LFP battery. Generic, never real brands.
14. Authors' reference implementations of the lab models (Python) are kept in `tools/ref-models/` as test
    oracles for the simulation library.

## Semiconductors (after review R1)

15. Depletion region = «збіднена область» everywhere (`matter`, `lab-pv`, `lab-inverter`).
16. Band diagrams: valence band `violet`, conduction band `sky`, band gap dark (`bg.deep`); electrons `cyan`,
    holes `coral` — identical in `matter` and `lab-pv`.
17. Built-in potential keeps its international label `V_bi` (same rule as `V_oc`, `I_sc` — DECISIONS §2).
18. Typography is normalised by script on all chapter documents after the reviews are merged (apostrophe ’,
    non-breaking space between number and unit and in thousands groups, «…» with „…“ inside).

## Structure

11. Chapter step counts in the design documents supersede the CURRICULUM outline (authors added/split steps).
12. Cross-references between chapters use chapter id + step id (``→ `grid/frequency-balance` ``); reviewers
    verify that the target exists.

## After reviews R3+

19. AVR: «AVR (automatic voltage regulator) — автоматичний регулятор напруги»; for large synchronous
    generators add once «(у великій енергетиці — АРЗ, автоматичний регулятор збудження)».
20. «відгалуження» (not «відпайка») for transformer taps; `p.u.`, `rpm`, `tan` as international notation.
21. Cross-chapter fixes requested by reviewers are collected from `docs/audits/review-R*.md` and applied in one
    reconciliation pass after all reviews are merged (agent `E1-reconcile`), together with the typography pass.
22. Grid-forming inverter = «мережоформувальний інвертор»; grid-following = «мережевідомий інвертор».
    Frequency nadir = «надир частоти (nadir) — найнижча точка провалу» (not «дно частоти»).
23. Non-breaking spaces between number and unit are used everywhere on-screen, including inline formulas.
24. **Shared lab equipment — battery side (one definition for all four labs).** Battery: LFP 16S, 51,2 V × 200 Ah =
    10,24 kWh, built from two 100 Ah modules in parallel; BMS continuous limit 200 A (1C), recommended 100 A (0,5C).
    Hybrid inverter «ЛІ-6»: 6 kW AC continuous, 12 kW peak for 10 s; battery port 135 A continuous (the limiting
    element, ≈ 6,9 kW DC), 250 A peak for 10 s; PV inputs 16 A operating / 20 A short-circuit per MPPT.
25. String inverter = «стрінговий інвертор»; PV string = «стрінг (ланцюжок модулів)». SPD = «ПЗІП (пристрій
    захисту від імпульсних перенапруг)»; «ОПН» only for HV surge arresters.
26. Steam parameters: «докритичні / надкритичні (SC) / ультранадкритичні (USC)»; pressure ratio = «ступінь
    підвищення тиску»; feedwater heater = «підігрівник»; CCS = «уловлювання та зберігання вуглецю».
27. Fuel cell = «паливна комірка» everywhere (avoids confusion with nuclear «тепловидільний елемент»).
28. Plant flexibility figures (ramp rate, minimum load, start-up time) are owned by the hub `plants/flexibility`;
    `grid` and the plant chapters quote the hub ranges (old vs modern units stated explicitly).
29. Every chart, lane, chip and map marker that encodes a plant type uses `plantType.*` (STYLE_GUIDE §2.2) in
    all plant chapters, `grid` and `plants`.
30. «лампа розжарення» (once: «або жарівка»); no-load = «неробочий хід» (first mention: «неробочий (холостий) хід»).
31. Named laws and scientists: first mention international-first («Ohm's law — закон Ома», «Maxwell's equations —
    рівняння Максвелла»), afterwards Ukrainian with normal declension; never Latin name + Ukrainian ending.
32. Greek mu `μ` (U+03BC) for micro and permeability, never the legacy micro sign `µ` (U+00B5).
33. Panel copy term order is always «**International term** — український відповідник» at first mention; the
    reconciliation pass converts any chapter still using the reverse order.
34. Duck curve = «качина крива (duck curve)»; FCR = «резерв підтримання частоти (FCR)»; black start = «пуск
    «з нуля» (black start)»; steam = «пара» (feminine). Grid-forming stays «мережоформувальний» (§22) — replace
    «мережоутворювальний» wherever it appears.
35. Run-of-river = «ГЕС на стоку (run-of-river)»; «руслова ГЕС» is a layout term and is not a synonym.
    Potential energy `E_p`, kinetic `E_k` (canonical mechanics symbols, like §1 exceptions).
36. Nuclear chapter colour code: nuclear energy / chapter accent / radioactivity marker `violet`
    (`plantType.nuclear`); core and pool glow `sky`→`white` (never `cyan`, which is the electron); neutrons
    `mist`→`steel`. Status frames on maps use `amber`, not pulsing `red`.
37. GSU = «блочний трансформатор (GSU)» (not «блоковий»). The reference 1000 MW unit generator is 24 kV, 26,7 kA
    everywhere (`generator-ac`, `transformer`, `transmission`, `home` finale, plant chapters).
38. Reactive / charging current is drawn as `sky` dashed pulses (token `flow.reactive`); reverse active power
    flow keeps the energy colour `yellow` with reversed chevrons — never a new hue.
39. Each chapter document ends with a «Перехресні посилання» section (chapter id + step id); builders turn
    them into in-app links.
40. «оливний трансформатор», «трансформаторна олива» (never «масляний»). Tidal range = «величина припливу»
    (not «амплітуда»); spring / neap tide = «сизигійний / квадратурний приплив».
41. Simulation fixtures are taken from the *reviewed* documents on `main` (reviewers changed several models:
    wind wake and shear, tidal barrage, coal efficiency, combined cycle, `plant-future` M4, hydro M2/M6,
    transformer Т1, `distribution` Р5/Р6/Р8, `lab-hybrid-home` self-sufficiency), never from authors' originals.

## After reconciliation E1 (proposals N1–N9 ruled)

42. (N1) Non-breaking spaces apply to on-screen copy; «Модель симуляції» and «Примітки щодо фактів» sections use
    plain spaces so fixtures stay grep-friendly.
43. (N2) Nested quotes: „…“ inside «…». The «…» that delimit a panel page or hotspot text in the documents are
    delimiters, not copy — content is taken from the generated export (`docs/chapters/_export/<id>.json`), which
    strips delimiters and promotes inner quotes correctly; builders never retype or hand-copy Ukrainian text.
44. (N3) «спад напруги», «синхроноскоп», «швидкість зміни навантаження» (ramp rate), «чисте (залишкове)
    навантаження» (net load); BESS = «акумуляторна система накопичення енергії (СНЕ)», with one mention in
    `plant-future` that Ukrainian law calls it «установка зберігання енергії (УЗЕ)».
45. (N4) Symbols: half-life `T½`, solar constant `G_sc`, stored heat `W_th`; standard electrode potential `E°` and
    particle / level energies keep `E`.
46. (N5) Durations after a number: `s`, `min`, `h`; «доба», «рік», «р.» stay Ukrainian.
47. (N6) PV string = «стрінг» in running text too; «ланцюжок» only for cells inside a module / battery cell chains.
48. (N7) `docs/chapters/_shared-house.md` owns appliance nameplates, circuits and lab equipment;
    `lab-hybrid-home` §M2 owns the 24 h profiles.
49. (N8) `INDEX.md`, `GLOSSARY.md` and `_export/*.json` are generated, never hand-edited; `tools/content/doccheck.py`
    must be green before any change to `docs/chapters/` is merged.
50. (N9) Semiconductor colours: donor atoms (P) and n-region tint `teal`; acceptor atoms (B) and p-region tint
    `pink`; electrons `cyan`, holes `coral` (unchanged). Same in `matter`, `lab-pv`, `lab-inverter`.
51. The course has **25** chapter modules (12 on the main path incl. the `plants` hub, 9 plant types, 4 labs) and
    267 steps; earlier documents that say 26 are wrong.

## After Phase 2 (kit, UI, fx)

52. The shared house follows the kit model `cutawayHouse` (`docs/KIT_API.md`): a spine wall with six showcase
    rooms facing the cut; the storage room («комора») is a lab niche in the hall and the balcony is on the east
    wall. Where `_shared-house.md` or a chapter document describes the layout differently, the kit layout wins;
    device ids in the house equal the simulator ids.
53. Chapter text at runtime comes from `app/src/content/generated/<id>.json` (generated from the export) through
    `defineContent()`; UI through `stepUi(ctx)` (`docs/UI_API.md`); effects from `@/fx` (`docs/FX_API.md`);
    models from `@/kit` (`docs/KIT_API.md`); physics from `@/sim/<id>`.

## Term rule revised by the user (2026-11-13 evening) — supersedes §3 (term order), §31, §33 and the
## "international first" wording wherever it appears

54. **Terms are written in plain Ukrainian.** The earlier "international term first" principle is withdrawn:
    it made the copy read English-first. On screen (panel pages, titles, hotspot and callout names, chips,
    control labels, quiz, facts, misconceptions):
    a. Use the Ukrainian term alone: «кварки», «змінний струм», «напруга», «вітрова турбіна». No
       «English — українською» pairs, no English term in front, no English in parentheses by default.
    b. An international **abbreviation** stays only where there is a real need — it has no established Ukrainian
       equivalent and is what the learner will actually see on devices, datasheets and in apps (BMS, MPPT, PWM,
       LED, SOC, DoD, LFP, NMC, HVDC, IGBT, MOSFET, USB-PD, GaN …). Form at first mention in a chapter:
       Ukrainian explanation first, abbreviation in parentheses — «система керування батареєю (BMS)»; after
       that the abbreviation alone may be used.
    c. Where an established Ukrainian abbreviation exists (ПЗВ, АЕС, ТЕС, ГЕС, ГАЕС, ВЕС, СЕС, ЛЕП, ТП, ККД, ЕРС,
       КЗ, АПВ, АЧР, ОЕС, ПЗІП, СІП, ОПН, КВВП, ВВЕР), use it. Add the international one in parentheses once
       only if the learner meets it on real equipment or documents: «ПЗВ (на корпусі — RCD)», «змінний струм
       (AC)», «постійний струм (DC)».
    d. Named laws and scientists: Ukrainian only — «закон Ома», «рівняння Максвелла», «межа Беца».
    e. Proper names stay as they are (ENTSO-E, ITER, Schuko, Europlug, Type F); reactor/technology type codes
       follow (b)/(c): «водо-водяний реактор під тиском (PWR; у нас — ВВЕР)».
    f. **Unchanged:** symbols, formulas and units stay international (U, I, R, P, W, cos φ; V, A, Ω, W, kWh, Hz),
       with all typography rulings (§18, §23, §32, §42, §43, §46).
    g. Structured data keeps both forms: the «Терміни» lines, the «Глосарій розділу» tables and the hotspot
       name pairs in the documents still carry the international equivalent as data. The app **displays** the
       Ukrainian name (plus «(ABBR)» when the international form is an abbreviation kept under (b)/(c)); the
       glossary is sorted by the Ukrainian term and shows the international equivalent as a secondary line.
    h. Labels that builders author themselves in chapter code (callouts, console titles, button text) follow
       the same rule.
55. (replaces §25 and §47 on this point) PV string = «ланцюжок модулів»; at its first mention in a chapter:
    «ланцюжок модулів (стрінг)», because installers and inverter labels say "string". «стрінговий інвертор» stays
    as the established name of the product type. Glossary rows use «ланцюжок модулів».
56. Spelling: «ефект Ферранті». VSC = «перетворювач напруги (VSC)». Appliance names in the shared house are
    Ukrainian («Роутер і оптичний модем», «Світлодіодне освітлення»); device ids in code do not change.

## Mobile target (user decision, 2026-11-13 evening)

57. **Desktop stays exactly as built and planned; in addition the app adapts automatically to tablets and
    phones, portrait included.** Adaptation is done centrally by the engine and the HUD (form factor,
    layouts, quality tier, camera fit, touch), not by per-chapter special cases. Chapters make that possible by
    following the **mobile rules**:
    a. Everything a learner must read or operate lives in the HUD: step panel, control dock, `board`. Text
       in the 3D world is limited to short labels; consoles/cards in the world use the world-console preset
       (which re-homes to the HUD on phones) — never hand-built text panels.
    b. No hover-only information or action. Every interaction works with one finger; drag handles and
       tappable objects are ≥ 44 px on screen; nothing needs precision finer than ~24 px.
    c. Controls are declared through `stepUi` (no custom panels), most important control first.
    d. Camera shots declare what must stay in frame (subject bounds), so the director can re-frame for any
       aspect ratio; no shot may depend on a 16:9 window.
    e. Scenes honour the quality tier: particle counts through the tier budgets, kit `low`/detail options and
       optional set-dressing keyed to the tier, so a `mobile` tier can run them.
    f. No ad-hoc viewport or user-agent checks in chapters — only the engine's `device` state and HUD APIs.
    g. Mobile test profiles (phone portrait 390×844 and 360×800, phone landscape 844×390, tablet 820×1180 and
       1180×820, touch-only) join the standard QA once the mobile foundation (agent F5) lands; until then
       builders follow rules a–f and test on desktop sizes.

## Encyclopedia readiness (user decision, 2026-11-13 evening)

58. **The project is structured as a library of volumes («томи»); electricity is volume 1.** The user wants the
    option to grow the course into an interactive 3D encyclopedia (radio, microprocessors, geodesy and GNSS,
    cars, aircraft, the internet …) with the same depth. No second volume is being built now, but nothing in
    the architecture or the process may assume a single course:
    a. **Identity.** Every chapter belongs to a volume; the full id is `<volume>/<chapter>`, the step address is
       `<volume>/<chapter>/<step>`. Volume 1 is `electricity`. Routes are `#/<volume>/<chapter>/<step>`; the old
       two-part form redirects to `electricity`. Progress, settings scoped to content, glossary entries and
       cross-references use the full id.
    b. **Layout.** Shared platform code (engine, style, text, ui3d, hud, fx, kit, audio) is volume-agnostic.
       Volume-specific code and data live under one directory per volume: its manifest (title, accent, journey
       axis, order), chapters, simulations and generated content; its documents live under one directory
       per volume as well (curriculum, chapter scripts, exports, glossary, index). Tools take the volume as a
       parameter.
    c. **Navigation.** Above the per-volume «Мапа подорожі» sits a library level that lists volumes. While only
       one volume exists the library is skipped and the app opens that volume's map, exactly as today. The
       journey map takes its axis (for electricity: scale in metres), grouping and layout hints from the volume
       manifest, so another volume can use another axis (frequency, abstraction level, time).
    d. **Shared knowledge.** A chapter has one home volume; other volumes may link to it (cross-references
       already use full ids) and later list it as a guest node. Foundational chapters (`atom`, `matter`,
       `charge-field`) are expected to be shared.
    e. **Visual language.** The palette and the engine materials are global. The semantic colour code of
       STYLE_GUIDE §2.2 is the electricity volume's code plus a global core (interactive affordance, warning /
       ok / alarm, heat / cold); each new volume adds its own semantic table without redefining the core.
    f. **Process.** The production pipeline is per volume and repeatable: curriculum → chapter scripts → review
       → reconciliation → simulations → pilot chapters → chapter production → refinement → audits, with
       briefs parameterised by volume. `docs/VOLUMES.md` describes how to start a volume.
    g. **Naming.** «Від електрона до розетки» is the title of volume 1. The umbrella name of the library is a
       configuration value, to be chosen by the user when a second volume starts.

    **Implementation notes (agent M4-volumes; details in `docs/VOLUMES.md`, `docs/reports/M4-volumes.md`).**
    Paths named in earlier rulings moved with the volume: `docs/chapters/…` → `docs/volumes/electricity/chapters/…`,
    `docs/CURRICULUM.md` / `docs/GLOSSARY.md` → `docs/volumes/electricity/…`, `app/src/content/generated/<id>.json`
    → `app/src/volumes/electricity/content/generated/<id>.json`, `@/sim/<id>` → `@electricity/sim/<id>` (§53),
    `app/src/chapters/<id>` → `app/src/volumes/electricity/chapters/<id>`. Choices made while implementing:
    - volume 1: id `electricity`, title «Електроенергія», subtitle «Від електрона до розетки»
      (`app/src/volumes/electricity/volume.json`; `headline: "subtitle"` keeps the home screen and the splash
      as they were); the library title is `app/src/volumes/library.json → title` (null = that headline);
    - manifest fields `scaleLabel` / `scaleExp` became `axisLabel` / `axisValue` (the axis belongs to the volume);
    - the library level (library screen, volume name in the header, «Бібліотека» buttons, glossary scope
      switch) is shown only with more than one published volume — or inside a listed dev volume, so it can
      be tested; `?debug` alone does not change how volume 1 looks;
    - dev volumes: a directory name starting with `_` (`_demo`, `_dev`), status `dev`, registered only with
      `?debug`; a volume in the making uses status `draft`;
    - a short chapter id resolves in the current volume, then the default volume, then the others; a volume id
      must not equal a chapter id of the default volume;
    - simulations are per volume, `sim/core` included; a model needed by two volumes is promoted to the
      platform on request;
    - saved progress moved to the key `electricity:v2` (full chapter ids); the `v1` record is migrated once
      and left in place.

59. **The interface is ordinary 2D web UI (HTML/CSS), not WebGL.** User, 2026-11-13 ≈23:55, verbatim: «Зараз в
    проекті є багато 2D UI. Наприклад, я зараз на першому кроці в Мікросвіті. Блок справа з інформацією (котрий
    починається з "Усе складається з атомів"), блок зліва вгорі з назвою розділу і кроку, сервісні і меню кнопки
    справа вгорі, шкала масштабу, перемикач кроків - все це варто робити в 2D звичайними веб браузерними
    техніками, і щоб текст виділявся. Зроби цю зміну для усієї системи.» This withdraws PLAN §1/§4 "UI integrated
    into the 3D scene (panels, buttons, sliders, charts are WebGL objects)".
    a. **Scope:** every piece of interface that is not part of the 3D world — header, step panel and its
       sections, system buttons and menus, scale spine, step navigator, dock controls, boards (charts, tables,
       readouts), tooltips, toasts, hotspot cards, the journey map's panels and cards, home, library, glossary,
       settings, help, loading screen, touch shells (F5). The 3D world (scenes, the journey map's world of
       platforms) stays WebGL.
    b. **Text:** selectable and copyable («щоб текст виділявся»), crisp at any DPR and browser zoom, real DOM
       text (screen readers, find-in-page, translation tools).
    c. **Look:** keep the style guide (palette tokens, fonts, panels, motion); the change is the technique, not a
       redesign. Desktop layout as now; phones/tablets per §57 with CSS.
    d. **Chapters do not change:** the declarative chapter API (`stepUi`, `board`, `visible`, `ctl-<id>`, hotspots,
       links) and the QA hooks (`__ui.*`) keep their meaning, so existing chapters and their interaction tests
       keep working. Anything a chapter must change is listed by the design and done by the platform.
    e. **Open for the design (D0):** in-scene labels and callouts anchored to 3D objects (DOM overlay vs WebGL),
       world consoles that are part of a prop, migration order, feature flag, framework choice. Decided by the
       orchestrator from D0's proposal; questions of taste go to the user.
    f. **Process (user, same message):** «Пам'ятай про те, що ти - оркестратор, планувальник і аудитор. Для
       кожної задачі запускай субагента на opus-5-5 high effort.»
    **Design settled (orchestrator, 2026-11-14, from D0-hud-dom's proposal; design `docs/HUD_DOM.md`).**
    g. **Technique:** `@/hud-dom`, vanilla TypeScript + CSS, no UI framework; one fixed layer `#kd-hud` over the
       canvas with five sub-layers (world, chrome, popups, modal, tip); plates take pointers, the rest passes to
       the scene.
    h. **Units and tokens:** CSS lengths are px-equivalent units × `--u` (= `HudMetrics.pxPerUnit`); colours, type
       scale, radii and motion are CSS variables generated from `@/style` and `UI`; no hard-coded colours.
    i. **Fonts and icons:** the same families as WOFF2 subsets served from the app origin (OFL, `THIRD_PARTY.md`);
       icons from the same definitions as CSS masks.
    j. **In-scene text:** callouts, hotspot markers and cards, journey-map labels and 3D tooltips become DOM,
       projected per frame; `Text3D` and world consoles stay WebGL; `hudSurface` is replaced by a DOM `hudLayer`.
       On phones a world console steps aside when the dock already shows the same value, else it gets an optional
       declarative spec, else it stays in the scene.
    k. **Charts:** Canvas2D for marks, DOM for all text; the chart API for chapters is unchanged; the platform
       ports the six custom chapter widgets and the atom scale ruler.
    l. **Motion:** choreography on the engine clock (deterministic QA); CSS transitions only for micro-interactions,
       off under `?freeze` and reduced motion.
    m. **Migration:** hybrid flag `?hud=dom|gl` (default `gl` until cut-over); work packages D1–D9
       (`docs/HUD_DOM.md` §16); D1 starts after F5-mobile is in `main`; the WebGL HUD is deleted only after the
       user has reviewed the before/after sheets.
    n. **Reading level:** the DOM step panel carries the «Просто / Докладно» switch; copy comes only from L1's
       selector (`docs/briefs/L-simple-level.md`).
    o. **Open taste questions for the user** (until answered, today's look is kept): Q2 scan band and animated
       grain on panels → static faint grain?; Q3 no perspective tilt on panels, only slight sideways parallax?;
       Q6 behaviour at 200 % browser zoom (Q3 settled by p below); Q8 wording when a step has no simple layer; Q9 calmer glow on DOM
       panels vs pushing it toward the WebGL bloom.
    p. **No 3D effects on 2D interface (user, 2026-11-14 ≈00:45, verbatim):** «ти намагався повторити мікро рухи
       HUD/UI за курсором. не треба цього робити. усе що справжнє 2D - не треба намагатись додати до нього ефекту
       3D». So the interface has no pointer parallax or any cursor-following micro-movement, no perspective tilt,
       no fake depth; it moves only when it changes state (reveal, conceal, transitions). This settles Q3 (no tilt
       and no parallax) and applies to the current WebGL HUD as well (its pointer parallax is removed). 3D effects
       stay where things are really 3D: the scenes and the journey map's world.
