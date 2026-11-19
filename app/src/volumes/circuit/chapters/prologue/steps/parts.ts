/**
 * Names of the parts as they land (script `dive`, «Бачимо»; C-circuit-1 request 25–26): «батарейка», «лампочка»,
 * «вимикач» — each the moment its part takes its place (beat 4), in that order — and «дріт» when the strips have
 * become wires (beat 5). All four stay about 3 s after the stand has stopped, or until the reader's first touch;
 * after that a part is named on hover / long press. A deep link to the finished stand shows them the same way.
 * Four one-word labels for a few seconds are the script's deliberate exception to «не більше трьох».
 */
import { Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import type { CalloutSpec } from '@/hud';
import { LOOP, UNFOLD_SECONDS, boardToWorld } from '@circuit/shared/stage';
import type { CircuitWorld } from '@circuit/shared/world';
import type { Unfolding } from './unfold';

/** When each part has landed, in seconds of the stage's six-beat timeline (`unfold × UNFOLD_SECONDS`). */
const LANDS = { battery: 4.4, lamp: 4.45, switch: 4.2, wire: 5.0 } as const;
/** Seconds the names stay after the stand has stopped. */
const STAY = 3;

export interface PartNames {
  callouts: CalloutSpec[];
  /** The reader touched something: the names go (hover keeps naming the parts). */
  dismiss(): void;
  /** A new visit of the step: the names may come again. */
  reset(): void;
  /** True while any name is up. */
  readonly shown: boolean;
  /** The names up now (QA). */
  up(): string[];
}

export function partNames(
  ctx: ChapterContext,
  world: CircuitWorld,
  unfolding: Unfolding,
  labels: { battery: string; lamp: string; switch: string; wire: string },
): PartNames {
  const { stand } = world.stand;
  const { anchors } = stand;
  let dismissed = false;
  // the far wire's middle: the longest straight piece, clear of every other label
  const wireAt = boardToWorld(-0.6, LOOP.y + 0.08, LOOP.far);
  const landed = (part: keyof typeof LANDS): boolean =>
    world.stand.unfold * UNFOLD_SECONDS >= LANDS[part] - 0.05;
  const up = (): boolean =>
    ctx.stage.current === 'dive' &&
    world.deep < 0.01 &&
    !dismissed &&
    (unfolding.playing || unfolding.since < STAY);
  const callout = (
    part: keyof typeof LANDS,
    anchor: (out: Vector3) => Vector3,
    side: CalloutSpec['side'],
  ): CalloutSpec => {
    const own = new Vector3();
    return {
      anchor: () => anchor(own),
      text: labels[part],
      side,
      visible: () => up() && landed(part),
    };
  };
  const callouts = [
    callout('battery', (v) => anchors.battery.getWorldPosition(v), 'down'),
    callout('lamp', (v) => anchors.lamp.getWorldPosition(v), 'left'),
    callout('switch', (v) => anchors.switch.getWorldPosition(v), 'down'),
    callout('wire', (v) => v.copy(wireAt), 'up'),
  ];
  return {
    callouts,
    up: () =>
      callouts
        .filter((c) => (typeof c.visible === 'function' ? c.visible() : c.visible !== false))
        .map((c) => (typeof c.text === 'function' ? c.text() : c.text)),
    dismiss() {
      dismissed = true;
    },
    reset() {
      dismissed = false;
    },
    get shown() {
      return up() && landed('battery');
    },
  };
}
