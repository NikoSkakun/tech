# KIT API — the parametric model kit (`@/kit`)

Owner: `F4-kit`. Source: `app/src/kit/**`. Live catalogue: dev chapter `_sandbox-kit` (`?debug#/_sandbox-kit/town`).
Every model is code: a builder function returning a `KitModel`. This file is the catalogue; exact option lists
live in the TSDoc of each builder (they are short — read them).

Contents: 1 principles · 2 quick start · 3 environment · 4 life · 5 buildings · 6 industrial · 7 machines ·
8 grid · 9 renewables & home · 10 cost table & contact sheets · 11 QA harness · 12 limits.

## 1. Principles

**Units and scale.** All models are authored in **metres** (a person is 1.75 m, a 330 kV tower 32 m), with
toy-thick details. The look presets (fog density, AO radius, DOF sharp range) are tuned for subjects of
`LOOK_SCALE.diorama` ≈ 11 world units. **Recommended for new chapters (M1/M2): build in metres and tell the
environment** — the look then matches `_sandbox-diorama` without any group scale:

```ts
import { LOOK_SCALE } from '@/style';
ctx.root.add(isl.group);                                        // no scale: 1 unit = 1 m
ctx.env.setScale(60, { adaptFrom: LOOK_SCALE.diorama });       // island radius 60 m → fog ÷ 5.45, AO / DOF × 5.45
ctx.env.setShadow({ extent: 90, center: [0, 0, 0] });          // metres too
```

Write camera shots, `setShadow`, orbit limits and `ctx.env.tune({ fogDensity })` (still in reference units) for
that scale; `post` values (`aoRadius`, `dofRange`) stay as in the reference scenes — the engine multiplies them.
What changes compared with the old pattern: **`K.water` patterns are world-space** (`scale` = feature size in
world units; `followLook: true` makes them follow `adaptFrom` too, §2b), so the kit's water (`lake`, `sea`, `river`, island lakes, cooling-tower basins, sized in metres)
shows its glint lines as authored; under a 0.15 group they were 6.7× too large to read. Everything else was
measured equivalent (`_sandbox-kit`, all 8 steps: RMSE ≤ 0.003 apart from free-running animation;
`qa/M2-libs/adapt/pair/`).

The older pattern — one scaled group, environment untouched — still works and is what `_sandbox-kit` keeps
(its water would change look otherwise): `world.scale.setScalar(0.15)` (a 60 m island becomes a 9-unit diorama).
`island().place(obj, x, z)` adds objects to the island's own group, so scaling the island scales its world.
Sizes are parameters everywhere (`hubHeight`, `height`, `radius`…) — compress them for toy proportions
(e.g. a 46 m cooling tower beside a 13 m hall) rather than scaling individual models non-uniformly.

**What a builder returns — `KitModel`:**

| Member | Meaning |
|---|---|
| `group` | add it to your scene; origin = centre of the footprint on the ground unless the TSDoc says otherwise |
| `parts` / `part(name)` | sub-groups that move or come off (rotor, door, roof, cover…); `part()` throws on a typo |
| `anchors` / `anchor(name)`, `anchorWorld(name)`, `anchorLocal(name)` | named points for labels, hotspots, wire and pipe attachment, fx emitters (smoke, steam) |
| `paths` | named polylines in model space (cable routes, pipe centre lines, road lanes, phase conductors) for `fx` flows and movers |
| `night` (0…1) | emissive windows and lamps (tween it: `stage.param('night', 0, { onChange: (v) => (model.night = v) })`) |
| `update(dt, t)` | per-frame animation (rotors, sway, traffic). Call it from your scene's `update` for models that have one |
| `mats` | the model's `MatSet` (K materials by slot): `mats.setClipping(planes)`, `mats.list()` for fades / cutaway fx |
| `triangles`, `drawCalls` | cost |

Extra handles are plain methods on the returned object (`turbine.setPitch()`, `house.setOpen()`, `board.setLever()`).

**How models are built — `Builder`.** Shapes are baked into vertex colours and merged per *material slot*, so a
detailed hero model costs 2–6 draw calls. Slots: `toon` (default) · `matte` (ground, roofs, concrete) · `soft`
(foliage) · `metal` · `gloss` (painted / ceramic) · `facet` (flat-shaded rocks) · `double` (thin sheets) ·
`window` (lights up with `night`) · `lamp` (dim by day, bright at night) · `glow` (always-on indicators) ·
`flat` · `glass`. Only palette tokens and `K.*` materials are used.

*Lit windows (M2)* use per-vertex emissive (`K.toon({ vertexEmissive })`): every pane carries its own night colour,
so a model still has one `window` draw call. Default: the `LIT_WINDOW_TONES` mix (mostly warm yellow, some paler /
deeper warm panes, a few cool ones) picked by a hash of the pane's position; `b.box(…, { slot: 'window', glow:
'sky' })` sets one pane (TVs and monitors use a cool screen glow); `new Builder(name, { windowGlow })` forces one
colour for the whole model, `{ windowTones: [...] }` another mix. *Small coloured lights* — the `glow` slot (aviation
reds, status LEDs) and the inverter / battery LED materials — use `keepHue`, so they read red / green / blue at
night instead of white (`K.glow({ color, whiten: 0, keepHue: true, intensity: 1.5…1.8 })` for your own).

**Two forms of every model.** `x(options)` returns a `KitModel`; `addX(builder, options)` adds the same model
into *your* builder in the current frame. Use the second form to assemble many things into a few draw calls:

```ts
const b = new Builder('yard');
b.frame({ at: [0, 0, 0] }, () => addPowerTransformer(b, { hv: 110, lv: 10 }), 't1.');   // anchors: t1.hv1 …
b.frame({ at: [14, 0, 0], rot: [0, Math.PI / 2, 0] }, () => addBreaker(b, { kV: 110 }), 'q1.');
const yard = b.build();                                                                  // ≈ 4 draw calls
```

`frame(place, fn, prefix)` nests transforms and namespaces anchors / parts; `b.locate(name)` gives the
model-space position of an anchor added earlier (wire things together); `b.part(name, place)` starts a movable
sub-group; `b.geometry(slot)` extracts a merged geometry for your own `InstancedMesh`.

**Many copies:** `instanced(model, placements)` (static copies for the model's own draw calls), or the scatter
builders (`forest`, `groundCover`, `people`, `birds`, `train` — instanced internally).

**Division of labour with `fx`.** The kit is static geometry plus simple mechanical motion. Flowing particles,
steam, smoke, flames, energy pulses and animated clipping are `fx`: use `anchors` (`top`, `exhaust`, `smoke`),
`paths` (`span0.p1`, `pvDc`, `pipe3`) and `mats.setClipping()`. `powerLine({ material })` accepts `K.energy`.

**Crisp colour bands.** Terrain, mountains, stacks and blade stripes are not vertex-painted: triangles are cut
along iso-lines of a scalar field and each piece gets one flat colour (`splitBands`, `bandGeometry`) — borders
stay sharp at any zoom. Use `bandGeometry(geo, field, stops, rest)` for your own striped / zoned surfaces.

## 2. Quick start

```ts
import { defineScene } from '@/engine/api';
import { LOOK_SCALE } from '@/style';
import { forest, house, island, latticeTower, powerLine, windTurbine } from '@/kit';

export default defineScene((ctx) => {
  const isl = island({ radius: 60, seed: 7, features: [{ type: 'lake', x: -15, z: 10, r: 14 }] });
  ctx.root.add(isl.group);                                   // metres (§1)
  ctx.env.setScale(60, { adaptFrom: LOOK_SCALE.diorama });
  const turbine = windTurbine({ hubHeight: 34, rotorDiameter: 40 });
  isl.place(turbine.group, 30, -20);
  const home = house({ seed: 3 });
  isl.place(home.group, -30, -25, 0.6);
  const towers = [-40, 0, 40].map((x) => {
    const t = latticeTower({ voltage: 110, circuits: 1 });
    isl.place(t.group, x, 35, Math.PI / 2);
    return t;
  });
  const line = powerLine(towers);
  isl.group.add(line.group);                       // same parent as the towers
  const trees = forest({ count: 80, ground: isl, rng: ctx.random.fork('trees'), avoid: [[30, -20, 8], [-30, -25, 9]] });
  isl.group.add(trees.group);
  const night = ctx.stage.param('night', 0, { onChange: (v) => (home.night = v) });
  void night;
  return { update: (dt, t) => (turbine.update(dt, t), trees.update(dt, t)) };
});
```

## 2b. Building chapter hero models — `Builder` + `G` (the recommended way)

Chapter-specific hero models (cutaways, machine rooms, lab instruments) are built with the same `Builder` the kit
uses — the pilots built 15+ models this way and it is *the* way: the result has the kit's look, merges into 2–6
draw calls, and gets `parts` / `anchors` / `paths` / `night` for free. `G` (`import { G } from '@/kit'`) holds the
geometry toolbox for shapes `Builder` has no shortcut for (`G.revolve` with `phiStart` / `phiLength` for cutaway
shells, `G.lathe`, `G.loft`, `G.tube`, `G.catenary`, `roundPath`…); add them with `b.add(geometry, { slot, c })`.

```ts
import { Builder, G, type KitModel } from '@/kit';
export function createPump(): KitModel {
  const b = new Builder('pump');                                     // metres, origin = centre of the base
  b.box(1.2, 0.2, 0.8, { r: 0.04, slot: 'metal', c: 'slate' });      // skid
  const can = G.revolve([[0.3, 0], [0.32, 0], [0.32, 0.9], [0.3, 0.9]], { seg: 40, phiStart: 0.4, phiLength: 5.5 });
  b.add(can.shell, { slot: 'gloss', c: ['teal.dark', 'teal'], at: [0, 0.2, 0] });   // casing with a cut window
  const rotor = b.part('impeller', { at: [0, 0.6, 0] });            // moves: own sub-group (+1 draw call)
  rotor.cyl(0.22, 0.05, { seg: 24, slot: 'metal', c: 'steel.light' });
  rotor.anchor('tip', 0.22, 0, 0);                                   // → anchors 'impeller.tip' (+ alias 'tip')
  b.anchor('inlet', -0.5, 0.6, 0).path('flow', [new Vector3(-0.8, 0.6, 0), new Vector3(0, 0.6, 0)]);
  return b.build();
}
```

Rules: colours are palette tokens (two-stop `c: [dark, light]` = vertical gradient); the slot decides the
material; only things that move get a `part()` (each costs draw calls); anchors / paths registered inside a part
are named `<part>.<name>` (M3) and also reachable by the bare name (last one wins).

**Placements** (`instanced`, scatter helpers, `windFleet`): `Placement = { at: [x, y, z], ry?, s?, tint? }` —
`at` is required, `ry` rotates about Y, `s` scales (number or `[x, y, z]`), `tint` multiplies colours:

```ts
const poles = instanced(distributionPole(), xs.map((x) => ({ at: [x, 0, 0], ry: Math.PI / 2 })));
const farm = windFleet(sites.map(([x, z], i) => ({ at: [x, 0, z], yaw: 0.2, speed: 1.1 + 0.05 * i })), { rotorDiameter: 90 });
```

**Origins** are base-centred except where a model is wall-mounted (`hybridInverter`, wall boxes: centre of the
back face) — check the TSDoc. **`applyHeat`** needs a `KToonMaterial`: cast `model.mats.get('toon') as
KToonMaterial`.

**`K.water` convention.** Water meshes are built in their **local XY plane and laid flat** (`rotation.x = −π/2`;
UVs encode the shore distance: `shape: 'disc' | 'strip' | 'open'`). `scale` is the pattern size in world units —
or, with `followLook: true` (M3; kit helpers take `followLook`, `island({ waterFollowLook })`), in reference units
× `env.lookScale`, so a metre-scale scene with `setScale(…, { adaptFrom })` keeps the reference glint size.

## 2c. Additions in M3

| Builder | What | Notes |
|---|---|---|
| `windFleet(placements, turbineOptions)` | instanced farm: static / nacelle / rotor layers, rotors spin | per turbine `yaw`, `phase`, `speed` (live in `fleet.turbines`); `update(dt)`, `hubOf(i)`; interior off by default |
| `windTurbine({ interior })` | `false` = empty nacelle; `Object3D` = your machine room in the nacelle frame | drive-train anchors always present; `addTurbineHub`, `addDriveTrainAnchors` exported |
| `substation({ detail: 'light' })` | breaker → disconnector → gantry / breaker → transformer, coarse insulators, no fence | ≈ 1/3 of `full`; `gantryPort(model, prefix, kV)` = `powerLine` support; `withLowDetail(fn)` |
| `addJacket`, `addFloater`, `addScour`, `addTopside`, `addJackUp` | offshore hardware (y = 0 = sea surface) | copied from `plant-wind` |
| `cylinderCellDetailed({ format, wrap, window, scale })` | 18650 / 21700 / 4680 with window cutaway (layer stripes) and header parts `gasket` › `cid` › `ptc` › `vent` › `cap` | real size × `scale`; anchors `plus`, `minus`, `window`, `inside`, `top` |
| `prismaticCellDetailed({ cut, color, scale })` | 100 Ah LFP brick: studs, nuts, vent, stepped electrode stack when `cut` | anchors `plus`, `minus`, `vent`, `inside` |
| `levelTube({ height, radius, color, level, ticks })` | glass tube with a glowing fill 0…1 | `tube.level` (tweenable), `setColor`, anchor `surface` follows the level |

## 3. Environment (`kit/env`)

| Builder | What | Key options | Parts / anchors / extras |
|---|---|---|---|
| `island(o)` | floating island, tabletop slab or sea-level tray with crisp colour bands and real shoreline foam | `radius`, `seed`, `wobble` / `outline`, `relief`, `biome` (`meadow` `steppe` `desert` `snow` `rock` `industrial`), `altitude {rock, snow}`, `sea`, `underside` (`floating` `slab` `none`), `depth`, `features[]` | returns `Island`: `heightAt(x,z)`, `rimAt(θ)`, `inside(x,z,margin)`, `dry(x,z)`, `place(obj,x,z,ry,lift)` |
| ↳ `features` | `hill`, `lake` (basin + water), `river` (carved channel + water), `pad` (flattened disc / rounded rectangle, optional ground colour: `GROUND.gravel()` `concrete` `asphalt` `dirt` `sand` `coal`), `path` (painted track) | | water = `K.water` whose UVs encode shore proximity |
| `forest(o)` / `trees(spots, o)` | instanced trees with sway: `round`, `oak`, `conifer`, `poplar`, `birch`, `pine`, `fruit`, `bush` (11 crown variants) | `count`, `ground`, `rng`, `avoid[]`, `clump`, `minDist`, `kinds[]`, `season` (`summer` `autumn` `blossom`), `sway` | `update` |
| `groundCover(o)` | instanced `grass`, `flowers` (poppies, cornflowers, daisies), `reeds`, `rocks`, `boulders` | `kind`, `count` or `spots`, `ground`, `avoid`, `wet`, `scale` | |
| `clouds(o)` | flat-bottomed puff clouds (3 variants) drifting around, casting soft shadows | `count`, `radius`, `heights[]`, `size`, `speed` | `update` |
| `sunDisc`, `moonDisc({phase})`, `hills({kind})` | modelled sun / moon, ring of distant hills or snow-capped mountains (banded snow line) | `radius`, `count`, `height`, `arc`, `start`, `base` | anchor `centre` |
| `road(o)` / `addRoad` | draped road: asphalt with dashes and edge lines, or `dirt` / `gravel` | `route [x,z][]`, `ground`, `width`, `surface`, `closed`, `bend` | paths `centre`, `laneLeft`, `laneRight` |
| `rails(o)` / `addRails` | ballast, sleepers, rails (1520 mm), optional second track and catenary masts | `route`, `double`, `electrified` | paths `centre` (`centre2`), `contactWire` |
| `fence(o)` / `addFence` | `picket`, `rail`, `mesh` (industrial), `wall` (precast panels) | `route`, `kind`, `height`, `color` | |
| `streetLamp(o)` / `addStreetLamp` | `road`, `double`, `park` lamps (`lamp` slot) | `kind`, `height`, `light` | anchors `light`, `light2` |
| `bridge(o)` / `addBridge` | `beam`, `arch`, `truss` (Warren) | `from`, `to`, `width`, `clearance`, `spans` | anchors `start`, `mid`, `end` |
| helpers | `drape`, `offsetPath`, `stations`, `addRibbon`, `scatter`, `noise2`, `fbm` | | |

## 4. Life (`kit/life`)

| Builder | What | Key options | Extras |
|---|---|---|---|
| `people(specs, rng)` | capsule people, 4 draw calls for any number: `idle`, `walk` (along a path, loop or there-and-back), `work` | per person: `at`, `ry`, `path`, `loop`, `speed`, `action`, `color`, `hat` (hard hat), `scale` (0.62 child, 0.26 cat-sized) | `update` |
| `birds(o)` | flock circling in loose groups, flapping wings, 2 draw calls | `count`, `centre`, `radius`, `height`, `size`, `speed` | `update` |
| `vehicle(kind)` / `addVehicle` | `car`, `van`, `truck`, `tractor`, `boat`, `ship` (2 meshes each, head lamps on at night) | `color` | ship anchor `funnel` |
| `traffic(items, rng)` | several vehicles following paths (`road.paths.laneRight`, `circlePath(...)`) | `kind`, `path`, `mode` (`loop` `pingpong`), `speed`, `offset` | `update` |
| `train(o)` | electric locomotive + instanced wagons (`coal`, `tank`, `passenger`) | `path` (`rails.paths.centre`), `wagons`, `kind`, `speed`, `mode` | part `loco`, anchor `pantograph`, `speed`, `update` |
| helpers | `samplePath(points, mode)`, `placeOnPath(object, sampler, s)`, `circlePath(cx, y, cz, r)` | | |

## 5. Buildings (`kit/buildings`, `kit/home`)

| Builder | What | Key options | Parts / anchors |
|---|---|---|---|
| `house(o)` / `addHouse` | detached house: shutters, flower boxes, porch, chimney, gutters, service mast, meter box | `width`, `depth`, `floors`, `roof` (`gable` `hip` `flat` `shed`), `wall`, `roofColor`, `door`, `shutters`, `lit`, `seed` | `door`, `lamp`, `service`, `meter`, `chimney.smoke`, `roof` |
| `apartmentBlock(o)` | prefabricated block («панелька») with coloured balconies, stairwells, entrances | `floors`, `sections`, `accents`, `lit`, `seed` | `roof`, `entranceN`, `service` |
| `officeBlock(o)` | glazed block with roof plant and beacon | `floors`, `width`, `depth`, `lit` | `roof`, `entrance`, `beacon` |
| `factoryHall(o)` | hall with `sawtooth` / `gable` / `flat` roof, clerestory band, sliding gate | `length`, `width`, `height`, `roof`, `accent` | `gate`, `roof`, `ventN` |
| `warehouse(o)`, `controlRoom(o)` | ribbed warehouse with loading docks; control building with panoramic window and antenna | sizes, `docks` | `dockN`, `roof`; `door`, `window`, `roof` |
| `cityBlock(o)` / `addSimpleTower` | grid of simple towers, 6 draw calls, seeded lit windows | `size`, `lot`, `floors [min,max]`, `downtown`, `gaps`, `lit`, `seed` | `centre`, `feeder1…4` |
| `cutawayHouse(o)` | **the shared house** (`_shared-house.md`): 6 showcase rooms in front of a spine wall, board in the hall, lab niche (ЛІ-6, 10.24 kWh battery, DC box, critical board), 12 × ЛМ-440 on the 35° south slope | `lab` (false = `home` chapter variant), `boardLevers`, `wall`, `roofColor` | parts `roof`, `front`, `board.door`, `board.cover`, `board.lever.rR.mM`, `battery.cover`; anchors `room.*`, `light.*`, `board`, `meter`, `service`, `ev`, device ids (`fridge` `kettle` `stove` `microwave` `boiler_pump` `water_heater` `washer` `air_cond` `router` `tv` `laptop`), `inverter.*`, `battery.*`, `critical`, `dcbox`, `pv.*`; paths `grid`, `pvDc`, `batDc`, `backup`, `toInverter`; handles `setOpen(front, roof)`, `board`, `inverter`, `battery` |
| parts | `addWindow`, `addDoor`, `addRoof`, `addChimney`, `onWall`; furniture (`addSofa` `addBed` `addTv` `addDesk`…) and appliances (`addFridge` `addKitchen` `addWasher` `addWaterHeater` `addGasBoiler`…) | | device anchors as above |

## 6. Industrial (`kit/industrial`)

| Builder | What | Key options | Parts / anchors |
|---|---|---|---|
| `verticalTank`, `horizontalTank`, `sphericalTank`, `silo` | storage vessels with stairs, ladders, railings, nozzles | `radius`, `height` / `length`, `color`, `band` (content colour) | `top`, `inlet`, `outlet`, `manhole` |
| `stack(o)` | flue stack with banded red / white top, platforms, lights | `height`, `radius`, `bands` | `top` (smoke), `inlet`, `light1…4` |
| `coolingTower(o)` | hyperboloid shell on V-columns over a water basin; fill, spray pipes, riser inside | `height`, `cut` (cutaway window, radians) | `top` (plume), `basin`, `inlet`, `outlet` |
| `addPipe(b, points, o)` | pipe with elbows, flanges, supports | `radius`, `color`, `bend`, `flangeEvery`, `supportEvery`, `name` | path `name` |
| `valve`, `pump`, `pipeRack` | gate / butterfly / control valve; centrifugal pump set; rack with colour-coded pipes | `radius`, `kind`; `size`; `length`, `tiers`, `colors` | `handle`; `suction`, `discharge`; paths `pipeN` |
| `conveyor(o)` | belt on trestles with instanced lumps riding it | `from`, `to`, `width`, `load` (colour / false), `density` | `tail`, `head`; `speed`, `update` |
| `gantryCrane(o)` | rail-mounted gantry crane | `span`, `height` | parts `trolley`, `hook`, `rope`; `setTrolley`, `setHook` |
| `heatExchanger(o)` | shell-and-tube exchanger or `condenser` (steam neck + hotwell) with a cutaway onto the tube bundle | `kind`, `length`, `radius`, `cut`, `cold`, `hot` | `coldIn`, `coldOut`, `hotIn`, `hotOut`, `tubes` |
| `machineHall(o)` | turbine hall with removable roof and front wall, bridge crane | `length`, `width`, `height`, `units` | parts `roof`, `front`, `crane`, `trolley`; anchors `unitN`, `hook`; `setCrane`, `setOpen` |
| steelwork | `addRailing`, `addRingRailing`, `addLadder`, `addStairs`, `addCatwalk`, `addSpiralStair` | | |

## 7. Rotating machines (`kit/machines`) — shaft along X unless stated

| Builder | What | Key options | Parts / anchors / handles |
|---|---|---|---|
| `steamTurbine(o)` | HP (coral) → IP (amber) → double-flow LP (sky) sections, bladed rotor, fixed diaphragms in the lower halves, liftable upper casings with cross-over pipes | `sections` (default HP, IP, LP, LP), `axisHeight` | parts `rotor`, `casingTop`; anchors `steamIn`, `reheatOut`, `reheatIn`, `exhaustN`, `hp1` `ip1` `lpN`, `coupling`; `setOpen(0…1)`, `speed`, `length`, `update` |
| `turbogenerator(o)` | 2-pole generator: cutaway frame and core, 3-phase winding in L1 / L2 / L3 colours, rotor with N coral / S blue pole faces, exciter, line terminals | `cut` (radians, 0 = closed), `scale` | part `rotor`; anchors `coupling`, `u` `v` `w`, `stator`, `core`, `winding`, `pole.n`, `pole.s`, `exciter` |
| `turboSet(o)` | turbine + generator on one foundation table (the `TurboSet` of the plants hub) | `sections`, `cut`, `deck` | parts `rotor`, `casingTop`, `gen.rotor`; anchors `gen.*` |
| `hydrogenerator(o)` | vertical salient-pole machine (alternating pole shoes, field coils), upper bracket, optional Francis runner on the shaft | `poles`, `cut`, `runnerDepth`, `scale` | part `rotor`; anchors `stator`, `poles`, `thrustBearing`, `exciter`, `u` `v` `w`, `runner`, `shaft` |
| `gasTurbine(o)` | bellmouth → 12-stage compressor → ring of combustor cans + fuel manifold → 4-stage turbine → exhaust diffuser | `axisHeight` | parts `rotor`, `casingTop`; anchors `airIn`, `compressor`, `combustor`, `fuel`, `turbine`, `exhaust`, `coupling`; `setOpen` |
| `motor(o)` | finned induction motor with cutaway: stator end windings (phase colours), squirrel-cage rotor | `scale`, `cut`, `color` | part `rotor`; anchors `shaft`, `terminals`, `stator`, `cage`, `fan` |
| `francisRunner`, `kaplanRunner`, `peltonRunner` | runners (vertical axis; Pelton in the XY plane with its nozzle) | `radius`, `blades` / `buckets` | Kaplan: parts `bladeN`, `setPitch`; anchors `inlet`, `outlet`, `shaft`, `nozzle`, `jet` |
| helpers | `addBladeRow`, `addHalfShell` (horizontally split casing), `addBearing`, `addCoupling` | | |

All rotor speeds are slowed-down defaults (`speed` in rad/s) — a chapter showing them must carry the
«сповільнено ×N» chip (DECISIONS §5).

## 8. Grid (`kit/grid`) — lines run along local Z, phases spread along X

| Builder | What | Key options | Parts / anchors |
|---|---|---|---|
| `latticeTower(o)` / `addLatticeTower` | tower by voltage class; `suspension` or `tension` (horizontal strings + jumpers), line `angle` | `voltage` 110 … 750, `type`, `angle`, `circuits`, `insulators` (`glass` `porcelain` `polymer`), `phaseMarks`, `low` | anchors `pK`, `pK.in`, `pK.out`, `sK`, `top`; fields `phases[]`, `shields[]`, `spec` |
| `powerLine(sites, o)` | conductors with catenary sag, bundles with spacers, shield wires between consecutive supports (towers, poles, `substation.ports`) | `sag`, `radius`, `spacing`, `phaseColors`, `material` (e.g. `K.energy`) | paths `spanN.pK`, `spanN.sK` |
| `distributionPole(o)` | 35 / 10 / 0.4 kV pole, concrete or wood (with concrete stub), bare wires or СІП, optional street light | `voltage`, `kind`, `sip`, `lamp` | phase anchors (`p1…3`, `n` or `sip`), `drop`, `light`, `top` |
| `powerTransformer(o)` | oil transformer: tank, radiators with fans, conservator + Buchholz + breather, HV / LV / neutral bushings sized by kV, OLTC, cabinet | `hv`, `lv`, `phases` (3 or 1), `scale`, `fans` | `hv1…3`, `lv1…3`, `neutral`, `tank`, `conservator`, `radiator`, `cabinet`, `oltc` |
| `autotransformerBank(o)` | three single-phase units with fire walls (+ spare) | `hv`, `lv`, `spare` | `a.*`, `b.*`, `c.*`, `spare.*` |
| `addBreaker`, `addDisconnector`, `addCurrentTransformer`, `addVoltageTransformer`, `addSurgeArrester`, `addBusSupport` | three-pole outdoor apparatus sized by `kV`; breaker: I-type ≤ 150 kV, T-type with grading capacitors above; disconnector `open` 0…1 with earthing blade | `kV`, `open`, `earthing` | `pK.in`, `pK.out`, `pK.top` |
| `addGantry(b, o)` | line-entry portal with strain strings and lightning masts | `kV`, `bays` | `bB.pK` (`.line` `.drop` `.in` `.out`), `sN` |
| `substation(o)` | **assembler**: `bays: [{ type: 'line' | 'transformer', open? }]` → apparatus in the real order, wired phase by phase, rigid busbar, gravel yard, fence, floodlights | `kV`, `bays`, `fence` | `bayN.<dsb cb ct dsl vt oa gantry t>.…`, `bus`, `floodN`; `ports[]` (line terminations for `powerLine`), `footprint` |
| `kioskSubstation(o)` | КТП 10/0.4 kV: HV fuses, transformer, 0.4 kV board inside | `kVA`, `overhead` | part `doors`; anchors `hv1…3`, `lv`, `transformer`, `board`, `fuses`, `lamp` |
| `poleSubstation(o)`, `distTransformer(o)` | pole-mounted substation (a `LineSupport`); 10/0.4 kV distribution transformer | `kVA` | `p1…3`, `lv`, `transformer`, `fuses`; `hv1…3`, `lv1…3`, `n` |
| `gis(o)` | gas-insulated switchgear bays sharing two busbar tubes | `bays` | `bayN`, `bayN.cable`, `bus` |
| `hvdcValveHall()` | valve hall: three suspended double-valve towers, AC and DC wall bushings, smoothing reactor | — | parts `roof`, `front`; anchors `ac1…3`, `dcPlus`, `dcMinus`, `valveN`, `reactor`; `setOpen` |
| helpers | `addInsulatorString`, `addRibbedColumn`, `discsFor(kV)`, `addLatticeBody` / `Arm` / `Beam`, `addSpan`, `phaseSpacing(kV)`, `insulationHeight(kV)` | | |

Voltage-class table (the one the `transmission` chapter teaches; `TOWER_SPECS`, `discsFor`):

| kV | Tower | Height, m | Phase gap, m | Discs / string | Conductors per phase | Shield wires |
|---|---|---|---|---|---|---|
| 110 | double-circuit «бочка» (`circuits: 1` = one circuit) | 30 | 4 | 8 | 1 | 1 |
| 150 | «бочка» | 32 | 5 | 10 | 1 | 1 |
| 220 | single-circuit, phases in a triangle | 35 | 7 | 14 | 1 | 1 |
| 330 | Y-shaped «чарка» | 32 | 8.5 | 20 | 2 | 2 |
| 400 | «чарка» | 34 | 10 | 23 | 2 | 2 |
| 500 | guyed portal | 30 | 12 | 27 | 3 | 2 |
| 750 | guyed portal, V-strings | 38 | 18 | 40 | 5 | 2 |

Phases are marked L1 yellow / L2 green / L3 red on clamps, bushing caps and terminals; DC poles + coral / − blue.

## 9. Renewables & home energy (`kit/energy`, `kit/home`)

| Builder | What | Key options | Parts / anchors / handles |
|---|---|---|---|
| `windTurbine(o)` | tower with flanged sections and door, yawing nacelle with liftable cover over the drive train (bearing → gearbox → brake → generator → transformer), hub, 3 lofted aerofoil blades with twist | `hubHeight`, `rotorDiameter`, `chunk`, `foundation` (`onshore` `offshore`), `depth`, `stripes` | parts `nacelle` › `rotor` › `blade0…2`, `cover`; anchors `hub`, `top`, `door`, `cable`, `mainBearing`, `gearbox`, `brake`, `generator`, `transformer`, `bladeN.tip`; `setYaw`, `setPitch`, `setCover`, `rotorSpeed`, `update` |
| `pvModule(o)` | «ЛМ-440»: 108 half-cells, busbars, frame, junction boxes, MC4 leads (`hero`) or light version (`mid`) | `detail` | `plus`, `minus`, `jbox`, `centre`; constants `PV_MODULE` |
| `pvTable(o)` | table of modules on a `rack` or flat on a `roof` | `cols`, `rows`, `tilt`, `clearance`, `mount`, `portrait` | `centre`, `top`, `plus`, `minus`, `mN.*` |
| `pvTracker(o)`, `heliostat(o)`, `parabolicTrough(o)` | single-axis tracker; two-axis heliostat (`aim(sunDir, target)`); trough with receiver tube | `modules`; `size`; `length`, `aperture` | parts `table`; `yoke` › `mirror`; `trough`; `setAngle`; anchors `mirror`, `in`, `out` |
| `hybridInverter()` | «ЛІ-6» wall inverter: display, GRID / PV / BAT / ALARM LEDs, DC isolator, ports | — | anchors `pv1` `pv2` `bat` `grid` `load` `gen` `display` `dcSwitch` `nameplate` `led.*`; `leds`, `setLeds`, `display` |
| `batteryCabinet()` | 51.2 V LFP cabinet: two 16-cell modules with series busbars, BMS, SOC bars | — | part `cover`; anchors `plus`, `minus`, `can`, `display`, `module1/2`, `bms`; `setSoc(0…1)` |
| `cell(kind, {cut})` | `cylindrical`, `prismatic`, `pouch` cells with optional cut onto the electrode layers | | `plus`, `minus`, `inside` |
| `bessContainer(o)`, `electricCar()`, `wallbox()`, `portableGenerator({canopy})` | grid storage container; EV with charge port; wallbox; petrol generator under an open canopy | | `ac`, `door`, `hvac`; `port`, `roof`; `plug`, `status`; `exhaust`, `socket`, `tank` |
| `distributionBoard(o)` | DIN-rail board: `main`, `mcb`, `rcd`, `rcbo`, `spd`, `meter`, `relay`, `blank`; N and PE bars | `rows`, `width`, `leverParts` | parts `door`, `cover`, `lever.rR.mM`; anchors `rR.mM` (`.in` `.out`), `n`, `pe`, `feed`; `setLever(row, i, on)`, `setDoor(0…1)` |
| `schukoSocket()`, `plug(kind)`, `lightSwitch()`, `lamp(kind)`, `cable(points)` | real-size wiring devices (scale the group for close-ups); cable with L brown / N blue / PE green-yellow cores | `kind`: `schuko` `euro`; `incandescent` `led` | `l`, `n`, `pe`, `cable`; `setOn`; `setPower`, `glow` |

## 10. Cost table and contact sheets

Measured in the studio step at 640×520, quality `high` (`qa/F4-kit/thumbs.mjs`). "Triangles (frame)" is what the
renderer draws for the whole frame — model + shadow pass (casters are drawn twice) + studio plinth and sky
(≈ 3k) — so the model itself is roughly half of it. "Meshes" = draw calls per pass.

**env** — sheet `/srv/electricity/qa/F4-kit/sheet-set-env.jpg`

| catalogue id | triangles (frame) | meshes | size x×y×z, m |
|---|---|---|---|
| `trees` | 27k | 10 | 53 × 18 × 16 |
| `forest` | 258k | 14 | 123 × 77 × 122 |
| `island` | 75k | 3 | 122 × 60 × 120 |
| `island-lake` | 79k | 4 | 123 × 69 × 122 |
| `island-slab-sea` | 69k | 2 | 122 × 13 × 121 |
| `roads-rails` | 206k | 21 | 126 × 47 × 128 |
| `backdrop` | 27k | 9 | 288 × 91 × 193 |

**life** — sheet `/srv/electricity/qa/F4-kit/sheet-set-life.jpg`

| catalogue id | triangles (frame) | meshes | size x×y×z, m |
|---|---|---|---|
| `people` | 18k | 4 | 5.3 × 1.8 × 3.0 |
| `birds` | 3k | 2 | 12 × 4.9 × 17 |
| `vehicles` | 28k | 2 | 19 × 3.9 × 7.8 |
| `ship` | 8k | 2 | 9.0 × 14 × 46 |
| `train` | 96k | 8 | 65 × 8.2 × 65 |

**buildings** — sheet `/srv/electricity/qa/F4-kit/sheet-set-buildings.jpg`

| catalogue id | triangles (frame) | meshes | size x×y×z, m |
|---|---|---|---|
| `house-gable` | 24k | 7 | 9.0 × 8.3 × 8.3 |
| `house-hip` | 22k | 7 | 9.9 × 7.2 × 8.3 |
| `house-2f` | 28k | 7 | 11 × 12 × 9.3 |
| `house-flat` | 21k | 7 | 8.5 × 7.3 × 8.0 |
| `house-shed` | 16k | 7 | 8.0 × 6.7 × 7.3 |
| `house-small` | 20k | 7 | 7.0 × 7.6 × 6.8 |
| `apartment-9` | 32k | 6 | 25 × 30 × 14 |
| `apartment-5` | 28k | 6 | 38 × 18 × 14 |
| `office` | 19k | 6 | 23 × 37 × 19 |
| `factory-sawtooth` | 12k | 6 | 41 × 14 × 19 |
| `factory-gable` | 12k | 6 | 33 × 15 × 19 |
| `warehouse` | 9k | 2 | 31 × 8.8 × 19 |
| `control-room` | 11k | 7 | 13 × 9.0 × 8.0 |
| `city-block` | 44k | 6 | 120 × 36 × 90 |

**industrial** — sheet `/srv/electricity/qa/F4-kit/sheet-set-industrial.jpg`

| catalogue id | triangles (frame) | meshes | size x×y×z, m |
|---|---|---|---|
| `tank-vertical` | 19k | 3 | 21 × 12 × 21 |
| `tank-horizontal` | 10k | 3 | 9.0 × 5.2 × 3.6 |
| `tank-sphere` | 17k | 3 | 13 × 16 × 13 |
| `silo` | 12k | 2 | 5.2 × 15 × 5.9 |
| `stack` | 14k | 3 | 14 × 120 × 21 |
| `cooling-tower` | 21k | 4 | 102 × 114 × 102 |
| `cooling-tower-cut` | 21k | 4 | 102 × 114 × 102 |
| `pipes-pump-valves` | 20k | 3 | 12 × 4.6 × 5.9 |
| `pipe-rack` | 24k | 3 | 32 × 7.2 × 4.8 |
| `conveyor` | 10k | 4 | 3.9 × 9.5 × 25 |
| `gantry-crane` | 11k | 9 | 27 × 16 × 16 |
| `heat-exchanger` | 15k | 3 | 10 × 3.9 × 2.6 |
| `condenser` | 15k | 3 | 13 × 6.7 × 4.0 |
| `machine-hall` | 18k | 11 | 61 × 24 × 27 |

**machines** — sheet `/srv/electricity/qa/F4-kit/sheet-set-machines.jpg`

| catalogue id | triangles (frame) | meshes | size x×y×z, m |
|---|---|---|---|
| `steam-turbine` | 90k | 6 | 24 × 7.5 × 6.2 |
| `steam-turbine-open` | 90k | 6 | 24 × 12 × 6.2 |
| `turbogenerator` | 32k | 5 | 14 × 6.2 × 5.3 |
| `turbogenerator-closed` | 32k | 5 | 14 × 6.2 × 5.3 |
| `turbo-set` | 120k | 8 | 41 × 18 × 9.0 |
| `hydrogenerator` | 37k | 5 | 14 × 17 × 14 |
| `gas-turbine-open` | 47k | 7 | 12 × 9.3 × 5.4 |
| `gas-turbine` | 47k | 7 | 12 × 5.7 × 5.4 |
| `motor` | 18k | 3 | 1.5 × 0.9 × 0.8 |
| `runner-francis` | 13k | 1 | 3.2 × 3.0 × 3.2 |
| `runner-kaplan` | 14k | 6 | 3.7 × 4.0 × 3.9 |
| `runner-pelton` | 20k | 2 | 4.5 × 3.2 × 2.4 |

**grid** — sheet `/srv/electricity/qa/F4-kit/sheet-set-grid.jpg`

| catalogue id | triangles (frame) | meshes | size x×y×z, m |
|---|---|---|---|
| `tower-110` | 44k | 4 | 11 × 31 × 7.2 |
| `tower-220` | 36k | 4 | 13 × 36 × 8.4 |
| `tower-330` | 51k | 4 | 20 × 33 × 8.3 |
| `tower-750` | 156k | 4 | 41 × 39 × 40 |
| `tower-330-tension` | 91k | 4 | 20 × 33 × 10 |
| `tower-110-tension` | 82k | 4 | 11 × 31 × 8.7 |
| `line-110` | 162k | 14 | 40 × 31 × 150 |
| `line-330` | 188k | 14 | 40 × 33 × 210 |
| `line-750` | 479k | 14 | 41 × 39 × 280 |
| `transformer-330` | 63k | 4 | 12 × 8.6 × 8.1 |
| `transformer-110` | 53k | 4 | 9.4 × 5.9 × 6.4 |
| `transformer-750-1ph` | 45k | 4 | 11 × 13 × 10 |
| `breaker-110` | 29k | 4 | 6.6 × 6.6 × 1.4 |
| `breaker-330` | 72k | 4 | 11 × 7.6 × 7.3 |
| `disconnector-110` | 31k | 3 | 6.7 × 5.1 × 4.2 |
| `disconnector-330-open` | 46k | 3 | 14 × 7.2 × 6.5 |
| `ct-110` | 23k | 3 | 6.1 × 6.0 × 1.8 |
| `vt-330` | 30k | 3 | 11 × 8.0 × 1.3 |
| `arrester-330` | 28k | 3 | 11 × 6.3 × 1.4 |
| `bus-support-110` | 18k | 3 | 5.9 × 4.9 × 4.0 |
| `substation-110` | 690k | 6 | 43 × 16 × 76 |
| `substation-330` | 629k | 6 | 40 × 24 × 109 |
| `poles-10` | 20k | 10 | 1.7 × 11 × 29 |
| `poles-04-sip` | 10k | 13 | 2.6 × 8.6 × 25 |
| `poles-04-wood` | 23k | 10 | 1.6 × 9.1 × 25 |
| `poles-35` | 26k | 10 | 3.5 × 15 × 37 |
| `ktp` | 36k | 8 | 4.7 × 4.4 × 2.7 |
| `ktp-open` | 35k | 8 | 4.7 × 4.4 × 2.7 |
| `pole-substation` | 36k | 3 | 3.9 × 10 × 1.2 |
| `dist-transformer` | 21k | 2 | 1.6 × 1.7 × 1.1 |
| `at-bank` | 164k | 4 | 54 × 13 × 11 |
| `gis` | 38k | 4 | 7.6 × 3.6 × 7.2 |
| `hvdc-valve-hall` | 91k | 6 | 46 × 18 × 24 |

**energy** — sheet `/srv/electricity/qa/F4-kit/sheet-set-energy.jpg`

| catalogue id | triangles (frame) | meshes | size x×y×z, m |
|---|---|---|---|
| `pv-module` | 8k | 3 | 1.1 × 0.1 × 1.7 |
| `pv-module-back` | 8k | 3 | 1.1 × 0.1 × 1.7 |
| `pv-table` | 18k | 3 | 7.0 × 2.7 × 3.0 |
| `hybrid-inverter` | 9k | 7 | 0.5 × 0.7 × 0.2 |
| `battery-cabinet` | 20k | 14 | 0.6 × 1.1 × 0.3 |
| `battery-open` | 20k | 14 | 1.4 × 1.1 × 0.3 |
| `distribution-board` | 18k | 18 | 0.4 × 0.4 × 0.4 |
| `wind-turbine` | 23k | 10 | 98 × 146 × 22 |
| `wind-turbine-offshore` | 25k | 11 | 98 × 163 × 14 |
| `wind-nacelle-open` | 22k | 10 | 98 × 96 × 15 |
| `cutaway-house` | 109k | 50 | 12 × 10.0 × 9.3 |
| `cutaway-house-closed` | 120k | 50 | 12 × 10.0 × 9.3 |
| `cutaway-house-roof-off` | 94k | 50 | 12 × 10.0 × 9.3 |
| `cutaway-house-home` | 78k | 32 | 12 × 10.0 × 9.3 |
| `socket-plugs` | 10k | 2 | 0.2 × 0.1 × 0.2 |
| `lamps-switch` | 11k | 9 | 0.3 × 0.1 × 0.1 |
| `cells` | 14k | 13 | 0.4 × 0.2 × 0.2 |
| `pv-tracker` | 17k | 5 | 1.6 × 2.8 × 12 |
| `heliostat` | 7k | 3 | 5.3 × 4.6 × 3.4 |
| `parabolic-trough` | 7k | 5 | 5.2 × 4.3 × 13 |
| `bess-container` | 9k | 4 | 2.6 × 2.9 × 6.9 |
| `ev-wallbox` | 12k | 6 | 3.3 × 1.6 × 4.3 |
| `portable-generator` | 10k | 5 | 2.1 × 2.2 × 1.7 |

Hero close-ups: `/srv/electricity/qa/F4-kit/sheet-hero-day.jpg`, `sheet-hero-night.jpg`. Parade islands
(chapter-check): `/srv/electricity/qa/F4-kit/_sandbox-kit/sheet-1920x1080.jpg`, `sheet-1280x720.jpg`.

Parade steps at 1080p `high` (chapter-check, RTX 5060): town 2.9 ms · 110 calls · 470k triangles; industry
3.4 ms · 104 · 329k; grid 2.7 ms · 131 · 912k; renewables 3.2 ms · 301 · 613k; machines 2.9 ms · 94 · 267k.
The whole kit in one chunk is 225 kB (74 kB gzip); chapters only pull what they import.

Cost rules of thumb: a model = one draw call per slot used (+ one per part), doubled by the shadow pass.
Merge neighbours with the `addX` form; instance repeats; pass `low: true` to towers in the distance; a
substation yard is the heaviest assembly (≈ 85k triangles per bay at 110 kV — ribbed insulators).

## 11. QA harness

- `window.__kit.ids(set?)`, `window.__kit.show(id, { night, az, el, zoom, env })` in the `studio` step of
  `_sandbox-kit` (catalogue: `app/src/volumes/_dev/chapters/_sandbox-kit/parts/catalog*.ts`).
- `node /srv/electricity/qa/F4-kit/thumbs.mjs <sheet> [ids | prefix*] [--set grid] [--night 1 --env night]
  [--size WxH --cols N --tile W]` → `qa/F4-kit/sheet-<sheet>.jpg` + `thumbs/<sheet>/stats.json`.
- Unit tests: `app/src/kit/__tests__/kit.test.ts` (catenary, band splitting, builder merge, voltage-class
  honesty, line wiring, path motion).

## 12. Limits and conventions to know

- No text on models (nameplates are anchors: `nameplate`, `display`) — text belongs to chapters' `content.ts`.
- `instanced()` freezes animated parts; night and fades still work (materials are shared with the source model).
- Anchors inside removed parts (`roof`, `front`) move with the part; hide parts with `visible` or a stage actor.
- `train.update` and `conveyor.update` integrate `dt` (not seekable by absolute time); everything else derives
  from `t`.
- The Francis and Kaplan runners and the GIS bay are the simplest hero-class models of the kit (see the report).
