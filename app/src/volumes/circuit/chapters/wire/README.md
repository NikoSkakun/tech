# Chapter `circuit/wire` — «З чого зроблений дріт?»

Script: `docs/volumes/circuit/chapters/wire.md` (path format). Six steps on the lower floors of the copper world
(`@circuit/shared/copper`, README there). All reader text comes from the generated content; the scene addresses
the script's «Підписи» by position (`caption(step, i)`, pinned by `__tests__/manifest.test.ts`).

## Files

| File                                    | What                                                                                                                                                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `index.ts`                              | manifest (from `wire.manifest.json`), lazy scene                                                                                                                                                                                           |
| `content.ts`                            | runtime content + `caption(step, i)`                                                                                                                                                                                                       |
| `chapter.ts`                            | `STEP_IDS`, the `Chapter` / `StepModule` contract, session memory of reached goals                                                                                                                                                         |
| `world.ts`                              | mounts the composed world (`@circuit/shared/world`: stand + copper, flights through the lens); `state(floor, lamp, camera)` (world params `deep` / `closed` / `lens`, shot names), `go`, `between`, `name` — every mount detail lives here |
| `scene.ts`                              | orchestrator: world → step factories → `stage.define` + `stepUi.define` → update routing                                                                                                                                                   |
| `steps/01-atoms.ts` … `06-plastic.ts`   | one factory per step: input, probes, stage state, UI (controls, callouts, goal), update                                                                                                                                                    |
| `parts/proxies.ts`                      | invisible pick balls for the atoms of the focal plane (exact hover / click per atom)                                                                                                                                                       |
| `parts/electron-proxies.ts`             | moving pick balls on the 32 focus electrons (`restless`)                                                                                                                                                                                   |
| `parts/ring.ts`                         | the hover ring «this one can be taken»                                                                                                                                                                                                     |
| `qa/interactions.mjs`, `qa/helpers.mjs` | the pointer-driven test of every goal (below)                                                                                                                                                                                              |

## Steps

| Step          | Floor · lamp · shot                          | What the reader does → goal                                                                                                                                                                                                                                                                                      | Captions                                                                                                                                 |
| ------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `atoms`       | rows · on · `rows`                           | from the prologue: the whole dive (`world.flyIn`); the focus ring on the lens «Глибина» (lens mode all step; marks деталь · ряди, rail 0…2; sway over the atoms); hover swells a ball, click chooses it and makes it the hero; the middle ball pulses every 3.2 s until then; goal: a ball touched at the rows                                        | ring mark «ряди кульок» → «ряди атомів»; «атом» over the chosen ball at the takeaway                                                    |
| `inside-atom` | atom · on · `atom` → `apart`                 | dock slider «Розсунути атом» → `atom.apart` (eased); the camera follows the slider between `atom` and `apart`; goal: slider ≥ 0.97 once                                                                                                                                                                          | «ядро», «ядро збільшено», «електрони» at the takeaway                                                                                    |
| `outer`       | atom · on · `atom`                           | drag any electron (29 moving proxies, hover ring): a near one gives and springs back, the outer one comes off (`atom.hold`); goal: a near one pulled ≥ 0.55 and released + the outer one freed, any order; 2.6 s after the takeaway the outer one comes home                                                     | «ближній електрон» on the near one in hand / under the pointer; «зовнішній електрон» on hover, in hand, or once the near attempt is done |
| `shared`      | rows · on · `one` → `pair` → `row` → `piece` | dock button «Додати атоми»: `atoms` 1 → 2 → 5 → 15, `sim.shared` 0 → 1, camera steps back; the dock note names the stage («один атом» …); goal: the piece                                                                                                                                                        | «вільні електрони» in a gap of the piece at the takeaway                                                                                 |
| `restless`    | rows · **off** · `gate`                      | click a free electron (32 moving proxies, hover ring) → `copper.marked`, counts reset; goal: ≥ 10 each way after marking                                                                                                                                                                                         | «позначений електрон»; counts above the frame (scene) and in the dock («ліворуч» / «праворуч», from `sim.gate`)                          |
| `plastic`     | rows · off · `lens-start`                    | drag anywhere moves the lens with the hand (up = toward the sheath, half a screen ≈ copper → plastic); once on entry the lens lifts a little and settles (affordance); goal: ≥ 2 s over the plastic, then back on the copper; 3.5 s after the takeaway the world flies back to the stand, the lens to its holder | «мідь», «пластик» → «мідь — провідник», «пластик — ізолятор» at the takeaway                                                             |

Every step re-derives its state in `enter` (deep links = the frame a reader arrives at); goals reached are kept for
the session (`chapter.ts`), like the panel's takeaway. Transitions: depth tweens of 1.6–2 s with the camera
(VISUAL §3, ≤ 2.2 s); frame strips `/srv/electricity/qa/B-circuit-wire/strips-*.jpg`.

## What is simplified or stubbed (honest list)

- **The world** is `B-circuit-prologue`'s `shared/world`; it owns env, post, the lamp's light below and the drift
  (`world.drift = 0` here: chapter 1 shows no common drift). The entry dive runs only when the chapter is entered
  from the prologue (the store still names it while this scene builds); a deep link lands on the rows directly.
- **The touched atom is the hero** (`copper.hero = site`): the dive opens it, nothing moves on the rows floor; deep
  links and the steps from `shared` on use the middle atom (`hero = 0`; switched on the atom floor, where it is
  invisible).
- **Counts within two** with the lamp off: `sim.gate.balance = 1` (the library's model); the counts stand only in
  the scene, above the frame, with their arrows — no dock readout (one place for the two numbers).
- **«де ми»**: the platform's `floorLadder` with `floorLabel` names, shown whenever the reader is below the stand.
- **`shared` opens** on the lone atom and a faint breathing outline where the next one will stand (shot between
  `one` and `pair`), so the frame reads as «one, and room for more» and points at «Додати атоми».
- No drift with the lamp on in `atoms` … `shared` (the library shows drift only from chapter 4).

## QA

- `node app/src/volumes/circuit/chapters/wire/qa/interactions.mjs --port <port> --size 1280x720 [--out <dir>]`
  (frozen clock, `?hud=dom`; every goal by real pointer input, takeaways, «Докладніше», «Згадайте», closing card,
  console clean).
- Strips of transitions: `/srv/electricity/qa/B-circuit-wire/strip.mjs` (needs `freeze=0`: `freeze=N` makes the app
  simulate N s on every step entry; `--only prologue/map>atoms` for the entry dive), `close-strip.mjs` (closing
  flight), `frames.mjs` (hover rings, electron and lens in the hand).

## Sliders scrub (DECISIONS §60 p, UI_API §3.3)

- `atoms` the focus ring «Глибина» on the lens IS the dive, as in `prologue/dive` (F-lens-ring): range 0…2 on the
  world's rail (0 the lens over the wire · 1 «деталь» · 2 the rows), two named marks; a drag along it calls
  `world.scrub`, a click / mark / key / wheel `world.travelTo`; the marker is `world.position`. From the takeaway
  the last mark reads «ряди атомів». A drag on the atoms (their proxies pass lens mode's drag on) sways the camera.
- `inside-atom` «Розсунути атом»: a drag sets `atom.apart` directly (and the camera follows within 0.12 s), a click
  or key eases there; the fill is `atom.apart`; the goal holds when the picture (not the thumb) is at the end.
- Pops removed: the outline in `shared` waits for an empty place and a landed camera; the names in `plastic` wait
  for the landing and show only for the material in view; `outer` brings the electrons back together eased.
