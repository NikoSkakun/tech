/**
 * `flashlight` — «Знову ліхтарик». ONE slider «Скласти» 0 … 1 is the unfolding played backwards (DECISIONS §60 p;
 * `unfold` = 1 − fold): wires to strips, the parts close up in a row, the housing flies back into the picture and closes,
 * the mounts sink into the board — and the lamp shines all the way (the circuit is whole: the model says `lit`).
 * The camera rides with it from the stand plan to the flashlight's shot on the prologue's own timing (the same
 * move as `prologue`'s fold, as a function of the slider), the room's cold light goes down with the stand, the
 * poles' tints go back to the neutral sheath of the prologue. The slider's end is `prologue/click`'s frame (lamp
 * on). Goal: the slider at the end for 1 s; then the volume's closing card comes up over that frame, calmly.
 */
import { STAGE_SHOTS } from '@circuit/shared/stage';
import { pathEnd } from '@/hud';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { END_KEYS } from '../parts/ends';
import { cameraRail } from '../parts/rail';
import { AMBIENT } from '../bench';

/** The fold's share where the camera starts to move, and how long its move lasts (prologue: 0.06 and 5.6 of 7 s,
 *  backwards). */
const CAMERA_FROM = 1 - 0.06 - 5.6 / 7;
const CAMERA_SPAN = 5.6 / 7;
/** Seconds at the end that the goal asks for, and the calm before the closing card. */
const STAY = 1;
const CARD_AFTER = 1.6;
/** A click on the track glides there: time constant (s) and the least time for the whole track. */
const GLIDE = 0.45;
const CROSS = 3.0;

const smooth = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
/** `power1.inOut` of the prologue's camera move. */
const inOut = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) ** 2);
/** The camera's place on its rail (0 stand … 1 flashlight) for a fold. */
export const cameraAt = (fold: number): number => inOut((fold - CAMERA_FROM) / CAMERA_SPAN);
/** The cold moon for an unfold (the prologue's `(u − 0.12) / 0.6`). */
export const moonAt = (unfold: number): number => Math.min(1, Math.max(0, (unfold - 0.12) / 0.6));

export const flashlightStep: StepFactory = ({ ctx, ui, bench, lens, reached, reach, here }) => {
  const { wiring, stage } = bench;
  const rail = cameraRail(ctx, [STAGE_SHOTS.stand, STAGE_SHOTS.flashlight]);
  const x = { target: 0, shown: 0, drag: false, told: -1 };
  let ready = false;
  let atEnd = 0;
  let parked = false;
  /** The fold the camera rail was last put at (the rail takes the camera only when the fold moves). */
  let railFold = 0;
  ctx.qa.expose('flashlight', () => ({
    fold: x.shown,
    unfold: stage.unfold,
    glow: stage.glow,
    ready,
    atEnd,
    card: pathEnd.shown,
    rail: rail.position,
    engaged: rail.engaged,
  }));
  return {
    spec: {
      camera: 'stand',
      params: { lens: 0, lensCall: 0, window: 0, poles: 1, moon: 1, unfold: 1, charge: 1 },
    },
    ui: {
      reset: true,
      controls: [
        {
          type: 'slider',
          id: 'fold',
          label: caption('flashlight', 0),
          min: 0,
          max: 1,
          value: 0,
          step: 0.001,
          format: () => '',
          marks: [
            { value: 0, label: caption('flashlight', 1) },
            { value: 1, label: caption('flashlight', 2) },
          ],
          disabled: () => !ready,
          visible: () => !pathEnd.shown,
          onChange: (v) => (x.target = v),
          onInput: (_v, how) => (x.drag = how === 'drag'),
        },
      ],
      goal: () => reached('flashlight'),
      // the volume's closing card takes the panel once the fold has stood complete a moment (the format's own
      // card, `panel.closingWhen`); the slider's dock fades meanwhile and comes back with «back»
      panel: { closingWhen: () => here('flashlight') && atEnd >= CARD_AFTER },
    },
    enter(info) {
      x.target = x.shown = 0;
      x.drag = false;
      x.told = -1;
      atEnd = 0;
      parked = false;
      railFold = 0;
      rail.release();
      bench.hands.policy = null;
      bench.switchLive = () => false;
      bench.sw.closed = true;
      bench.follow = true;
      for (const k of END_KEYS) wiring.grips.of[k].shown.go(0, info.instant ? 0 : 0.4);
      // the stand as built, every end home; the fold waits until the wires lie on their staples
      wiring.active = true;
      bench.restore(info.instant ? 0 : 0.8);
      lens.idle = false;
      if (info.instant) lens.snap(stage.tools.poses.holder);
      else lens.to(stage.tools.poses.holder, 1.1);
      ready = info.instant;
      // the prologue's dark room: no extra lift of the unlit parts
      bench.ambient = 0.5;
    },
    leave() {
      bench.ambient = AMBIENT;
      rail.release();
      lens.idle = false;
      wiring.active = true;
      ctx.stage.setParam('unfold', 1, { duration: 1.2 });
      ctx.stage.setParam('moon', 1, { duration: 1.2 });
    },
    update(dt) {
      if (!here('flashlight')) return;
      if (!ready && !wiring.moving && !lens.gliding && !ctx.camera.moving) ready = true;
      // from here the stand's own unfolding lays the wires, the slider and the lens
      if (ready && !parked) {
        parked = true;
        wiring.active = false;
        lens.idle = true;
      }
      const gap = x.target - x.shown;
      const most = dt / CROSS;
      x.shown += x.drag ? gap : Math.max(-most, Math.min(most, gap * (1 - Math.exp(-dt / GLIDE))));
      if (Math.abs(x.shown - x.target) < 1e-4) x.shown = x.target;
      if (Math.abs(x.shown - x.told) > 0.0005) ui.patch('fold', { current: (x.told = x.shown) });
      const unfold = 1 - x.shown;
      if (Math.abs(stage.unfold - unfold) > 1e-6) ctx.stage.setParam('unfold', unfold, { instant: true });
      ctx.stage.setParam('moon', moonAt(unfold), { instant: true });
      ctx.stage.setParam('poles', 1 - smooth(x.shown / 0.6), { instant: true });
      // the camera rides the fold; until the slider first moves it is the reader's (orbit, zoom)
      if (Math.abs(x.shown - railFold) > 1e-6) {
        railFold = x.shown;
        rail.scrub(cameraAt(x.shown));
      }
      rail.update(dt);
      atEnd = x.shown >= 0.999 ? atEnd + dt : 0;
      if (atEnd >= STAY) reach('flashlight');
    },
  };
};
