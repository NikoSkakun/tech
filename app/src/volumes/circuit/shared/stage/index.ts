/**
 * The table floor of the volume `circuit`: the demonstration stand in a dark room (VISUAL.md §2).
 * A chapter mounts it once in its scene factory and drives it through plain parameters — see README.md.
 */
import { Group, Quaternion, Vector3, type Mesh } from 'three';
import { damp, type ChapterContext } from '@/engine/api';
import { KToonMaterial } from '@/style';
import { createAir } from './air';
import { createBase, type Base } from './base';
import { createCrawlScene, type CrawlScene } from './crawl-scene';
import { createLight, type LightRig } from './light';
import { tame } from './materials';
import { createRoom, type Room } from './room';
import { STAGE_POST } from './shots';
import { createStand, type Stand } from './stand';
import { createTools, type Tools } from './tools';
import { createTorch, torchDims, type Torch } from './torch';
import { bulbDims, type BulbDims } from './bulb';
import { temperatureOfHeat } from './bulb-heat';
import { createBulbPrint } from './bulb-print';
import { createLampView, type LampView } from './lamp-view';
import { createThermal } from './bulb-thermal';
import { UNFOLD_PLAY, createUnfold, type Unfold } from './unfold';

export * from './layout';
export { BOARD_Y } from './base';
export { HANDOVER, LENS_OVER_WIRE, STAGE_FOV, STAGE_POST, STAGE_SHOTS, boardToWorld } from './shots';
export { filamentColor } from './light';
export { BEATS, UNFOLD_PLAY, UNFOLD_SECONDS } from './unfold';
export * from './tools';
export { CRAWL_SECONDS } from './crawl-scene';
export * from './bulb-heat';
export { LAMP_SHOTS, lampLensPose } from './lamp-shots';
export { DETAIL_FAR, DETAIL_NEAR } from './lamp-view';
export type { LampAnchor, LampPath, LampView } from './lamp-view';
export type { LampMarks } from './bulb-close';
export * from './battery-cell';
export { BATTERY_LAYERS, type BatteryLayer } from './battery-section';
export { BATTERY_SHOTS, CUT_NORMAL, type BatteryInside } from './battery-inside';
export { POLE_DOTS, POLE_MARK, type Clump } from './battery-poles';
export { createStandHands, type StandHands, type StandHandsOptions } from './hands';
export { createLoopGlow, loopShare, type LoopGlow } from './loop-glow';
export type { CrawlAnchors, CrawlScene } from './crawl-scene';

export interface CircuitStage {
  /** Everything of the table floor; already added to `ctx.root`. */
  group: Group;
  room: Room;
  base: Base;
  stand: Stand;
  torch: Torch;
  tools: Tools;
  light: LightRig;
  /**
   * The unfolding: 0 = the flashlight lying on the board … 1 = the stand (default). One number, both ways;
   * `unfold × UNFOLD_SECONDS` is the time on the six-beat timeline (`BEATS`).
   */
  unfold: number;
  /** Read-only helpers of the unfolding (`beatOf(u)`, `beat6`). */
  unfolding: Unfold;
  /** Switch: 0 = open (the gap shows, lamp dark) … 1 = closed. The slider follows; the lamp heats up and cools. */
  closed: number;
  /**
   * 1 (default) = the battery is in its clamps and the lamp screwed into its socket; 0 = one of them is out (the
   * reader's hands, `hands/`): the circuit is broken whatever the switch shows, and the lamp cools by its own inertia.
   */
  contact: number;
  /** The lamp's dimensions (globe radius etc.) this stage was built with. */
  readonly bulbDims: BulbDims;
  /** The magnifier: 0 = in its holder … 1 = in use over the near wire (`LENS.wireSpot`). */
  lens: number;
  /** The dive through the ring: 0 … 1 = the hand-over pose (rim arcs appear, the wire's sheath dissolves). */
  dive: number;
  /** 0…1: the step asks the reader to take the magnifier — the resting ring turns full cyan (default 0: quiet). */
  lensCall: number;
  /**
   * @deprecated Nothing reads these any more (the front ruler, the spark's pin and the race track are gone —
   * the snail lives in `crawlScene`). Kept as inert numbers only until `shared/world/params.ts` drops its
   * params of the same names (docs/requests/W1-circuit-stage.md §7); then they go.
   */
  snail: number;
  ruler: number;
  spark: number;
  race: number;
  /**
   * The crawl as one entry (README «Crawl», DECISIONS §60 t): `crawlScene.show()` / `.hide()` bring the snail
   * along the wire, the magnifier on the wire's start and its scale in and out as one motion; `crawlScene.time`
   * (seconds of true time, 0 … `.duration`) places everything, the lamp and the switch included. A chapter
   * needs nothing else of the crawl; the fields below are what it writes.
   */
  crawlScene: CrawlScene;
  /**
   * The crawl's raw state (DECISIONS §60 r–s): `crawlShown` 0…1 brings up the snail on its lane beside the wire (from the
   * battery's minus toward the lamp), the centimetre ticks along it, and — with `lens = 1` — lays the magnifier
   * on the start of that wire (`tools.poses.overStart`). `crawl` is SECONDS OF TRUE TIME: every frame is a
   * function of that one number, both ways (bind it to a scrub slider, 0 … `tools.crawl.duration`).
   * `tools.crawl.lengthCm` is the snail's way, `tools.crawl.scaleMm` what one spark covers meanwhile.
   * The lamp is the chapter's: `closed = crawl > 0 ? 1 : 0` gives «light at once». Shot `STAGE_SHOTS.crawl`.
   */
  crawl: number;
  crawlShown: number;
  /** The magnifier shows the wire's first centimetre enlarged 0…1 (default 0; the crawl sets it). */
  loupe: number;
  /**
   * Ambient lift of the unlit room 0…1 (default 0.5; 0 = the first, darker look). Only the dark states get
   * lighter — the flashlight before the click, the open circuit, the dead battery; with the lamp on nothing changes.
   */
  ambient: number;
  /**
   * How much the wires tell plus from minus: 0 = both sheaths nearly the same neutral tint (default — the
   * prologue and chapters 1–2 know no poles) … 1 = `coral` from the plus, `blue` from the minus (from
   * `battery/poles` on, VISUAL.md §4).
   */
  poles: number;
  /** Battery: 1 fresh … 0 dead (limits the lamp's glow and shows on the battery's band). */
  charge: number;
  /**
   * The lamp's heat 0…1 for a `charge` with the circuit closed (default `glowOfCharge`). `drain` puts the
   * battery model's chain here (`heatOfCurrent(loadCurrent(life))`), so light, meter and counter tell one story;
   * the switch and the filament's inertia still apply.
   */
  glowOf: (charge: number) => number;
  /** Strength of the cold moon 0…1 (0 in `prologue/click`: the lamp is the only light in the frame). */
  moon: number;
  /**
   * Glow of the filament 0…1 as shown right now (read-only: it follows `closed × charge` with the filament's
   * thermal inertia). Use `setGlow` to scrub it by hand (`lamp/glow`).
   */
  readonly glow: number;
  /** Take the filament's glow under manual control (a number) or give it back to the circuit (`null`). */
  setGlow(value: number | null): void;
  /**
   * The lamp close up (README «The lamp close up»): `heat` (= `glow`) and `celsius`, the close-up `detail`, the
   * opening of the base `cut`, the heat view `thermal`, the current's `path` and `anchors`.
   */
  lamp: LampView;
  /** Jump to the state without the heating / cooling ramp (deep links). */
  snap(): void;
  /**
   * Write the unfolding's poses again now, for the `unfold` there is. The stage poses its parts only when `unfold`
   * or the slider changes; whoever else moves the battery or the lamp (the reader's hands, `hands/`) calls this
   * when it lets go of them, so the parts are always where the unfolding has them — inside the closed flashlight
   * at `unfold` 0, in their places on the stand at 1.
   */
  repose(): void;
  /**
   * Play the unfolding by itself: `unfold` runs to 1 (or back to 0 with `to = 0`) in `seconds` for the whole
   * way (default `UNFOLD_PLAY.seconds`), from wherever it is. Returns a live handle: `progress` 0…1, `done`.
   * Setting `unfold` by hand or calling it again takes over.
   */
  playUnfold(seconds?: number, to?: 0 | 1): UnfoldPlay;
  update(dt: number, t: number): void;
}

/** What the lamp shows for a battery charge (VISUAL.md §5.8): white while fresh, orange when tired, dark when dead. */
export function glowOfCharge(charge: number): number {
  const c = Math.min(Math.max(charge, 0), 1);
  return c <= 0.04 ? 0 : 0.16 + 0.84 * ((c - 0.04) / 0.96) ** 0.55;
}

/** Apply `tame()` to every lit K material below `root` (call again after adding tools or props). */
export function tameAll(root: Group): void {
  root.traverse((o) => {
    const material = (o as Mesh).material;
    for (const m of Array.isArray(material) ? material : material ? [material] : []) {
      if (m instanceof KToonMaterial) tame(m);
    }
  });
}

/** Handle of a running `playUnfold`. */
export interface UnfoldPlay {
  readonly progress: number;
  readonly done: boolean;
}

/** How much the crawl lifts the unlit room's ambient light while it is shown (on top of `ambient`). */
const CRAWL_AMBIENT = 0.5;

export interface StageOptions {
  /**
   * Radius of the lamp's glass globe (default `LAMP.glass` = 0.66 — 16 % of the frame height in the main
   * shot). The flashlight's head is built around it, so the lamp never changes size in the unfolding.
   */
  globe?: number;
}

export function mountStage(ctx: ChapterContext, options: StageOptions = {}): CircuitStage {
  const bulb = bulbDims(options.globe);
  const torchSize = torchDims(bulb);
  const group = new Group();
  group.name = 'circuit-stage';
  ctx.root.add(group);
  ctx.env.setScale(3.6);
  ctx.post.base(STAGE_POST.stand);
  const room = createRoom(ctx);
  const base = createBase();
  const stand = createStand(bulb);
  const torch = createTorch(torchSize, bulb);
  base.frame.add(stand.group, ...torch.parts);
  group.add(room.group, base.group);
  const unfolding = createUnfold(stand, torch, torchSize, bulb);
  const tools = createTools(ctx, base.frame);
  tameAll(group);
  const air = createAir(ctx);
  group.add(air.motes);
  torch.glass.add(air.beam);
  tameAll(group);

  // on a phone the print on the battery would be under 14 px: the chapter labels it in the interface instead
  // (`stand.stand.battery.printAnchor`)
  // «0,3 A» on the lamp's base (`flow/count`): laid here, where the fonts are loaded
  const bulbPrint = (stand.bulb.print = createBulbPrint(stand.bulb.group, bulb.threadRadius));
  const phonePrint = (): void => {
    stand.battery.printShown = ctx.device.formFactor !== 'phone';
    bulbPrint.shown = ctx.device.formFactor !== 'phone';
  };
  phonePrint();
  ctx.onResize(phonePrint);
  const light = createLight(ctx, stand.bulb.filament);
  ctx.env.setShadow({ extent: 5.4, center: [0, 0.8, 0], softness: 4 });
  let glow = 0;
  let manual: number | null = null;
  let slider = 0;
  let shown = '';
  let play: { from: number; to: number; elapsed: number; total: number; last: number } | null = null;
  let time = 0;
  const lampWorld = new Vector3();
  const lampView = createLampView(
    stand.bulb.close,
    stand.bulb.filament,
    () => glow,
    temperatureOfHeat,
    createThermal({
      root: stand.group,
      glass: tools.lens.glass,
      bulb: stand.bulb.group,
      stemY: 0.6,
      filamentY: bulb.filamentY,
    }),
  );
  const cameraAt = new Vector3();
  stand.bulb.close.cutAlso(stand.mounts.lampPost!); // the socket opens with the lamp's base
  const axisWorld = new Vector3();
  const frameQ = new Quaternion();
  const bounceOffset = new Vector3();
  const scene = createCrawlScene(tools);
  // while the crawl is shown the switch follows its time (on above 0); otherwise the chapter's `closed`
  const closedNow = (): number => scene.closed() ?? stage.closed;
  const target = (): number => manual ?? closedNow() * stage.contact * stage.glowOf(stage.charge);
  const apply = (): void => {
    const key = `${stage.unfold.toFixed(5)}|${slider.toFixed(4)}`;
    if (key !== shown) {
      shown = key;
      unfolding.set(stage.unfold, 1 - slider);
    }
    stand.battery.charge = stage.charge;
    // switching ON: the light is there in the frame of the click (the script's «тієї ж миті»); only the coil's
    // colour takes its tenth of a second. Switching off, light and coil cool together.
    // the crawl's dark frame (time 0) is lifted a little more: the lamp and the snail must be found in it
    const ambient = Math.min(1, stage.ambient + CRAWL_AMBIENT * scene.presence);
    light.set({ glow, moon: stage.moon, light: Math.max(glow, target()), ambient });
    // the working lamp breathes, barely: two slow sines, ±2 % (VISUAL §2: the frame's life)
    const breath = 1 + 0.014 * Math.sin(time * 1.7) + 0.008 * Math.sin(time * 2.9 + 1.3);
    light.lamp.intensity *= breath;
    stand.bulb.setGlow(light.filament, light.emission * breath, glow, stage.moon);
    const room = Math.min(1, 0.25 + 0.75 * Math.max(stage.moon, glow ** 2));
    stand.battery.light = room;
    bulbPrint.light = room;
    bulbPrint.update(ctx.camera.camera);
    // the slider shows in the dark by its own faint glow and hands over to the room's light
    stand.setSliderGlow(1 - Math.max(stage.moon, light.output));
    stand.bulb.filament.getWorldPosition(lampWorld);
    const beam = unfolding.beam;
    axisWorld.copy(unfolding.axis).applyQuaternion(base.frame.getWorldQuaternion(frameQ));
    // bounce light: above the middle of the lamp's pool — in front of the glass while the lamp sits in its
    // mirror, toward the middle of the board once it shines all around
    light.bounce.position
      .copy(lampWorld)
      .addScaledVector(axisWorld, 2.1 * beam)
      .add(bounceOffset.set(-1.1 * (1 - beam), 1.5 * beam + 0.5 * (1 - beam), 0.9 * (1 - beam)));
    tools.set(
      {
        arrive: unfolding.beat6,
        lensUse: stage.lens,
        dive: stage.dive,
        light: room,
        call: stage.lensCall,
        crawl: stage.crawl,
        crawlShown: stage.crawlShown,
        loupe: stage.loupe,
        glow,
      },
      time,
    );
    stand.wires.setPoles(stage.poles);
    stand.wires.setDive(stage.dive);
    lampView.update(ctx.camera.camera.getWorldPosition(cameraAt));
    air.set(lampWorld, light.lamp.color, light.output ** 1.5, beam > 0.02 ? axisWorld : null, beam);
  };
  const stage: CircuitStage = {
    group,
    room,
    base,
    stand,
    torch,
    tools,
    light,
    crawlScene: scene,
    lamp: lampView,
    lens: 0,
    lensCall: 0,
    dive: 0,
    snail: 0,
    ruler: 0,
    spark: 0,
    race: 0,
    crawl: 0,
    crawlShown: 0,
    loupe: 0,
    poles: 0,
    ambient: 0.5,
    unfold: 1,
    unfolding,
    closed: 0,
    contact: 1,
    bulbDims: bulb,
    charge: 1,
    glowOf: glowOfCharge,
    moon: 1,
    get glow() {
      return glow;
    },
    setGlow(value) {
      manual = value;
    },
    playUnfold(seconds = UNFOLD_PLAY.seconds, to = 1) {
      const from = stage.unfold;
      const span = Math.abs(to - from);
      play = { from, to, elapsed: 0, total: Math.max(seconds * span, 1e-3), last: from };
      const mine = play;
      return {
        get progress() {
          return play === mine ? Math.min(mine.elapsed / mine.total, 1) : 1;
        },
        get done() {
          return play !== mine || mine.elapsed >= mine.total;
        },
      };
    },
    repose() {
      shown = '';
      apply();
    },
    snap() {
      play = null;
      glow = target();
      slider = closedNow();
      apply();
    },
    update(dt, t) {
      time = t;
      if (play) {
        // a hand on `unfold` (a step's param, a slider) ends the play
        if (Math.abs(stage.unfold - play.last) > 1e-6) play = null;
        else {
          play.elapsed = Math.min(play.elapsed + dt, play.total);
          stage.unfold = play.last = play.from + (play.to - play.from) * (play.elapsed / play.total);
          if (play.elapsed >= play.total) play = null;
        }
      }
      scene.update(dt, stage);
      tools.update(dt, t);
      stand.battery.inside.lamp = glow;
      stand.battery.inside.update(dt, t);
      // a small filament heats in a few hundredths of a second and cools a little slower; stretched just
      // enough to be seen as a ramp through red and orange, never as a delay
      const to = target();
      glow = manual !== null ? to : damp(glow, to, to > glow ? 16 : 9, dt);
      if (Math.abs(glow - to) < 1e-3) glow = to;
      slider = damp(slider, closedNow(), 22, dt);
      apply();
    },
  };
  stage.snap();
  return stage;
}
