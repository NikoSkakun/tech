/**
 * `trick`: `wall` (in the micro world an electron carried to the separator bounces, an ion swims through), `stop`
 * (slider «Перші миті» scrubs the first seconds of a new battery: electrons gather on the minus, the reaction thins
 * out and stops), `loop` (the reader's switch: sparks run along the wire, the reaction in the cut revives), `back`
 * (in the micro world with the switch on: ions through the separator, two equal counters), `push` (the meter).
 */
import { Vector3 } from 'three';
import { defineScene } from '@/engine/api';
import { goals, runChapter, type StepDef } from '@alkaline/shared/chapter';
import { holdFor, scrubSlider } from '@alkaline/shared/controls';
import { SEP } from '@alkaline/shared/micro/layout';
import { PLANE_Z, createProbe } from '@alkaline/shared/micro/probe';
import { approach, scrub, glide } from '@alkaline/shared/scrub';
import { mountBattery } from '@alkaline/shared/world';
import { caption } from './content';

const done = goals('trick');
/** Time constant of the first moment (s of the slider): the poles fill, the reaction dies away. */
const FIRST_TAU = 1.1;

export default defineScene((ctx) => {
  const w = mountBattery(ctx);
  const { micro, cell, gauge } = w;
  const { field } = micro;
  const at = (id: string) => () => ctx.stage.current === id;
  /** Micro steps keep the slice out (the lens sits on it); stand steps put it back into the battery. */
  const base = (info: { instant: boolean }, cut = 0, out = cut > 0 ? 0 : 1) =>
    w.reset({ out, spread: 0, lye: 1, cut, life: 0 }, info.instant);

  // ---- wall: an electron and an ion carried to the zinc
  const electron = createProbe(ctx, micro, 'electron', 'probe-electron');
  const ion = createProbe(ctx, micro, 'ion', 'probe-ion');
  electron.home.set(5.8, 1.7, PLANE_Z);
  ion.home.set(5.8, -1.7, PLANE_Z);
  let bounced = false;
  let crossed = false;
  electron.rule = (want, blocked) => {
    const stop = SEP.to + 0.3;
    if (want.x < stop) {
      blocked.hit = true;
      bounced = true;
      return want.clone().setX(stop);
    }
    return want;
  };
  ion.onDrop = (p) => {
    if (p.x < SEP.from - 0.2) {
      crossed = true;
      return true;
    }
    return false;
  };
  electron.enabled = ion.enabled = at('wall');
  const wall: StepDef = {
    spec: { ...w.state('sep'), params: { closed: 0, poles: 1 } },
    ui: {
      goal: () => done.has('wall'),
      callouts: [
        { anchor: () => micro.toWorld(electron.at), text: caption('wall', 0), visible: at('wall') },
        { anchor: () => micro.toWorld(ion.at), text: caption('wall', 1), visible: at('wall') },
        {
          anchor: () => micro.toWorld(new Vector3(SEP.to, -3.6, 1)),
          text: caption('wall', 2),
          visible: at('wall'),
        },
      ],
    },
    enter: (info) => {
      base(info);
      bounced = crossed = false;
      electron.place(electron.home);
      ion.place(ion.home);
    },
    leave: () => {
      electron.shown = ion.shown = 0;
      electron.update(0, 0);
      ion.update(0, 0);
    },
    update: (dt, t) => {
      electron.shown = ion.shown = 1;
      electron.update(dt, t);
      ion.update(dt, t);
      if (bounced && crossed) done.add('wall');
    },
  };

  // ---- stop: the first seconds of a new battery
  const first = scrub(0, 0.3);
  const stop: StepDef = {
    spec: { ...w.state('battery'), params: { closed: 0, poles: 1 }, cameraMove: { duration: 2.2 } },
    ui: {
      goal: () => done.has('stop'),
      controls: [
        scrubSlider(first, 'first', caption('stop', 0), {
          max: 5,
          format: (v) => `${v.toFixed(1).replace('.', ',')} s`,
          onChange: (v) => v >= 4.9 && done.add('stop'),
        }),
      ],
      callouts: [
        {
          anchor: cell.anchors.minusCap,
          text: caption('stop', 1),
          visible: () => at('stop')() && first.shown > 1,
        },
        {
          anchor: cell.layers.zinc.anchor,
          text: caption('stop', 2),
          visible: () => at('stop')() && first.shown > 0.05 && first.shown < 2.2,
        },
      ],
    },
    enter: (info) => {
      base(info, 1);
      w.island = 1;
      cell.hold = false;
      first.target = first.shown = 0;
    },
    leave: () => {
      w.island = 0;
      cell.reaction = 0;
    },
    update: (dt) => {
      glide(first, dt);
      const t = first.shown;
      cell.hold = false;
      cell.surplus = cell.lack = cell.mark * (1 - Math.exp(-t / FIRST_TAU));
      cell.reaction = t > 0.02 ? Math.exp(-t / FIRST_TAU) : 0;
    },
  };

  // ---- loop: the reader's switch
  let closedFor = 0;
  const loop: StepDef = {
    spec: { ...w.state('loop'), params: { closed: 0, poles: 1 }, cameraMove: { duration: 2 } },
    ui: {
      goal: () => done.has('loop'),
      callouts: [
        {
          anchor: w.stage.stand.slider,
          text: caption('loop', 0),
          visible: () => at('loop')() && w.flips === 0,
        },
        {
          anchor: w.stage.stand.anchors.lamp,
          text: caption('loop', 1),
          visible: () => at('loop')() && w.closed > 0.5,
        },
      ],
    },
    enter: (info) => {
      base(info, 1);
      w.island = 1;
      w.setPoleDots(true);
      w.sparksOn = 1;
      w.switchLive = true;
      closedFor = 0;
    },
    leave: () => {
      w.island = 0;
      w.sparksOn = 0;
      w.switchLive = false;
    },
    update: (dt) => {
      closedFor = w.closed > 0.5 ? closedFor + dt : 0;
      if (w.flips >= 3 && closedFor > 2) done.add('loop');
    },
  };

  // ---- back: ions through the separator while the lamp burns
  const back: StepDef = {
    spec: { ...w.state('sep'), params: { closed: 0, poles: 1 } },
    ui: {
      goal: () => done.has('back'),
      controls: [
        {
          type: 'toggle',
          id: 'switch',
          label: caption('back', 0),
          value: false,
          onChange: (on: boolean) => w.setClosed(on),
        },
        { type: 'readout', id: 'wire', label: caption('back', 1), digits: 0, get: () => field.crossed },
        { type: 'readout', id: 'sep', label: caption('back', 2), digits: 0, get: () => field.crossed },
      ],
    },
    enter: (info) => {
      base(info);
      w.setPoleDots(true);
      field.flow = 0;
      field.resetCount();
    },
    leave: () => {
      field.flow = 0;
    },
    update: (dt) => {
      field.flow = approach(field.flow, w.closed, 1.5, dt);
      if (w.closed > 0.5 && field.crossed >= 12) done.add('back');
    },
  };

  // ---- push: the meter's probes on the poles
  for (const id of ['minus', 'plus'] as const) {
    ctx.input.register(gauge.probes[id].handle, {
      cursor: 'pointer',
      enabled: () => at('push')() && gauge.shown > 0.95,
      click: () => void (w.meter[id] = 1),
    });
    ctx.qa.probe(`probe-${id}`, gauge.probes[id].handle);
  }
  const steady = holdFor(1);
  const push: StepDef = {
    spec: { ...w.state('voltage'), params: { closed: 0, poles: 1 }, cameraMove: { duration: 2 } },
    ui: {
      goal: () => done.has('push'),
      callouts: [
        { anchor: gauge.anchor, text: caption('push', 0), visible: () => at('push')() && !gauge.touching },
        // the meter's own number is under 14 px on a phone: name it in the interface there
        {
          anchor: gauge.anchor,
          text: caption('push', 1),
          visible: () => at('push')() && gauge.touching && ctx.device.formFactor === 'phone',
        },
      ],
    },
    enter: (info) => {
      base(info, 0, 0);
      w.setPoleDots(true);
      w.meter.want = 1;
      w.meter.minus = w.meter.plus = 0;
      steady.reset();
    },
    leave: () => {
      w.meter.want = 0;
      w.meter.minus = w.meter.plus = 0;
    },
    update: (dt) => {
      if (steady.tick(dt, gauge.touching && Math.abs(w.volts - 1.6) < 0.04)) done.add('push');
    },
  };

  ctx.qa.expose('trick', () => ({
    step: ctx.stage.current,
    bounced,
    crossed,
    first: first.shown,
    closed: w.closed,
    flips: w.flips,
    ions: field.crossed,
    volts: w.volts,
    touching: gauge.touching,
  }));
  return runChapter(
    ctx,
    w,
    { wall, stop, loop, back, push },
    {
      enter: (id) => {
        if (id !== 'stop') cell.reaction = 0;
        if (id === 'wall') w.setPoleDots(true);
      },
    },
  );
});
