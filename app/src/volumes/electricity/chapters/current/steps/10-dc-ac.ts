/**
 * Step 10 `dc-ac` — direct and alternating current, and the bridge to magnetism. Left: a battery and a lamp
 * (DC); right: a mains socket module and the same lamp (AC); between them an oscilloscope that looks at
 * either source. Lenses: steady drift in the DC wire, electrons shuffling to and fro in the AC wire. In front:
 * Oersted's experiment — a wire over a compass; switching 5 A on swings the needle ≈ 79° off north.
 * Models: `sourceVoltage`, `lampFlicker`, `createOerstedCompass` (§10).
 */
import { Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtUnit, linkTarget } from '@/content';
import { SEMANTIC, col } from '@/style';
import { AC_DC, OERSTED, createOerstedCompass, lampFlicker, sourceVoltage } from '@electricity/sim/current';
import content from '../content';
import type { StepFactory } from '../chapter';
import { DOC } from '../labels';
import { OWN } from '../labels-own';
import { createOerstedRig, createScopeBox, createSocketModule } from '../parts/ac-bench';
import { createBattery } from '../parts/battery';
import { createBulb } from '../parts/bulb';
import { anchorIn, createLead, route } from '../parts/leads';
import { createLens } from '../parts/lens';
import { createSupply } from '../parts/supply';
import { group } from '../world';

const ID = 'dc-ac';
const SAMPLES = 160;
const LIVE = col('teal');
const IDLE = col('slate');
/** The scope draws model time slowed so that the 50 Hz sine glides: 1 s on stage = 4 ms of signal. */
const GLIDE = 0.004;

export const dcAcStep: StepFactory = (bench) => {
  const { ctx, ui, mats } = bench;
  const set = group(`set:${ID}`);
  bench.top.add(set);
  const battery = createBattery();
  battery.group.position.set(-2.3, 0, -0.8);
  const socket = createSocketModule();
  socket.group.position.set(2.3, 0, -1.0);
  const lampDc = createBulb(0.85);
  lampDc.group.position.set(-2.3, 0, -2.3);
  const lampAc = createBulb(0.85);
  lampAc.group.position.set(2.3, 0, -2.3);
  const box = createScopeBox();
  box.group.position.set(0, 0, -2.3);
  set.add(battery.group, socket.group, lampDc.group, lampAc.group, box.group);
  const loop = (plus: Vector3, minus: Vector3, la: Vector3, lb: Vector3, x: number) => [
    createLead(
      route(plus, lb, [
        [x + 1.3, plus.z],
        [x + 1.3, lb.z],
      ]),
    ),
    createLead(
      route(la, minus, [
        [x - 1.3, la.z],
        [x - 1.3, minus.z],
      ]),
    ),
  ];
  const dc = loop(
    anchorIn(set, battery.plus),
    anchorIn(set, battery.minus),
    anchorIn(set, lampDc.a),
    anchorIn(set, lampDc.b),
    -2.3,
  );
  const ac = loop(
    anchorIn(set, socket.b),
    anchorIn(set, socket.a),
    anchorIn(set, lampAc.a),
    anchorIn(set, lampAc.b),
    2.3,
  );
  // sense leads of the scope: to the DC loop on the left, to the AC loop on the right
  const sense = [
    createLead(route(anchorIn(set, box.left), new Vector3(-1.0, 0.075, -1.5), [[-0.75, -1.5]]), {
      radius: 0.03,
      color: 'teal',
    }),
    createLead(route(anchorIn(set, box.right), new Vector3(1.0, 0.075, -1.5), [[0.75, -1.5]]), {
      radius: 0.03,
      color: 'teal',
    }),
  ];
  set.add(...[...dc, ...ac, ...sense].map((l) => l.mesh));
  const lensDc = createLens(ctx, mats, [0.45, 2.0, 2.4]);
  lensDc.group.scale.setScalar(0.7);
  lensDc.group.position.set(-3.6, 0.075, -1.55);
  lensDc.dir.set(0, 0, 1);
  const lensAc = createLens(ctx, mats, [-0.45, 2.0, 2.4]);
  lensAc.group.scale.setScalar(0.7);
  lensAc.group.position.set(3.6, 0.075, -1.55);
  lensAc.dir.set(0, 0, 1);
  // Oersted's experiment in front: 5 A from the laboratory supply, wire along north–south (north = away)
  const rig = createOerstedRig();
  rig.group.position.set(1.0, 0, 1.75);
  const supply = createSupply();
  supply.group.position.set(-1.9, 0, 2.5);
  const oersted = [
    createLead(
      route(anchorIn(set, supply.plus), anchorIn(set, rig.south), [
        [-0.4, 2.5],
        [-0.4, 3.35],
        [1.2, 3.35],
      ]),
    ),
    createLead(
      route(anchorIn(set, rig.north), anchorIn(set, supply.minus), [
        [1.6, 0.45],
        [1.6, 0.05],
        [-3.3, 0.05],
        [-3.3, 2.5],
      ]),
    ),
  ];
  set.add(lensDc.group, lensAc.group, rig.group, supply.group, ...oersted.map((l) => l.mesh));

  /* ------------------------------------------------------------------------------------- state */
  const compass = createOerstedCompass();
  const buffer = new Float32Array(SAMPLES);
  const isAc = (): boolean => ui.value<string>('mode10') === 'ac';
  const currentOn = (): boolean => ui.value<boolean>('on10');
  const direction = (): 1 | -1 => (ui.value<string>('dir10') === 'south' ? -1 : 1);
  const bridge = content.crossReferences
    ?.flatMap((x) => x.targets)
    .find((t) => linkTarget(t)?.chapterId === 'magnetism' && linkTarget(t)?.stepId === 'magnet-field');
  const toOersted = (): void => void ctx.camera.go(`${ID}:oersted`, { duration: 1.6 });
  const toBench = (): void => void ctx.camera.go(ID, { duration: 1.6 });
  ui.onChange('on10', () => (audio.play('relay'), toOersted()));
  ui.onChange('dir10', toOersted);
  ui.onChange('mode10', toBench);
  ui.onChange('sweep10', toBench);
  ctx.qa.probe('compass10', rig.compass);
  ctx.qa.expose('dc-ac', () => ({
    mode: isAc() ? 'ac' : 'dc',
    sweepMs: ui.value<number>('sweep10'),
    needleDeg: (rig.angle * 180) / Math.PI,
    on: currentOn(),
    direction: direction(),
    trace: [buffer[0], buffer[40], buffer[80]],
    acAmp: lensAc.ac.amplitude,
  }));
  const v = new Vector3();

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [0.3, 7.4, 10.2],
        target: [0, 0.6, 0.2],
        fov: 30,
        orbit: { azimuth: 0.7, polar: 0.3 },
        fit: { center: [0, 0.8, 0], radius: 4.7 },
      },
      [`${ID}:oersted`]: {
        position: [2.2, 6.2, 7.4],
        target: [0.6, 0.3, 1.6],
        fov: 30,
        orbit: { azimuth: 0.7, polar: 0.3 },
        fit: { center: [0.4, 0.5, 2], radius: 2.6 },
      },
    },
    stage: {
      show: [
        battery.group,
        socket.group,
        lampDc.group,
        lampAc.group,
        box.group,
        lensDc.group,
        lensAc.group,
        rig.group,
        supply.group,
        ...[...dc, ...ac, ...sense, ...oersted].map((l) => l.mesh),
      ],
      enter: () => compass.needle.reset(0),
    },
    ui: {
      reset: true,
      honesty: [{ text: OWN.acChip }, 'notToScale'],
      controls: [
        {
          type: 'segmented',
          id: 'mode10',
          label: OWN.scopeOn,
          items: [
            { id: 'dc', label: DOC.dcAc[0]! },
            { id: 'ac', label: DOC.dcAc[1]! },
          ],
          value: 'dc',
        },
        {
          type: 'slider',
          id: 'sweep10',
          label: DOC.sweep,
          ...AC_DC.sweepMs,
          value: AC_DC.sweepMs.default,
          step: 5,
          unit: 'ms',
        },
        { type: 'toggle', id: 'on10', label: DOC.currentOn, value: false },
        {
          type: 'segmented',
          id: 'dir10',
          label: OWN.direction,
          items: [
            { id: 'north', label: OWN.directions[0] },
            { id: 'south', label: OWN.directions[1] },
          ],
          value: 'north',
        },
        {
          type: 'readout',
          id: 'needle10',
          label: OWN.needle,
          text: () => fmtUnit(Math.abs((rig.angle * 180) / Math.PI), '°', { digits: 0 }),
        },
        {
          type: 'button',
          id: 'next10',
          label: `${OWN.nextChapter} ${DOC.magnetism} →`,
          icon: 'next',
          primary: true,
          onClick: () =>
            bridge && ctx.nav.locate(bridge)
              ? void ctx.nav.open(bridge)
              : ui.toast(OWN.notBuilt, { tone: 'info' }),
        },
      ],
      callouts: [
        {
          anchor: box.top,
          text: () => (isAc() ? OWN.scopeAc : OWN.scopeDc),
          color: SEMANTIC.phaseL1,
          side: 'up',
        },
        { anchor: socket.top, text: OWN.mains, side: 'up' },
        {
          anchor: () => lensDc.head.getWorldPosition(v).setY(v.y + 0.75),
          text: OWN.driftDc,
          color: 'cyan',
          side: 'up',
        },
        {
          anchor: () => lensAc.head.getWorldPosition(v).setY(v.y + 0.75),
          text: OWN.driftAc,
          color: 'cyan',
          side: 'up',
        },
        {
          anchor: rig.wire,
          text: () => (currentOn() ? `5 A ${direction() > 0 ? '↑' : '↓'}` : OWN.wireOff),
          color: SEMANTIC.current,
          side: 'right',
        },
      ],
      hotspots: [
        { anchor: rig.compass, content: 'compass' },
        {
          anchor: () => box.top.getWorldPosition(v).set(v.x + 1.0, v.y - 0.9, v.z + 0.5),
          content: 'sine-on-scope',
        },
      ],
    },
    update(dt, t) {
      const on = bench.isCurrent(ID);
      const acMode = isAc();
      // scope: one screen = `sweep` ms of the selected source; DC on a ±2 V scale, AC on ±350 V
      const sweep = ui.value<number>('sweep10') / 1000;
      const full = acMode ? 350 : 2;
      for (let k = 0; k < SAMPLES; k++)
        buffer[k] = sourceVoltage(acMode ? 'ac' : 'dc', t * GLIDE + (k / (SAMPLES - 1)) * sweep) / full;
      box.scope.setSamples(0, buffer);
      sense[0]!.tint(acMode ? IDLE : LIVE);
      sense[1]!.tint(acMode ? LIVE : IDLE);
      // DC loop: steady pulses one way; AC loop: pulses swing back and forth with the (slowed) mains
      for (const lead of dc) lead.drive(on ? 0.8 : 0, on ? 0.7 : 0);
      const swing = Math.sin(t * 2 * Math.PI * 0.6);
      for (const lead of ac) lead.drive(on ? 1.6 * swing : 0, on ? 0.35 + 0.5 * Math.abs(swing) : 0);
      lampDc.brightness = on ? 0.85 : 0;
      lampAc.brightness = on ? 0.85 * lampFlicker('ac', t * 0.02) : 0; // 100 Hz flicker, slowed to be seen at all
      lampDc.update(t);
      lampAc.update(t);
      lensDc.drift = -0.22;
      lensAc.ac.amplitude = 0.3;
      lensAc.ac.frequency = 0.6;
      lensDc.update(dt, t, ctx.camera.camera);
      lensAc.update(dt, t, ctx.camera.camera);
      // Oersted: second-order needle toward atan(B_wire/B_Earth); rings and pulses follow the current
      const i = on && currentOn() ? 1 : 0;
      rig.angle = compass.step(dt, i === 1, direction());
      rig.field += (i - rig.field) * Math.min(dt * 5, 1);
      rig.update(t);
      for (const lead of oersted) lead.drive(i * direction() * 1.8, i * 1.2);
      supply.set(Number.NaN, i * OERSTED.currentA);
      supply.update(t);
      bench.live.hum = on ? (acMode ? 0.7 : 0.35) : 0;
    },
  };
};
