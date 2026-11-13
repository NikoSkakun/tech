/**
 * Step 11 `safety` — the safety oven. NMC and LFP run side by side through four scenarios (oven, nail,
 * overcharge, propagation); a stage ladder lights up, gas vents, then flame and sparks — sooner and harder for
 * NMC. Model: `ThermalCell` & co. (§M7, illustrative) through `sim-bindings/thermal-session.ts`.
 *
 * Honesty: every scenario runs at its own time lapse (`thermalSpeed`), and the chips under the title state
 * exactly that factor; the document's long chip «… час ×30 …» stands on the board only while ×30 is true.
 */
import { Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtNumber, fmtUnit } from '@/content';
import { MOTION } from '@/style';
import type { Chart } from '@/ui3d';
import type { StepFactory } from '../lab';
import { L } from '../labels';
import { note } from '../notes';
import { createOvenRig } from '../parts/oven';
import {
  CHEMS2,
  PLOTTED_ROW_CELL,
  THERMAL_SPEED,
  createThermalSession,
  thermalSpeed,
  type ThermalScenario,
} from '../sim-bindings/thermal-session';
import { frame } from '../shots';
import { group } from '../world';

const ID = 'safety';
const SCENARIOS: readonly { id: ThermalScenario; label: string; cta: string }[] = [
  { id: 'oven', label: L.scenarioOven, cta: L.hint11 },
  { id: 'nail', label: L.nail, cta: L.ctaNail },
  { id: 'overcharge', label: L.overchargeScenario, cta: L.ctaOvercharge },
  { id: 'propagation', label: L.propagation, cta: L.ctaPropagation },
];
/** First X range of the chart per scenario (model minutes; seconds for the nail); it grows with the run. */
const X_MAX: Record<ThermalScenario, number> = { oven: 10, nail: 30, overcharge: 60, propagation: 10 };
const SERIES = ['ambient', 'NMC', 'LFP'] as const;

export const safety: StepFactory = (lab) => {
  const { ctx, ui, mats } = lab;
  const rig = createOvenRig(ctx, mats);
  const set = group(`set:${ID}`, 0.9, 0, 0, [rig.group]);
  lab.stageRoot.add(set);
  const session = createThermalSession();

  const scenario = (): ThermalScenario => ui.value<ThermalScenario>('scenario11');
  const is = (s: ThermalScenario) => (): boolean => scenario() === s;
  /** Time lapse of the scenario on screen now (model s per screen s). */
  const speed = (): number => thermalSpeed({ scenario: scenario(), bms: ui.value<boolean>('bms11') });
  const options = () => ({
    scenario: scenario(),
    ovenC: ui.value<number>('oven11'),
    socPct: ui.value<number>('soc11'),
    bms: ui.value<boolean>('bms11'),
    barrier: ui.value<boolean>('barrier11'),
  });
  let revision = 0;
  const painted = { revision: -1, samples: -1, xMax: 10 };
  /** Back to the cold rig of the chosen scenario, waiting for «Старт». */
  function reset(): void {
    session.start(options());
    session.running = false;
    revision++;
  }
  function start(): void {
    session.start(options());
    revision++;
    audio.play('relay');
    // the default oven is at room temperature (the document's default): say why nothing happens
    if (scenario() === 'oven' && session.options.ovenC <= 30) ui.toast(L.ovenCold, { icon: 'info' });
  }
  ui.onChange('scenario11', reset);
  // the big button on the rig is the same «Старт»
  const beacon = { hover: 0 };
  ctx.input.register(rig.startButton, {
    cursor: 'pointer',
    hover: (over) => ctx.tweens.to(beacon, { hover: over ? 1 : 0 }, { duration: MOTION.hover.duration }),
    click: () => ui.press('start11'),
  });
  ctx.qa.probe('start-button', rig.startButton);

  /** Chart side: a fresh axis per run, then the traces as the session samples them. */
  function paint(chart: Chart): void {
    const s = session.options.scenario;
    if (painted.revision !== revision) {
      painted.revision = revision;
      painted.samples = -1;
      painted.xMax = X_MAX[s];
      chart.setAxis('x', { max: painted.xMax, label: s === 'nail' ? L.axisTimeS : L.axisTime });
      for (const id of SERIES) chart.clearData(id);
    }
    const tr = session.trace;
    if (tr.t.length === painted.samples) return;
    painted.samples = tr.t.length;
    const unit = s === 'nail' ? 1 : 60;
    const xs = tr.t.map((x) => x / unit);
    if ((xs[xs.length - 1] ?? 0) > painted.xMax) chart.setAxis('x', { max: (painted.xMax *= 1.5) });
    chart.setData('ambient', xs, tr.ambient);
    for (const chem of CHEMS2) chart.setData(chem, xs, tr[chem]);
  }
  const plotted = (chem: 'NMC' | 'LFP'): number =>
    session.options.scenario === 'propagation'
      ? session.row[chem][PLOTTED_ROW_CELL]!.tempC
      : session.cell[chem].tempC;
  const v = new Vector3();
  const lamp = (i: number) => (): Vector3 => rig.ladder.NMC.getWorldPosition(v).setY(v.y + 0.3 + i * 0.45);
  const single = (): boolean => scenario() !== 'propagation';

  return {
    id: ID,
    shots: {
      [ID]: frame([0.35, 2.05, 0.2], 7.8, 4.7, { azimuth: 0.2, elevation: 0.22 }),
    },
    stage: {
      show: [rig.group],
      post: { bloomIntensity: 1.1 },
      enter: reset,
      leave: () => (audio.loop('fire').set({ gain: 0 }), audio.loop('steam').set({ gain: 0 })),
    },
    ui: {
      hint: L.hint11,
      honesty: [
        'illustrative',
        { sped: THERMAL_SPEED.oven, visible: () => speed() === THERMAL_SPEED.oven },
        { sped: THERMAL_SPEED.overcharge, visible: () => speed() === THERMAL_SPEED.overcharge },
        { text: L.realTime, visible: () => speed() === THERMAL_SPEED.nail },
        // «сценарій»: scripted animations by typical test results, not a physical calculation
        { text: L.scenario, visible: () => scenario() === 'nail' || scenario() === 'overcharge' },
      ],
      controls: [
        { type: 'segmented', id: 'scenario11', items: SCENARIOS, value: 'oven' },
        // each scenario shows the one parameter it has
        {
          type: 'slider',
          id: 'oven11',
          label: L.ovenTemp,
          min: 25,
          max: 300,
          step: 5,
          unit: '°C',
          value: 25,
          visible: is('oven'),
        },
        {
          type: 'slider',
          id: 'soc11',
          label: `${L.nail}: ${L.socShort}`,
          min: 0,
          max: 100,
          step: 5,
          unit: '%',
          value: 80,
          visible: is('nail'),
        },
        { type: 'toggle', id: 'bms11', label: L.bmsOn, value: true, visible: is('overcharge') },
        { type: 'toggle', id: 'barrier11', label: L.barrier, value: false, visible: is('propagation') },
        // call to action while the rig waits (the lime button on the rig pulses with it)
        note(
          'cta11',
          () => SCENARIOS.find((s) => s.id === scenario())!.cta,
          'info',
          () => !session.running,
          'play',
        ),
        { type: 'button', id: 'start11', label: L.start, icon: 'play', primary: true, onClick: start },
      ],
      board: {
        title: L.boardThermal,
        size: 'md',
        children: [
          {
            type: 'chart',
            id: 'chart11',
            chart: {
              height: 190,
              x: { min: 0, max: 10, label: L.axisTime },
              y: { min: 0, max: 800, label: L.axisTemp },
              series: [
                { id: 'ambient', label: L.seriesOven, color: 'amber', dash: true },
                { id: 'NMC', label: 'NMC', color: 'violet' },
                { id: 'LFP', label: 'LFP', color: 'teal' },
              ],
            },
            init: () => (painted.revision = -1),
            update: paint,
          },
          {
            type: 'stats',
            id: 'stats11',
            items: [
              {
                label: L.time,
                get: () =>
                  session.options.scenario === 'nail'
                    ? fmtUnit(session.timeS, 's', { digits: 0 })
                    : fmtUnit(session.timeS / 60, 'min', { digits: 1 }),
              },
              {
                label: 'NMC',
                get: () => `${fmtNumber(plotted('NMC'), { digits: 0 })} °C`,
                color: () => 'violet',
              },
              {
                label: 'LFP',
                get: () => `${fmtNumber(plotted('LFP'), { digits: 0 })} °C`,
                color: () => 'teal',
              },
            ],
          },
          // the document's chip in full, while its «час ×30» is true (oven, propagation, overcharge under BMS)
          note('model11', L.ovenChip, 'honesty', () => speed() === THERMAL_SPEED.oven),
          note('bms11cut', L.bmsCut, 'ok', () => session.bmsCut),
          note('nailLfp11', L.nailLfpNote, 'info', is('nail')),
          note('plotted11', L.plottedCell, 'info', is('propagation')),
        ],
      },
      callouts: [
        { anchor: lamp(0), text: L.stageSei, color: 'amber', side: 'left', visible: single },
        { anchor: lamp(1), text: L.stageSeparator, side: 'left', visible: single },
        { anchor: lamp(2), text: L.stageVent, color: 'sky', side: 'left', visible: single },
        { anchor: lamp(3), text: L.stageRunaway, color: 'red', side: 'left', visible: single },
      ],
      hotspots: [
        {
          anchor: () =>
            single()
              ? rig.vent.NMC.getWorldPosition(v).setX(v.x + 0.35)
              : rig.tray.getWorldPosition(v).set(v.x - 1.4, v.y + 1.3, v.z - 0.5),
          content: 'vent',
        },
        {
          anchor: () => rig.group.getWorldPosition(v).set(v.x + 2.2, v.y + 3.1, v.z - 0.2),
          content: 'fire-fighting',
        },
        {
          anchor: () => rig.group.getWorldPosition(v).set(v.x + 2.45, v.y + 0.25, v.z - 0.9),
          content: 'storage',
        },
      ],
    },
    probe: () => ({
      scenario: scenario(),
      running: session.running,
      time: session.timeS,
      speed: speed(),
      nmc: session.cell.NMC.tempC,
      lfp: session.cell.LFP.tempC,
      nmcRunaway: session.cell.NMC.runaway,
      lfpRunaway: session.cell.LFP.runaway,
      nmcVent: session.cell.NMC.vent,
      lfpVent: session.cell.LFP.vent,
      rowNmc: session.row.NMC.map((c) => c.runaway).join(),
      bmsCut: session.bmsCut,
      barrier: ui.value<boolean>('barrier11'),
    }),
    update(dt, t) {
      const live = lab.isCurrent(ID);
      session.options.barrier = ui.value<boolean>('barrier11'); // pads go in and out during a run too
      const lit = live ? session.tick(dt) : [];
      for (const chem of lit) {
        rig.ignite(chem);
        audio.play('zap', { gain: chem === 'NMC' ? 0.9 : 0.5 });
      }
      const o = session.options;
      if (session.bmsCut && session.running) {
        session.running = false;
        audio.play('success');
      }
      rig.apply(
        {
          propagation: !single(),
          // the coils follow the slider at once, before «Старт» too: immediate feedback
          heater:
            scenario() === 'oven' ? Math.min(Math.max((ui.value<number>('oven11') - 25) / 275, 0), 1) : 0,
          cell: session.cell,
          row: session.row,
          barrier: ui.value<boolean>('barrier11'),
          nail: o.scenario === 'nail' && session.running ? Math.min(session.timeS / 1.2, 1) : 0,
          idle: !session.running,
          hover: beacon.hover,
        },
        dt,
        t,
      );
      const burning = CHEMS2.filter(
        (c) => session.cell[c].runaway || session.row[c].some((x) => x.runaway),
      ).length;
      const venting = CHEMS2.filter((c) => session.cell[c].vent && !session.cell[c].runaway).length;
      audio.loop('fire').set({ gain: live ? 0.18 * burning : 0 });
      audio.loop('steam').set({ gain: live ? 0.1 * venting : 0 });
    },
  };
};
