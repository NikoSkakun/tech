/**
 * `drain/life` — «Життя батарейки». Back to the stand plan; the meter and the lens are put away; the dead battery
 * lies in the cradle (pale band, the filament a dull red), and a new one slides onto the table in front of the
 * stand at the left. The reader drags it up over the cradle (`parts/spare.ts`, `carry`); let go there, the swap
 * plays: the dead one rises out of the clamps and leaves the picture, then the new one goes down into the cradle —
 * the lamp flashes white and the frame is warm again. Let go short, the new battery glides back to the table.
 * «Назад» plays the swap backwards. Goal: the new one in the cradle, the old one gone, the lamp white.
 */
import { Vector2, Vector3 } from 'three';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { scrub, stepScrub } from '../parts/scrub';
import { createSpare } from '../parts/spare';

/** Seconds the swap takes, and its way back when the reader leaves the step. */
const SWAP_SECONDS = 2.6;
const BACK_SECONDS = 1.6;
/** The lamp counts as white from here (heat; 1 = 2 300 °C). */
const WHITE = 0.95;

export const lifeStep: StepFactory = ({ ctx, world: dw, here, reached, reach }) => {
  const spare = createSpare(ctx.root, dw.stand);
  const presence = scrub(0, 0.45);
  const carry = scrub(0, 0.3);
  let swapTo = 0;
  let held = false;
  /** The chapter's end by itself (`finish`): the swap starts once the new battery is over the cradle. */
  let finishing = false;
  /** Arrived from the practicum (`rewind`): the carry glides back once the swap has played backwards. */
  let backing = false;
  let k0 = 0;
  let p0 = 0;
  const on = (): boolean => here('life');
  const a = new Vector3();
  const b = new Vector3();
  const sa = new Vector2();
  const sb = new Vector2();
  const at = new Vector3();
  const along = (ndc: Vector2): number => {
    spare.rest(a).project(ctx.camera.camera);
    spare.over(b).project(ctx.camera.camera);
    sa.set(a.x, a.y);
    sb.set(b.x, b.y);
    const d = sb.clone().sub(sa);
    return ndc.clone().sub(sa).dot(d) / Math.max(d.lengthSq(), 1e-6);
  };
  const ready = (): boolean => on() && presence.shown > 0.97 && swapTo === 0 && !ctx.camera.moving;
  ctx.input.register(spare.handle, {
    cursor: 'grab',
    enabled: ready,
    dragStart: (e) => {
      held = true;
      k0 = carry.shown;
      p0 = along(e.ndc);
      carry.drag = true;
    },
    drag: (e) => {
      if (held) carry.target = Math.min(Math.max(k0 + along(e.ndc) - p0, 0), 1);
    },
    dragEnd: () => {
      held = false;
      carry.drag = false;
      // let go over the cradle: the batteries change places; short of it: back to the table
      if (carry.shown > 0.55) {
        carry.target = 1;
        swapTo = 1;
      } else carry.target = 0;
    },
  });
  ctx.qa.probe('spare', () => spare.model.group.getWorldPosition(at));
  ctx.qa.probe('cradle', () => spare.over(new Vector3()));
  ctx.qa.expose('life', () => ({
    carry: carry.shown,
    swap: spare.swap,
    presence: presence.shown,
    held,
    glow: dw.stand.glow,
  }));

  return {
    spec: { ...dw.state('hours'), cameraMove: { duration: 2.2 } },
    ui: {
      goal: () => reached('life'),
      callouts: [
        {
          anchor: () => spare.model.group.getWorldPosition(at).add(new Vector3(0, 0.3, 0)),
          text: caption('life', 0),
          side: 'left',
          visible: () => ready() && carry.shown < 0.02 && !held,
        },
        {
          anchor: () => dw.stand.stand.anchors.battery.getWorldPosition(new Vector3()),
          text: caption('life', 1),
          side: 'up',
          visible: () => on() && presence.shown > 0.97 && spare.swap < 0.02 && !held && carry.shown < 0.02,
        },
      ],
    },
    enter(info) {
      dw.meter.want = 0;
      dw.meter.probes = 0;
      dw.counter.want = 0;
      dw.hours.target = 8;
      dw.cut.target = 0;
      held = false;
      presence.target = 1;
      if (info.instant) {
        presence.shown = 1;
        carry.shown = carry.target = 0;
        swapTo = spare.swap = 0;
      }
    },
    leave() {
      held = false;
      carry.drag = false;
    },
    finish() {
      held = false;
      carry.drag = false;
      carry.target = 1;
      finishing = true;
      return () => spare.swap >= 1 && carry.shown > 0.99;
    },
    rewind(play) {
      // first the border frame (the swap done, held), then — `play` — the swap plays backwards
      presence.shown = presence.target = 1;
      if (!play) {
        carry.shown = carry.target = 1;
        spare.swap = swapTo = 1;
        return;
      }
      swapTo = 0;
      backing = true;
    },
    late(dt) {
      if (finishing && carry.shown > 0.98) {
        finishing = false;
        swapTo = 1;
      }
      if (backing && spare.swap <= 0) {
        backing = false;
        carry.target = 0;
      }
      // away from `life` everything plays back: the swap, then the carry, then the new battery leaves the table
      if (!on()) {
        swapTo = 0;
        if (spare.swap <= 0) carry.target = 0;
        if (spare.swap <= 0 && carry.shown < 0.01) presence.target = 0;
      }
      const ds = dt / (swapTo > spare.swap ? SWAP_SECONDS : BACK_SECONDS);
      spare.swap =
        swapTo > spare.swap ? Math.min(swapTo, spare.swap + ds) : Math.max(swapTo, spare.swap - ds);
      stepScrub(presence, dt);
      stepScrub(carry, dt);
      spare.presence = presence.shown;
      spare.carry = carry.shown;
      spare.update();
      dw.cradle.contact = spare.contact;
      dw.cradle.fresh = spare.fresh;
      if (on() && spare.swap >= 1 && dw.stand.glow >= WHITE && !reached('life')) {
        reach('life');
        // the chapter's last frame is the stand plan the practicum starts from
        ctx.camera.go('stand', { duration: 2.4, ease: 'sine.inOut' });
      }
    },
  };
};
