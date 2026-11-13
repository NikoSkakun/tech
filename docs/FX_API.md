# FX API — effects library (`@/fx`) and procedural audio (`@/audio`)

Owner: `F3-fx`. Everything here is used the same way: **create it, add it under `ctx.root`, set parameters**.
Live gallery with every effect: chapter `_sandbox-fx` (`#/_sandbox-fx/<step>` with `?debug`), source in
`app/src/volumes/_dev/chapters/_sandbox-fx/parts/*.ts` — copy from there. Costs below were measured at 1920×1080, quality
`high`, RTX 5060, with typical settings (see `docs/reports/F3-fx.md` for the method).

Contents: 0 conventions · 1 particles · 2 characters · 3 flow along curves · 4 conductors & beams · 5 fields ·
6 electric drama · 7 thermal & fluids · 8 machine helpers · 9 signals · 10 audio · 11 cost table · 12 do / don't.

## 0. Conventions (apply to every effect)

- **No `update()` for renderable effects.** They animate from the engine clock by themselves (shader time, or a
  tick hooked into the scene-graph update) — deterministic under `?freeze` / `__app.step`, paused when hidden.
  Only *controllers* that move other objects need a call: `Spin`, `Vibration` → put them in an `FxSet` and call
  `fx.update(dt, t)` once in your `update` hook.
- **Tween the public properties** (`speed`, `power`, `intensity`, `amount`, `fade`, `reach`, `rpm`, …) with
  `ctx.tweens` or drive them from a `stage.param({ onChange })`. Speeds and frequencies are integrated
  internally, so changing them never makes anything jump. Most effects expose `fade` (0…1), so
  `stage.actor(effect, { appear: 'fade' })` works; the default `pop` (scale) works for all of them too.
- **`FxEnv`**: factories that scale with quality or need randomness take `ctx` as their first argument
  (they use `ctx.quality` and `ctx.random` only). Particle / flow counts are *nominal at `high`* and follow the
  tier automatically (also when the user changes it at run time).
- **Colours** are palette tokens; defaults follow STYLE_GUIDE §2.2 (electron `cyan`, **E** `amber`, **B**
  `magenta`, current `yellow`, phases `yellow`/`green`/`red`, heat `orange`→`red`, hot steam white + `pink`).
  Override a colour only when the meaning really is different.
- **Brightness**: `intensity` > ~1.2 blooms. Defaults are tuned so that the semantic hue survives the bloom
  (a too bright `amber` line turns white). Raise bloom per step with `post: { bloomIntensity }`, not per effect.
- **Hue under bloom (M2)**: semantic lines and markers keep their hue on screen: field lines (`keepHue` default
  on), spectral photons (`wavelength` given) and field arrows use the same pre-compensation of the display
  transform's white bleed as `K.glow({ keepHue })`, and the line / packet core covers the backdrop instead of adding
  to it (amber over indigo used to read as peach). For your own glow materials of semantic colours use
  `K.glow({ color, whiten: 0, keepHue: true })` (the old `core: color` trick is what `whiten: 0` does).
- **Disposal** is automatic for everything under `ctx.root`. The exceptions own things outside the graph:
  `Cutaway` and `Outline` → `ctx.onDispose(() => x.dispose())`.
- **Space**: positions given to an effect (`from`, `to`, `setPosition`, paths, field sources) are in the local
  space of the effect object. Effects assume *uniform* scale of their parents.
- One-shot triggers (`emit`, `burst`, `fire`, `strike`) use the engine clock; call them from `update`, tweens
  or input handlers — not from a `setTimeout`.
- **Sizes are in world units, tuned for the F1 reference scenes (a subject of ≈ 3–6 units).** In a metre-scale
  scene (kit models, `env.setScale(r, { adaptFrom })`) pass every size explicitly — nothing in `@/fx` follows
  `lookScale`. Rules of thumb for a 100 m diorama: `createWire({ radius: 0.15–0.4, repeat: 0.02–0.05 /* pulses
  per metre */, speed: 8–20 /* m/s */, detail: 0.3–0.4 })` (`detail` = tube segments per unit length: the default
  6 means 600 segments per 100 m); flows `radius` 0.3–1, `spread` ≈ the pipe / cable radius, `speed` in m/s;
  orbs `radius` in metres; `createSparks({ size })` ≈ 0.05 × the subject size; ribbons `width` in metres
  (`minPixels` keeps distant ones visible).
- **Custom additive shaders** (M3 note from the `atom` pilot): output `gl_FragColor = vec4(rgb, 0.0)` with
  `blending: AdditiveBlending, premultipliedAlpha: true` — without `premultipliedAlpha` three uses
  (SRC_ALPHA, ONE) and alpha 0 draws nothing.

## 1. Particles — `createParticles(ctx, options)` → `ParticleSystem`

Instanced billboards simulated entirely in the vertex shader (closed-form ballistic motion with gravity, drag,
wind, turbulence). One draw call, zero CPU per frame, seamless loops.

```ts
const dust = createParticles(ctx, {
  count: 200, emitter: boxEmitter([4, 2, 4]), sprite: 'soft', color: ['sky', 'white'],
  life: [3, 5], speed: [0.05, 0.2], size: [0.02, 0.06, 0.02], turbulence: { amplitude: 0.1 },
});
root.add(dust);
dust.rate = 0.5;                 // thin the stream (0…1, tweenable)
dust.setEmitting(false);         // stop emitting: living particles finish their flight
```

| Option | Meaning (default) |
|---|---|
| `count`, `exactCount` | nominal count at `high` (scaled by tier unless `exactCount`) |
| `emitter` | `pointEmitter(origin, aim)`, `sphereEmitter(r, {surface})`, `boxEmitter(size)`, `discEmitter(r, {axis, spread})`, `surfaceEmitter(geometry, {matrix})` (area-weighted mesh surface), `curveEmitter(curve, {radius})`; `aim = { axis, spread }` |
| `loop` | `true` continuous (reborn on death) · `false` = pool for `emit(n, { position, direction, spread, speed, life, inherit })` |
| `life`, `speed` | seconds / units·s⁻¹, number or `[min, max]` |
| `gravity`, `drag`, `wind`, `turbulence` | acceleration; linear drag k (1/s); air velocity (needs drag); wobble `{ amplitude, frequency, speed }` |
| `size`, `sizeJitter`, `color`, `mid` | curves over life: value, `[start, end]` or `[start, mid, end]`; `mid` = position of the middle key |
| `fadeIn`, `fadeOut`, `intensity`, `opacity` | envelope fractions (0.1 / 0.35), brightness, opacity |
| `sprite` | `soft` glow · `disc` · `puff` (toon cloud) · `spark` (streak) · `drop` · `bubble` · `ring` |
| `blend`, `stretch`, `spin`, `reseed`, `fog`, `depthTest` | `add` / `normal`; velocity streak length (s); rotation; per-rebirth spawn jitter radius |

Properties: `rate`, `intensity`, `fade`, `wind`, `gravity` (live vectors), `setColor()`, `setSize()`,
`setEmitting(on, instant?)`, `emit()`, `reset()`. Pass `instant = info.instant` when a step sets the state.
**Trails**: `createTrail(target, { color, duration, points, width })` draws a fading ribbon behind any moving
object (add it to the group the target moves in; `reset()` after a teleport). Particle streaks: `stretch`.

Limits: no collisions, no per-particle sorting (fine for same-coloured puffs and additive sprites), a looping
system follows its object when the object moves (use an `emit()` pool for world-space trails).

## 2. Characters — one look everywhere (STYLE_GUIDE §3 "particles are characters")

| Character | Factory (hero) | Look |
|---|---|---|
| electron e⁻ | `createElectron({ radius })` | glowing `cyan` marble, deeper limb, white glint, drifting shell, dark "−", halo |
| proton p⁺ | `createProton()` | glossy `coral` sphere, white "+" |
| neutron n⁰ | `createNeutron()` | glossy `mist` → `steel` sphere |
| ion | `createIon({ color, sign })` | glossy sphere with sign; default Li⁺ `lime` "+" |
| quark u / d | `createQuark('up' \| 'down')` | `amber` / `violet` sphere, halo wandering through the three colour charges |
| hole h⁺ | `createHole()` | hollow dashed `coral` ring with a small "+" (an absence, not a ball) |
| photon γ | `createPhoton({ wavelength })` | wavy packet: sine under a gaussian envelope, colour from `wavelengthToColor(nm)` |
| gluon | `createGluons({ count })` | springy `lime` coil with running beads; `setEnds(i, a, b)` + `commit()` |

All sphere-like characters are **impostor orbs** (`Orbs`): a camera-facing quad shaded as an analytic sphere
that writes true sphere depth — perfectly round at any zoom, correct intersections (nucleus clusters), AO and
depth of field like a mesh, two triangles each. Lit kinds read the chapter's real light rig (same cel model as
`K.toon`); self-lit kinds (electron, pulse, hole) ignore it. They do not cast or receive shadow maps.

```ts
const e = createElectron({ radius: 0.2 });            // hero: move the object
e.intensity = 1.5; e.glow = 2;                         // hover / excitation feedback (tweenable)
const nucleons = createOrbs({ kind: 'proton', count: 29, radius: 0.3 });   // swarm with CPU positions
nucleons.setPosition(i, x, y, z /*, scale */); nucleons.commit();
const gas = createGas(ctx, { kind: 'electron', count: 400, radius: 0.05, box: [4, 1, 1], drift: [0.3, 0, 0] });
gas.thermal = 2; gas.wander = 0.2; gas.drift.x = -0.5;   // "temperature" and drift, all tweenable
```

`createOrbs({ kind, count, radius, color?, shade?, glyph?, halo? })` — kinds: `electron`, `proton`,
`neutron`, `ion`, `quarkUp`, `quarkDown`, `hole`, `blob` (generic lit toon blob: water, coolant, pellets),
`pulse` (self-lit energy mote). Properties: `radius`, `fade`, `intensity`, `glow`, `instances`, `setColor()`.
The sign sticker fades out automatically when an orb is only a few pixels big. **Picking**: heroes and
CPU-positioned swarms are pickable with `ctx.input.register(orbs, …)` (ray vs. the real spheres; the hit's
`instanceId` is the orb index); gas and flow swarms are not — register an invisible proxy mesh for those.
`createPhotons({ count, wavelength | color, length, amplitude, waves, travel, speed, keepHue })` (`keepHue`
defaults to true with `wavelength`: red / green / violet photons show their colour instead of a near-white core;
the default `yellow` photon keeps its white-hot core): with `travel` > 0 the
packets fly along their direction and respawn (a looping stream: lamp, sunlight, laser); `setPhoton(i, origin,
direction, phase)` + `commit()`. Helpers: `wavelengthToColor(nm)` → `{ color, band: 'uv'|'visible'|'ir', waves }`,
`photonEnergyEV(nm)`.

## 3. Flow along curves

```ts
const electrons = createFlow(ctx, {
  kind: 'electron', paths: wireCurve, closed: true, count: 300, radius: 0.05,
  speed: 0.8,            // DC drift, units/s (sign = direction)
  spread: 0.12,          // radius of the tube the particles fill (0 = single file)
  wobble: 0.02,          // thermal jitter
});
electrons.speed = 0;                                   // stop (tween it for a soft stop / start)
electrons.ac.amplitude = 0.4; electrons.ac.frequency = 0.9;   // AC: jiggle around the mean position (Hz, slowed)
electrons.density = 0.5;                               // 0…1 share of particles shown
```

- `Flow` is an `Orbs` swarm (any `kind`, same look as the heroes) whose centres are computed on the GPU from
  baked, arc-length-uniform paths → thousands of particles for one draw call (+1 for the halo layer).
- `paths`: one curve / point list, or `[{ path, closed?, weight? }]` for several; per path
  `setPathDensity(row, v)` and `setPathSpeed(row, factor)`. `bidirectional: true` sends half the particles the
  other way (ions of both signs). Open paths grow particles in and shrink them out at the ends (`endFade`).
- **Junctions** (`flowNetwork`): name the edges once, then list the routes with weights; routes sharing an
  edge add up there, so the stream splits and merges with particle count conserved (Kirchhoff's current law).
  `splitByConductance([g1, g2, …])` gives the weights of parallel branches.

```ts
const net = flowNetwork({ trunk, left, right, back }, [
  { via: ['trunk', 'left', 'back'], weight: 2, closed: true },
  { via: ['trunk', 'right', 'back'], weight: 1, closed: true },   // '-name' runs an edge backwards
]);
const flow = createFlow(ctx, { kind: 'electron', paths: net.paths, count: 300 });
flow.setPathDensity(1, 0.3);     // a branch carries less after a resistance change
```

- `createMeshFlow(ctx, { geometry, material, path, count, speed, scale, jitter, align, tumble })` moves real
  instanced meshes along a path on the CPU (coal lumps, crates, pellets: they cast shadows). Use it for up to a
  few hundred items; `speed` and `density` are tweenable.
- Pure helpers: `bakePath`, `samplePath`, `tangentPath`, `concatPaths`.
- Honesty: real drift speeds are mm/s and AC is 50 Hz — flows are slowed and exaggerated; show the
  «сповільнено ×N» chip (DECISIONS §5).

## 4. Conductors & beams

```ts
const cable = createWire(curveOrPoints, { radius: 0.05, color: 'ink', repeat: 0.8, speed: 1.5 });
cable.material.power = 0.4;                 // brightness ∝ power (tweenable); `.material.speed` in U units
const span = createSpan(a, b, 0.6 /* sag */, { radius: 0.03 });      // true catenary between supports
const lines = createBundle(fromPoints, toPoints, { sag: 0.4 });      // L1 / L2 / L3 colours, pulses 120° apart
lines.setPower(0.8); lines.setSpeed(2);
const beam = createBeam({ from: [0, 0, 0], to: [3, 1, 0], color: 'yellow', width: 0.05 });
beam.reach = 0;  ctx.tweens.to(beam, { reach: 1 }, { duration: 0.4 });   // "fire" the beam
```

- `createWire` builds a tube whose U coordinate is in world units, so `repeat` = pulses per unit length and
  `speed` = units/s on every wire regardless of its length (it wraps `K.energy`; reverse flow = negative speed,
  DECISIONS §38: reactive current = `pulseColor: 'sky'`).
- `catenaryPoints(from, to, sag, segments)`, `catenaryParameter(span, sag)`, `catenaryLength(span, sag)` —
  y = a·cosh(x/a), also for supports at different heights. `wireGeometry(curve, opts)`, `curveThrough(points)`.
- `Beam`: camera-facing ribbon with white-hot core; `from` / `to` are live vectors, `ripple: 0` = steady laser.
  Individual photons along a line: `createPhotons({ travel })` (§2).

## 5. Fields

```ts
const charges = [{ position: p1, q: +1 }, { position: p2, q: -1 }];
const E = pointChargesField(charges);
const lines = createFieldLines({
  field: E, kind: 'E',                                   // 'E' amber · 'B' magenta
  seeds: seedsOnSphere(p1, 0.3, 24),
  trace: { step: 0.06, maxLength: 14, bounds: { center, radius: 5 }, stops: [{ position: p2, radius: 0.3 }] },
});
lines.refresh(E, seedsOnSphere(p1, 0.3, 24));            // after a charge moved (cheap for point charges)
lines.reveal = 0; ctx.tweens.to(lines, { reveal: 1 }, { duration: 1.2 });   // grow the lines from their seeds
```

| Piece | API |
|---|---|
| Field functions (pure) | `pointChargesField`, `pointChargesPotential`, `barMagnetField(n, s)`, `dipoleField`, `straightWireField`, `currentLoopField` (Biot–Savart), `solenoidField`, `uniformField`, `superpose(...)`; type `VectorField = (p, out) => out` — write your own for anything else |
| Integration (pure) | `streamline(field, seed, { step, maxLength, bounds, stops, backward, bothWays, detectLoop })` (RK4 at fixed arc-length step; closed loops are detected), `streamlines`, seeds: `seedsOnSphere`, `seedsOnRing`, `seedsOnLine` |
| `FieldLines` | ribbons with chevron dashes running along the field; `dashSpeed`, `dashRepeat`, `width`, `magnitudeContrast` (brightness ∝ log\|F\|), `reveal`, `fade`, `refresh()`, `.lines` (the streamlines, for labels) |
| `createVectorArrow({ color })` | `arrow.set(origin, vector)`; `arrow.tip` is an empty object at the tip — parent a label to it |
| `createArrowField(field, { points: gridPoints(center, size, counts), length })` | instanced arrows; `sample(field)` to update |
| `createPotentialSurface({ size, range, height, contours })` | height-map "potential landscape" in the voltage ramp with equipotential contours; `surface.sample(potentialFn)`, `heightAt(φ)` |
| `contourLines(fn, plane, levels)` + `createEquipotentials(contours)` | marching-squares iso-lines on any plane as thin ribbons |
| `createFluxSurface({ shape, size, color })` | ⊙ / ⊗ notation whose ink grows with \|Φ\|; `flux.setField(B)` returns Φ = B·A·cos θ, or set `flux.flux` (−1…1) |

Cost notes: integration is CPU work — re-integrating 11 two-pole lines (≈ 5000 RK4 steps) plus a 27-arrow
grid every frame costs ≈ 0.5 ms in the gallery's `induction` stand (measured as the stand's extra CPU time), so
a handful of point charges can follow a drag every frame. Cost grows with the number of source elements per
sample (a 32-segment `currentLoopField` ≈ 16 charge pairs, the default `solenoidField` ≈ 90): refresh those only
when something changed. `RibbonLines` (the renderer under field lines, arcs, traces) is exported for
custom polylines: `new RibbonLines({ capacity, color, width, dashStrength })` + `setLines([{ points, closed }])`.
Options added in M2 (off by default, so existing ribbons look as before): `keepHue` (crisp core covers the backdrop
and keeps its hue, peak capped at 1.3; `FieldLines` turn it on — pass `keepHue: false` for the old additive look)
and `mitre` (full width through sharp corners; `PulseTrain` uses it).

## 6. Electric drama

```ts
const arc = createArc({ from: [-1, 2, 0], to: [1, 2, 0], branches: 1 });   // burns continuously, flickers
arc.power = 0.5;  arc.to.set(1, 2.4, 0);                                    // strength / moving contact
const bolt = createArc({ from: top, to: ground, branches: 3, continuous: false });
bolt.strike(0.4);                                                            // one-shot lightning
const short = createShortCircuit(ctx);  short.fire([0, 0.5, 0]);             // flash + ring + sparks
const sparks = createSparks(ctx);       sparks.burst([0, 1, 0], 24, [0, 1, 0], 0.8);
```

| Effect | Factory | Notes |
|---|---|---|
| Arc / lightning | `createArc({ from, to, color, jaggedness, branches, flickerRate, width, intensity, continuous })` | midpoint-displacement bolt re-seeded from engine time (deterministic flicker); white-hot core drives bloom; `power`, `strike(duration)`, live `from` / `to` |
| Sparks | `createSparks(ctx, { count, color, size, gravity })` | pool of streak particles, `burst(position, count, direction?, spread?)` |
| Short circuit | `createShortCircuit(ctx, { size, color })` | `fire(position)` = flash with expanding ring + spark shower |
| Flash | `createFlash({ size, color, speed /* duration */ })` | `fire()` |
| Corona | `createCorona({ size, color, intensity })` | fuzzy flickering crown (default `violet.light`) |
| Halo | `createHalo({ color, size, intensity, amount /* pulse */ })` | soft glow sprite for lamps, hot spots, LEDs |
| Pulse rings | `createPulseRings({ size, color, amount /* rings */, billboard })` | seamless expanding rings; `billboard: false` + rotate to lay them on the ground (affordance ping) |
| Light shaft | `createLightShaft({ length, radiusTop, radiusBottom, color, intensity })` | additive cone, source at the origin, light falls along −Y |

All glow sprites share `size`, `intensity`, `fade`, `color`. They are additive and do not write depth: in a
shallow-DOF shot keep them near the focus plane (ENGINE_API §9).

## 7. Thermal & fluids

```ts
const steam = createSteam(ctx, { radius: 0.15, height: 2 });       // also createHotSteam / createSmoke / createPlume
steam.setEmitting(valveOpen, info.instant);  steam.rate = flow;      // puffs already in the air keep rising
const flame = createFlame({ height: 1, width: 0.5 });  flame.power = 0.7;   // createGasFlame() = blue burner
const river = createWaterStrip(curve, { width: 1, speed: 1.5, whiteWater: 0.2 });
applyHeat(boilerMaterial, 0.6);                                      // K.toon / K.metal emissive by temperature
```

| Effect | Factory | Notes |
|---|---|---|
| Steam / hot steam / smoke | `createSteam`, `createHotSteam`, `createSmoke` `(ctx, { radius, height, axis, wind, count, color })` | toon puffs; white → `mist`, white + `pink` (hot), `slate` → `steel` |
| Cooling-tower plume | `createPlume(ctx, { radius, height, wind })` | big slow billowing cloud leaning with the wind |
| Flame | `createFlame`, `createGasFlame` `({ height, width, colors, power, speed, seed })` | layered teardrop tongues; burns along local +Y, turns to face the camera around that axis |
| Heat shimmer | `createHeatShimmer({ width, height, lines, intensity })` | rising wavy lines (stylised: no screen-space refraction) |
| Heat glow | `applyHeat(material, t, maxIntensity?)` | emissive along the heat ramp `orange` → `red`, ∝ t² |
| Flowing water | `createWaterStrip(curve, { width, speed, whiteWater, up })` | river / spillway / waterfall ribbon; `speed`, `whiteWater` tweenable; still water = `K.water` |
| Splash | `createSplash(ctx)` | `burst(position, count, direction, spread)` |
| Foam | `createFoam(ctx, { radius })` | churning white puffs that stay in place |
| Bubbles | `createBubbles(ctx, { size /* box */, radius, rise })` | rise and wobble inside a box, pop at the top |
| Rain / droplets | `createRain(ctx, { size /* box */, speed, count })` | condenser rain, cooling-tower fill, weather |
| Ripples | `createRipples({ size, rings })` | flat rings on a water surface |
| Fluid in a pipe | `createFlow(ctx, { kind: 'blob', color, paths, spread })` inside a `K.glass` tube | colour by temperature (`temperatureRamp`) |

## 8. Machine helpers

```ts
const cut = createCutaway({ normal: [0, 0, 1], offset: 2, capColor: 'blue.dark' });   // normal → removed side
cut.apply(casing).apply(stator);            // clips their materials, adds hatched caps
ctx.onDispose(() => cut.dispose());
const open = stage.param('open', 0, { onChange: (v) => (cut.offset = 2 - 2 * v) });   // sweep the cut per step

const exploded = createExplodedView([{ object: cover, axis: [0, 1, 0], distance: 1.2 }, { object: bearing, axis: [0, 1, 0], distance: 0.6, delay: 0.3 }]);
exploded.amount = 1;                         // 0 assembled … 1 exploded (pure function → random-access safe)
const xray = createXRay(shell);  xray.amount = 1;                                      // dissolve shell → glass ghost
const fx = new FxSet();
const spin = fx.add(createSpin(rotor, { axis: 'y', radius: 1.1, blades: 5, fade: [bladeMaterial] }));
spin.rpm = 3000;                             // blades give way to a blur disc between blurStart and blurFull
const hum = fx.add(createVibration(machine, { amplitude: 0.006, reducedMotion: ctx.reducedMotion }));
const outline = createOutline(button);  outline.amount = hovered ? 1 : 0.7;  outline.setSelected(true);
return { update: (dt, t) => fx.update(dt, t) };
```

| Helper | Notes |
|---|---|
| `Cutaway` | world-space plane; `offset`, `setNormal()`, `enabled`. Caps = back faces in the cap colour with 45° hatching evaluated on the true cutting plane. Needs **closed (watertight) meshes**; give thin shells a wall thickness (lathe a closed profile). The engine has no stencil buffer, so the cap's *depth* is that of the back wall behind it (AO / DOF see the wall). Apply it only to the parts that should be cut (e.g. casing and stator, not the rotor). One cap colour per `Cutaway`. |
| `ExplodedView` | parts slide along authored axes (parent space) by `distance`; `delay` staggers them. |
| `XRay` | needs materials with `fade` (all K materials); the ghost is `K.glass`. `keep` leaves some solidity. |
| `Spin` | integrates `rpm` → rotation; above `blurStart` rpm the `fade` materials dissolve and a blur disc with soft ghost blades appears; the visible step per frame is capped so nothing strobes. `spin.blur`, `spin.angle`, `spin.disc`. |
| `Vibration` | deterministic jitter around the rest position; `amount` 0…1 (map to load). No shake with reduced motion. |
| `Outline` | inverted-hull outline of constant pixel width, pulsing; `cyan` affordance / `yellow` selected. Smooth-shaded meshes only (hard-edged boxes show gaps at corners). `ctx.onDispose(() => outline.dispose())`. |

## 9. Signals

```ts
const scope = createScope({ width: 4, height: 2.4, cycles: 2, frequency: 0.5 });   // 3 channels: L1 / L2 / L3
([0, 1, 2] as const).forEach((k) => scope.setWave(k, threePhase(k), 0.9));
scope.push(0, sim.voltage / 325);            // or live data: rolling trace (setSamples for a whole buffer)
const phasors = createPhasors({ size: 2 });  // rotating arrows + projection dots
phasors.angle = scope.phase;                  // lock both to one phase: the sine is the arrow's shadow
```

| Piece | API |
|---|---|
| Waveforms (pure) | `sine(phase)`, `threePhase(k)`, `square(duty)`, `triangle()`, `sawtooth()`, `rectified(half?)`, `harmonics(amplitudes, phases?)`, `spwm(m, ratio)`; analysis: `rms`, `mean`, `spectrum(wave, n)`, `thd(amplitudes)` |
| `Scope` | grid screen + glowing traces; `setWave(i, fn, amplitude)`, `setSamples(i, values)`, `push(i, value)`, `frequency` (Hz, slowed), `phase`, `frozen`, `setChannelIntensity(i, v)`; `channels: [colours]` |
| `Phasors` | polar screen, arrows, dashed guides to the projection axis; `set(i, amplitude, phase)`, `value(i)`, `angle`, `frequency`, `frozen` |
| `createWaveOnCurve(curve, { amplitude, wavelength, speed, transverse })` | y(s, t) = A·sin(2π(s − vt)/λ) along any curve |
| `createPulseTrain({ wave, length, height, cycles, frequency })` | crisp vertical edges for PWM / square waves; `phase`, `wave` replaceable |
| `createSpectrumBars({ count, width, height })` | `bars.set(values 0…1)`; bars ease to new values; first bar (fundamental) in `yellow` |
| `createScreen({ width, height, kind: 'grid' \| 'polar' })` | the instrument plate on its own |

Screens lie in their local XY plane; mount them on a console or wall. Text (axis labels, units) is yours: add
`Text3D` children. Display frequencies are slowed for the eye — label them («сповільнено»).

## 10. Audio — `import { audio } from '@/audio'`

```ts
audio.play('click');  audio.play('tick', { pitch: 1 + value, gain: 0.8 });
audio.loop('turbine').set({ gain: 0.5 * load, pitch: rpm / 3000 });   // call from update() / enterStep()
audio.mood('dioramaNight');                                            // normally automatic per chapter
```

- One-shots: `hover`, `click`, `toggle`, `tick`, `panelOpen`, `panelClose`, `success`, `error`, `zap`, `spark`,
  `breaker`, `relay`, `whooshUp`, `whooshDown`. Options `{ gain, pitch }`.
- Loops (one shared voice per name): `hum` (50 Hz + harmonics; pitch 1.2 = 60 Hz), `turbine`, `water`, `steam`,
  `wind`, `fire`, `geiger` (pitch = count rate), `buzz`. `set({ gain, pitch })` glides; gain 0 … 1.
  **Set loops continuously (in `update`) or in `enterStep`**, not once in the scene factory: the plugin fades all
  loops out when the chapter changes, and a loop whose gain is set again simply restarts.
- Moods: `micro`, `studio`, `dioramaDay`, `dioramaNight` — slow evolving pads, cross-faded over ≈ 2.5 s. The plugin
  picks one from `manifest.theme` (`mood` + `sky`: `dusk` / `night` → `dioramaNight`); call `audio.mood()` in a step
  that changes the time of day.
- The plugin also: unlocks on the first gesture, follows `settings.audio` / `settings.volume`, plays the
  transition whoosh (down when zooming in, up when zooming out), ducks the ambient bed under loud one-shots,
  suspends with a hidden tab. Before the first gesture and with `?noaudio` every call is a silent no-op.
- Everything is synthesised (oscillators + filtered noise), mixed through a limiter; nothing is required for
  understanding (STYLE_GUIDE §7). QA: `node app/src/audio/qa/audio-check.mjs` (`window.__audio` debug hooks).

**Boot path (M2).** Both libraries ship a tiny `plugin.ts` that exports only `plugin` (re-exported from the barrels),
so `main.ts` loads just that at boot: `@/fx` (37 kB gzip) arrives with the first chapter that imports it (the boot
module is 0.5 kB); `@/audio`'s plugin needs the synthesiser (unlock on the first gesture, per-chapter mood), so its
boot module is the whole audio engine (4.5 kB gzip, unchanged). Chapters keep importing from `@/fx` / `@/audio`.

## 10b. Additions in M3 (pilot feedback)

```ts
const cloud = createProbabilityCloud({ capacity: 20000, color: 'cyan', size: 0.04 });   // soft additive dots
cloud.fill(8000, (i, out) => sampleOrbital(out));        // static |ψ|² sample; or cloud.sync(positions, ages) per frame
cloud.swirl = 0.2; cloud.spread = 1.1;                   // alive / swelling; `fade`, `intensity`, `dotSize` tweenable
```
`ProbabilityCloud` (from the `atom` pilot): one `Points` draw call; fresh dots of a live cloud flash in `flash`
colour and fade over `lifetime`. Put it on the overlay layer (`toOverlay`) so DOF does not smear it.

```ts
const streaks = new RibbonLines({ capacity: 4096, color: 'blue', width: 0.4, blend: 'normal' });   // also createFieldLines({ …, blend })
streaks.setLines(paths.map((points) => ({ points })));
```
`RibbonLines({ blend: 'normal' })`: alpha-blended paint instead of added light — visible on the bright `day`
sky and on white machines (wind streaks, streamlines, wakes). Additive stays the default.

```ts
flow.setPaths(streamTube(slider.value));                 // same number of paths as at creation; phases continue
flow.setPath(1, newCurve);                               // one path; cheap enough per frame for a few paths
```

```ts
const nucleons = createOrbs({ kind: 'proton', count: 63, instanceColors: true });
nucleons.setInstanceColor(i, isNeutron ? 'mist' : 'coral'); nucleons.setInstanceColor(0, 'cyan', 2.2); nucleons.commit();
```
Per-instance colour + brightness (body and halo) in one draw call; works for flows and gas (instance = particle).

`createSparks(ctx, { color: 'cyan' })` — one colour gives white-hot → colour → darker colour; the triple
`[birth, middle, death]` still works.

## 11. Cost (1920×1080, `high`, RTX 5060)

Whole gallery stands, `chapter-check` (GPU timer query + CPU; the post stack alone is ≈ 30 draw calls):

| Stand | What is on screen | Frame | Draw calls | Triangles |
|---|---|---|---|---|
| characters | 8 hero orbs + trail, 16-nucleon cluster, 90-electron gas, 6 photons, gluon, 9 labels | 2.1–2.5 ms | 76 | 3 k |
| fields | 26 field lines, potential surface 80², probe arrow | 2.1 ms | 37 | 19 k |
| induction | coil wire, 11 B lines re-integrated every frame, 27 arrows, flux surface | 3.1 ms | 35 | 37 k |
| flow | 150-electron network flow, 4 wires with pulses, beam, 12-lump conveyor | 2.8 ms | 41 | 15 k |
| thermal | 4 flames, shimmer, 3 vapour systems, plume, water, foam, splash, rain, bubbles | 2.7 ms | 56 | 7 k |
| machine | cutaway with 5 caps, spin blur, exploded view, x-ray, outline | 2.2 ms | 73 | 40 k |
| signals | 3 scopes (5 traces), phasors, PWM train, spectrum bars, wave on a wire | 2.9 ms | 55 | 7 k |
| drama | 2 arcs, 2 coronas, 2 halos, light shaft, short circuit, rings | 2.5 ms | 66 | 11 k |

Per effect (hide / show difference inside its stand; the time of a single effect is below the ±0.3 ms
measurement noise of a GPU shared with other QA runs, so only draw calls are exact):

| Effect | Draw calls | Per-frame CPU work |
|---|---|---|
| `ParticleSystem` (any preset: steam, smoke, plume, foam, rain, bubbles, sparks, splash) | 1 | none |
| `Orbs` hero / swarm / `createGas` / `createFlow` | 1 body + 1 halo (kinds with a halo) | none (gas, flow: a few uniforms) |
| `Photons`, `Gluons`, `Beam`, `Flame`, `HeatShimmer`, glow sprites, `LightShaft`, `FluxSurface`, `WaterStrip`, `PotentialSurface` | 1 each | none (`PotentialSurface.sample()` on demand: N² evaluations) |
| `createWire` / `createSpan` | 1 (+1 in the shadow pass) | none |
| `createBundle` (3 phases) | 3 (+3 shadow) | none |
| `FieldLines`, `RibbonLines`, `Arc`, `WaveOnCurve`, `PulseTrain` | 1 each | rebuilds its polyline when it changes (arc: 16×/s; wave, pulses: every frame, ≤ 1400 points) |
| `Scope` | 1 screen + 1 per channel | 160 points per analytic channel per frame |
| `Phasors` | 1 screen + per phasor: 2 arrow + 1 dot + 1 guide | trivial |
| `ArrowField` | 1 | `sample()` on demand |
| `MeshFlow` | 1 (+1 shadow) | one matrix per item per frame |
| `SpectrumBars` | 1 | one matrix per bar per frame |
| `Cutaway` | +1 per clipped mesh (cap) | none |
| `Outline`, `XRay` ghost | +1 per mesh | none |
| `Spin` blur disc | 1 | trivial |

Rules of thumb: every effect is one or two draw calls; fill rate is what costs — large additive / translucent
sprites that cover the screen (a plume filling the frame, a 6-unit halo in a close-up). Counts scale with the
quality tier (×0.35 at `low`), so do not compensate by hand.

## 12. Do / don't

**Do**
- compose scenes from these effects before writing a shader; if something is missing, request it in
  `docs/requests/<your-id>.md` rather than building a look-alike that will drift from the rest of the course;
- use the characters for every electron / proton / ion / photon on screen, at any size;
- map physical quantities to effect parameters (current → `flow.speed` + `density` + wire `power`; rpm →
  `spin.rpm` + `audio.loop('turbine')` pitch; temperature → `applyHeat` + shimmer `intensity`);
- set one-shot state with `instant` where offered (`setEmitting(on, info.instant)`) so deep links look settled;
- keep additive glows moderate and let the step's `post.bloomIntensity` do the rest.

**Don't**
- no `MeshBasicMaterial` glow balls, no ad-hoc `Points` clouds for charge carriers — use `Orbs` / `createGas`;
- do not scale an effect non-uniformly, and do not parent a `Cutaway` target under a moving, non-uniformly
  scaled group (the plane is in world space: move `cut.offset` / `setNormal` instead);
- do not call `emit` / `fire` / `strike` every frame — they are events; continuous things have `rate`, `power`;
- do not start loops in the scene factory (see §10), and do not rely on sound for meaning;
- do not re-integrate Biot–Savart field lines every frame; refresh on change.
