/**
 * Step 7 `mppt-controller` — the boost stage as the hand on the rheostat. Above the inverter hangs the P-V
 * hill of the string with a climber: the duty D sets the string voltage U_pv = 400·(1 − D), so every change
 * of D is a step along the hill. «Ранок» puts two different hills on the two inputs; one tracker for both
 * shows the mismatch loss; «Обрізання» adds the 6 kW ceiling. Model: `createMpptController`,
 * `eastWestMismatch`, `clippedPoint` logic (§M5) through `sim-bindings/mppt-session`.
 */
import { Vector3 } from 'three';
import { fmtNumber, fmtPercent, fmtSI, fmtUnit } from '@/content';
import { damp } from '@/engine/api';
import { createScreen } from '@/fx';
import { PLANT_TYPE } from '@/style';
import { STATUS } from '@/ui3d';
import type { StepFactory } from '../chapter';
import { doc } from '../labels';
import { OWN } from '../labels-own';
import { invToSet } from '../parts/bench-set';
import { STAGE } from '../parts/inverter-layout';
import { MOUNTAIN, createPvMountain } from '../parts/pv-mountain';
import { createMpptSession, type MpptMode } from '../sim-bindings/mppt-session';
import { group } from '../world';
import { sharedBench } from './shared-bench';

const ID = 'mppt-controller';
/** Height of the holograms' base line above the bench. */
const HILL_Y = 1.8;
/** Poses of the two holograms (set space): alone in the middle, or side by side in the morning scene. */
const POSE = {
  solo: { x: -1.2, s: 0.88 },
  left: { x: -2.85, s: 0.58 },
  right: { x: -0.1, s: 0.58 },
} as const;

export const mpptController: StepFactory = (lab) => {
  const { ui } = lab;
  const bench = sharedBench(lab);
  const { inv } = bench;
  const session = createMpptSession();
  const hills = [createPvMountain('yellow', 'coral'), createPvMountain(PLANT_TYPE.solar, 'sky')] as const;
  const holders = hills.map((m, i) => {
    const screen = createScreen({
      width: MOUNTAIN.w + 0.5,
      height: MOUNTAIN.h + 1.1,
      divisions: [8, 6],
      accent: 'violet',
    });
    screen.position.set(0, MOUNTAIN.h / 2 + 0.05, -0.05);
    return group(`hill-${i}`, POSE.solo.x, HILL_Y, -0.45, [screen, m.group]);
  });
  const set = group(`set:${ID}`, 0, 0, 0, holders);
  lab.stageRoot.add(set);

  const morning = (): boolean => ui.value<boolean>('morning7');
  const mode = (): MpptMode =>
    morning()
      ? ui.value<boolean>('single7')
        ? 'shared'
        : 'two'
      : ui.value<boolean>('clip7')
        ? 'clipping'
        : 'single';
  function configure(): void {
    session.configure({
      mode: mode(),
      gWm2: ui.value<number>('g7'),
      tcC: ui.value<number>('t7'),
      auto: ui.value<boolean>('auto7'),
      duty: ui.value<number>('d7'),
    });
  }
  for (const id of ['d7', 'auto7', 'g7', 't7', 'morning7', 'single7', 'clip7']) ui.onChange(id, configure);

  let drawn = '';
  const first = (): (typeof session.climbers)[number] => session.climbers[0]!;
  const total = (): number => session.climbers.reduce((s, c) => s + c.pW, 0);
  const chokeAt = invToSet(STAGE.chokeA.at.clone().setY(0.6));
  const tmp = new Vector3();
  const onHill = (i: number, v: () => number, p: () => number, dy = 0): (() => Vector3) => {
    const out = new Vector3();
    return () => hills[i]!.group.localToWorld(hills[i]!.point(v(), p(), out).setY(out.y + dy));
  };

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [-0.4, 5.3, 11.4],
        target: [-1.45, 2.3, 0.2],
        fov: 30,
        frameAspect: 1.2,
        orbit: { azimuth: 0.45, polar: 0.25 },
        fit: { center: [-1.5, 2, 0], radius: 3.6 },
      },
    },
    stage: {
      show: [bench.actor, set],
      params: { coverOpen: 1, coverAway: 1 },
      enter: () => {
        drawn = '';
        configure();
      },
      post: { bloomIntensity: 1.1 },
    },
    ui: {
      hint: OWN.hint7,
      honesty: ['simplified', { slowed: 20000 }],
      controls: [
        {
          type: 'slider',
          id: 'd7',
          label: doc(ID, 0),
          min: 0,
          max: 0.8,
          step: 0.005,
          value: 0.3,
          digits: 3,
          disabled: () => ui.value<boolean>('auto7') || morning(),
        },
        {
          type: 'slider',
          id: 'g7',
          label: OWN.irradiance,
          min: 0,
          max: 1200,
          step: 50,
          value: 1000,
          unit: 'W/m²',
          digits: 0,
          disabled: morning,
        },
        {
          type: 'slider',
          id: 't7',
          label: OWN.cellTemp,
          min: -20,
          max: 70,
          step: 5,
          value: 25,
          unit: '°C',
          digits: 0,
        },
        { type: 'toggle', id: 'auto7', label: doc(ID, 1), value: true },
        { type: 'toggle', id: 'clip7', label: doc(ID, 5), value: false, disabled: morning },
        { type: 'toggle', id: 'morning7', label: doc(ID, 2), value: false },
        { type: 'toggle', id: 'single7', label: doc(ID, 3), value: false, visible: morning },
      ],
      board: {
        title: OWN.board7,
        size: 'sm',
        children: [
          {
            type: 'stats',
            id: 'stats7',
            columns: 2,
            items: [
              { label: doc(ID, 0), get: () => fmtNumber(first().duty, { digits: 3 }) },
              { label: OWN.uPv, get: () => fmtUnit(first().vV, 'V', { digits: 1 }) },
              { label: OWN.pNow, get: () => fmtSI(total(), 'W'), color: () => STATUS.info },
              {
                label: OWN.pTop,
                get: () =>
                  fmtSI(
                    session.climbers.reduce((s, c) => s + c.mppW, 0),
                    'W',
                  ),
              },
            ],
          },
          {
            type: 'table',
            id: 'table7',
            head: [OWN.where, OWN.pNow],
            rows: () => [
              [OWN.twoMppt, fmtSI(session.mismatch.twoMpptW, 'W')],
              [OWN.oneMppt, fmtSI(session.mismatch.oneMpptW, 'W')],
              [
                doc(ID, 4),
                `${fmtSI(session.mismatch.lossW, 'W')} · ${fmtPercent(session.mismatch.lossFraction, 1)}`,
              ],
            ],
            highlight: () => (mode() === 'shared' ? 1 : 0),
            visible: morning,
          },
          {
            type: 'note',
            id: 'clip7note',
            text: () => `${doc(ID, 7)}: ${fmtSI(session.capW ?? 0, 'W')}`,
            icon: 'warning',
            color: STATUS.warning,
            visible: () => mode() === 'clipping',
          },
        ],
      },
      callouts: [
        {
          anchor: () => holders[0]!.localToWorld(tmp.set(-MOUNTAIN.w / 2 + 0.2, MOUNTAIN.h + 0.75, 0)),
          text: () =>
            mode() === 'shared'
              ? OWN.sumCurve
              : mode() === 'two'
                ? `${OWN.east} · ${OWN.inputA}`
                : OWN.inputA,
          color: 'yellow',
          side: 'up',
        },
        {
          anchor: () => holders[1]!.localToWorld(tmp.set(-MOUNTAIN.w / 2 + 0.2, MOUNTAIN.h + 0.75, 0)),
          text: `${OWN.west} · ${OWN.inputB}`,
          color: 'amber',
          side: 'up',
          visible: () => mode() === 'two',
        },
        {
          anchor: () => lab.stageRoot.localToWorld(tmp.copy(chokeAt)),
          text: OWN.boostStage,
          color: 'cyan',
          side: 'left',
        },
      ],
      hotspots: [
        {
          anchor: onHill(
            0,
            () => 20,
            () => first().power(20),
            0.3,
          ),
          content: 'input-current-limit',
        },
      ],
    },
    probe: () => ({
      mode: mode(),
      duty: first().duty,
      vPv: first().vV,
      p: total(),
      mpp: first().mppW,
      loss: session.mismatch.lossW,
      climbers: session.climbers.length,
    }),
    update(dt, t) {
      if (!lab.isCurrent(ID)) return;
      session.tick(dt);
      const m = mode();
      const cs = session.climbers;
      // reshape the hills when a curve changed; the frame's top follows the tallest peak
      const key = `${m}|${session.version}`;
      if (key !== drawn) {
        drawn = key;
        const top = Math.max(600, ...cs.map((c) => c.mppW)) * 1.18;
        cs.forEach((c, i) => {
          hills[i]!.setCurve(c.power, top);
          hills[i]!.setPeak(c.mppV, c.mppW, fmtSI(c.mppW, 'W'));
          hills[i]!.setCeiling(i === 0 ? session.capW : null);
          hills[i]!.label.text = OWN.axisPv;
        });
      }
      cs.forEach((c, i) => {
        hills[i]!.setClimber(c.vV, Math.min(c.pW, session.capW ?? Infinity));
        hills[i]!.climberTag.text = `${fmtUnit(c.vV, 'V', { digits: 0 })} · ${fmtSI(c.pW, 'W')}`;
      });
      // one hologram in the middle, or two side by side
      const two = m === 'two';
      const want = [two ? POSE.left : POSE.solo, POSE.right];
      holders.forEach((h, i) => {
        h.position.x = damp(h.position.x, want[i]!.x, 6, dt);
        h.scale.setScalar(damp(h.scale.x, i === 1 && !two ? 0.001 : want[i]!.s, 7, dt));
        h.visible = h.scale.x > 0.02;
        h.position.y = HILL_Y + Math.sin(t * 0.8 + i) * 0.03;
      });
      // the inverter underneath: the boost switch chops with the present duty, PV power sets the flow
      const k = Math.min(1, total() / 3000);
      bench.idle(t, 0.3 + 0.7 * k);
      const ph = (t % 0.9) / 0.9;
      inv.boost.intensity = ph < first().duty ? 1.8 : 0.15;
      inv.wires.bat.material.power = 0.05;
      bench.feeds.bat.material.power = 0.05;
      bench.feeds.pvB.material.power = two || m === 'shared' ? 0.3 + 0.7 * k : 0.05;
      inv.wires.pvB.material.power = bench.feeds.pvB.material.power;
      inv.setLinkVoltage(400);
    },
  };
};
