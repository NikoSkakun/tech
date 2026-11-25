/**
 * `dive` — «Углиб дроту». The lens is the way in (DECISIONS §60 p; the owner, 2026-11-25: the zoom is an in-game
 * focus ring that appears only once the reader has taken the lens). A tap or a drag on the lens in its holder takes it:
 * it rises, crosses the stand and settles on the near wire while the camera comes with it (the rail's lens leg) —
 * that is lens mode, and the knurled ring shows as an arc at the bottom of the screen (`focus-ring.ts`). Turning the ring is the dive
 * itself, both ways (`world.scrub`; a click on the ring, a mark's name, the keys or the wheel glide there,
 * `world.travelTo`); the ring stands still there, apart from the lens, whatever the zoom. In lens mode a
 * drag on empty space sways the camera a little and it springs back (`lens-mode.ts`). A tap on the lens while it lies
 * on the wire with the ring at its start lays it back in its holder: lens mode ends, the ring goes. The floors stand
 * as marks: деталь · ряди кульок. The goal holds after 2 s at the end.
 *
 * The switch is the reader's here too (`switch.ts`); the moment the reader starts the dive — the lens or the ring —
 * an open switch closes by itself and the light comes on in that frame (the owner, 2026-11-17).
 */
import type { ChapterContext } from '@/engine/api';
import type { StepUiSpec } from '@/hud';
import { LENS_LEG, type CircuitWorld } from '@circuit/shared/world';
import { lensMode } from '@circuit/shared/world/lens-mode';
import { createFocusRing, type FocusRingState } from '@circuit/shared/stage/tools/focus-ring';
import type { PartNames } from './parts';

/** The rail's end for the prologue: «ряди» (2); the prologue does not go to one atom. */
const END = 2;
/** Seconds at the end before the takeaway (script: «пробув там щонайменше 2 s»). */
const DWELL = 2;
/** The lens counts as on the wire (lens mode) from this rail position on (it lands at 85 % of the lens leg). */
const ON_WIRE = -0.04;
/** A tap on the lens lays it back only while the ring is this close to its start. */
const AT_START = 0.05;

export interface DiveStep {
  spec: StepUiSpec;
  enter(): void;
  update(dt: number): void;
  /** For the interaction test (`__app.read('prologue')`). */
  state(): {
    lens: number;
    /** The rail's position (−½ the lens in its holder … 0 on the wire … 2 «ряди») and where it is going. */
    position: number;
    goal: number;
    moving: boolean;
    dwell: number;
    /** The step's own «лупа» callout is up. */
    named: boolean;
    /** Lens mode: the ring is on the lens. */
    lensMode: boolean;
    ring: FocusRingState;
    /** The camera's sway (rad) and whether the hand is on it. */
    sway: { yaw: number; pitch: number; held: boolean };
  };
}

export function diveStep(
  ctx: ChapterContext,
  world: CircuitWorld,
  labels: readonly string[],
  names: PartNames,
  /** True while the step's panel is held back (the unfolding plays): the lens waits with the text. */
  held: () => boolean,
  /** The reader started the dive (the scene closes an open switch). */
  started: () => void,
  /** Another step's name for the lens (`riddle`: «позначена іскорка» on hover), with when it applies. */
  otherName?: { text: string; when: () => boolean },
): DiveStep {
  const [lensLabel = '', ringLabel = '', , ...floorLabels] = labels;
  const lens = world.stand.tools.lens;
  let dwell = 0;
  let calling = true;
  const active = (): boolean => ctx.stage.current === 'dive';
  /**
   * The lens is the reader's only once it lies in its holder: not while the flashlight unfolds (it is still inside
   * the flashlight or growing out of it, and with an orbited camera its spot is on screen as empty air).
   */
  const placed = (): boolean => active() && !held();
  const lensOn = (): boolean => world.value('lens') > 0.99;
  /** Lens mode: the lens taken and on the wire (or below), not on its way back to the holder. */
  const inLens = (): boolean => placed() && world.goal >= 0 && world.position > ON_WIRE;
  /** The reader's first touch of the dive: names go, an open switch closes. */
  const touch = (): void => {
    names.dismiss();
    started();
  };

  const take = (): void => {
    // only from the lens leg: once the ring is past it the lens already lies on the wire
    if (!placed() || world.goal >= 0) return;
    touch();
    world.takeLens();
  };
  /** On the wire with the ring at its start: the lens goes back into its holder (lens mode ends). */
  const putBack = (): boolean => inLens() && world.goal <= AT_START && world.position <= AT_START;
  // one registration for the lens (a second one on its glass would swallow the tap that takes it here)
  const other = (): boolean => otherName?.when() ?? false;
  ctx.input.register(lens.group, {
    tooltip: () => (other() ? (otherName?.text ?? '') : lensLabel),
    cursor: 'grab',
    enabled: () => (placed() && (world.goal < 0 || putBack())) || other(),
    click: () => {
      if (putBack()) world.travelTo(-LENS_LEG);
      else take();
    },
    dragEnd: take,
  });
  const anchor = lens.glass.position.clone();
  const named = (): boolean => placed() && world.value('lens') < 0.01 && !names.shown && world.deep < 0.01;
  ctx.qa.probe('lens', () => lens.glass.getWorldPosition(anchor));

  const floors = [1, 2].map((value, i) => ({ value, label: floorLabels[i] ?? '' }));
  const ring = createFocusRing(ctx, {
    name: 'depth-ring',
    label: ringLabel,
    min: 0,
    max: END,
    marks: () => floors,
    value: () => Math.max(world.position, 0),
    target: () => Math.max(world.goal, 0),
    shown: inLens,
    scrub: (v) => world.scrub(v),
    travelTo: (v) => world.travelTo(v),
    valueText: (v) => (v < 0.5 ? lensLabel : (floorLabels[Math.min(Math.round(v), 2) - 1] ?? '')),
    touched: touch,
  });
  const mode = lensMode(ctx, { active: inLens, ring, sway: world.sway });
  const spec: StepUiSpec = {
    reset: true,
    controls: [],
    callouts: [
      ...names.callouts,
      {
        anchor: () => lens.glass.getWorldPosition(anchor),
        text: lensLabel,
        visible: named,
      },
    ],
    goal: () => lensOn() && dwell >= DWELL,
  };
  return {
    spec,
    enter() {
      dwell = 0;
      calling = true;
      names.reset();
    },
    update(dt) {
      mode.update();
      ring.update(dt);
      if (!active()) return;
      // the ring stops calling «take me» once the lens has left its holder
      if (calling && world.position > -0.995) {
        calling = false;
        ctx.stage.setParam('lensCall', 0, { duration: 0.4 });
      }
      dwell = world.position > END - 0.005 && world.goal > END - 0.005 ? dwell + dt : 0;
    },
    state: () => ({
      lens: world.value('lens'),
      position: world.position,
      goal: world.goal,
      moving: world.position !== world.goal,
      dwell,
      named: named(),
      lensMode: inLens(),
      ring: ring.state(),
      sway: { yaw: world.sway.yaw, pitch: world.sway.pitch, held: mode.swaying },
    }),
  };
}
