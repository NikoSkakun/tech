/**
 * Step 11 `safety` — the safety oven. NMC and LFP run side by side through four scenarios (oven, nail,
 * overcharge, propagation); a stage ladder lights up, gas vents, then flame and sparks — sooner and harder for
 * NMC. Model: `ThermalCell` & co. (§M7, illustrative) through `sim/thermal-session.ts`.
 */
import { Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtNumber } from '@/content';
import { Button, Chart, Tabs, row } from '@/ui3d';
import { notices, statGrid } from '../hud-bits';
import type { StepFactory } from '../lab';
import { L } from '../labels';
import { createOvenRig } from '../parts';
import { CHEMS2, THERMAL_SPEED, createThermalSession, type ThermalScenario } from '../sim';
import { group, nowhere } from '../world';

const ID = 'safety';
const SCENARIOS: readonly { id: ThermalScenario; label: string }[] = [
  { id: 'oven', label: L.scenarioOven },
  { id: 'nail', label: L.nail },
  { id: 'overcharge', label: L.overchargeScenario },
  { id: 'propagation', label: L.propagation },
];

export const safety: StepFactory = (lab) => {
  const { ctx, ui, mats } = lab;
  const rig = createOvenRig(ctx, mats);
  const set = group(`set:${ID}`, 0.9, 0, 0, [rig.group]);
  lab.stageRoot.add(set);
  const session = createThermalSession();

  /* --------------------------------------------------------------------------------------- board */
  const chart = new Chart({
    height: 180,
    x: { min: 0, max: 10, label: L.axisTime },
    y: { min: 0, max: 800, label: L.axisTemp },
    series: [
      { id: 'ambient', label: L.seriesOven, color: 'amber', width: 1.4 },
      { id: 'NMC', label: 'NMC', color: 'violet' },
      { id: 'LFP', label: 'LFP', color: 'teal' },
    ],
  });
  const stats = statGrid([{ name: '', color: 'white' }], [L.statModelMin, 'NMC, °C', 'LFP, °C']);
  const tabs = new Tabs<ThermalScenario>({ items: SCENARIOS, value: 'oven', onChange: (id) => pick.set(id) });
  const pick = ui.external('scenario11', 'oven', (id) => (tabs.value = id as ThermalScenario));
  const notes = notices(
    'notes11',
    {
      model: { text: L.ovenChip, tone: 'honesty' },
      scripted: { text: L.scenario, tone: 'info' },
      nailLfp: { text: L.nailLfpNote, tone: 'info' },
      bms: { text: L.bmsCut, tone: 'ok' },
    },
    ['model'],
  );
  const scenario = (): ThermalScenario => ui.value<ThermalScenario>('scenario11');
  let drawn = 0;
  function start(): void {
    const s = scenario();
    session.start({
      scenario: s,
      ovenC: ui.value<number>('oven11'),
      socPct: ui.value<number>('soc11'),
      bms: ui.value<boolean>('bms11'),
      barrier: ui.value<boolean>('barrier11'),
    });
    chart.setAxis('x', {
      max: s === 'nail' ? 30 : s === 'overcharge' ? 60 : 10,
      label: s === 'nail' ? L.axisTimeS : L.axisTime,
    });
    for (const id of ['ambient', 'NMC', 'LFP']) chart.clearData(id);
    drawn = 0;
    notes.show('bms', false);
    audio.play('relay');
  }
  const go = new Button({
    label: L.start,
    icon: 'play',
    variant: 'primary',
    onClick: ui.action('start11', start),
  });
  lab.holo.add(ID, {
    title: L.boardThermal,
    width: 540,
    children: [
      tabs,
      chart,
      row({ gap: 10, width: 'fill', align: 'center', children: [stats.node, go] }),
      notes.spec.node,
    ],
  });
  ui.onChange('scenario11', (s) => {
    // the scripted scenarios say so; the nail scenario adds the document's caveat about big LFP cells
    notes.show('scripted', s === 'nail' || s === 'overcharge');
    notes.show('nailLfp', s === 'nail');
    session.start({ ...session.options, scenario: s as ThermalScenario });
    session.running = false;
    for (const id of ['ambient', 'NMC', 'LFP']) chart.clearData(id);
  });

  const v = new Vector3();
  const lamp = (i: number) => (): Vector3 =>
    scenario() === 'propagation'
      ? nowhere(ctx, v)
      : rig.ladder.NMC.getWorldPosition(v).setY(v.y + 0.3 + i * 0.45);
  return {
    id: ID,
    shots: {
      [ID]: {
        position: [2.6, 5.2, 13.2],
        target: [-1.0, 3.05, 0],
        fov: 28,
        orbit: { azimuth: 0.8, polar: 0.3 },
      },
    },
    stage: {
      show: [rig.group],
      post: { bloomIntensity: 1.1 },
      leave: () => (audio.loop('fire').set({ gain: 0 }), audio.loop('steam').set({ gain: 0 })),
    },
    ui: {
      hint: L.hint11,
      honesty: ['illustrative', { sped: THERMAL_SPEED.oven }],
      controls: [
        {
          type: 'slider',
          id: 'oven11',
          label: L.ovenTemp,
          min: 25,
          max: 300,
          step: 5,
          unit: '°C',
          value: 25,
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
        },
        { type: 'toggle', id: 'bms11', label: L.bmsOn, value: true },
        { type: 'toggle', id: 'barrier11', label: L.barrier, value: false },
      ],
      callouts: [
        { anchor: lamp(0), text: L.stageSei, color: 'amber', side: 'left' },
        { anchor: lamp(1), text: L.stageSeparator, side: 'left' },
        { anchor: lamp(2), text: L.stageVent, color: 'sky', side: 'left' },
        { anchor: lamp(3), text: L.stageRunaway, color: 'red', side: 'left' },
      ],
      hotspots: [
        {
          anchor: () =>
            scenario() === 'propagation'
              ? rig.tray.getWorldPosition(v).set(v.x - 1.4, v.y + 1.3, v.z - 0.5)
              : rig.vent.NMC.getWorldPosition(v).setX(v.x + 0.35),
          title: 'Vent — клапан',
        },
        {
          anchor: () => rig.group.getWorldPosition(v).set(v.x + 2.2, v.y + 3.1, v.z - 0.2),
          title: 'Fire fighting — гасіння',
        },
        {
          anchor: () => rig.group.getWorldPosition(v).set(v.x + 2.45, v.y + 0.25, v.z + 0.9),
          title: 'Storage — зберігання',
        },
      ],
    },
    probe: () => ({
      scenario: scenario(),
      running: session.running,
      time: session.timeS,
      nmc: session.cell.NMC.tempC,
      lfp: session.cell.LFP.tempC,
      nmcRunaway: session.cell.NMC.runaway,
      lfpRunaway: session.cell.LFP.runaway,
      rowNmc: session.row.NMC.map((c) => c.runaway).join(),
      bmsCut: session.bmsCut,
      barrier: ui.value<boolean>('barrier11'),
    }),
    update(dt, t) {
      const live = lab.isCurrent(ID);
      const lit = live ? session.tick(dt) : [];
      for (const chem of lit) {
        rig.ignite(chem);
        audio.play('zap', { gain: chem === 'NMC' ? 0.9 : 0.5 });
      }
      const o = session.options;
      if (session.bmsCut && session.running) {
        session.running = false;
        notes.show('bms', true);
        audio.play('success');
      }
      rig.apply(
        {
          propagation: scenario() === 'propagation',
          heater:
            o.scenario === 'oven' ? Math.min(Math.max((ui.value<number>('oven11') - 25) / 275, 0), 1) : 0,
          cell: session.cell,
          row: session.row,
          barrier: ui.value<boolean>('barrier11'),
          nail: o.scenario === 'nail' && session.running ? Math.min(session.timeS / 1.2, 1) : 0,
        },
        dt,
        t,
      );
      // board: model time and the two temperatures; the curve grows with the samples
      const tr = session.trace;
      const unit = o.scenario === 'nail' ? 1 : 60;
      if (tr.t.length !== drawn) {
        drawn = tr.t.length;
        const xs = tr.t.map((s) => s / unit);
        const last = xs[xs.length - 1] ?? 0;
        if (last > chart.axes.x.spec.max) chart.setAxis('x', { max: chart.axes.x.spec.max * 1.5 });
        chart.setData('ambient', xs, tr.ambient);
        for (const chem of CHEMS2) chart.setData(chem, xs, tr[chem]);
      }
      const plotted = (chem: 'NMC' | 'LFP'): number =>
        o.scenario === 'propagation' ? session.row[chem][1]!.tempC : session.cell[chem].tempC;
      stats.set(0, 0, fmtNumber(session.timeS / 60, { digits: 1 }));
      stats.set(0, 1, fmtNumber(plotted('NMC'), { digits: 0 }));
      stats.set(0, 2, fmtNumber(plotted('LFP'), { digits: 0 }));
      const burning = CHEMS2.filter(
        (c) => session.cell[c].runaway || session.row[c].some((x) => x.runaway),
      ).length;
      const venting = CHEMS2.filter((c) => session.cell[c].vent && !session.cell[c].runaway).length;
      audio.loop('fire').set({ gain: live ? 0.18 * burning : 0 });
      audio.loop('steam').set({ gain: live ? 0.1 * venting : 0 });
    },
  };
};
