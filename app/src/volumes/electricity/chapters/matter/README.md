# Chapter `matter` — «Провідники, ізолятори, напівпровідники»

Script: `docs/volumes/electricity/chapters/matter.md`. Physics: `@electricity/sim/matter` only.
Scene: micro «inner space»; a floating podium (radius 3.4, top at y = 0) under every set; heroes hover at
`HERO_Y` = 2.4 (`world.ts`). Every step builds its own _set_ under `lab.stand`; the stage shows one set at a time.

| File                                                        | Role                                                                                                                                                  |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`                                                  | Manifest (eager, tiny): `manifestText(meta)`, theme `teal` / micro, lazy scene and emblem.                                                            |
| `content.ts`                                                | `defineContent(generated JSON, { labels })`; `docLabel` / `docItems` (captions quoted «…» in the script), `crossTarget`.                              |
| `labels.ts`                                                 | `DOC` (verbatim «…» quotes the export does not list; tested against the script) and `L` (own plain-Ukrainian captions).                               |
| `chapter.ts`                                                | Contract: `Lab { ctx, ui, stand, live, isCurrent }`, `StepModule { id, shots, stage, ui, update }`.                                                   |
| `scene.ts`                                                  | Orchestrator: env → podium → step factories → shots / `stage.define` / `ui.define` → update routing → sound.                                          |
| `world.ts`                                                  | The podium with its ring of crystal motes.                                                                                                            |
| `sound.ts`                                                  | Loops (`buzz`, `hum`, `geiger` as scattering crackle) from the "wanted this frame" `lab.live`.                                                        |
| `fmt.ts`                                                    | `sci()` — scientific notation that never prints a mantissa of 10.                                                                                     |
| `emblem.ts`                                                 | Journey-map emblem: the copper unit cell (3 meshes).                                                                                                  |
| `parts/fcc-block.ts`, `unit-cell.ts`                        | Copper FCC block (assemble / jitter / swell / disorder, instance colours); the exploded unit cell (8·⅛ + 6·½).                                        |
| `parts/electron-hall.ts`                                    | Step 2: the lattice around the camera + the 600-electron Drude gas with tails and scattering flashes; re-centres for the "drone" ride.                |
| `parts/band-tower.ts`, `material-crystal.ts`                | Step 3: band tower (N sub-levels → bands, Fermi level, hops, holes); the switching crystal.                                                           |
| `parts/gap-cell.ts`                                         | Step 4: electrodes, insulator slab, molecules, field lines, avalanches, spark, burn track.                                                            |
| `parts/scatter-crystal.ts`, `instruments.ts`, `cryostat.ts` | Step 5: crystal with phonon ripples / impurities / vacancy / scattering electrons; thermometer and «ρ» meter; mercury sub-scene with Cooper pairs.    |
| `parts/si-sheet.ts`, `diamond.ts`                           | Steps 6–7: the planar silicon scheme as a small carrier engine (pairs, hole hops, recombination, split halves); the 3D diamond lattice that flattens. |
| `parts/dopants.ts`                                          | Step 7: P / B dopants (neutral → fixed ions with rings) and the tray.                                                                                 |
| `parts/pn-block.ts`, `circuit.ts`                           | Step 8: p-n block (depletion, fixed ions, built-in field, energy hill, crossing carriers); source, 220 Ω, ammeter, lamp, wire pulses.                 |
| `parts/dev-diode-led.ts`, `dev-solar-mosfet.ts`             | Step 9: rectifier, LED, solar cell, MOSFET.                                                                                                           |
| `steps/NN-<id>.ts`                                          | One `StepFactory` per step: set → handlers → shots → stage spec → step UI → QA probes → update.                                                       |
| `qa/interaction.mjs`, `qa/cases.mjs`                        | Playwright: every control and scene manipulation once (37 checks), dev and production builds.                                                         |
| `qa/sound.mjs`                                              | Live master levels per step (real time), clipping and "loops stop after leaving".                                                                     |
| `__tests__/manifest.test.ts`                                | Manifest = content, `DOC` = script, hotspots bound by id, quoted captions read from the content.                                                      |

## Conventions that keep the steps random-access safe

1. Everything a step shows is a stage actor (its set, or sub-groups registered in the factory); sub-states use
   `stage.toggle`. Nothing hangs directly under a set unless it is always visible with it.
2. A step re-derives its state in `stage.enter(info)` and honours `info.instant` (entry animations: the band
   birth in step 3, the flattening in step 6, the assembly in step 1 play only on animated entries).
3. One model sample drives 3D, readouts and charts (`state()` / `model()` closures over `ui.value`).
4. Captions: quoted in the script → `docLabel` / `docItems` / `DOC`; otherwise `L` in `labels.ts`.

## QA loop

```bash
export QA_ID=B-matter QA_PORT=5245
node tools/qa/shot.mjs matter/doping --size 1280x720 --eval "await app.step(1/60, 120); return app.read('doping')"
node tools/qa/chapter-check.mjs matter --sizes all
node app/src/volumes/electricity/chapters/matter/qa/interaction.mjs [--port 5345] [--size 1920x1080] [--only bands,doping]
node app/src/volumes/electricity/chapters/matter/qa/sound.mjs --port 5245
```
