/**
 * DEV TOOL (the owner, 2026-11-19: «на самому першому кроці додай dev слайдер для програвання анімації розбирання
 * ліхтарика»): a slider on `click` that scrubs the whole unfolding frame by frame, both ways — the stand's
 * timeline (`unfold`, the same linear mapping `stand.playUnfold` uses), the camera between `flashlight` and
 * `stand` on the same share of the play as `unfold.ts` (`unfoldCamera`), the room's cold light (`unfoldMoon`); the
 * lamp is on while scrubbing. A drag follows the hand, a click on the track or a key glides there. «Далі» with
 * the slider above 0 plays the rest of the unfolding from there (`Unfolding.play(to, from)`).
 * Remove or hide it in one place: `DEV_UNFOLD_SCRUB`.
 */
import { Vector3 } from 'three';
import { resolveEase, type ChapterContext, type Shot, type Vec3Like } from '@/engine/api';
import type { StepUiApi } from '@/hud';
import type { ControlSpec } from '@/hud/step-ui-types';
import { STAGE_SHOTS, UNFOLD_PLAY, edgeLineShown, setEdgeLine } from '@circuit/shared/stage';
import { unfoldCamera, unfoldMoon } from './unfold';

/** The one switch of the dev tool: false removes the slider from `click` (nothing else changes). */
export const DEV_UNFOLD_SCRUB = true;
/** The dev switch on `click` that hides the line along the board's edge (false removes it; the line stays on). */
export const DEV_EDGE_LINE = true;

/** Seconds of a glide over the whole track (a click on the track): twice the play's speed. */
const GLIDE_SECONDS = UNFOLD_PLAY.seconds / 2;

export interface UnfoldScrub {
  /** The slider (empty when the tool is off). */
  readonly controls: readonly ControlSpec[];
  /** Where the scrub stands now, 0 … 1 (0 = untouched: today's `click`). */
  readonly value: number;
  /** Back to 0 without touching the scene (step entry: the step's own params set the scene). */
  reset(): void;
  update(dt: number): void;
}

const vec = (v: Vec3Like): Vector3 => (v instanceof Vector3 ? v.clone() : new Vector3(v[0], v[1], v[2]));

export function unfoldScrub(ctx: ChapterContext, ui: StepUiApi, lampOn: () => void): UnfoldScrub {
  const from = STAGE_SHOTS.flashlight;
  const to = STAGE_SHOTS.stand;
  const pos = [vec(from.position), vec(to.position)] as const;
  const aim = [vec(from.target), vec(to.target)] as const;
  const ease = resolveEase('power1.inOut');
  let value = 0;
  let glide: { from: number; to: number; t: number; total: number } | null = null;

  /** The frame of the play at progress `p`: stand, camera, moon. */
  const show = (p: number): void => {
    value = p;
    lampOn();
    ctx.stage.setParam('unfold', p, { instant: true });
    ctx.stage.setParam('moon', unfoldMoon(p), { instant: true });
    const k = unfoldCamera(p);
    const shot: Shot = {
      ...(k < 0.5 ? from : to),
      position: pos[0].clone().lerp(pos[1], k),
      target: aim[0].clone().lerp(aim[1], k),
    };
    ctx.camera.go(shot, { instant: true });
    ui.patch('unfoldScrub', { current: p });
  };

  const controls: ControlSpec[] = DEV_UNFOLD_SCRUB
    ? [
        {
          type: 'slider',
          id: 'unfoldScrub',
          label: 'dev · розбирання',
          min: 0,
          max: 1,
          value: 0,
          step: 0.001,
          format: (v) => `${Math.round(v * 100)} %`,
          onChange: (v) => {
            glide = { from: value, to: v, t: 0, total: Math.max(0.25, GLIDE_SECONDS * Math.abs(v - value)) };
          },
          onInput: (v, how) => {
            if (how !== 'drag') return;
            glide = null;
            show(v);
          },
        },
      ]
    : [];
  // DEV (owner 2026-11-19): the line along the board's edge off / on, for the whole session (`setEdgeLine`)
  if (DEV_EDGE_LINE)
    controls.push({
      type: 'toggle',
      id: 'edgeLine',
      label: 'dev · лінія по краю',
      value: edgeLineShown(),
      onChange: (on) => setEdgeLine(on),
    });

  return {
    controls,
    get value() {
      return value;
    },
    reset() {
      value = 0;
      glide = null;
    },
    update(dt) {
      if (!glide || ctx.stage.current !== 'click') return;
      glide.t = Math.min(glide.t + dt, glide.total);
      const k = ease(glide.t / glide.total);
      show(glide.from + (glide.to - glide.from) * k);
      if (glide.t >= glide.total) glide = null;
    },
  };
}
