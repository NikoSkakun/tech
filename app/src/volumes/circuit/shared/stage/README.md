# `shared/stage` — the table floor of the volume `circuit`

The demonstration stand in a dark room, the flashlight that unfolds into it, the lamp as the real key light,
and the tools that live on the stand (`docs/volumes/circuit/VISUAL.md` §2, §3, §5.1, §5.6, §5.7). A library:
models, materials, light and motion with **states and parameters, no step logic**. Showcase:
`app/src/volumes/_dev/chapters/_sandbox-circuit-stage` (23 steps, one per state or beat); the crawl: `_sandbox-circuit-crawl`.

## Mount

```ts
import { STAGE_SHOTS, mountStage } from '@circuit/shared/stage';

export default defineScene((ctx) => {
  const stand = mountStage(ctx); // adds everything to ctx.root, sets the room's environment
  ctx.camera.shots(STAGE_SHOTS); // stand · flashlight · lamp · lens · handover
  ctx.stage.param('closed', 0, { duration: 0.01, onChange: (v) => (stand.closed = v) });
  ctx.stage.define({ intro: { params: { closed: 1 }, camera: 'stand' } });
  return {
    enterStep: (_id, info) => info.instant && stand.snap(), // deep link: no heating ramp
    update: (dt, t) => stand.update(dt, t), // every frame
  };
});
```

The manifest must use `theme: { sky: 'studio', mood: 'studio' }` (the room is built on the `studio` backdrop
with everything of it switched off). Do not call `ctx.env.tune()` yourself: the light rig owns it.
A chapter of `circuit` needs `shared` in the lint rule's `SHARED_IN_VOLUME` (`docs/requests/W1-circuit-stage.md` §2).

## Parameters (`CircuitStage`) — plain numbers, set them from `stage.param(..., { onChange })`

| Field                | Range | Meaning                                                                                                                                                                                                         |
| -------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `closed`             | 0 / 1 | the switch: 0 open (the air gap shows, cold light), 1 closed. The slider and the filament follow with their own short inertia; the whole frame changes, not a halo                                              |
| `charge`             | 1 … 0 | the battery's life as the outside shows it: the lamp's glow (`glowOf(charge)`, default `glowOfCharge`; `drain` sets `glowOf` to the battery model's current → `heatOfCurrent`), the pool on the board, the amber band paling to grey in the last third |
| `moon`               | 0 … 1 | the cold key light from the upper left. 0 in `prologue/click` (the lamp is the only light)                                                                                                                      |
| `unfold`             | 0 … 1 | 0 = the flashlight lying on the board, 1 = the stand. One pure function of the number: drag it, stop it, play it backwards. `unfold × UNFOLD_SECONDS` (6 s) is the time on the six-beat timeline `BEATS`        |
| `lens`               | 0 … 1 | the magnifier: 0 in its holder, 1 in use over the near wire (`LENS.wireSpot`)                                                                                                                                   |
| `dive`               | 0 … 1 | progress of the flight through the ring: the rim's arcs appear in the frame's corners (from 0.5), the sheath of the wire under the lens dissolves (0.7 … 1). Move the camera with the shots `lens` → `handover` |
| `lensCall`           | 0 … 1 | the step asks the reader to take the magnifier: the resting ring turns full cyan and pulses. Default 0 — at rest the ring is quiet (thin, greyed) so that the lamp stays the hero                               |
| `poles`              | 0 … 1 | how much the wires tell plus from minus: 0 (default) both sheaths nearly one neutral tint — the prologue and chapters 1–2 know no poles; 1 = coral from the plus, blue from the minus (from `battery/poles` on) |
| `setGlow(v \| null)` | 0 … 1 | take the filament's glow by hand (`lamp/glow` scrubs the incandescence scale); `null` gives it back                                                                                                             |
| `glow` (read)        | 0 … 1 | what the filament shows now. Pass it down to the lower floors: warm light when > 0                                                                                                                              |

Tools (`stand.tools`): `gauge.shown` 0…1 and `gauge.value` (volts, needle + number), `frame.shown`,
`frame.setOnLoop(s)` / `frame.setAt(point, tangent)`, `frame.setNumber('12')`, `lens.setPose(from, to, k)`
for other places (`LensPose` in the board frame; `poses.holder`, `poses.overWire` exist). Probes, hotspots:
`stand.stand.anchors.{battery,switch,lamp,plus,minus}`, `stand.stand.wires.core('p1')`, `tools.lens.glass`.

### Options and entry states

- `mountStage(ctx, { globe })` — radius of the lamp's glass globe (default 0.66 = 16 % of the frame height in
  the main shot; 0.52 is the smallest that still reads at 1280×720, about 13 %). The flashlight's head is built
  around the globe, so the lamp never changes size in the unfolding. Side by side: `qa/W1-circuit-stage/lamp-scale.jpg`.
- **The glass and depth of field.** Transparent glass writes no depth, so the post pipeline's depth of field
  blurred the globe by whatever lay behind it (smeared rim over the far room, sharp over the table). The bulb
  carries an invisible depth-only copy of its glass (`bulb:glass-depth`, drawn last, 1.2 % larger): the globe is
  focused like the solid lamp. Any other large glass that must read crisp needs the same (`depthShell` in
  `bulb.ts`). Steps `lamp-off`, `lamp-top`, `lamp-top-off` of the showcase show the glass on dark and light ground.
- **Lamp on or off at step entry** is just `closed` in the step's params plus `stand.snap()` on an instant entry
  (deep link): `prologue/open`, `prologue/dive` enter with `closed: 1`; `prologue/riddle`, `wire/restless` with 0.
- **The slider in the dark**: the thumb has its own faint yellow glow that fades as the room gets light — it is
  visible in the black frame of `prologue/click` without any light. Nothing to set.
- **At the click the light is there at once**: the pool, the bounce and the room switch in the same frame; only
  the coil's colour takes about 0.1 s to run up its scale. Switching off, both cool together.
- **The dive's look** (`stand.dive`): from 0.45 the sheath under the lens dissolves (eased) and the bare core
  becomes one even copper that does not depend on the lamp or the environment — see requests §5.
- `stand.stand.battery.printShown` / `.printAnchor`: «1,5 V» is not printed on phones (it would be under
  14 px); label it in the interface at the anchor.
- **`ambient`** 0 … 1 (default 0.5): lifts only the UNLIT room — the flashlight before the click, the open
  circuit, the dead battery — and steps back as the lamp's output rises (0 = the first, darker look). Mean
  luminance of the frame at 1280×720, ambient 0 → 0.5: flashlight off 15.9 → 24.9, circuit open 36.2 → 39.9,
  dead battery 35.9 → 39.6; lamp on unchanged (52.3).
- **`stand.playUnfold(seconds = 7, to = 1)`** plays the unfolding by itself from wherever `unfold` is (`to = 0`
  folds it back for the practicum) and returns `{ progress, done }`; a hand on `unfold` takes over. Recommended
  timeline `UNFOLD_PLAY`: 7 s for the whole way at constant speed (each beat eases itself; first and last frame
  have zero velocity), camera on `flashlight` through beats 1–2, one `cinematic` move to `stand` starting at
  progress 0.25 and lasting 3.6 s. Showcase step `play`; strip `qa/W1-circuit-stage/play-strip.jpg`.
- The light rig re-applies itself when a step entry resets the environment, and the lens glides between its poses
  (holder, over the wire, on the wire's start) — neither jumps at a step change any more.
- `STAGE_POST.stand` (installed as the chapter's post base) and `STAGE_POST.lamp` (use as the `post` of a lamp
  close-up step): depth of field for the two kinds of shot.

## Crawl — the snail along the wire under one slider of time (`prologue/riddle`, later `flow/snail`)

DECISIONS §60 r–t. One entry, `stand.crawlScene` (`crawl-scene.ts`); nothing of it shows until `show()`.

```ts
const crawl = stand.crawlScene;
// step entry (after world.enterStep): the scene arrives / leaves as ONE motion — never set its parts yourself
if (id === 'riddle') {
  crawl.time = 0;
  crawl.show(info.instant);
} else crawl.hide(info.instant);
// the builder's slider «Час»: min 0, max crawl.duration (136.4 s), true time; every frame (UI_API §3.3):
crawl.time = shownSeconds; // the ONLY input: lamp, switch, snail, lens picture, scale, marked spark follow
```

| Member                              | Meaning                                                                                                                                                                                                                                              |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `time`                              | seconds of true time, clamped to 0 … `duration`. Every frame is a function of it, both ways                                                                                                                                                          |
| `duration` · `lengthCm` · `scaleMm` | 136.4 s · 13.64 cm (the snail's lane) · 6 mm (0.044 mm/s × duration; the lane's start is placed so that it is whole millimetres)                                                                                                                     |
| `show(instant?)` / `hide(instant?)` | arrival 2.0 s, leaving 1.5 s (`CRAWL_SECONDS`); `instant` for deep links. Leaving keeps `time`: the snail goes from where it is                                                                                                                      |
| `shown` · `presence` · `ready`      | asked for · 0 … 1 · in place (show captions and enable the slider when `ready`)                                                                                                                                                                      |
| `snailCm` · `sparkMm`               | where the two are now (for a readout or a goal: `time >= duration`)                                                                                                                                                                                  |
| `anchors`                           | `Object3D`s for captions: `snail` (above the shell), `lens` (centre), `lensTop/Bottom/Left/Right` (just outside the ring, as seen), `mark` (the marked spark's place on the scale), `scaleEnd` (the last tick). The lamp: `stand.stand.anchors.lamp` |

- **Lamp and switch.** While the scene is `shown` they follow the time: off at 0, on in the very frame the time
  is above 0 (the slider's thumb on the stand moves too), off again at 0. The step's own `closed` is ignored
  meanwhile and takes over at `hide()` — so give the next step (`map`: `closed: 1`) its value as usual.
- **Magnifier.** The scene takes it by itself from wherever it is — the holder (`lens: 0`) or over the wire
  (`lens: 1`) — to the start of the run (`tools.poses.overStart`, 1.9×, its right rim at the clamp's screw) and
  gives it back at `hide()`. Leave `world.lensPose` null and `window: 0` on that step. Inside it is a plain
  magnifier ≈ 3.5× of the wire's first centimetre: the scale 0 … 6 мм, cyan sparks darting (live, also at time 0),
  the marked one (white, in a ring) about a point that advances to the last tick; a caret on the scale is that
  point. Stated simplification: sparks drawn huge and few, darting made visible; lengths on the scale are true.
- **Snail.** On its own lane 0.56 inside the loop (`tools/crawl-lane.ts`), from behind the minus clamp up the
  left side, round one corner, along the far side to the lamp's terminal — the electrons' way — at 1 mm/s; pale
  trail, a tick per centimetre, «5 см», «10 см». It creeps (wave, feelers) only while it moves; on the crawl its
  shell is fuller and leans to one side, so it reads from behind as well.
- **The motion in** (`CRAWL_BEATS`, shares of the 2.0 s): lens 0 – 0.62 · its picture opens 0.5 – 0.9 · ticks as
  a wave along the lane 0.12 – 0.7 · the snail creeps to its start 0.3 – 1 · numbers and trail 0.6 – 1. Out: the
  same backwards in 1.5 s. Move the camera with the step (`dive` ends on `stand`; `map` has its own shot).
- **Shots.** `STAGE_SHOTS.crawl` for 16:9 (whole run, lamp, lens with its handle inside the frame, clear of the
  right panel) — its `fit` is the phone-portrait framing: the whole stand with the lens above a half-height
  sheet (checked at 390×844 with the DOM touch sheet). On phones the printed numbers are left out (< 14 px).
- Frames: `/srv/electricity/qa/W1-circuit-stage/crawl/v3/sheet.jpg` (key frames, phone, lens, arrival, leaving,
  snail). Showcase: `_dev/_sandbox-circuit-crawl` (`stand` → `crawl` is exactly the code above).
- **Time 0 is a dark frame**, so the scene keeps it readable: the ring is calm while the crawl has the lens
  (`CRAWL_RING` 0.22 of full cyan, no call — nobody takes the lens there) and the unlit room is lifted by
  `CRAWL_AMBIENT` on top of `ambient`; the lamp's glass, the snail at its start and the lens picture all read.
- **The handle** stays of ordinary size under the 1.9× ring (`LensPose.grip = 1 / scale`), so the whole tool is
  inside the frame at 16:9 with any panel height and above the phone sheet.
- Gone with the rebuild of `riddle` (2026-11-16): the race track, the spark's pin, the front ruler, variant A
  of the preview. `stand.snail`, `.ruler`, `.spark`, `.race` remain as inert deprecated numbers only until
  `shared/world/params.ts` drops its params of those names (requests §7).

## Battery inside — the cutaway, its life, the poles, the meter (`battery-*.ts`, `tools/gauge.ts`; VISUAL §5.2, §5.7, §5.8)

The same battery in its cradle (`stand.stand.battery`), never taken out. Everything is on
`stand.stand.battery.inside`; the stage ticks it. Every default reproduces the closed battery of the prologue
(checked: `circuit/prologue` pixel-identical, `circuit/wire` within the run-to-run noise).

```ts
import { BATTERY_LAYERS, BATTERY_SHOTS, followVoltage, meterVoltage } from '@circuit/shared/stage';

const cell = stand.stand.battery.inside;
ctx.camera.shots({ ...STAGE_SHOTS, ...BATTERY_SHOTS }); // battery · batteryMinus · batteryPlus · voltage
// the «Розріз» slider (UI_API §3.3): cell.cut = shown;  life: cell.life = …; stand.charge = 1 - cell.life
cell.hold = true; // battery/inside «first moment»: cell.surplus = cell.lack = 0 first, then the battery fills them
cell.current = stand.closed; // lamp/energy: the reaction runs while the circuit is closed
```

| Member | Range | Meaning |
|---|---|---|
| `cut` | 0 … 1 | the near half of the can lifts toward the viewer (clear of the minus clamp), slides along the axis past the minus end and dissolves (dithered `fade`, no clipping plane) — `B-circuit-battery`; under it the lengthwise section, facing the camera. A pure function of the number, both ways |
| `life` | 0 … 1 | 0 fresh → `LIFE_STATES` working 0.4 · tired 0.75 · dead 1. Zinc grains melt into a pale deposit from the separator toward the axis; the manganese oxide lightens `ink` → `slate` from the separator toward the can; the dead core is pale and matte. The outside is the stage's: set `stand.charge = 1 − life` |
| `reaction` | 0 … 1 | events at the zinc front (flash, two `cyan` electrons to the pin and along it to the minus cap, the zinc atom drifting into the paste, a `coral` spark on the can) and `sky` ions creeping through the separator. 0 = still. Fewer as `life` ends, none when dead. Only with the section open (`cut > 0.3`) |
| `surplus` · `lack` | 0 … 1 | pole LEVELS (0 = «порівну»): `cyan` electrons on the minus cap's rim, `coral` rings of lack on the nub and the shoulder; in the cut they sit on the cap and the start of the pin / on the steel of the plus end. Drive the scale «бракує · порівну · забагато» from them (`surplusCount` · `lackCount` = dots drawn, at most `POLE_DOTS` 16) |
| `mark` | 0 … 1 | the level the battery holds (default `POLE_MARK` 0.75) |
| `hold` | bool | the battery keeps its poles itself: levels climb to `mark` (from 0 within 5 % in ≈ 4.6 s), the reaction hard at first and thinning out, still at the mark. `activity` (read) is what runs = max(`reaction`, the battery's own drive) |
| `current` | 0 … 1 | with `hold`: a current flows, the reaction keeps running at this rate although the poles are full |
| `clump` | — | `battery/balance`: `clump.handle` (invisible sphere on the heap — register it with `ctx.input`), `grab(share = ½)` (the level drops at once), `moveTo(world)` (dots follow with a little lag each), `release()` → true = let go far (> 0.45): it melts away; false = it flows back. With `hold` the battery restores the level in ≈ 3 s |
| `island` | 0 … 1, **0** | the open cut's own soft key light (VISUAL §2 «освітлений острів»): a shadowless point light above the cut (reach 1.4, decay 2 — the clamps and the cradle stay as they are), eased in ≈ 0.35 s, only while `cut` > 0.5. With the lamp lit it is scaled down by the glow (`× (1 − 0.7·glow)`, the stage writes `lamp`): it lifts the cut's shadows, it does not double the exposure. Always in the scene (intensity 0 = no recompiles); every chapter's stage starts at 0 — set it in the steps that look into the cut and back to 0 elsewhere. `battery/inside`, `battery/balance` use 1; showcase step `battery-cut` (slider «Світло розрізу») |
| `highlight` | `BatteryLayer \| null` | one layer lifts, the others step back (eased) |
| `layers[id]` | — | `{ anchor, pick }` per layer: callout anchor on its cut face; invisible pick boxes (register `pick` with `ctx.input`, or `cell.pick(raycaster)` → layer or `null`, only while `cut > 0.5`) |
| `anchors` | — | `minusCap`, `plusCap` (outside: lens, the scale), `section` (centre of the cut face) |

Layers (`BATTERY_LAYERS`, plain names for labels): `can` сталевий корпус · `cathode` оксид мангану ·
`separator` перегородка з пастою · `zinc` цинк у гелі · `pin` латунний стрижень · `seal` ущільнювач ·
`minusCap` кришка мінуса. The script's three touchable layers are `zinc`, `separator`, `cathode`.

**Shots** (`BATTERY_SHOTS`, world, `fit` for portrait): `battery` the cut from 42° above (a sliver of the far
half's jacket shows above the cut: it reads as a cylinder) · `batteryMinus` / `batteryPlus` a pole close up ·
`voltage` battery + meter. Use `STAGE_POST.lamp` as the post of the first three.

**The numbers** (`battery-cell.ts`, pure, unit-tested): `openVoltage(life)` 1.60 → 1.20 V · `internalOhms(life)`
0.2 → 6.4 Ω · `loadCurrent(life, load = LAMP_OHMS 5 Ω)` 0.31 → 0.105 A · `loadVoltage(life)` 1.54 → 0.53 V
(tired ≈ 1.12) · `meterVoltage(life, closed)` · `lampPower(life)` · `hoursAt(life)` / `lifeAtHours(h)` /
`lifeHours()` (≈ 8.0 h at `CAPACITY_AH` 1.86; the steep end of `internalOhms` puts the dead lamp at ≈ 0.1 A — a dull red glow, `B-circuit-drain`) · `lifeState(life)` · `followVoltage(shown, target, dt)` — the
needle as the battery answers: falls in ≈ 0.5 s under load, creeps back in 2–3 s (`drain/ghost`). Meter shows
«1,6 V» fresh and open, «1,5 V» under the lamp. The lamp's heat for a current is the lamp's (`K-lamp-filament`).

**The meter** (`stand.tools.gauge`): a desk instrument on the table in front of the battery (`GAUGE_HOME`),
leaning back toward the reader; printed scale 0 · 0,5 · 1 · 1,5 · 2, needle, number (one decimal). `value`
(volts; feed it `followVoltage(…, meterVoltage(life, closed), dt)`), `shown` 0 … 1 (slides in), `light`.
Probes on leads: `probes.minus` (`blue`) / `probes.plus` (`coral`): `on` 0 resting beside the meter … 1 tip on
its clamp's leaf; `hold(world | null)` follows the hand; `pole` (world) where its tip belongs — snap when the hand
is near it, so each probe sticks only to its own clamp; `tip`; `handle` (register it). `touching` = both on.
`GAUGE_HOME` is on the table left of the battery (below the minus clamp), clear of the interface's bottom bar on a
lowered stand plan (`battery/voltage` uses its own shot `meter`). `anchor` (at the number, for callouts), `probes.*.rest`
(the tip at rest, world); a held probe turns from its resting lie as it leaves the table (no snap at the grab).
Pole dots grow in and shrink away one after another as a level changes (no pop).
Frames: `/srv/electricity/qa/K-battery-inside/` (`final/*.jpg`).

## The frame of reference

`layout.ts` holds every permanent place in the **board frame** (origin = centre of the face, +x right, +y out
of the face, +z toward the reader; the face leans 15°). `stand.base.frame` is that frame as a `Group` — add
props for the stand there. `boardToWorld()` / `worldToBoard()` convert. 1 unit ≈ 26 mm (battery = 1.9 units).

Measured on the main shot at 1920×1080 (same ratios at 1280×720 and 3840×2160): board 62.4 % of the frame
width and 57.6 % of its height; loop 856 × 442 px (height / width 0.52); battery 18.9 % of the width; lamp
glass 16.5 % of the height; wire 22 px (core 12 px); switch 8.2 % of the width, its gap 36 px.

## The unfolding (`unfold.ts`) — VISUAL §5.1

`0–0.8 s` the housing splits, the halves slide apart (each decorative ring is cut along the same plane as the
body, half on each half) · `0.8–2.1` the housing leaves the picture: the far half (mirror and glass fly into its
head) rises over the back and out of the top of the frame, the near half runs off low to the left; out of the
frame they are hidden — at `unfold = 1` no part of the flashlight is in the scene (there is no shelf behind the stand any more) ·
`1.45–2.45` mounts grow left → right · `1.9–4.45` THE LOOP OPENS in one move: in the torch the parts and strips
are the stand's loop squashed flat (spring, battery, slider, lamp in a row; the minus strip behind them on the far
wall), and it only has to open — the row comes toward the reader, the minus strip unrolls behind it to the left and
far sides, the lamp goes round to the far right corner and screws in, the lamp strip unrolls between slider and
lamp, the slider rides forward along the battery and steps down in front of «+»; the strips round into wires on
the way (`2.6–3.9`) · `4.3–5.0` sheath grows from the clamps · `4.85–5.6` the staples' arches close ·
`5.0–6.0` magnifier into its holder (`unfolding.beat6`).
How a strip moves is `unfurl.ts`: it UNROLLS — each piece of it turns from its direction in the torch to its
direction on the stand and grows to its length there (after its bent tip has eased), so nothing shrinks, folds
or kinks; it is then brought onto the part at its far end whole (`fitEndFlat`, a similarity in the board's plane)
and its last stretch sweeps up to the lamp (`liftEnd`). Designed curves, not a simulated rope: a pure function of
`unfold`, one pass over the points per frame. The short plus strip has its own way under the battery's front end
(`unfold-plus.ts`).
The lamp's light is a `PointLight` parented to the filament, so light and shadows travel with the lamp; no
contact opens (every strip end is computed from the part it touches). No wire piece passes through a part at
any moment: `__tests__/unfold-clear.test.ts` checks every 0.005 of `unfold` against simple solids of the
battery, lamp, slider, mounts, board and housing — keep it green when you change a beat. The camera is yours: `flashlight` for
beats 1–2, `stand` from beat 3 is what the showcase uses.

## The dive and the hand-over pose («жила дроту»)

`HANDOVER` in `shots.ts` (agreed with W2 in `docs/requests/W1-circuit-stage.md` §1): the camera looks **across**
the near wire between the plus clamp and the switch; the wire's axis is horizontal through the centre of the
frame; the copper core's silhouette lies on the upper and lower edges of the 3 : 2 safe frame (distance to the
axis = 4.17 core radii = 0.150, `Shot.fov` 27°); view direction `(0, −0.660, −0.751)` (world), up = world +y.
Left in the frame is the battery's plus, right the switch and the lamp: the electrons' common shift runs right
→ left. The whole flight happens in the stand's real geometry (the camera approaches the real wire through the
real ring), so no portal is needed up to that frame; exchange the worlds there with a dissolve.
`tools.lens.rim` (overlay layer) stays on the lower floors as the thin cyan arcs — keep `dive = 1`.

Not built: a view of the lower floor **inside** the resting lens (`flow/*`: "the lens is a window, not a
flight"). `tools.lens.glass` is the disc to put it on (render target or stencil — an engine question).

## Light and materials (what to know before adding a prop)

- `light.ts`: lamp `PointLight` 7.5 × glow^1.9, plus a shadowless bounce light above the pool (`light.bounce`), decay 1.55, cube shadow map 1024, radius 36; the moon is the
  environment's key light (halves when the lamp works). Filament colour = `filamentColor(glow)`.
- `materials.ts`: `surface()` (board, table: K.toon + warm scatter + a pool gathered into three soft steps),
  `sheath()` (translucent plastic that is LIT — `K.glass` is unlit and would shine in the dark),
  `tame()` (caps each light at 1.1 for toon materials, so things next to the lamp are not over-exposed).
  Call `tameAll(group)` after adding your own lit props. Unlit things (`Text3D`, `K.glow`, `K.glass`) must
  follow the room's light by hand, as `battery.light`, `gauge.light`, `frame.light` do.
- Nothing runs along the wires on this floor, by design.

## The lamp close up — `stand.lamp` (VISUAL §5.3; `lamp/*`, `resistance/heat`, `drain/*`)

One lamp, one number. **`heat` 0…1 is the stand's `glow`** — the coil's place on the incandescence scale; the
filament's colour, the glare, the glass, the lamp's `PointLight`, the pool and the room all follow it (one source of
truth: `light.set`). Scrub it with `stand.setGlow(h)` (`null` gives it back to `closed × charge`); a dying cell is
just a lower heat — yellower, then orange, dimmer (`charge`, or `setGlow(heatOfCurrent(I))`), no other path.

| `stand.lamp.…`   | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `heat` (read)    | = `stand.glow`                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `celsius` (read) | the coil's temperature now, °C; the read-out: `formatTemperature(lamp.celsius)` → «≈ 2 300 °C»                                                                                                                                                                                                                                                                                                                                     |
| `detail`         | `null` (default) = by the camera's distance to the coil: the close-up level (fine coil of 22 tight turns, crimped legs, both leads continued below the stem — one into the bottom contact, one over the collar's rim to a solder drop) fades in between `DETAIL_FAR` 4.1 and `DETAIL_NEAR` 3.5 units. Every shot of `prologue`/`wire` and `STAGE_SHOTS.lamp` (4.6) keep today's lamp. A number 0…1 forces it. `detailShown` (read) |
| `cut`            | 0…1: a wedge toward the reader opens through the lamp's base **and the socket** (≤ 100°, from the collar down to the socket's floor, 0.32 deep): the bottom contact on the socket's floor and both leads inside the base show. Default 0 (no clipping in any shader until then)                                                                                                                                                    |
| `thermal`        | 0…1: heat view **inside the magnifier's ring**, wherever the ring is: the ground under it sinks into cold dark, things at room temperature (wires, socket, base, battery) turn cold `blue`, the supports run warm toward the coil (magenta → orange), the coil is white at heat 1 (its shade follows `heat`). Outside the ring nothing changes. No render target; ≈ 50 extra draw calls while > 0                                  |
| `path`           | the current's way `contact → lead → coil → lead → thread` (world, follows the lamp): `path.at(s, out, tangent?)` for s 0…1 by length, `path.points()`, `path.marks` = `{ contact: 0, leadIn, coilStart, coilEnd, leadOut, thread: 1 }` (shares of the way; `leadIn`/`leadOut` = the middle of each support in the glass), `path.helix` (default true: the coil part runs along the wire's spiral; false = along the coil's axis)   |
| `anchors`        | `Object3D`s for captions: `contact`, `leadIn`, `bead`, `coil`, `leadOut`, `thread` (the solder drop), `glass`                                                                                                                                                                                                                                                                                                                      |

Shots `LAMP_SHOTS` (merge into `ctx.camera.shots`, use `STAGE_POST.lamp` as their `post`): `lampInside` (the whole
lamp from the socket to the crown — `lamp/inside`, `lamp/hot-spot`), `lampCoil` (the coil fills the frame, from
just outside the glass — `lamp/glow`). The magnifier over the lamp: `world.lensPose = lampLensPose(scale = 1.75,
from = STAGE_SHOTS.stand.position, height = 0.95)` with `lens: 1`, then `lamp.thermal = 1`; its ring holds the coil
and the wires at the lamp's terminals (showcase: `lampLensPose(1.45, STAGE_SHOTS.lamp.position, 1.15)` on the `lamp` shot).

Pure functions (`bulb-heat.ts`, unit-tested; exported from the stage):

- `temperatureOfHeat(h)` / `heatOfTemperature(°C)` — stops: 0 → 20 °C, 0.1 → 600 (first dull red), 0.26 → 800,
  0.46 → 1 050 (orange), 0.66 → 1 400, 0.84 → 1 850, 1 → 2 300 °C; `FIRST_GLOW` ≈ 0.076 (≈ 460 °C: the first, barely visible dull
  red; a chapter that names «світиться» can test against it).
- `heatOfCurrent(A)` / `currentOfHeat(h)` / `temperatureOfCurrent(A)` — the coil's steady energy balance
  (I²R(T) = radiation + conduction): 0.3 A → 1, 0.25 A → 0.88, 0.2 A → 0.73, 0.15 A → 0.51, 0.1 A → 0.09.
  `resistanceAt(°C)`: 5 Ω hot, 0.37 Ω cold. `LAMP_WORK = { amps: 0.3, ohms: 5, watts: 0.45 }`.
- `filamentAfterClick(s, { volts, ohms }?)` / `filamentAfterRelease(s, fromHeat?)` → `{ heat, celsius, amps }`: the
  first hundredths of a second from the same balance (inrush ≈ 2.7 A; heat 0.45 at 10 ms, 0.84 at 30 ms, 0.97 at
  60 ms; cooling: 0.7 at 50 ms, dark after ≈ 0.5 s). `lamp/glow`: `stand.setGlow(filamentAfterClick(t).heat)`.

Showcase steps `lamp-inside` (sliders: cut, heat; read-out), `lamp-cut`, `lamp-coil`, `lamp-coil-off`, `lamp-glow`
(slider: ms after the click), `lamp-dim` (slider: current), `lamp-thermal` (sliders: heat view, heat).

## Performance (RTX 5060, `high`, chapter-check)

1920×1080: frame 3.0–4.7 ms (budget 8), 171–317 draw calls (budget 350), ≤ 281k triangles; 3840×2160:
7.4–12.3 ms (warning above 14); no leaks.
The cube shadow map is the main cost of draw calls: every new shadow-casting mesh on the stand adds up to
six. Merge static props (`Builder`) and set `castShadow = false` on small things.

## Not here yet (for the chapter builders)

- `flow/loop`: the slider moving to the second seat (the seat and its jumper are modelled; no motion).
- `resistance/shape`: the far wire as a snake — `wires.setShape('m', { path, …, thin: { from, core, sheath } })`
  (the far wire `m` is ONE tube from the minus clamp to the lamp; `thin` thins it from a length on, `setEmber` warms
  that stretch).
- `build/*` (built, chapter-side): loose wires with cyan handles are the chapter's (`chapters/build/parts/wiring.ts`);
  `wires.setShape` takes `bare: [start, end]` (stripped copper, default `BARE` 0.11 both) and `gap: { at, width }`
  (a break in the core under the sheath) — both default to today's wire.
- `drain/life`: the dead battery leaving the picture (low left, then hidden) and a new one arriving (one `BatteryModel` exists).
- Cutaways of the battery and the lamp (§5.2, §5.3 close-ups) are other floors.

## Additions of chapter 4 (`B-circuit-flow`, 2026-11-17)

- **`createLoopGlow()`** (`loop-glow.ts`): a soft additive sleeve of light round the wire of the whole loop, outside
  the copper. `origin` / `meet` (shares of `loopPath()`), `front` 0…1 (two fronts, one each way, meeting at `meet`),
  `intensity`, `wake` (light left behind), `peak` (the fronts' band), `edge`, `flow` (stripes running the path's
  way — for the energy of `lamp/handover`), `color`, `hide` (up to 4 stretches `[from, to]` of shares where the
  sleeve passes unseen; default none — `flow/push` hides it through the battery's body and the switch block). `loopShare(x, z)` gives the share of a board point (projected
  on the path's segments — the straight sides are single segments). `flow/push`: origin at the switch, amber, meet
  = origin + ½. For `lamp/handover`: origin at the battery, `meet` at the lamp, yellow, `flow` > 0. Note for any
  shader here: no `pow`/`sqrt` of a value that can be 0 — on this GPU they give NaN, which the bloom spreads into
  black blots (the tube has rings with zero normals).
- **`seatJumper`** is now a mount part of its own (it was merged into `seat`), so a chapter can lift it
  (`flow/loop`: `stand.stand.mounts.seatJumper`). It grows in the unfolding with the seat (one more part in the
  wave: the mounts right of x = −0.6 start 55 ms later, not visible).
- The lens window (`shared/world/window.ts`) is used by `flow/connect` (span 8.5 with a 1.3× lens pose).

## «0,3 A» on the lamp's base (`bulb-print.ts`, F-circuit-seams 2026-11-17)

`stand.bulb.print`: small unlit text on the part of the thread above the socket, turned toward the reader's side
(between the stand shot's and the lamp close-up's directions). `light` follows the room (the stage sets it, like the
battery's print), `glow` 0…1 lights it up faintly (`flow/count` at its takeaway), `shown` false on phones (the
stage's `phonePrint`; the chapter names it in the interface there). Drawn only where it can be read (`update`:
≥ 16 px-equivalent per em, fading in to 20 — the rule `chapter-check` holds every world text to), so not at the stand
shot (≈ 6 px-eq there; `flow/count` keeps «0,3 A» as its caption), but in the lamp close-ups (≈ 23 px-eq).

## Files (index, 2026-11-17)

- `air.ts` — The air of the room (VISUAL.md §2, §5.1): dust motes that are visible ONLY in the lamp's light, and the faint cone of light in front of the…
- `base.ts` — The base of the stand (VISUAL.md §2): a thick rounded slab, 3 : 2, whose rear edge is raised so that the face leans 15° toward the reader —…
- `battery-cell.ts` — The numbers of the one AA alkaline battery of the volume as functions of its `life` (0 fresh … 1 dead), so that the meter, the lamp and the…
- `battery-grains.ts` — The grains of the section: zinc powder in the gel (round, silvery, bulging out of the recessed gel), the pale deposit that grows where a zin…
- `battery-inside.ts` — The battery opened where it lies (VISUAL.md §5.2, §5.8)
- `battery-layers.ts` — The drawing of the section (where each layer lies) and its colours as functions of `life` and of the highlighted layer.
- `battery-poles.ts` — The pole charges of the stand battery (VISUAL.md §5.2, chapter `battery`)
- `battery-react.ts` — The reaction inside the section (VISUAL.md §5.2 «Рух»): events at the zinc front — a flash, two `cyan` electrons that run across the gel to…
- `battery-section.ts` — The lengthwise section of the stand battery (VISUAL.md §5.2): what the cut shows, drawn as a shallow relief lying in the cut plane — each la…
- `battery.ts` — The one AA battery of the volume: dark `ink` jacket with an `amber` band toward the plus (as in volume 1, where it read at a glance), steel…
- `bulb-close.ts` — The lamp close up (VISUAL.md §5.3, PATH `lamp/inside`): what the camera finds when it comes to the lamp.
- `bulb-heat.ts` — The filament's heat as numbers (VISUAL.md §5.3, PATH `lamp/glow`, `lamp/hot-spot`, `drain/*`): pure functions, no three.js.
- `bulb-print.ts` — «0,3 A» stamped on the lamp's base (`flow/count`), with `glow` and `shown`.
- `bulb-thermal.ts` — The heat view through the magnifier (VISUAL.md §5.3 `lamp/hot-spot`, PATH `resistance/heat`): whatever the ring covers turns false colour —…
- `bulb.ts` — The lamp (VISUAL.md §5.3): a miniature screw-base bulb.
- `crawl-scene.ts` — The crawl as ONE entry for a chapter (DECISIONS §60 t — the scene of `prologue/riddle`, later `flow/snail`): the snail creeping along the wi…
- `dyn-tube.ts` — A tube whose path and cross-section can change every frame — the flashlight's metal strips that become the stand's wires (VISUAL.md §5.1, be…
- `index.ts` — The table floor of the volume `circuit`: the demonstration stand in a dark room (VISUAL.md §2).
- `lamp-shots.ts` — Camera shots of the lamp close up and the magnifier's pose over the lamp (README «The lamp close up»).
- `lamp-view.ts` — The lamp's close-up level, live (VISUAL.md §5.3): crossfade of the coarse coil to the fine one, the leads below the stem, the opening of the…
- `layout.ts` — The permanent places of the stand (VISUAL.md §2).
- `light.ts` — The light of the volume (VISUAL.md §2): the lamp is the real key light.
- `loop-glow.ts` — A soft sleeve of light round the wire of the loop (VISUAL §5.4, §5.5): the push of the field running along the loop from the switch both way…
- `materials.ts` — Materials of the stand.
- `mounts.ts` — The mounts of the stand (VISUAL.md §2): everything that is fixed to the board and that, in the unfolding, grows out of it in a wave from lef…
- `room.ts` — The dark room (VISUAL.md §2): night, void → deep indigo, a smooth round table top without a single detail, and far behind, out of focus, a f…
- `shots.ts` — Camera shots of the table floor and the hand-over pose of the dive (docs/requests/W1-circuit-stage.md §1, README.md).
- `small-parts.ts` — The two small parts the flashlight shares with the stand: the yellow slider of the switch (a thumb piece on a steel bridge — "повзунок-місто…
- `stand.ts` — Everything that stands on the board, assembled in the BOARD FRAME, with each thing on its permanent place (VISUAL.md §2): mounts, the one ba…
- `torch.ts` — The flashlight (VISUAL.md §5.1): a pocket torch for one AA battery — a cylinder with a wider head, a glass, a cone mirror inside, the yellow…
- `unfold.ts` — The unfolding of the flashlight into the stand (VISUAL.md §5.1) as ONE pure function of `u` ∈ 0…1, so the reader can drag it, stop it and le…
- `unfold-plus.ts` — The plus strip's way under the battery's front end and its hook to the slider while the flashlight unfolds.
- `unfurl.ts` — How a strip gets from its shape in the flashlight to its shape on the stand: it unrolls (`createUnfurl`, `fitEndFlat`, `liftEnd`).
- `wires.ts` — The loop of wire (VISUAL.md §2): three pieces that together with the battery, the switch and the lamp close the rounded rectangle.
- `tools/crawl-lane.ts` — The geometry of the crawl (the owner's snail scene, DECISIONS §60 r–s): the wire's run from the battery's minus clamp to the lamp — the way…
- `tools/crawl.ts` — The crawl (the owner's snail scene, DECISIONS §60 r–s)
- `tools/frame.ts` — The counter frame (VISUAL.md §5.7): a thin `teal` frame around the wire that can be carried along the loop, with its number right above it —…
- `tools/gauge.ts` — The voltage gauge (VISUAL.md §5.7, chapter `battery/voltage`, `drain/*`): a small desk instrument lying on the table at the stand's near edg…
- `tools/index.ts` — The tools that live on the stand (VISUAL.md §2, §3, §5.6, §5.7): the magnifier in its holder, the counter frame, the voltage gauge, the snai…
- `tools/lens.ts` — The magnifier (VISUAL.md §2, §3): the only door to the lower floors.
- `tools/loupe-shader.ts` — What a PLAIN magnifier shows of the wire's first centimetre (the crawl): the wire leaving the clamp, a millimetre scale along it, and stylis…
- `tools/loupe.ts` — The magnifier as a PLAIN magnifier (the crawl, DECISIONS §60 s–t): inside the ring the first centimetre of the wire a few times enlarged — t…
- `tools/snail.ts` — The snail (VISUAL.md §5.6).

## The far wire is one piece (`F-one-far-wire`, 2026-11-18)

- The far wire is ONE tube `m` (minus clamp → left side → far side → the lamp's thread), not `m1` + `m2`:
  one mesh pair (core + sheath), no joins, no open caps (`DynTube` is always capped; `WireShape.open` is gone).
- `wires.setSeat(k)` (`Stand.setSeat`, `flow/loop` only) parts it between the second seat's two terminals: the
  section collapses there (flat copper ends as the `gap` cut faces, `BARE × k` of copper into each terminal); at 0
  it is whole again. It applies to any shape of `m` whose path ends with the straight far stretch.
- `WireShape.thin` + `wires.setEmber` — the snake of `resistance/shape` is the far stretch of `m` itself
  (`farWirePath(k)`); `wires.shapeOf(id)` tells a chapter when the stand re-laid its piece; `wires.sheath(id)`.
- The flashlight's minus strip is one strip `torchPath('m')` on the housing's FAR wall, its flat side transported
  along the whole strip (it stands on edge while it unrolls, as a strip bends round a corner).
