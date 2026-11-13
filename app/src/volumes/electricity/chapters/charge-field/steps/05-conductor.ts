/**
 * Step 5 `conductor-in-field` — «Провідник у полі: індукція й екранування». A uniform field between two
 * electrode bars; a draggable metal ball whose free electrons shift against the field (sim: σ = 3ε₀E₀cos θ,
 * `inducedShiftFraction`), field lines that end on it at right angles (`sphereInUniformField`) and none
 * inside (cutaway). Tabs: the Faraday cage with two sensors and a phone, and the pointed conductor with corona.
 */
import { Group, Mesh, SphereGeometry, Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtNumber, fmtSci } from '@/content';
import { damp } from '@/engine/api';
import { createCorona, createHalo } from '@/fx';
import {
  CONDUCTOR_FIELD_RANGE_V_PER_M as E0,
  inducedHemisphereCharge,
  inducedShiftFraction,
  inducedSurfaceDensity,
} from '@electricity/sim/charge-field';
import { K } from '@/style';
import { clamp, type StepFactory } from '../chapter';
import { cap, docItems, docLabel } from '../content';
import { fmtPrefixed } from '../fmt';
import { DOC, L } from '../labels';
import { CONDUCTOR, M } from '../layout';
import { createConductorField } from '../parts/conductor-field';
import { cage, cutBall, electrodes, metalBall, miniCar, phone, teardrop, TIP_X } from '../parts/conductors';
import { createInduced } from '../parts/induced';
import { sound } from '../sound';

type Shape = 'ball' | 'cage' | 'tip';
const SHAPES: readonly Shape[] = ['ball', 'cage', 'tip'];
const R = CONDUCTOR.radius;

export const conductorStep: StepFactory = ({ ctx, ui, world }) => {
  const { stage } = ctx;
  const on = (): boolean => stage.current === 'conductor-in-field';
  const set = new Group();
  set.name = 'step-conductor';
  const body = new Group(); // moves with the dragged conductor
  body.position.set(0, CONDUCTOR.y, 0);
  const field = createConductorField();
  const induced = createInduced();
  const models = { ball: metalBall(), cut: cutBall(), cage: cage(), tip: teardrop() };
  const corona = createCorona({ size: 1.5, intensity: 0 });
  corona.position.x = TIP_X + 0.05;
  const inner = new Mesh(
    new SphereGeometry(0.13, 16, 12),
    K.glow({ color: 'green', keepHue: true, whiten: 0, intensity: 1.7 }),
  );
  inner.add(createHalo({ color: 'green', size: 0.9, intensity: 0.7, amount: 0.3 }));
  const outer = new Mesh(
    new SphereGeometry(0.13, 16, 12),
    K.glow({ color: 'amber', keepHue: true, whiten: 0, intensity: 1.7 }),
  );
  outer.position.set(0, 0.2, -2.1);
  const mobile = phone();
  const grip = new Mesh(new SphereGeometry(R + 0.25, 16, 12), K.flat('cyan'));
  grip.material.colorWrite = false;
  grip.material.depthWrite = false;
  body.add(
    models.ball,
    models.cut,
    models.cage,
    models.tip,
    induced.group,
    corona,
    inner,
    outer,
    mobile.group,
    grip,
  );
  const car = miniCar();
  set.add(electrodes(), field.lines, body, car);
  ctx.root.add(set);
  // every shape is its own actor, registered now so that deep links find them hidden
  const actors = {
    ball: stage.actor(models.ball),
    cut: stage.actor(models.cut),
    cage: stage.actor(models.cage),
    tip: stage.actor(models.tip),
  };
  const cageKit = [stage.actor(inner), stage.actor(outer), stage.actor(mobile.group)];
  const inducedActor = stage.actor(induced.group, { appear: 'none' });
  const phoneIn = stage.param('phoneIn', 0, { duration: 1.0, ease: 'power2.inOut' });

  const shape = (): Shape => ui.value<Shape>('shape');
  const e0 = (): number => ui.value<number>('e0') * 1e3; // slider in kV/m
  const inside = (): boolean => Math.abs(body.position.z) <= CONDUCTOR.halfWidth - 0.2;
  const applyShape = (instant = false): void => {
    const s = shape();
    const cut = s === 'ball' && ui.value<boolean>('cut');
    stage.toggle(actors.ball, s === 'ball' && !cut, { instant });
    stage.toggle(actors.cut, cut, { instant });
    stage.toggle(actors.cage, s === 'cage', { instant });
    stage.toggle(actors.tip, s === 'tip', { instant });
    for (const a of cageKit) stage.toggle(a, s === 'cage', { instant });
    stage.toggle(inducedActor, s !== 'tip', { instant: true });
    induced.cut = cut;
    traced = '';
  };
  ui.onChange('shape', () => on() && (applyShape(), stage.setParam('phoneIn', 0)));
  ui.onChange('cut', () => on() && applyShape());
  const togglePhone = (): void => {
    const next = phoneIn.value < 0.5 ? 1 : 0;
    stage.setParam('phoneIn', next);
    audio.play('whooshUp', { gain: 0.35 });
  };

  const up = new Vector3(0, 1, 0);
  const hit = new Vector3();
  const hover = { v: 0 };
  ctx.input.register(grip, {
    tooltip: L.conductor.drag,
    cursor: 'grab',
    enabled: on,
    hover: (over) => stage.scope.to(hover, { v: over ? 1 : 0 }, { duration: 0.12 }),
    dragStart: () => audio.play('click'),
    drag: (e) => {
      if (!e.planePoint(up, body.position, hit)) return;
      // between the electrodes along X; along Z the conductor may leave the field (and come back)
      body.position.x = clamp(
        hit.x,
        -CONDUCTOR.plates + R + 0.5,
        CONDUCTOR.plates - R - (shape() === 'tip' ? TIP_X - R + 0.6 : 0.5),
      );
      body.position.z = clamp(hit.z, -4.6, 4.6);
    },
  });
  ctx.qa.probe('conductor', grip);
  ctx.qa.expose('conductor', () => ({
    shape: shape(),
    cut: ui.value<boolean>('cut'),
    e0: e0(),
    inside: inside(),
    shift: induced.shift,
    x: body.position.x,
    z: body.position.z,
    phoneIn: phoneIn.value,
    signal: mobile.signal,
  }));

  let traced = '';
  let wait = 0;
  const realR = R / M; // the ball's radius in the table's metres (≈ 3,8 cm)
  const ballMode = (): boolean => shape() === 'ball';
  const spot = new Vector3();

  return {
    id: 'conductor-in-field',
    stage: {
      show: [world.top.object, set],
      camera: 'conductor',
      enter(info) {
        body.position.set(0, CONDUCTOR.y, 0);
        applyShape(true);
        induced.shift = info.instant ? inducedShiftFraction(e0()) : 0;
        if (info.instant) return;
        // the ball rolls into the field from the front edge; its electrons shift as it enters
        body.position.z = 4.6;
        info.scope.to(body.position, { z: 0 }, { duration: 1.3, ease: 'power2.out', delay: 0.3 });
      },
    },
    ui: {
      hint: L.conductor.drag,
      honesty: [
        { slowed: 1e9, visible: () => shape() !== 'tip' },
        { kind: 'illustrative', text: L.conductor.tipModel, visible: () => shape() === 'tip' },
        'notToScale',
      ],
      controls: [
        {
          type: 'segmented',
          id: 'shape',
          value: 'ball',
          items: SHAPES.map((id, i) => ({ id, label: docItems('conductor-in-field', 0)[i]! })),
        },
        {
          type: 'slider',
          id: 'e0',
          label: L.conductor.e0,
          min: E0.min / 1e3,
          max: E0.max / 1e3,
          step: E0.step / 1e3,
          value: E0.default / 1e3,
          unit: 'kV/m',
          digits: 0,
        },
        {
          type: 'toggle',
          id: 'cut',
          label: docLabel('conductor-in-field', 1),
          value: false,
          visible: ballMode,
        },
        {
          type: 'stats',
          id: 'conductorStats',
          visible: () => shape() !== 'tip',
          items: [
            {
              label: L.conductor.shifted,
              get: () =>
                inside() ? fmtSci(inducedHemisphereCharge(e0(), realR).electrons, 1) : L.conductor.out,
              color: () => 'cyan',
            },
            {
              label: L.conductor.sigma,
              get: () => (inside() ? `${fmtPrefixed(inducedSurfaceDensity(e0(), 0), 'C')}/m²` : '—'),
            },
            {
              label: L.conductor.surface,
              get: () => (inside() ? `${fmtNumber((3 * e0()) / 1e3, { digits: 0 })} kV/m` : '—'),
              color: () => 'amber',
            },
          ],
        },
        {
          type: 'stats',
          id: 'phoneStats',
          visible: () => shape() === 'cage',
          items: [
            {
              label: L.conductor.signal,
              get: () => (mobile.signal > 0.5 ? L.conductor.signalOn : L.conductor.signalOff),
              color: () => (mobile.signal > 0.5 ? 'green' : 'red'),
            },
          ],
        },
        {
          type: 'note',
          id: 'phoneNote',
          text: cap(DOC.phoneNote),
          icon: 'info',
          visible: () => shape() === 'cage' && phoneIn.value > 0.5,
        },
        {
          type: 'button',
          id: 'phone',
          label: docLabel('conductor-in-field', 3),
          icon: 'arrowRight',
          visible: () => shape() === 'cage' && phoneIn.value < 0.5,
          onClick: togglePhone,
        },
        {
          type: 'button',
          id: 'phoneOut',
          label: L.conductor.phoneOut,
          icon: 'arrowLeft',
          visible: () => shape() === 'cage' && phoneIn.value >= 0.5,
          onClick: togglePhone,
        },
      ],
      callouts: [
        {
          anchor: body,
          text: L.conductor.inside,
          side: 'up',
          color: 'green',
          visible: () => shape() === 'cage' || (ballMode() && ui.value<boolean>('cut')),
        },
        {
          anchor: outer,
          text: L.conductor.sensorOut,
          side: 'left',
          color: 'amber',
          visible: () => shape() === 'cage',
        },
        {
          anchor: corona,
          text: L.conductor.corona,
          side: 'up',
          color: 'violet',
          visible: () => shape() === 'tip' && e0() > 0,
        },
      ],
      hotspots: [
        {
          anchor: () => spot.copy(body.position).add(hit.set(-R * 0.8, R * 0.75, R * 0.3)),
          content: 'surface-charge',
          visible: () => shape() !== 'tip',
        },
        { anchor: () => spot.copy(car.position).setY(1.1), content: 'car' },
      ],
    },
    update(dt, t) {
      const s = shape();
      const density = e0() / E0.max;
      const active = inside();
      // the electron "skin" needs ≈ 0,4 s on screen to settle (a billionth of a second in a real metal)
      induced.shift = damp(induced.shift, s === 'tip' ? 0 : active ? inducedShiftFraction(e0()) : 0, 6, dt);
      induced.update(t);
      wait -= dt;
      const key = `${s}|${body.position.x.toFixed(3)}|${body.position.z.toFixed(3)}|${density}|${active}`;
      if (key !== traced && wait <= 0) {
        traced = key;
        wait = 1 / 30;
        if (s === 'tip') field.traceTip(body.position, density);
        else field.traceSphere(body.position, density, active);
      }
      field.lines.dashSpeed = 0.5 + 1.2 * density;
      corona.intensity = s === 'tip' ? 2.2 * density * (0.85 + 0.15 * Math.sin(t * 23)) : 0;
      corona.visible = corona.intensity > 0.02;
      // sensors of the cage: the inner one stays calm and green, the outer one blinks faster in a stronger field
      outer.scale.setScalar(
        active && density > 0 ? 1 + 0.35 * Math.max(Math.sin(t * (4 + 14 * density)), 0) : 0.7,
      );
      inner.scale.setScalar(1 + 0.06 * Math.sin(t * 2));
      // the phone glides from beside the cage to its centre; the signal bars go out once it is inside
      const p = phoneIn.value;
      mobile.group.position.set(
        2.5 * (1 - p),
        0.25 + 0.9 * Math.sin(p * Math.PI) - 0.25 * p,
        1.7 * (1 - p) + 0.02,
      );
      mobile.group.rotation.y = -0.5 * (1 - p);
      mobile.signal = 1 - clamp((p - 0.55) / 0.35, 0, 1);
      mobile.update();
      grip.scale.setScalar(1 + 0.05 * hover.v);
      body.position.y = CONDUCTOR.y + 0.04 * Math.sin(t * 1.4);
      sound.buzz = s === 'tip' ? 0.5 * density : 0;
    },
  };
};
