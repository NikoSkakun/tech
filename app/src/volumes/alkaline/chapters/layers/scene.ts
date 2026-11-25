/**
 * `layers`: the slice over the stand. `slice` brings it out of the battery (slider «Скибочка» = `out`); `can`, `zinc`,
 * `oxide` name the rings the reader touches (and the two ends of the battery on the stand); `wall` slides the rings
 * apart like a telescope (`spread`); `lye` soaks the dry rings (`lye` 0 → 1). One name at a time, on the ring.
 */
import { Vector3 } from 'three';
import { defineScene } from '@/engine/api';
import type { CalloutSpec } from '@/hud';
import { goals, runChapter, type StepDef } from '@alkaline/shared/chapter';
import { holdFor, scrubSlider } from '@alkaline/shared/controls';
import type { SliceRing } from '@alkaline/shared/slice';
import { battery, mountBattery } from '@alkaline/shared/world';
import { caption } from './content';

const done = goals('layers');
type End = 'plus' | 'minus';

export default defineScene((ctx) => {
  const w = mountBattery(ctx);
  const { slice } = w;
  const b = battery();
  const at = (id: string) => () => ctx.stage.current === id;
  const touched = new Set<SliceRing | End>();
  let hovered: SliceRing | End | null = null;
  let named: SliceRing | End | null = null;
  /** Which rings / ends the step on screen lets the reader touch. */
  const live: Record<string, readonly (SliceRing | End)[]> = {
    can: ['can', 'plus', 'minus'],
    zinc: ['zinc', 'pin'],
    oxide: ['cathode'],
    wall: ['separator'],
  };
  const canTouch = (id: SliceRing | End): boolean =>
    slice.out > 0.9 && (live[ctx.stage.current ?? '']?.includes(id) ?? false);
  const touch = (id: SliceRing | End) => ({
    cursor: 'pointer' as const,
    enabled: () => canTouch(id),
    hover: (over: boolean) => {
      hovered = over ? id : hovered === id ? null : hovered;
    },
    click: () => {
      touched.add(id);
      named = id;
    },
  });
  for (const id of ['can', 'cathode', 'separator', 'zinc', 'pin'] as const) {
    ctx.input.register(slice.rings[id].mesh, touch(id));
    ctx.qa.probe(`ring-${id}`, slice.rings[id].anchor);
  }
  const plusHit = w.hitAt(b.plus.clone().addScaledVector(b.axis, 0.06), 0.24, 'end-plus');
  const minusHit = w.hitAt(b.minus.clone().addScaledVector(b.axis, -0.04), 0.24, 'end-minus');
  ctx.input.register(plusHit, touch('plus'));
  ctx.input.register(minusHit, touch('minus'));

  const nameOn = (id: SliceRing | End, text: string, step: string, after?: () => boolean): CalloutSpec => ({
    anchor: id === 'plus' ? plusHit : id === 'minus' ? minusHit : slice.rings[id].anchor,
    text,
    visible: () => at(step)() && slice.out > 0.9 && ((hovered ?? named) === id || (after?.() ?? false)),
  });

  /** A touch step: every live id touched → goal. */
  function touchStep(id: string, callouts: CalloutSpec[]): StepDef {
    return {
      spec: { ...w.state('slice'), params: { closed: 0, poles: 1 } },
      ui: { goal: () => done.has(id), callouts },
      enter: (info) => {
        touched.clear();
        hovered = named = null;
        w.reset({ out: 1, spread: 0, lye: 1, cut: 0, life: 0 }, info.instant);
      },
      leave: () => void (slice.highlight = null),
      update: () => {
        const h = hovered ?? named;
        slice.highlight = h && h !== 'plus' && h !== 'minus' ? h : null;
        if ((live[id] ?? []).every((x) => touched.has(x))) done.add(id);
      },
    };
  }

  const outHold = holdFor(1);
  const sliceStep: StepDef = {
    spec: { ...w.state('slice'), params: { closed: 0, poles: 0 }, cameraMove: { duration: 2 } },
    ui: { goal: () => done.has('slice'), controls: [scrubSlider(w.out, 'out', caption('slice', 0))] },
    enter: (info) => {
      outHold.reset();
      w.reset({ out: 0, spread: 0, lye: 1, cut: 0, life: 0 }, info.instant);
    },
    update: (dt) => {
      if (outHold.tick(dt, w.out.shown > 0.97)) done.add('slice');
    },
  };

  const spreadHold = holdFor(1);
  const wall: StepDef = {
    ...touchStep('wall', [nameOn('separator', caption('wall', 1), 'wall', () => w.spread.shown > 0.6)]),
    ui: {
      goal: () => done.has('wall'),
      controls: [scrubSlider(w.spread, 'spread', caption('wall', 0))],
      callouts: [nameOn('separator', caption('wall', 1), 'wall', () => w.spread.shown > 0.6)],
    },
    update: (dt) => {
      slice.highlight = w.spread.shown > 0.6 ? 'separator' : null;
      if (spreadHold.tick(dt, w.spread.shown > 0.95)) done.add('wall');
    },
  };
  const wallEnter = wall.enter;
  wall.enter = (info) => {
    spreadHold.reset();
    wallEnter?.(info);
  };

  const lye: StepDef = {
    spec: { ...w.state('slice'), params: { closed: 0, poles: 0 } },
    ui: {
      goal: () => done.has('lye'),
      controls: [
        scrubSlider(w.lye, 'lye', caption('lye', 0), { onChange: (v) => v > 0.98 && done.add('lye') }),
      ],
      callouts: [
        {
          anchor: () => slice.rings.separator.anchor.getWorldPosition(new Vector3()),
          text: caption('lye', 1),
          visible: () => at('lye')() && w.lye.shown > 0.15,
        },
      ],
    },
    enter: (info) => w.reset({ out: 1, spread: 0, lye: 0, cut: 0, life: 0 }, info.instant),
  };

  const steps: Record<string, StepDef> = {
    slice: sliceStep,
    can: touchStep('can', [
      nameOn('can', caption('can', 0), 'can'),
      nameOn('plus', caption('can', 1), 'can', () => touched.has('plus')),
      nameOn('minus', caption('can', 2), 'can', () => touched.has('minus')),
    ]),
    zinc: touchStep('zinc', [
      nameOn('zinc', caption('zinc', 0), 'zinc'),
      nameOn('pin', caption('zinc', 1), 'zinc'),
    ]),
    oxide: touchStep('oxide', [nameOn('cathode', caption('oxide', 0), 'oxide')]),
    wall,
    lye,
  };
  ctx.qa.expose('layers', () => ({
    step: ctx.stage.current,
    out: w.out.shown,
    spread: w.spread.shown,
    lye: w.lye.shown,
    touched: [...touched],
  }));
  return runChapter(ctx, w, steps);
});
