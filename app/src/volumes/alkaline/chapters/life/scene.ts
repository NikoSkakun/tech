/**
 * `life`: one slider «Години» over the whole life of the battery under the lamp (`lifeAtHours` of `circuit`'s model):
 * `spend` watches the slice and the cut (zinc → white zinc oxide from the separator inward), `sag` the meter and the
 * lamp; `dead` lets the reader flip the switch on the dead battery (the needle falls under load); `drawer` scrubs ten
 * years on the shelf (3 % a year) and shows how little changes.
 */
import { defineScene } from '@/engine/api';
import { lifeAtHours, lifeHours } from '@circuit/shared/stage';
import { goals, runChapter, type StepDef } from '@alkaline/shared/chapter';
import { holdFor, scrubSlider } from '@alkaline/shared/controls';
import { drawerLife } from '@alkaline/shared/numbers';
import { mountBattery } from '@alkaline/shared/world';
import { caption } from './content';

const done = goals('life');
const HOURS = 8;

export default defineScene((ctx) => {
  const w = mountBattery(ctx);
  const { slice } = w;
  const at = (id: string) => () => ctx.stage.current === id;
  const toLife = (h: number) => lifeAtHours((h / HOURS) * lifeHours());

  const hoursSlider = (step: string) =>
    scrubSlider(w.life, 'hours', caption(step, 0), {
      max: HOURS,
      map: toLife,
      format: (v) => `${v.toFixed(1).replace('.', ',')} год`,
      marks: [
        { value: 0, label: caption(step, 1) },
        { value: HOURS, label: caption(step, 2) },
      ],
    });

  const spendHold = holdFor(1);
  const spend: StepDef = {
    spec: { ...w.state('slice'), params: { closed: 1, poles: 1 }, cameraMove: { duration: 2 } },
    ui: {
      goal: () => done.has('spend'),
      controls: [hoursSlider('spend')],
      callouts: [
        {
          anchor: slice.rings.zinc.anchor,
          text: caption('spend', 3),
          visible: () => at('spend')() && w.life.shown < 0.25,
        },
        {
          anchor: slice.rings.zinc.anchor,
          text: caption('spend', 4),
          visible: () => at('spend')() && w.life.shown >= 0.25,
        },
      ],
    },
    enter: (info) => {
      spendHold.reset();
      w.reset({ out: 1, spread: 0, lye: 1, cut: 1, life: 0 }, info.instant);
      w.island = 1;
      w.setPoleDots(true);
    },
    leave: () => void (w.island = 0),
    update: (dt) => {
      if (spendHold.tick(dt, w.life.shown > 0.995)) done.add('spend');
    },
  };

  const sagHold = holdFor(1);
  const sag: StepDef = {
    spec: { ...w.state('standMeter'), params: { closed: 1, poles: 1 }, cameraMove: { duration: 2 } },
    ui: {
      goal: () => done.has('sag'),
      controls: [hoursSlider('sag')],
      callouts: [{ anchor: w.gauge.anchor, text: caption('sag', 3), visible: at('sag') }],
    },
    enter: (info) => {
      sagHold.reset();
      w.reset({ out: 0, spread: 0, lye: 1, cut: 0, life: 0 }, info.instant);
      w.setPoleDots(true);
      w.meter.want = 1;
      w.meter.minus = w.meter.plus = 1;
    },
    leave: () => {
      w.meter.want = 0;
      w.meter.minus = w.meter.plus = 0;
    },
    update: (dt) => {
      if (sagHold.tick(dt, w.life.shown > 0.995)) done.add('sag');
    },
  };

  let wasOn = false;
  const dead: StepDef = {
    spec: { ...w.state('standMeter'), params: { closed: 0, poles: 1 } },
    ui: {
      goal: () => done.has('dead'),
      callouts: [
        {
          anchor: w.stage.stand.slider,
          text: caption('dead', 0),
          visible: () => at('dead')() && w.flips === 0,
        },
        { anchor: w.gauge.anchor, text: caption('dead', 1), visible: at('dead') },
      ],
    },
    enter: (info) => {
      wasOn = false;
      w.reset({ out: 0, spread: 0, lye: 1, cut: 0, life: 1 }, true);
      if (info.instant) w.stage.snap();
      w.setPoleDots(true);
      w.switchLive = true;
      w.meter.want = 1;
      w.meter.minus = w.meter.plus = 1;
    },
    leave: () => {
      w.switchLive = false;
      w.meter.want = 0;
      w.meter.minus = w.meter.plus = 0;
    },
    update: () => {
      if (w.closed > 0.5) wasOn = true;
      else if (wasOn && w.flips >= 2) done.add('dead');
    },
  };

  const drawer: StepDef = {
    spec: { ...w.state('slice'), params: { closed: 0, poles: 1 }, cameraMove: { duration: 2 } },
    ui: {
      goal: () => done.has('drawer'),
      controls: [
        scrubSlider(w.life, 'years', caption('drawer', 0), {
          max: 10,
          map: drawerLife,
          format: (v) => `${Math.round(v)}`,
          marks: [
            { value: 0, label: caption('drawer', 1) },
            { value: 10, label: caption('drawer', 2) },
          ],
          onChange: (v) => v >= 9.9 && done.add('drawer'),
        }),
      ],
    },
    enter: (info) => {
      w.reset({ out: 1, spread: 0, lye: 1, cut: 1, life: 0 }, info.instant);
      w.island = 1;
      w.setPoleDots(true);
    },
    leave: () => void (w.island = 0),
  };

  ctx.qa.expose('life', () => ({
    step: ctx.stage.current,
    life: w.life.shown,
    volts: w.volts,
    closed: w.closed,
    flips: w.flips,
  }));
  return runChapter(ctx, w, { spend, sag, dead, drawer });
});
