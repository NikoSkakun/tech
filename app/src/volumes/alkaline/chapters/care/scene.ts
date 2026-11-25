/**
 * `care`: `sizes` (four batteries on the table, a touch shows each one's voltage and hours), `short` (a tap lays the
 * bare wire across the poles and takes it away: the lamp dies, the meter drops), `hot` (slider «Хвилини» of a short:
 * the heat grows inside the slice and the battery, the copper stays cold) and `leak` (slider «Роки»: the white crust).
 */
import { CylinderGeometry, Mesh, Quaternion, Vector3 } from 'three';
import { defineScene, type Shot } from '@/engine/api';
import { K } from '@/style';
import { BATTERY, STAGE_FOV } from '@circuit/shared/stage';
import { createCrust, createJumper, createSizes, SIZES } from '@alkaline/shared/care';
import { goals, runChapter, type StepDef } from '@alkaline/shared/chapter';
import { scrubSlider } from '@alkaline/shared/controls';
import { scrub, glide, smooth } from '@alkaline/shared/scrub';
import { battery, mountBattery } from '@alkaline/shared/world';
import { caption } from './content';

const done = goals('care');
const v3 = (v: Vector3): [number, number, number] => [v.x, v.y, v.z];

export default defineScene((ctx) => {
  const w = mountBattery(ctx);
  const b = battery();
  const at = (id: string) => () => ctx.stage.current === id;

  // ---- the things of this chapter
  const sizes = createSizes();
  const jumper = createJumper(
    b.minus
      .clone()
      .addScaledVector(b.axis, 0.05)
      .add(new Vector3(0, 0.12, 0.06)),
    b.plus
      .clone()
      .addScaledVector(b.axis, -0.12)
      .add(new Vector3(0, 0.14, 0.06)),
  );
  const crust = createCrust(b.minus.clone().addScaledVector(b.axis, 0.02), b.axis);
  const shellMat = K.glow({ color: 'orange', intensity: 0, additive: true, whiten: 0.1 });
  const shell = new Mesh(
    new CylinderGeometry(BATTERY.radius * 1.12, BATTERY.radius * 1.12, BATTERY.length * 0.96, 40, 1, true),
    shellMat,
  );
  shell.position.copy(b.centre);
  shell.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), b.axis));
  ctx.root.add(sizes.group, jumper.group, crust.group, shell);
  const centre = sizes.items
    .reduce((c, it) => c.add(it.body.position), new Vector3())
    .divideScalar(4)
    .setY(0.9);
  const sizesShot: Shot = {
    position: v3(centre.clone().add(new Vector3(0.3, 3.0, 8.4))),
    target: v3(centre),
    fov: STAGE_FOV,
    fit: { center: v3(centre), radius: 1.9 },
    orbit: { azimuth: 0.4, polar: 0.2, zoom: [0.8, 1.3] },
  };
  ctx.camera.shots({ sizes: sizesShot });

  // ---- sizes
  const touched = new Set<number>();
  sizes.items.forEach((it, i) => {
    ctx.input.register(it.body, {
      cursor: 'pointer',
      enabled: at('sizes'),
      click: () => void touched.add(i),
    });
    ctx.qa.probe(`size-${i}`, () => it.body.position.clone().setY(0.5));
  });
  const sizesStep: StepDef = {
    spec: { ...w.state('sizes'), params: { closed: 0, poles: 1 }, cameraMove: { duration: 2 } },
    ui: {
      goal: () => done.has('sizes'),
      callouts: sizes.items.map((it, i) => ({
        anchor: v3(it.top),
        text: () =>
          touched.has(i)
            ? `${caption('sizes', i)}: 1,6 V · ≈ ${SIZES[i]!.hours} ${caption('sizes', 4)}`
            : caption('sizes', i),
        side: 'up' as const,
        visible: at('sizes'),
      })),
    },
    enter: (info) => {
      touched.clear();
      w.reset({ out: 0, cut: 0, life: 0, heat: 0 }, info.instant);
    },
    update: () => {
      if (touched.size === 4) done.add('sizes');
    },
  };

  // ---- short: the bare wire across the poles
  let jumpTarget = 0;
  let onFor = 0;
  let wasOn = false;
  ctx.input.register(jumper.mesh, {
    cursor: 'pointer',
    enabled: at('short'),
    click: () => void (jumpTarget = jumpTarget > 0.5 ? 0 : 1),
  });
  // the wire is thin: a generous invisible handle in its middle, wherever it is
  const jumperAt = () =>
    b.centre.clone().add(new Vector3(0, -0.36 + 0.75 * jumper.on, 0.62 - 0.25 * jumper.on));
  const handle = w.hitAt(jumperAt(), 0.32, 'jumper');
  ctx.input.register(handle, {
    cursor: 'pointer',
    enabled: at('short'),
    click: () => void (jumpTarget = jumpTarget > 0.5 ? 0 : 1),
  });
  const short: StepDef = {
    spec: { ...w.state('standMeter'), params: { closed: 1, poles: 1 }, cameraMove: { duration: 2 } },
    ui: {
      goal: () => done.has('short'),
      callouts: [
        {
          anchor: () => b.centre.clone().add(new Vector3(0, -0.36 + 0.9 * jumper.on, 0.62 - 0.2 * jumper.on)),
          text: caption('short', 0),
          visible: at('short'),
        },
        { anchor: w.gauge.anchor, text: caption('short', 1), visible: at('short') },
      ],
    },
    enter: (info) => {
      w.reset({ out: 0, cut: 0, life: 0, heat: 0 }, info.instant);
      w.setPoleDots(true);
      w.meter.want = 1;
      w.meter.minus = w.meter.plus = 1;
      jumpTarget = 0;
      jumper.on = 0;
      onFor = 0;
      wasOn = false;
    },
    leave: () => {
      w.meter.want = 0;
      w.meter.minus = w.meter.plus = 0;
    },
    update: (dt) => {
      onFor = jumpTarget > 0.5 ? onFor + dt : 0;
      if (onFor > 2) wasOn = true;
      if (wasOn && jumpTarget < 0.5) done.add('short');
    },
  };

  // ---- hot: minutes of a short circuit
  const minutes = scrub(0, 0.35);
  const hot: StepDef = {
    spec: { ...w.state('slice'), params: { closed: 1, poles: 1 }, cameraMove: { duration: 2 } },
    ui: {
      goal: () => done.has('hot'),
      controls: [
        scrubSlider(minutes, 'minutes', caption('hot', 0), {
          max: 30,
          format: (v) => `${Math.round(v)} хв`,
          marks: [
            { value: 0, label: caption('hot', 1) },
            { value: 30, label: caption('hot', 2) },
          ],
          onChange: (v) => v >= 15 && done.add('hot'),
        }),
      ],
      callouts: [
        {
          anchor: w.slice.rings.zinc.anchor,
          text: caption('hot', 3),
          visible: () => at('hot')() && w.heat.shown > 0.3,
        },
        {
          anchor: () => b.centre.clone().add(new Vector3(0, 0.66, 0.4)),
          text: caption('hot', 4),
          visible: at('hot'),
        },
      ],
    },
    enter: (info) => {
      w.reset({ out: 1, spread: 0, lye: 1, cut: 1, life: 0, heat: 0 }, info.instant);
      w.island = 1;
      w.setPoleDots(true);
      jumpTarget = 1;
      jumper.on = 1;
      minutes.target = minutes.shown = 0;
    },
    leave: () => {
      w.island = 0;
      jumpTarget = 0;
    },
    update: (dt) => {
      glide(minutes, dt);
      const m = minutes.shown;
      // the heat rises over the first minutes and fades as the zinc runs out; the store goes in ≈ half an hour
      w.heat.target = smooth(0, 6, m) * (1 - 0.65 * smooth(16, 30, m));
      w.life.target = 0.92 * smooth(0, 30, m);
    },
  };

  // ---- leak: years in a forgotten remote
  const years = scrub(0, 0.35);
  const leak: StepDef = {
    spec: { ...w.state('batteryMinus'), params: { closed: 0, poles: 1 }, cameraMove: { duration: 2 } },
    ui: {
      goal: () => done.has('leak'),
      controls: [
        scrubSlider(years, 'years', caption('leak', 0), {
          max: 10,
          format: (v) => `${Math.round(v)}`,
          marks: [
            { value: 0, label: caption('leak', 1) },
            { value: 10, label: caption('leak', 2) },
          ],
          onChange: (v) => v >= 9.9 && done.add('leak'),
        }),
      ],
      callouts: [
        {
          anchor: () => b.minus.clone().add(new Vector3(0, BATTERY.radius + 0.05, 0)),
          text: caption('leak', 3),
          visible: () => at('leak')() && crust.amount > 0.3,
        },
      ],
    },
    enter: (info) => {
      w.reset({ out: 0, cut: 0, life: 0.4, heat: 0 }, info.instant);
      years.target = years.shown = 0;
    },
    update: (dt) => {
      glide(years, dt);
    },
  };

  ctx.qa.expose('care', () => ({
    step: ctx.stage.current,
    touched: [...touched],
    jumper: jumper.on,
    short: w.short,
    volts: w.volts,
    minutes: minutes.shown,
    heat: w.heat.shown,
    crust: crust.amount,
  }));
  return runChapter(
    ctx,
    w,
    { sizes: sizesStep, short, hot, leak },
    {
      enter: (id, info) => {
        sizes.group.visible = id === 'sizes';
        crust.group.visible = id === 'leak';
        if (id !== 'short' && id !== 'hot') jumpTarget = 0;
        if (info.instant) jumper.on = jumpTarget;
        if (id !== 'leak') years.target = years.shown = 0;
      },
      update: (dt) => {
        // the wire glides to the poles and back (0.6 s); the short follows the wire
        jumper.on += Math.sign(jumpTarget - jumper.on) * Math.min(Math.abs(jumpTarget - jumper.on), dt / 0.6);
        jumper.update();
        handle.position.copy(jumperAt());
        jumper.group.visible = ctx.stage.current === 'short' || ctx.stage.current === 'hot';
        w.short = smooth(0.85, 1, jumper.on);
        shellMat.intensity = 0.7 * w.heat.shown;
        crust.amount = smooth(2.5, 9.5, years.shown);
        crust.update();
      },
    },
  );
});
