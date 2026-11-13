/**
 * Step 2 `drift` — slow electrons, fast signal. A long wire from the switch to the lamp with two race lanes:
 * closing the switch sends the `amber` field front along the wire (1,5 s on stage for ≈ 14 ns), every electron
 * behind it starts to drift, the lamp lights — and the snail-electron has barely moved. Model: `drift` (§2).
 */
import { Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtNumber, fmtUnit, plural } from '@/content';
import { SEMANTIC } from '@/style';
import { DRIFT, drift, durationParts, snailDistanceM } from '@electricity/sim/current';
import type { StepFactory } from '../chapter';
import { DOC } from '../labels';
import { OWN } from '../labels-own';
import { createBallTube } from '../parts/ball-tube';
import { createBattery } from '../parts/battery';
import { createBulb } from '../parts/bulb';
import { anchorIn, createLead, route } from '../parts/leads';
import { RACE, createRace } from '../parts/race';
import { createSwitch } from '../parts/switch';
import { group } from '../world';

const ID = 'drift';
/** `41 000 s` → «11,4 h»; days stay Ukrainian (DECISIONS §46). */
function fmtTime(seconds: number): string {
  const p = durationParts(seconds);
  if (p.unit !== 'd') return fmtUnit(p.value, p.unit, { maxDigits: 1 });
  return `${fmtNumber(p.value, { maxDigits: 1 })} ${plural(p.value, ['доба', 'доби', 'діб'])}`;
}

const BATTERY_Z = -2.2;

export const driftStep: StepFactory = (bench) => {
  const { ctx, ui } = bench;
  const set = group(`set:${ID}`, 0, 0, -0.6);
  bench.top.add(set);
  const sw = createSwitch();
  sw.group.position.set(-2.95, 0, 0);
  const bulb = createBulb();
  bulb.group.position.set(2.95, 0, 0);
  const battery = createBattery();
  battery.group.position.set(0, 0, BATTERY_Z); // behind the wire: the wire is the nearest, largest thing
  const race = createRace(ctx);
  const balls = createBallTube();
  set.add(sw.group, bulb.group, battery.group, race.group, balls.group);
  ctx.stage.actor(balls.group); // hidden until «Аналогія з кульками»

  const endL = new Vector3(RACE.x0 - 0.3, RACE.wireY, 0);
  const endR = new Vector3(RACE.x1 + 0.3, RACE.wireY, 0);
  // conventional direction: «+» → lamp → the long wire → switch → «−»; electrons run from the switch to the lamp
  const leads = [
    createLead(
      route(anchorIn(set, battery.plus), anchorIn(set, bulb.b), [
        [3.9, BATTERY_Z],
        [3.9, 0],
      ]),
    ),
    createLead([anchorIn(set, bulb.a), endR], { bend: 0 }),
    createLead([endL, anchorIn(set, sw.b)], { bend: 0 }),
    createLead(
      route(anchorIn(set, sw.a), anchorIn(set, battery.minus), [
        [-3.9, 0],
        [-3.9, BATTERY_Z],
      ]),
    ),
  ];
  set.add(...leads.map((l) => l.mesh));

  /* ------------------------------------------------------------------------------------- state */
  let since = 0; // seconds since the switch closed (0 while open)
  let analogy = false;
  const amps = (): number => ui.value<number>('i2');
  const area = (): number => Number(ui.value<string>('a2'));
  const closed = (): boolean => ui.value<boolean>('sw2');
  const model = (): ReturnType<typeof drift> => drift(amps(), area());
  const lit = (): boolean => closed() && (analogy ? balls.phase > 0.5 : race.front >= 1);
  const toggleSwitch = (): void => ui.set('sw2', !closed(), { notify: true });
  ui.onChange('sw2', () => audio.play('relay'));
  ctx.input.register(sw.group, {
    tooltip: DOC.switch,
    cursor: 'pointer',
    click: toggleSwitch,
    enabled: () => bench.isCurrent(ID),
  });
  ctx.qa.probe('switch2', sw.handle);
  ctx.qa.expose('drift', () => ({
    driftMmS: model().driftMPerS * 1e3,
    electronTimeS: model().electronTimeS,
    signalNs: model().signalTimeS * 1e9,
    front: race.front,
    snailUm: snailDistanceM(amps(), area(), since) * 1e6,
    lit: lit(),
    analogy,
    pushes: balls.phase,
  }));
  const v = new Vector3();

  return {
    id: ID,
    shots: {
      [ID]: {
        // the wire is the hero: framed from switch to lamp at eye height, the battery loop only peeks in
        position: [0.1, 3.3, 6.9],
        target: [0, 1.35, -0.9],
        fov: 30,
        frameAspect: 1.75,
        orbit: { azimuth: 0.7, polar: 0.3 },
        fit: { center: [0, 1.0, -0.6], radius: 3.6 },
      },
    },
    stage: {
      show: [sw.group, bulb.group, battery.group, race.group, ...leads.map((l) => l.mesh)],
      enter: () => {
        since = 0;
        analogy = false;
        race.front = 0;
        balls.reset();
        sw.closed = closed();
        sw.snap();
      },
    },
    ui: {
      hint: OWN.hintRace,
      honesty: [{ text: DOC.slowedChip }, 'notToScale'],
      controls: [
        {
          type: 'slider',
          id: 'i2',
          label: DOC.currentSlider,
          ...DRIFT.currentRangeA,
          value: DRIFT.currentRangeA.default,
          unit: 'A',
          digits: 1,
        },
        {
          type: 'segmented',
          id: 'a2',
          label: OWN.area,
          items: DRIFT.crossSectionsMm2.map((a) => ({ id: String(a), label: fmtUnit(a, 'mm²') })),
          value: '1',
        },
        { type: 'toggle', id: 'sw2', label: DOC.switch, value: false },
        { type: 'toggle', id: 'balls2', label: DOC.balls, value: false },
        {
          type: 'stats',
          id: 'out2',
          items: [
            { label: OWN.driftSpeed, get: () => fmtUnit(model().driftMPerS * 1e3, 'mm/s', { maxDigits: 3 }) },
            { label: DOC.electronTime, get: () => fmtTime(model().electronTimeS) },
            {
              label: DOC.signalTime,
              get: () => `≈ ${fmtUnit(model().signalTimeS * 1e9, 'ns', { digits: 0 })}`,
            },
            {
              label: OWN.snailPath,
              get: () => fmtUnit(snailDistanceM(amps(), area(), since) * 1e6, 'μm', { digits: 0 }),
            },
          ],
        },
      ],
      callouts: [
        {
          anchor: () => race.snail.getWorldPosition(v).setY(v.y + 0.25),
          text: () => `${OWN.snail} · ${fmtTime(model().electronTimeS)}`,
          color: SEMANTIC.electron,
          side: 'up',
          visible: () => !analogy,
        },
        {
          anchor: () => race.frontMark.getWorldPosition(v).setY(v.y + 0.2),
          text: OWN.front,
          color: SEMANTIC.fieldE,
          side: 'up',
          visible: () => !analogy,
        },
        { anchor: sw.handle, text: DOC.switch, side: 'left' },
      ],
      hotspots: [
        {
          anchor: () => race.snail.getWorldPosition(v).setX(v.x + 0.5),
          content: 'snail-electron',
          visible: () => !analogy,
        },
        {
          anchor: () => race.frontMark.getWorldPosition(v).setX(v.x + 0.45),
          content: 'field-front',
          visible: () => !analogy,
        },
      ],
    },
    update(dt, t) {
      const on = bench.isCurrent(ID) && closed();
      const wantAnalogy = ui.value<boolean>('balls2');
      if (wantAnalogy !== analogy && bench.isCurrent(ID)) {
        analogy = wantAnalogy;
        ctx.stage.toggle(race.group, !analogy);
        ctx.stage.toggle(balls.group, analogy);
      }
      since = on ? since + dt : 0;
      sw.closed = on;
      sw.update(dt);
      // the front needs `frontSceneS` to cross the wire; opening the circuit stops everything at once
      race.front = on ? Math.min(since / DRIFT.frontSceneS, 1) : 0;
      race.drift = on ? 0.05 + 0.25 * Math.min(model().driftMPerS / 2.35e-3, 1) : 0; // exaggerated, ∝ v_d
      race.snailAt = snailDistanceM(amps(), area(), since) / DRIFT.wireLengthM;
      race.update(dt, t);
      balls.pushing = on && analogy;
      balls.update(dt);
      const glow = lit() ? 1 : 0;
      bulb.brightness += (glow - bulb.brightness) * Math.min(dt * 12, 1);
      bulb.update(t);
      for (const lead of leads) lead.drive(lit() ? 0.9 : 0, lit() ? 0.9 : 0);
      bench.live.buzz = lit() ? 0.25 : 0;
    },
  };
};
