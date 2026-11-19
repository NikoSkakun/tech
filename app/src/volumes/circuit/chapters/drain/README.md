# Chapter `circuit/drain` — «Чому батарейка сідає?»

Script: `docs/volumes/circuit/chapters/drain.md` (path format); writer's notes `docs/requests/C-circuit-4.md`. All
reader text comes from the generated content (`caption(step, i)`, pinned by `__tests__/manifest.test.ts`). World:
`@circuit/shared/world` (the stand, the battery's section `stand.stand.battery.inside`, the meter
`stand.tools.gauge`, the counter frame `stand.tools.frame`, the magnifier with the hit strip
`@circuit/shared/copper/hit-lens`).

## One chain for the dying battery

Slider «Години» (0 … 8 год) → `lifeAtHours` → `battery-cell.ts` (open voltage, internal resistance, current through
the 5 Ω lamp) → `heatOfCurrent` → the lamp's heat (`stand.glowOf`, a defaulted stage parameter this chapter sets):
the filament's colour, the lamp's light, the pool on the board, the room. The needle (`meterVoltage`), the frame's
number (`loadCurrent`, «0,31 A» → «0,11 A») and the section (`cell.life`) read the same life in the same frame.
The needle is an instrument (critically damped, τ 0.11 s) while the hours are scrubbed, and the battery itself
(`followVoltage`: falls in ½ s under load, creeps up in 2–3 s) in `ghost` and `inner`.
`battery-cell.ts`'s dead end was retuned for it (6.4 Ω dead → 0.105 A → heat 0.12, a dull red; ≈ 8.0 h of light).

## Files

| File                                     | What                                                                                                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `index.ts`, `content.ts`, `chapter.ts`   | manifest, content, the step contract (`update` before the world, `late` after it — for every step)                                                                 |
| `world.ts`                               | the chain above; hours, cut, meter (slides in, probes onto the clamps), counter frame on the right wire, the cradle (`fresh`, `contact`)                           |
| `shots.ts`                               | `hours` (stand lowered, meter on the table), `spent` (section + meter + lamp), `ghost`, `innerWide`, `inner` (pushed in on the lens over the battery)              |
| `scene.ts`                               | orchestrator; the switch is live in `ghost` once the battery is dead and closed                                                                                    |
| `parts/scrub.ts`                         | a value scrubbed by hand or glided on a critically damped spring (UI_API §3.3)                                                                                     |
| `parts/switch.ts`                        | the stand's switch as a direct control (as `lamp`'s), counts openings and closings                                                                                 |
| `parts/lens-rig.ts`                      | the magnifier: holder ↔ rail lamp's glass … battery (laid in `world.afterLens`)                                                                                    |
| `parts/paste-view.ts`, `paste-shader.ts` | inside the lens over the dead battery: the separator enlarged, pale deposit lumps, `sky` paste particles that slow, stick (the lump glows `orange`) and squeeze on |
| `parts/spare.ts`                         | the new battery (a second `createBattery()`), and the swap as pure functions of `carry` and `swap`                                                                 |
| `steps/0N-*.ts`                          | one factory per step                                                                                                                                               |
| `qa/interactions.mjs`, `qa/helpers.mjs`  | every goal by pointer (mouse or `--touch`), per-frame continuity of camera, lens, battery, light and needle                                                        |

## Steps

| Step    | Camera                                     | What the reader does → goal                                                                                                                                                                                                                                                                             |
| ------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hours` | `stand` (chapter 6's last frame) → `hours` | the meter slides in, probes onto the clamps, the frame rises on the right wire; slider «Години» scrubs the life both ways. Goal: thumb at «8 год», needle < 1 V, 1 s                                                                                                                                    |
| `spent` | → `spent`                                  | the hours glide back to 0 and the section opens on the way; the same slider: zinc melts into deposit, oxide pales, events thin out, the surplus on the minus stays. Goal: section open, «8 год», 1 s                                                                                                    |
| `ghost` | → `ghost`                                  | the hours run on to the end, the section closes; tap the switch: open — the needle creeps to ≈ 1,2 V in 2–3 s; closed — below 1 V in ½ s, the coil a dull red. Goal: ≥ 2 openings and closings, once open until 1,2 V                                                                                   |
| `inner` | → `innerWide` → `inner`                    | the lens comes out of its holder onto the lamp's glass (frosted, strip half full); drag it to the battery: the glass clears into the paste view, the strip fills and pulses, the camera pushes in. Goal: 2 s over the battery                                                                           |
| `life`  | → `hours` → `stand`                        | meter and lens put away; a new battery slides onto the table; drag it up over the cradle and let go: the dead one rises out and leaves the picture, the new one goes down, the lamp flashes white; the camera settles on the stand plan. «Назад» plays it backwards. Goal: new in the cradle, lamp white |

## QA

`node app/src/volumes/circuit/chapters/drain/qa/interactions.mjs --port <p> --size 1280x720` (also `1920x1080`,
`390x844 --touch`). Strips and contact sheets: `/srv/electricity/qa/B-circuit-drain/*.mjs`.
