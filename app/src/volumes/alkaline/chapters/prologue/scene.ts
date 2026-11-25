/**
 * The prologue: `light` (the reader's switch lights the lamp), `open` (the «Розріз» slider opens the battery where it
 * lies), `riddle` (ten years in a drawer, the meter on the poles barely moves) and `map` (the volume's own map).
 */
import { defineScene } from '@/engine/api';
import { journeyInset } from '@/hud-dom/journey';
import { goals, runChapter, type StepDef } from '@alkaline/shared/chapter';
import { mountBattery } from '@alkaline/shared/world';
import { drawerLife } from '@alkaline/shared/numbers';
import { caption } from './content';

const done = goals('prologue');

export default defineScene((ctx) => {
  const w = mountBattery(ctx);
  const here = (id: string) => () => ctx.stage.current === id;

  // light: the lamp has been on, then off again
  let wasOn = false;
  const light: StepDef = {
    spec: { ...w.state('stand'), params: { closed: 0, poles: 0 } },
    ui: {
      goal: () => done.has('light'),
      callouts: [
        {
          anchor: w.stage.stand.slider,
          text: caption('light', 0),
          visible: () => here('light')() && !done.has('light'),
        },
      ],
    },
    enter: () => {
      wasOn = false;
      w.switchLive = true;
      w.island = 0;
      w.reset({ cut: 0, life: 0, out: 0 }, true);
    },
    leave: () => void (w.switchLive = false),
    update: () => {
      if (w.closed > 0.5) wasOn = true;
      else if (wasOn && w.flips >= 2) done.add('light');
    },
  };

  // open: the cut slider; the goal holds once the cut has stayed open for 1 s
  let openFor = 0;
  const open: StepDef = {
    spec: { ...w.state('battery'), params: { closed: 0, poles: 0 }, cameraMove: { duration: 1.9 } },
    ui: {
      goal: () => done.has('open'),
      controls: [cutSlider('cut', caption('open', 0))],
    },
    enter: (info) => {
      openFor = 0;
      w.island = 1;
      w.reset({ cut: 0, life: 0 }, info.instant);
    },
    leave: () => void (w.island = 0),
    update: (dt) => {
      openFor = w.cut.shown > 0.97 ? openFor + dt : 0;
      if (openFor > 1) done.add('open');
    },
  };

  // riddle: years in a drawer on the meter
  const riddle: StepDef = {
    spec: { ...w.state('voltage'), params: { closed: 0, poles: 0 }, cameraMove: { duration: 1.9 } },
    ui: {
      goal: () => done.has('riddle'),
      controls: [
        {
          type: 'slider',
          id: 'years',
          label: caption('riddle', 0),
          min: 0,
          max: 10,
          value: 0,
          format: (v: number) => `${Math.round(v)}`,
          marks: [
            { value: 0, label: caption('riddle', 1) },
            { value: 10, label: caption('riddle', 2) },
          ],
          onChange: (v: number) => {
            w.life.target = drawerLife(v);
            if (v >= 9.9) done.add('riddle');
          },
          onInput: (_v: number, how: string) => (w.life.drag = how === 'drag'),
        },
      ],
      callouts: [{ anchor: w.gauge.anchor, text: caption('riddle', 3), visible: here('riddle') }],
    },
    enter: (info) => {
      w.meter.want = 1;
      w.meter.minus = w.meter.plus = 1;
      w.reset({ cut: 0, life: 0 }, info.instant);
    },
    leave: () => {
      w.meter.want = 0;
      w.meter.minus = w.meter.plus = 0;
    },
  };

  const journey = ctx.nav.volume?.journey;
  const layers = new Map((journey?.groups ?? []).map((g) => [g.id, g.layer]));
  const questions = (journey?.planned ?? []).filter((j) => layers.get(j.group) === 'path').map((j) => j.id);
  const opened = new Set<string>();
  const map: StepDef = {
    spec: { ...w.state('stand'), params: { closed: 1, poles: 0 } },
    ui: {
      board: {
        title: 'Мапа тому',
        size: 'fill',
        children: [
          journeyInset(ctx, {
            id: 'map-journey',
            onOpen: (id) => void (questions.includes(id) && opened.add(id)),
          }),
        ],
      },
      goal: () => opened.size >= questions.length,
    },
    enter: (info) => w.reset({ cut: 0, life: 0 }, info.instant),
  };

  function cutSlider(id: string, label: string) {
    return {
      type: 'slider' as const,
      id,
      label,
      min: 0,
      max: 1,
      value: 0,
      format: () => '',
      onChange: (v: number) => (w.cut.target = v),
      onInput: (_v: number, how: string) => (w.cut.drag = how === 'drag'),
    };
  }

  ctx.qa.expose('prologue', () => ({
    step: ctx.stage.current,
    closed: w.closed,
    cut: w.cut.shown,
    life: w.life.shown,
    volts: w.volts,
  }));
  return runChapter(ctx, w, { light, open, riddle, map });
});
