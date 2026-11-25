# Chapter `circuit/lamp` — «Чому лампочка світиться?»

Script: `docs/volumes/circuit/chapters/lamp.md` (path format); writer's notes `docs/requests/C-circuit-4.md`. All
reader text comes from the generated content (`caption(step, i)`, pinned by `__tests__/manifest.test.ts`). World:
`@circuit/shared/world` (the stand, the lamp close up `stand.lamp`, the battery section `stand.stand.battery.inside`).

## Files

| File | What |
| --- | --- |
| `index.ts`, `content.ts`, `chapter.ts` | manifest, content, the step contract (`update` before the world, `late` after it — for every step) |
| `world.ts`, `shots.ts` | the world and the chapter's shots: `lampDoor` (lens on the glass), `lampWhole` (the whole lamp, base opened), `energy` (battery section + switch) |
| `scene.ts` | orchestrator; the magnifier registered once (per-step `lensInput`); `chapter.fly(shot, s)` — an arc flight (to a close-up: a straight push-in along the shot's line for the last leg); the door's rewind when a step follows `inside` |
| `parts/rail.ts` | a camera rail of the chapter (world's dive-rail maths, stops' framing carried along, a hand followed with 50 ms lag, engaging never cuts) |
| `parts/door.ts` | `inside`'s depth rail −½…1: lens leg (holder → glass), door (camera to `lampWhole`, the ring comes to meet it and stays as the rim arcs) |
| `parts/lens-keeper.ts` | the magnifier's pose / call / rim / glass, owned after the stand's update; glides from wherever it is shown |
| `parts/path-marker.ts` | the light mark on the current's way through the lamp (bead on a wire) and its faint trail along the spiral |
| `parts/loop-track.ts` | the loop as a track (heat lens) |
| `parts/switch.ts` | the stand's switch as a direct control, counts for the goals |
| `parts/story-path.ts` | `story`'s pure maps of the slider: true time, camera rail stops and keys, lens, window, wave, atoms' heat |
| `steps/0N-*.ts` | one factory per step |
| `qa/interactions.mjs`, `qa/steps-b.mjs`, `qa/helpers.mjs` | every goal by pointer (mouse or `--touch`), per-frame continuity of camera and lens |

## Steps

| Step | Camera | What the reader does → goal |
| --- | --- | --- |
| `inside` | `stand` → `lampDoor` → `lampWhole` | a tap on the resting lens lays it on the glass (lens mode); the focus ring on its rim «Глибина» (0 the lens on the glass … 1 «усередині лампочки») IS the way in, both ways, and stays as the bottom arc; a tap with the ring at its start lays the lens back; sway on the door rail. Switch open (lamp dark), the base opens on the way, ambient lifted near the lamp. Down there: drag the light mark contact → support → coil → support → thread; names on hover. Goal: depth at the end and the mark at the thread; «нитка розжарення» over the coil at the takeaway |
| `hot-spot` | rewind through the door → `stand` | the switch closes once on the stand, the heat view fades in in the lens's ring; drag the lens: it follows the loop under the pointer and rises onto the lamp near it (tap = onto the wire by the battery). Goal: by the battery, then 2 s over the lamp. «холодне» at the wire, «гаряче» beside the ring |
| `glow` | arc flight → `lampCoil` | slider «Розжарення» 0 … 0,1 s = `0,1 s × x³` of the moment after the click (`filamentAfterClick`); switch closed above 0. Read-out «температура нитки ≈ … °C» under the coil. Goal: end, then first third |
| `energy` | flight → `energy` | the section opens (0.8 s) after landing; `hold` with poles at the mark, `current` = switch; tap the switch. Goal: ≥ 2 closings and openings, closed ≥ 1 s once |
| `handover` | flight → `standHigh` | the lens lies on the wire's first centimetre past the minus as a window onto the copper (`window: 1`, `sim.leash` 1.7, span 8.5 — as `flow/connect`), the electron nearest its centre marked; tap the switch: chapter 4's loop glow (`world.glow`, yellow, stripes running) runs battery → lamp along both wires in 0.7 s, melts when opened. Goal: closed, glow at the lamp, 2 s after the tap |
| `story` | flight → `stand`, then `parts/story-path.ts` | slider «Час» (`flow/push` continued): x 0…¼ = 0…1 ns linear (switch closes, amber wave from the switch both ways, meets at 0.8 of the stretch, camera holds then turns to the lamp), then log stretches to 1 µs, 1 ms, 0,1 s: the lens comes onto the coil, its window opens on the filament's atoms (`lattice.color` tungsten shade, drift on, `lattice.heat` rising), closes from the edge as the camera comes back out, the coil heats (`filamentAfterClick`), the camera passes the lamp's corner to the stand plan. Every frame a function of x, both ways. Goal: end held 1 s |

## QA

`node app/src/volumes/circuit/chapters/lamp/qa/interactions.mjs --port <p> --size 1280x720` (also `1920x1080`,
`390x844 --touch`). Strips and contact sheets: `/srv/electricity/qa/B-circuit-lamp/*.mjs` (`contact.mjs <size>`).
