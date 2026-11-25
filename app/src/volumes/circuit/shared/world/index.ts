/**
 * The composed world of the volume `circuit`: the stand (`shared/stage`) and the copper world (`shared/copper`)
 * in one scene, one number for the floor (`deep`), the flight through the lens between them and back, and the
 * floor for the map's ruler and the «де ми» cue. A chapter mounts it once, describes its steps with
 * `world.define` (instead of `ctx.stage.define`) and forwards `enterStep` / `update`. See README.md.
 */
import { Vector3 } from 'three';
import {
  damp,
  floorLabel,
  type ChapterContext,
  type PostOverrides,
  type StepInfo,
  type StepSpec,
  type VolumeManifest,
} from '@/engine/api';
import {
  HANDOVER,
  STAGE_POST,
  STAGE_SHOTS,
  WIRE,
  mountStage,
  type CircuitStage,
  type LensPose,
} from '@circuit/shared/stage';
import { createCopper, type Copper } from '@circuit/shared/copper/copper';
import { mountAtHandover } from '@circuit/shared/copper/mount';
import { copperShots } from '@circuit/shared/copper/shots';
import { AWAY_MOON, AWAY_POST, AWAY_SHOT } from './away';
import { setWhereBase } from '@/hud/where';
import { HOLD, createBorders, type Borders } from './border';
import { createDiveRail } from './dive';
import { createFlight } from './flight';
import { floorAt, floorValue, mixAt, type FloorId } from './levels';
import { createLook } from './look';
import { createLensWindow, type LensWindow } from './window';
import { registerParams, type WorldParam } from './params';
import { createSway, type Sway } from './sway';

export * from './levels';
export { STOP_SHOTS } from './flight';
export { LENS_LEG } from './dive';
export { AWAY_FOCUS, AWAY_MOON, AWAY_POST, AWAY_SHOT } from './away';
export type { WorldParam } from './params';
export { BORDERS, borderOf, type BorderState, type Borders } from './border';

export interface WorldOptions {
  /** Radius of the lamp's globe (`mountStage` option; default = the stage's default). */
  globe?: number;
  /** Share of the electrons' speed their common shift reaches when the lamp is fully on (0 = never shown). */
  drift?: number;
}

export interface CircuitWorld {
  stand: CircuitStage;
  copper: Copper;
  /** Scale of the copper world's mount at the hand-over (for `copperPost`, counter-scaled labels). */
  scale: number;
  /** `deep` now (0 stand … 1 «жила» … 2 «ряди» … 3 «один атом»), as the stage param moves it. */
  readonly deep: number;
  /** The volume map's axis value now: stand 3 … one atom 0 (continuous). */
  readonly floor: number;
  /** The nearest floor's id (the `axis.floors` ids of volume.json). */
  readonly floorId: FloorId;
  /** The name of the current floor for a «де ми» cue (plain name until the step that names it was visited). */
  floorName(volume: VolumeManifest, visited: Readonly<Record<string, readonly string[]>>): string;
  /** The lens as a window onto «ряди» (param `window` 0…1 opens it; `span` = copper units across it). */
  window: LensWindow;
  /**
   * Another resting place of the lens over the near wire for a step on the stand (board frame, see `LensPose`);
   * the lens glides there from `poses.overWire` while the reader is on the stand. `null` = the stage's own pose.
   */
  lensPose: LensPose | null;
  /** Share of the speed of the electrons' common shift at full glow (default 0.05; 0 hides it). */
  drift: number;
  /**
   * Called every frame right after the stand has laid the lens (and `lensPose`), before the lens window is placed:
   * a chapter that carries the lens itself lays it here, so the window opens where the lens is. Default none.
   */
  afterLens: ((dt: number) => void) | null;
  /**
   * Lens mode's camera sway (`sway.ts`): a chapter's lens mode holds / releases it; applied while the dive rail
   * owns the camera (reset at every step entry).
   */
  readonly sway: Sway;
  /** A registered param's live value (`deep`, `lens`, `closed`, …). */
  value(name: WorldParam): number;
  /** True while a flight between floors is under way (input that changes the floor should wait). */
  readonly flying: boolean;
  /** Describe the steps (passed to `ctx.stage.define`; `params` may use every `WorldParam`). */
  define(steps: Record<string, StepSpec>): void;
  /** Fly to a floor within a step: lens leg if needed, then a travel on the dive rail, then the step's camera. */
  fly(deep: number, camera: string, info?: Pick<StepInfo, 'scope'>, lens?: number): void;
  /**
   * The dive as a position −½…3 (−`LENS_LEG` the stand plan, the lens in its holder · 0 the lens over the wire ·
   * 1 «жила» · 2 «ряди» · 3 «один атом»): the frame — camera, the lens, `deep`, every dissolve — is a function of it.
   * The lens leg −½…0 is the take of the lens (it rises, crosses the stand and settles on the near wire; the camera comes
   * with it); a slider that starts at the lens over the wire simply uses 0…3. `scrub` follows the hand; `travelTo`
   * glides there (eased, speed-limited: a click on a slider's track, a programmatic move). Both take the camera
   * from the stage until the next step entry, and engaging never cuts (an orbit or drift on screen fades out).
   */
  scrub(t: number): void;
  /** `seconds`: glide in exactly that long (eased in and out) instead of at the rail's pace — a rewind. */
  travelTo(t: number, seconds?: number): void;
  /** Let the rail go where it is: the stage has the camera again (a step's own motion takes over from here). */
  release(): void;
  /** Where the rail is now (−½…3) and where it is going (before it engages: the position the stand's state shows). */
  readonly position: number;
  readonly goal: number;
  /** Glide the rail to 0 (the lens on the wire, the camera at the rail's start); from the stand: the lens leg. */
  takeLens(): void;
  /**
   * The entry flight of a chapter that starts below the stand (call from `enterStep` after `world.enterStep`, e.g.
   * on the first step when the reader comes from the previous chapter): jump to the stand plan with the lens in
   * its holder, then fly down to the step's own floor and camera. Returns the seconds it takes.
   */
  flyIn(id: string, info?: Pick<StepInfo, 'scope'>): void;
  /** Chapter borders: the walk to the shared border frame and the arrival from it (`border.ts`). */
  border: Borders;
  /** Forward from the scene's `enterStep`. Re-choreographs a change of floor as a flight; snaps on deep links. */
  enterStep(id: string, info: StepInfo): void;
  /** Forward from the scene's `update`. */
  update(dt: number, t: number): void;
}

/** Seconds of the first move of `flyIn`: from the «away» frame to the lens over the wire. */
const ENTRY_LEAD = 2.6;

export function mountWorld(ctx: ChapterContext, opts: WorldOptions = {}): CircuitWorld {
  const stand = mountStage(ctx, opts.globe === undefined ? {} : { globe: opts.globe });
  const copper = createCopper(ctx);
  ctx.root.add(copper.group);
  // a hair wider than the stand's own core, so the dissolve never fights it for the same depth
  const atHandover = (): number =>
    mountAtHandover(copper.group, {
      point: HANDOVER.spot.toArray(),
      view: HANDOVER.direction.toArray(),
      axis: [1, 0, 0],
      coreRadius: WIRE.core * 1.012,
    });
  const scale = atHandover();
  const win = createLensWindow(stand.tools.lens);
  let windowMode = false;
  /** How far the lens window is open (0…1): opens over ≈ 0.6 s, closes at once. */
  let iris = 0;
  let frameDt = 0;
  let poseWeight = 0;
  let poseSnap = false;
  let lastPose: LensPose | null = null;
  // the stand owns the magnifier's rim on the lower floors (`tools.lens.rim`); the copper world's own stays off
  copper.rim.amount = 0;
  copper.group.visible = false;
  const lower = copperShots(copper.group, 'copper-');
  ctx.camera.shots({ ...STAGE_SHOTS, ...lower, away: AWAY_SHOT });
  const params = registerParams(ctx, stand);
  const look = createLook(ctx, stand, copper, scale);
  // QA: the hero atom of the copper world (its origin), for colour checks of the lower floors
  const hero = new Vector3();
  ctx.qa.probe('copper-hero', () => copper.space.localToWorld(hero.set(0, 0, 0)));
  const rail = createDiveRail(
    [STAGE_SHOTS.lens, STAGE_SHOTS.handover, lower['copper-rows']!, lower['copper-atom']!],
    // the lens leg starts on the stand plan (`prologue/dive`'s camera)
    STAGE_SHOTS.stand,
  );
  const sway = createSway(ctx.reducedMotion);
  const flight = createFlight(
    ctx,
    rail,
    () => params.deep.value,
    () => params.lens.value,
    sway,
  );
  // the header's floor chip (`hud/where.ts`): the stand, or the floor of a dive — never the chapter's own floor
  // while the camera is elsewhere (a floor ladder's report, where a chapter has one, wins over this)
  const whereKey = `${ctx.manifest.volume}/${ctx.manifest.id}`;
  ctx.onDispose(() => setWhereBase(whereKey, null));
  const specs: Record<string, StepSpec> = {};
  /** `flyIn` waits out the border hold before it moves. */
  let flyInAfter: { wait: number; go(): void } | null = null;
  const standPost = (): PostOverrides => specs[ctx.stage.current ?? '']?.post ?? STAGE_POST.stand;
  const border = createBorders(ctx.manifest.id, {
    ctx,
    specs,
    value: (name) => params.all.get(name as WorldParam)?.value ?? Number.NaN,
    get deep() {
      return params.deep.value;
    },
    get flying() {
      return flight.flying;
    },
    release: () => flight.release(),
    fly: (deep, camera, lens) => flight.fly({ deep, camera, lens }),
    travel: (t, seconds) => flight.travelTo(t, seconds),
    snap() {
      rail.set(0);
      iris = 0;
      stand.snap();
      apply();
      look.assert(false, { instant: true, standPost: STAGE_POST.stand });
    },
  });
  const world: CircuitWorld = {
    stand,
    copper,
    scale,
    window: win,
    border,
    lensPose: null,
    drift: opts.drift ?? 0.05,
    afterLens: null,
    sway,
    get deep() {
      return params.deep.value;
    },
    get floor() {
      return floorValue(params.deep.value);
    },
    get floorId() {
      return floorAt(params.deep.value);
    },
    floorName(volume, visited) {
      const id = floorAt(params.deep.value);
      const floor = volume.journey.axis.floors.find((f) => f.id === id);
      return floor ? floorLabel(volume, floor, visited) : '';
    },
    get flying() {
      return flight.flying;
    },
    value(name) {
      return params.all.get(name)!.value;
    },
    define(steps) {
      Object.assign(specs, steps);
      ctx.stage.define(steps);
    },
    fly(deep, camera, _info, lens = 1) {
      flight.fly({ deep, camera, lens });
    },
    scrub: (t) => flight.scrub(t),
    travelTo: (t, seconds) => flight.travelTo(t, seconds),
    release: () => flight.release(),
    takeLens: () => flight.takeLens(),
    get position() {
      return flight.engaged ? rail.position : rail.positionOf(params.deep.value, params.lens.value);
    },
    get goal() {
      return flight.engaged ? rail.target : rail.positionOf(params.deep.value, params.lens.value);
    },
    flyIn(id) {
      const spec = specs[id];
      if (!spec) return;
      ctx.stage.setParam('deep', 0, { instant: true });
      ctx.stage.setParam('lens', 0, { instant: true });
      // the reader leaves the prologue on the «away» frame (the stand behind the map board): start right there and
      // move on in one go — the focus pulls from the board's plane onto the stand while the camera comes in
      ctx.camera.go('away', { instant: true });
      // the prologue's map left the room's cold light low: it comes back up with the move
      ctx.stage.setParam('moon', AWAY_MOON, { instant: true });
      apply();
      look.assert(false, { instant: true, standPost: AWAY_POST });
      flight.release();
      // the border frame holds while the platform cross-fades the two equal frames (`border.ts` HOLD), then moves
      flyInAfter = {
        wait: HOLD,
        go() {
          ctx.stage.setParam('moon', (spec.params?.moon as number | undefined) ?? 1, { duration: ENTRY_LEAD });
          ctx.post.apply(STAGE_POST.stand, { duration: ENTRY_LEAD * 0.8 });
          flight.fly(
            { deep: spec.params?.deep ?? 0, camera: spec.camera as string, lens: spec.params?.lens ?? 1 },
            ENTRY_LEAD,
          );
        },
      };
    },
    enterStep(id, info) {
      flyInAfter = null;
      sway.reset();
      const spec = specs[id];
      const to = spec?.params?.deep ?? 0;
      const from = info.instant ? to : params.deepBefore;
      // a new step takes the camera back from the dive rail, unless the floor changes: then the rail flies it
      flight.release();
      if (!info.instant && Math.abs(to - from) > 1e-3 && spec?.camera !== undefined) {
        // the stage started straight tweens and a straight camera move; replace them with the flight
        ctx.stage.setParam('deep', from, { instant: true });
        flight.fly({ deep: to, camera: spec.camera as string, lens: spec.params?.lens ?? 0 });
      }
      if (info.instant) {
        rail.set(to);
        iris = to < 0.005 ? params.window.value : 0; // a deep link shows the window already open
      }
      if (info.instant) {
        stand.snap();
        copper.snap();
        poseSnap = true; // the chapter may set `lensPose` after this call; the next update lands on it
      }
      apply();
      look.assert(mixAt(params.deep.value).below, { instant: info.instant, standPost: standPost() });
    },
    update(dt, t) {
      frameDt = dt;
      if (flyInAfter && (flyInAfter.wait -= dt) <= 0) {
        const { go } = flyInAfter;
        flyInAfter = null;
        go();
      }
      border.update(dt);
      sway.step(dt);
      flight.update(dt);
      stand.update(dt, t);
      const toPose = world.lensPose && params.deep.value < 0.01 && params.lens.value > 0.99 ? 1 : 0;
      poseWeight = poseSnap ? toPose : damp(poseWeight, toPose, 3.2, dt);
      poseSnap = false;
      if (Math.abs(poseWeight - toPose) < 1e-3) poseWeight = toPose;
      if (poseWeight > 0 && (world.lensPose ?? lastPose)) {
        lastPose = world.lensPose ?? lastPose;
        const k = poseWeight * poseWeight * (3 - 2 * poseWeight);
        stand.tools.lens.setPose(stand.tools.poses.overWire, lastPose!, k);
      }
      world.afterLens?.(dt);
      apply();
      copper.lamp = stand.glow;
      copper.sim.drift = -world.drift * stand.glow;
      if (copper.group.visible) {
        copper.update(dt, t);
        // the dissolve: the copper core appears over the stand's own core (dithered, no blending)
        copper.core.fade *= mixAt(params.deep.value).copperIn;
        copper.core.update(copper.group.matrixWorld);
      }
      look.update(mixAt(params.deep.value).below, copper.depth, standPost());
      params.deepBefore = params.deep.value;
      setWhereBase(whereKey, params.deep.value > 0.01 ? floorAt(params.deep.value) : 'stand');
    },
  };
  function apply(): void {
    const mix = mixAt(params.deep.value);
    // the window shows «ряди» inside the resting lens, only on the stand and never during the dissolve
    // and only once the camera is out of the ring (at the lens shot or beyond): it opens like an iris from there
    const want = params.deep.value < 0.005 && !mix.copperShown ? params.window.value : 0;
    iris =
      want > iris
        ? Math.min(want, iris + frameDt * 1.6)
        : win.closeSeconds > 0
          ? Math.max(want, iris - frameDt / win.closeSeconds)
          : want;
    const open = iris;
    const inWindow = open > 0.002;
    if (inWindow !== windowMode) {
      windowMode = inWindow;
      if (!inWindow) atHandover();
      win.clip(copper.group, inWindow);
      copper.snap();
    }
    if (inWindow) win.place(copper.group);
    win.amount = open;
    win.update();
    stand.dive = mix.standDive;
    stand.group.visible = mix.standShown;
    copper.group.visible = mix.copperShown || inWindow;
    copper.depth = inWindow ? 1 : mix.copperDepth;
  }
  return world;
}
