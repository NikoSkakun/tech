/**
 * Step 6 `static` — «Статична електрика та блискавка». Phase «Кулька»: rub the balloon on the sweater (sim §5
 * `createBalloon`: −15 nC per pass, U = q/C), watch the hair rise, stick it to the wall (|q| ≥ 60 nC), draw a
 * spark with the finger (d < |U| / 3 kV/mm). Phase «Гроза»: the storm diorama — charge separation slider,
 * stepped leader, streamer and return strokes (`lightningTimeline`), with or without the lightning rod.
 */
import { Group, Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtNumber } from '@/content';
import { damp } from '@/engine/api';
import { createArc, createSparks } from '@/fx';
import { BALLOON, createBalloon, stormState } from '@electricity/sim/charge-field';
import { clamp, smooth, type StepFactory } from '../chapter';
import { docLabel } from '../content';
import { L } from '../labels';
import { STATIC } from '../layout';
import { BALLOON_R, createBalloonModel, createWall } from '../parts/balloon';
import { createFigure, REST_HAND } from '../parts/figure';
import { createStormFx } from '../parts/storm-fx';
import { createStormSet } from '../parts/storm-set';
import { sound } from '../sound';

const S = STATIC.scale; // scene units per metre of the balloon set
const REST = 0.2; // slider value the cloud returns to after a strike

export const staticStep: StepFactory = ({ ctx, ui, world }) => {
  const { stage } = ctx;
  const on = (): boolean => stage.current === 'static';
  const storming = (): boolean => ui.value<string>('phase') === 'storm';

  /* --------------------------------------------------------------------------- phase «Кулька» */
  const kit = new Group();
  kit.name = 'static-kit';
  const figure = createFigure();
  const wall = createWall();
  const model = createBalloonModel();
  const spark = createArc({
    color: 'violet.light',
    width: 0.05,
    intensity: 3.2,
    branches: 1,
    continuous: false,
  });
  const sparks = createSparks(ctx, { count: 40, color: 'violet.light', size: 0.1 });
  kit.add(figure.group, wall.group, model.group, spark, sparks);
  const sim = createBalloon();
  const pos = STATIC.balloonHome.clone();
  let mode: 'free' | 'drag' | 'stuck' = 'free';
  const share = (): number => sim.state.chargeC / BALLOON.minChargeC;
  const tip = new Vector3();
  const near = new Vector3();
  /** The arm hangs at the side until the learner drags the hand; only a raised finger can draw a spark. */
  let raised = false;
  /** Gap between the finger tip and the balloon's skin, metres; a spark jumps when it is below |U|/E_b. */
  const tryFinger = (): void => {
    if (!raised) return;
    figure.group.localToWorld(tip.copy(figure.finger));
    const gap = Math.max(tip.distanceTo(pos) - BALLOON_R, 0) / S;
    if (!sim.fingerAt(gap)) return;
    spark.from.copy(tip);
    spark.to.copy(near.copy(tip).sub(pos).setLength(BALLOON_R).add(pos));
    spark.strike(0.3);
    sparks.burst([tip.x, tip.y, tip.z], 18, [0, 1, 0], 1.6);
    audio.play('spark', { gain: 0.9 }); // the document's «клац»
    // the arm drops back after the spark
    raised = false;
    stage.scope.to(
      figure.finger,
      { x: REST_HAND.x, y: REST_HAND.y, z: REST_HAND.z },
      { duration: 0.6, delay: 0.5, ease: 'power2.inOut' },
    );
  };
  const normal = new Vector3(0, 0, 1);
  const hit = new Vector3();
  ctx.input.register(model.body, {
    tooltip: L.static.rub,
    cursor: 'grab',
    enabled: () => on() && !storming(),
    hover: (over) => stage.scope.to(model, { hover: over ? 1 : 0 }, { duration: 0.12 }),
    dragStart: () => ((mode = 'drag'), audio.play('click')),
    drag: (e) => {
      if (!e.planePoint(normal, STATIC.balloonHome, hit)) return;
      // the balloon cannot pass through the figure or the wall
      pos.set(
        clamp(hit.x, STATIC.figureX + 1.55, STATIC.wallX - BALLOON_R),
        clamp(hit.y, 1.5, 5.6),
        STATIC.balloonHome.z,
      );
      // on the sweater / hair: every reversal after a 4 cm stroke is one rubbing pass
      if (pos.x < STATIC.figureX + 1.8 && sim.dragTo(pos.y / S)) audio.play('tick', { pitch: 1 + share() });
      tryFinger();
    },
    dragEnd: () => {
      const atWall = pos.x > STATIC.wallX - BALLOON_R - 0.12;
      mode = atWall && sim.state.sticksToWall ? 'stuck' : 'free';
      if (atWall && !sim.state.sticksToWall) ui.toast(L.static.weak, { tone: 'warning' });
    },
  });
  ctx.input.register(figure.hand, {
    tooltip: L.static.finger,
    cursor: 'grab',
    enabled: () => on() && !storming(),
    hover: (over) => stage.scope.to(figure, { hover: over ? 1 : 0 }, { duration: 0.12 }),
    drag: (e) => {
      if (!e.planePoint(normal, STATIC.balloonHome, hit)) return;
      raised = true;
      figure.pointAt(figure.group.worldToLocal(hit));
      tryFinger();
    },
  });

  /* ---------------------------------------------------------------------------- phase «Гроза» */
  const set = createStormSet(ctx);
  const storm = createStormFx(ctx, set);
  set.group.add(storm.group);
  ctx.root.add(kit, set.group);
  stage.actor(set.group);
  let strikes = 0;
  const bolt = (): void => {
    if (storm.striking) return;
    ui.set('separation', 100);
    storm.strike(
      ++strikes,
      (i) => {
        audio.play('zap', { gain: 0.9, pitch: 0.8 });
        // thunder follows the first flash by 0,1 s: a low, soft boom
        if (i === 0) stage.scope.delay(0.1, () => audio.play('breaker', { gain: 1, pitch: 0.35 }));
      },
      () => ui.set('separation', REST * 100),
    );
  };
  ui.onChange('separation', (v) => on() && Number(v) >= 100 && bolt());
  const setPhase = (instant = false): void => {
    stage.toggle(set.group, storming(), { instant });
    void ctx.camera.go(storming() ? 'storm' : 'balloon', { instant, duration: 2.2 });
  };
  ui.onChange('phase', () => on() && setPhase());
  const local = (p: Vector3): (() => Vector3) => {
    const out = new Vector3();
    return () => set.group.localToWorld(out.copy(p));
  };

  ctx.qa.probe('balloon', model.body);
  ctx.qa.probe('finger', figure.hand);
  ctx.qa.expose('static', () => ({
    ...sim.state,
    mode,
    x: pos.x,
    y: pos.y,
    squash: model.squash,
    phase: ui.value<string>('phase'),
    separation: storm.separation,
    striking: storm.striking,
    strikes,
    toRod: storm.toRod,
  }));
  ctx.qa.expose('staticPoints', () => ({
    sweater: [STATIC.figureX + 1.55, 2.4, STATIC.balloonHome.z],
    wall: [STATIC.wallX - BALLOON_R, 3.2, STATIC.balloonHome.z],
    home: STATIC.balloonHome.toArray(),
  }));

  const balloonPhase = (): boolean => !storming();
  const head = new Vector3();
  return {
    id: 'static',
    stage: {
      show: [world.top.object, kit],
      camera: 'balloon',
      enter(info) {
        mode = 'free';
        raised = false;
        figure.finger.copy(REST_HAND);
        pos.copy(STATIC.balloonHome);
        storm.reset();
        if (ui.value<number>('separation') >= 100) ui.set('separation', REST * 100);
        setPhase(info.instant);
      },
    },
    ui: {
      hint: L.static.rub,
      honesty: [
        'notToScale',
        { kind: 'simplified', visible: balloonPhase },
        { slowed: 30, visible: storming },
      ],
      controls: [
        {
          type: 'segmented',
          id: 'phase',
          value: 'balloon',
          items: [
            { id: 'balloon', label: docLabel('static', 0) },
            { id: 'storm', label: docLabel('static', 3) },
          ],
        },
        {
          type: 'stats',
          id: 'balloonStats',
          columns: 3,
          visible: balloonPhase,
          items: [
            {
              label: L.static.charge,
              get: () => `${fmtNumber(sim.state.chargeC * 1e9, { digits: 0 })} nC`,
              color: () => 'cyan',
            },
            {
              label: L.static.voltage,
              get: () => `${fmtNumber(sim.state.voltageV / 1e3, { digits: 1 })} kV`,
            },
            {
              label: L.static.gap,
              get: () => `${fmtNumber(sim.state.sparkGapM * 1e3, { digits: 1 })} mm`,
              color: () => 'violet',
            },
          ],
        },
        {
          type: 'note',
          id: 'stuck',
          text: `${L.static.wall}: ${L.static.stuck}`,
          icon: 'check',
          color: 'green',
          visible: () => balloonPhase() && mode === 'stuck',
        },
        {
          type: 'button',
          id: 'rubOnce',
          label: L.static.rub,
          icon: 'plus',
          visible: balloonPhase,
          onClick: () => (sim.rub(), audio.play('tick', { pitch: 1 + share() })),
        },
        {
          type: 'slider',
          id: 'separation',
          label: docLabel('static', 4),
          min: 0,
          max: 100,
          step: 1,
          value: REST * 100,
          unit: '%',
          digits: 0,
          visible: storming,
          disabled: () => storm.striking,
        },
        {
          type: 'toggle',
          id: 'rod',
          label: docLabel('static', 6),
          value: true,
          visible: storming,
          disabled: () => storm.striking,
        },
        {
          type: 'stats',
          id: 'stormStats',
          visible: storming,
          items: [
            { label: L.static.stormU, get: () => `~${stormState(1).voltageMV} MV`, color: () => 'violet' },
            { label: L.static.stormI, get: () => `~${stormState(1).currentKA} kA`, color: () => 'yellow' },
          ],
        },
        {
          type: 'button',
          id: 'bolt',
          label: docLabel('static', 5),
          icon: 'lightning',
          primary: true,
          visible: storming,
          disabled: () => storm.striking,
          onClick: bolt,
        },
      ],
      callouts: [
        {
          anchor: local(set.cloudTop),
          text: L.static.cloudTop,
          side: 'up',
          color: 'coral',
          visible: () => storming() && storm.separation > 0.1,
        },
        {
          anchor: local(set.cloudBase.clone().add(new Vector3(-13, 3, 3))),
          text: L.static.cloudBase,
          side: 'left',
          color: 'cyan',
          visible: () => storming() && storm.separation > 0.1,
        },
        {
          anchor: local(new Vector3(12, 1.5, 9)),
          text: L.static.ground,
          side: 'down',
          color: 'coral',
          visible: () => storming() && storm.separation > 0.3,
        },
      ],
      hotspots: [
        { anchor: [STATIC.wallX + 0.85, 4.9, 1.4], content: 'wall-molecules', visible: balloonPhase },
        { anchor: local(set.rodTip), content: 'lightning-rod', visible: () => storming() && storm.toRod },
        { anchor: local(set.core), content: 'graupel', visible: storming },
      ],
    },
    update(dt, t) {
      // balloon set
      if (mode === 'free') {
        pos.x = damp(pos.x, STATIC.balloonHome.x, 3, dt);
        pos.y = damp(pos.y, STATIC.balloonHome.y + 0.12 * Math.sin(t * 1.1), 3, dt);
      } else if (mode === 'stuck') pos.x = damp(pos.x, STATIC.wallX - BALLOON_R * 0.9, 10, dt);
      model.group.position.copy(pos);
      // stuck: the skin flattens on the wall (it sinks 0,1 R into the wall, which hides the contact patch)
      model.press = mode === 'stuck' ? 1 : 0;
      model.charge = share();
      model.update(dt, t);
      figure.group.localToWorld(head.set(0, 4.3, 0));
      figure.attract.copy(pos);
      figure.lift = share() * smooth(4.4, 1.7, head.distanceTo(pos));
      figure.charged = share();
      figure.update(dt, t);
      wall.source.copy(pos);
      wall.polarisation = Math.min(share() * 5, 1) * smooth(3.6, 0.3, STATIC.wallX - BALLOON_R - pos.x);
      wall.update(dt, t);
      // storm diorama
      storm.toRod = ui.value<boolean>('rod');
      set.rod.visible = storm.toRod;
      storm.separation = damp(
        storm.separation,
        ui.value<number>('separation') / 100,
        storm.striking ? 6 : 3,
        dt,
      );
      if (storming()) {
        set.update(dt, t);
        storm.update(dt, t);
        sound.wind = 0.35 + 0.4 * storm.separation;
      }
    },
  };
};
