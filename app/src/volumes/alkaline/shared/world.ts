/**
 * The world of the volume `alkaline`: the stand of `circuit` (borrowed, `@circuit/shared/stage`) with the one battery
 * in its cradle, the switch, the lamp and the meter — and this volume's own things on it: the slice. Every chapter
 * mounts it once, describes its steps with `state()` and forwards `update`. The world keeps the numbers that the
 * reader scrubs (`Scrub`) and writes them into the models every frame, so a step is a function of those numbers.
 *
 * One battery, one model of numbers (`battery-cell.ts` of `circuit`): the lamp's heat is `heatOfCurrent(loadCurrent
 * (life))`, the meter `meterVoltage(life, closed)`; `life` 0 fresh … 1 dead drives the cut, the slice and the lamp.
 */
import { Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from 'three';
import type { ChapterContext, Shot, StepSpec } from '@/engine/api';
import {
  BATTERY,
  BATTERY_SHOTS,
  STAGE_FOV,
  STAGE_POST,
  STAGE_SHOTS,
  boardToWorld,
  followVoltage,
  heatOfCurrent,
  loadCurrent,
  meterVoltage,
  mountStage,
  type BatteryInside,
  type CircuitStage,
  type GaugeModel,
} from '@circuit/shared/stage';
import { glide, scrub, snap, type Scrub } from './scrub';
import { createSlice, type Slice } from './slice';
import { createMicro, type Micro } from './micro';
import { createWireSparks, violetIons, type WireSparks } from './flows';

export type ShotName =
  keyof ReturnType<typeof worldShots> | 'grains' | 'atoms' | 'sep' | 'pair' | 'lensOn' | 'sizes';

/** World places of the battery and the slice (stand units; 1 ≈ 26 mm). */
export function battery(): { centre: Vector3; axis: Vector3; minus: Vector3; plus: Vector3 } {
  const centre = boardToWorld(BATTERY.x, BATTERY.y, BATTERY.z);
  const axis = boardToWorld(BATTERY.x + 1, BATTERY.y, BATTERY.z)
    .sub(centre)
    .normalize();
  return {
    centre,
    axis,
    minus: centre.clone().addScaledVector(axis, -BATTERY.length / 2),
    plus: centre.clone().addScaledVector(axis, BATTERY.length / 2),
  };
}

/** Where the slice hangs at `out` 1 and from where the camera looks at it. */
export const SLICE_AT = (() => {
  const b = battery();
  const to = b.centre.clone().add(new Vector3(1.3, 1.6, -0.9));
  const eye = to.clone().add(new Vector3(-0.5, 2.6, 8.3));
  // the slice turns a little away from the camera's line, so its edge shows: a piece, not a sticker
  const face = eye
    .clone()
    .sub(to)
    .normalize()
    .applyAxisAngle(new Vector3(0, 1, 0), -0.42);
  face.y += 0.12;
  return { to, eye, face: face.normalize() };
})();

const v3 = (v: Vector3): [number, number, number] => [v.x, v.y, v.z];

/** The shots of this volume on the stand: the stage's, the battery's and the slice's. */
export function worldShots() {
  const sliceShot: Shot = {
    position: v3(SLICE_AT.eye),
    target: v3(SLICE_AT.to.clone().add(new Vector3(-0.55, -0.55, 0))),
    fov: STAGE_FOV,
    fit: { center: v3(SLICE_AT.to.clone().add(new Vector3(-0.6, -0.7, 0))), radius: 2.3 },
    orbit: { azimuth: 0.4, polar: 0.2, zoom: [0.8, 1.3] },
  };
  // the open cut and the whole loop with the lamp: the cut in front, the lamp far right (`trick/loop`, `life/*`)
  const b = battery();
  const loopTarget = b.centre.clone().add(new Vector3(1.55, 0.1, -1.2));
  const loopShot: Shot = {
    position: v3(loopTarget.clone().add(new Vector3(-0.9, 5.3, 6.2))),
    target: v3(loopTarget),
    fov: STAGE_FOV,
    fit: { center: v3(loopTarget), radius: 3 },
    orbit: { azimuth: 0.4, polar: 0.2, zoom: [0.8, 1.3] },
  };
  // the stand with the meter whole in the frame (the meter lies on the table in front of the board)
  const st = STAGE_SHOTS.stand;
  const p0 = st.position as readonly number[];
  const t0 = st.target as readonly number[];
  const standMeter: Shot = {
    ...st,
    position: [p0[0]! - 0.3, p0[1]! - 0.2, p0[2]! + 1.3],
    target: [t0[0]! - 0.3, t0[1]! - 0.55, t0[2]! + 1.1],
  };
  return { ...STAGE_SHOTS, ...BATTERY_SHOTS, slice: sliceShot, loop: loopShot, standMeter };
}

export interface BatteryWorld {
  ctx: ChapterContext;
  stage: CircuitStage;
  cell: BatteryInside;
  gauge: GaugeModel;
  slice: Slice;
  /** The micro world in front of the slice (its shots are registered: `grains`, `atoms`, `sep`, `pair`, `lensOn`). */
  micro: Micro;
  /** The lengthwise cut 0 closed … 1 open. */
  cut: Scrub;
  /** The battery's life 0 fresh … 1 dead (cut, slice, lamp, meter). */
  life: Scrub;
  /** The slice: its way out, the telescope, the lye, the heat. */
  out: Scrub;
  spread: Scrub;
  lye: Scrub;
  heat: Scrub;
  /** The meter: `want` 0 away … 1 on the table; each probe 0 resting … 1 on its clamp; `volts` override or null. */
  meter: { want: number; minus: number; plus: number; volts: number | null };
  /** Electrons running along the wire while a current flows (`trick` on). */
  sparks: WireSparks;
  /** 0 / 1: the sparks may show (the current decides whether they run). */
  sparksOn: number;
  /** The needle now (volts). */
  readonly volts: number;
  /** Current through the lamp now, A (0 with the switch open). */
  readonly amps: number;
  /** The switch: param `closed` 0 / 1 (the slider and the filament follow with their inertia). */
  readonly closed: number;
  setClosed(on: boolean, instant?: boolean): void;
  /** The reader may flip the switch now (steps set it); `flips` counts the reader's taps since the step's entry. */
  switchLive: boolean;
  flips: number;
  /** The charges on the poles (cyan dots on the minus, coral rings on the plus): off until `trick` explains them. */
  setPoleDots(on: boolean): void;
  /** An invisible hit sphere at a world point (for the battery's ends and other small targets). */
  hitAt(at: Vector3, radius: number, name: string): Mesh;
  /** 0 … 1: a bare wire lies across the poles (`care`): the lamp goes out, the meter drops, the reaction races. */
  short: number;
  /** The open cut's own soft key light while the step looks into it (0 / 1). */
  island: number;
  /** Stage state for a step: shot, switch, wire tint. */
  state(camera: ShotName, opts?: { closed?: 0 | 1; poles?: number }): StepSpec;
  /** Re-derive a step's scrubbed numbers at entry (deep links snap them). */
  reset(
    values: Partial<Record<'cut' | 'life' | 'out' | 'spread' | 'lye' | 'heat', number>>,
    instant: boolean,
  ): void;
  update(dt: number, t: number): void;
}

export function mountBattery(ctx: ChapterContext): BatteryWorld {
  const stage = mountStage(ctx);
  ctx.camera.shots(worldShots());
  const cell = stage.stand.battery.inside;
  const gauge = stage.tools.gauge;
  for (const probe of Object.values(gauge.probes)) probe.on = 0;
  gauge.shown = 0;
  cell.hold = false;
  cell.surplus = cell.lack = 0;

  const slice = createSlice();
  ctx.root.add(slice.group);
  const b = battery();
  slice.place(b.centre, b.axis, SLICE_AT.to, SLICE_AT.face);
  const micro = createMicro(slice);
  ctx.root.add(micro.group);
  ctx.camera.shots(micro.shots());

  const scrubs = {
    cut: scrub(0, 0.3),
    life: scrub(0, 0.35),
    out: scrub(0, 0.45),
    spread: scrub(0, 0.3),
    lye: scrub(1, 0.4),
    heat: scrub(0, 0.5),
  };
  let closed = 0;
  ctx.stage.param('closed', 0, { duration: 0.01, onChange: (v) => (closed = v) });
  ctx.stage.param('poles', 0, { duration: 0.8, onChange: (v) => (stage.poles = v) });

  // the switch's slider as a direct control: a generous invisible hit volume on it
  const hit = new Mesh(
    new SphereGeometry(0.34, 16, 10),
    new MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
  );
  hit.name = 'switch-hit';
  stage.stand.slider.add(hit);
  ctx.qa.probe('switch', stage.stand.slider);
  ctx.qa.probe('battery-minus', () => b.minus.clone());
  ctx.qa.probe('battery-plus', () => b.plus.clone());

  const meter = { want: 0, minus: 0, plus: 0, volts: null as number | null };
  let needle = 0;
  const probesOn = { minus: 0, plus: 0 };
  const sparks = createWireSparks(stage.base.frame);
  violetIons(stage.stand.battery.group);
  let amps = 0;
  // the lamp's heat is the battery model's chain; the stage keeps the switch and the filament's inertia
  stage.glowOf = () => heatOfCurrent(loadCurrent(scrubs.life.shown)) * (1 - world.short);

  const world: BatteryWorld = {
    ctx,
    stage,
    cell,
    gauge,
    slice,
    micro,
    ...scrubs,
    meter,
    sparks,
    sparksOn: 0,
    get volts() {
      return needle;
    },
    get amps() {
      return amps;
    },
    get closed() {
      return closed;
    },
    setClosed(on, instant = true) {
      ctx.stage.setParam('closed', on ? 1 : 0, { instant });
    },
    setPoleDots(on) {
      cell.hold = on;
      cell.surplus = cell.lack = on ? cell.mark : 0;
    },
    hitAt(at, radius, name) {
      const m = new Mesh(
        new SphereGeometry(radius, 16, 10),
        new MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
      );
      m.name = name;
      m.position.copy(at);
      ctx.root.add(m);
      ctx.qa.probe(name, m);
      return m;
    },
    switchLive: false,
    flips: 0,
    short: 0,
    island: 0,
    state: (camera, opts = {}) => ({
      camera,
      params: { closed: opts.closed ?? 0, poles: opts.poles ?? 1 },
      post: camera === 'stand' ? STAGE_POST.stand : STAGE_POST.lamp,
    }),
    reset(values, instant) {
      for (const [k, v] of Object.entries(values) as [keyof typeof scrubs, number][]) {
        const s = scrubs[k];
        s.drag = false;
        if (instant) snap(s, v);
        else s.target = v;
      }
    },
    update(dt, t) {
      for (const s of Object.values(scrubs)) glide(s, dt);
      const life = scrubs.life.shown;
      cell.cut = scrubs.cut.shown;
      cell.life = life;
      cell.island = world.island;
      stage.charge = 1 - life;
      stage.closed = closed;
      cell.current = Math.max(closed, world.short);
      slice.out = scrubs.out.shown;
      slice.spread = scrubs.spread.shown;
      slice.lye = scrubs.lye.shown;
      slice.life = life;
      slice.heat = scrubs.heat.shown;
      slice.update(dt, t);
      micro.update(dt, t, ctx.camera.camera);
      // the meter slides on and off the table (0.9 s), the probes travel to the clamps and back (0.7 s)
      const k = Math.min(Math.abs(meter.want - gauge.shown), dt / 0.9);
      if (k > 0) gauge.shown += Math.sign(meter.want - gauge.shown) * k;
      for (const id of ['minus', 'plus'] as const) {
        const want = gauge.shown > 0.98 ? meter[id] : 0;
        const kp = Math.min(Math.abs(want - probesOn[id]), dt / 0.7);
        if (kp > 0) probesOn[id] += Math.sign(want - probesOn[id]) * kp;
        const e = probesOn[id];
        gauge.probes[id].on = e * e * (3 - 2 * e);
      }
      // shorted, the poles are joined by copper: almost nothing is left between them
      const open = gauge.touching ? meterVoltage(life, closed) : 0;
      const target = meter.volts ?? open * (1 - 0.95 * world.short);
      needle = followVoltage(needle, target, dt);
      if (Math.abs(needle - gauge.value) > 1e-4) gauge.value = needle;
      amps = closed * loadCurrent(life);
      sparks.amps = world.sparksOn * amps;
      sparks.update(dt);
      stage.update(dt, t);
    },
  };

  ctx.input.register(hit, {
    cursor: 'pointer',
    enabled: () => world.switchLive,
    click: () => {
      if (!world.switchLive) return;
      world.flips++;
      world.setClosed(closed < 0.5);
    },
  });
  return world;
}
