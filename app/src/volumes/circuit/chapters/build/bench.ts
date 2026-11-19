/**
 * The chapter's view of the composed world (`@circuit/shared/world`): the stand, the practicum's wiring (three
 * loose wires, any end into any clamp), the switch and the lamp — and the rule that joins them: the lamp has power
 * exactly when the pure model (`parts/circuit.ts`) says `lit` for the wiring and the switch as they are now. The
 * stage param `closed` therefore means «the lamp has power» in this chapter (as in `flow`); the slider is placed by
 * `parts/switch.ts`.
 */
import type { ChapterContext } from '@/engine/api';
import { BATTERY_SHOTS, LAMP_SHOTS, type CircuitStage } from '@circuit/shared/stage';
import { mountWorld, type CircuitWorld } from '@circuit/shared/world';
import { caption } from './content';
import { verdict, type Verdict } from './parts/circuit';
import { createHands, type Hands } from './parts/hands';
import { createSwap, type Swap } from './parts/swap';
import { switchPart, type SwitchPart } from './parts/switch';
import { END_KEYS } from './parts/ends';
import { createWiring, type Wiring } from './parts/wiring';

/** The lift of the unlit room in the practicum (the stage's default is 0.5; `flashlight` goes back to it). */
export const AMBIENT = 1;

export interface Bench {
  ctx: ChapterContext;
  world: CircuitWorld;
  stage: CircuitStage;
  wiring: Wiring;
  sw: SwitchPart;
  /** The reader's hand on the wires' ends (a step installs its `policy`). */
  hands: Hands;
  /** `find-fault` 3's repair: the far wire C replaced (the stand's `m`, whole). */
  swap: Swap;
  /**
   * Back to the stand as built, every fault gone: the ends travel home (`hop`: each lifts out and goes back in),
   * the stripped copper back on every end, the copper whole. `seconds` 0 = at once.
   */
  restore(seconds: number, hop?: boolean): void;
  /** What the circuit does now (the wiring as it sits, the switch as it is). */
  readonly verdict: Verdict;
  /** The lamp has power now (the param), and is shining (the filament). */
  readonly powered: boolean;
  readonly lit: boolean;
  /** May the reader flip the switch now (a step installs its own rule; default no). */
  switchLive: () => boolean;
  /** The lamp follows the model (off: a step holds the lamp's power itself, e.g. while the stand folds). */
  follow: boolean;
  /**
   * How much the unlit room is lifted (the stage's `ambient`, travels): the practicum's lamp-off frames — the ends
   * out, the faults, the short — read in the cold moonlight; the fold back to the flashlight keeps the prologue's.
   */
  ambient: number;
  snap(): void;
  update(dt: number, t: number): void;
  /** After the world's update: the wires' shapes, the slider. */
  late(dt: number, t: number): void;
}

export function createBench(ctx: ChapterContext): Bench {
  const world = mountWorld(ctx, { drift: 0.06 });
  const stage = world.stand;
  ctx.camera.shots({ ...LAMP_SHOTS, ...BATTERY_SHOTS });
  const wiring = createWiring(stage);
  const sw = switchPart(
    ctx,
    world,
    () => caption('first-light', 1),
    () => bench.switchLive(),
  );
  const hands = createHands(ctx, world, stage, wiring);
  const swap = createSwap(stage, 'm', wiring.lift.m);
  let now: Verdict = 'lit';
  const power = (on: boolean): void => {
    if (world.value('closed') > 0.5 !== on) ctx.stage.setParam('closed', on ? 1 : 0, { instant: true });
  };
  const bench: Bench = {
    ctx,
    world,
    stage,
    wiring,
    sw,
    hands,
    swap,
    restore(seconds, hop = false) {
      swap.finish();
      for (const k of END_KEYS) {
        wiring.ends[k].contact = true;
        wiring.bare[k].go(1, seconds * 0.6);
      }
      wiring.whole.a = wiring.whole.b = wiring.whole.c = true;
      wiring.home(seconds, hop);
      if (seconds <= 0) wiring.snap();
    },
    get verdict() {
      return now;
    },
    get powered() {
      return world.value('closed') > 0.5;
    },
    get lit() {
      return stage.glow > 0.5;
    },
    switchLive: () => false,
    follow: true,
    ambient: AMBIENT,
    snap() {
      stage.ambient = bench.ambient;
      wiring.snap();
      sw.snap();
      now = verdict(wiring.state(sw.closed));
      if (bench.follow) power(now === 'lit');
    },
    update() {
      // an end counts in its clamp once it has arrived there (the click is the moment of contact)
      now = verdict(wiring.state(sw.closed));
      if (bench.follow) power(now === 'lit');
    },
    late(dt, t) {
      stage.ambient += (bench.ambient - stage.ambient) * (1 - Math.exp(-dt * 2.5));
      swap.update(dt);
      wiring.update(dt, t);
      sw.place(dt, stage.unfold >= 1);
    },
  };
  return bench;
}
