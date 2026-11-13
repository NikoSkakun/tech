/**
 * Step 10 `degradation` — the time machine: two identical cells under domes, the left one lives carefully
 * (25 °C, 20–80 %), the right one lives by the sliders. Years sweep by; SOH rings fall, the SEI film
 * thickens, cathode particles crack, and both SOH(t) curves are on the holo board.
 * Model: `stateOfHealth` (§M6, illustrative) through `sim/ageing.ts`.
 */
import { Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtNumber } from '@/content';
import type { Chemistry } from '@electricity/sim/lab-battery';
import { Button, Chart, Tabs, row } from '@/ui3d';
import { notices, statGrid } from '../hud-bits';
import type { StepFactory } from '../lab';
import { L } from '../labels';
import { createAgingStation } from '../parts';
import {
  AGEING_CHART_MIN,
  AGEING_YEARS,
  ageingAt,
  ageingCurve,
  yearsTo80,
  type AgeingScenario,
} from '../sim';
import { group, tag } from '../world';

const ID = 'degradation';
/** The left cell: 25 °C, cycled between 20 and 80 % (DoD 60 %, mean SOC 50 %), 300 cycles a year. */
const CAREFUL = { tempC: 25, cyclesPerYear: 300, dodPct: 60, socAvgPct: 50 } as const;
const SWEEP_S = 11; // screen seconds for 20 years
const HOLD_S = 2.5;

export const degradation: StepFactory = (lab) => {
  const { ctx, ui, mats } = lab;
  const left = createAgingStation(ctx, mats, 'teal', L.refScenario);
  left.group.position.set(-1.45, 0, 0.5);
  const right = createAgingStation(ctx, mats, 'violet', L.yourScenario);
  right.group.position.set(1.45, 0, 0.5);
  const calendar = tag('', 30, 'white');
  calendar.position.set(0, 3.9, 0.5);
  const set = group(`set:${ID}`, 1.0, 0, 0, [left.group, right.group, calendar]);
  lab.stageRoot.add(set);

  /* --------------------------------------------------------------------------------------- board */
  const chart = new Chart({
    height: 180,
    x: { min: 0, max: AGEING_YEARS, label: L.axisYears },
    y: { min: AGEING_CHART_MIN, max: 100, label: L.axisSoh },
    series: [
      { id: 'eol', label: L.eol, color: 'amber', width: 1.3 },
      { id: 'ref', label: L.refScenario, color: 'teal' },
      { id: 'yoursOut', color: 'violet.dark', width: 1.3 },
      { id: 'yours', label: L.yourScenario, color: 'violet' },
    ],
    onScrub: (x) => {
      year = Math.min(Math.max(x, 0), AGEING_YEARS);
      hold = 6; // the sweep resumes a few seconds after the user lets go
    },
  });
  chart.setData('eol', [0, AGEING_YEARS], [80, 80]);
  const stats = statGrid(
    [
      { name: L.refScenario, color: 'teal' },
      { name: L.yourScenario, color: 'violet' },
    ],
    [L.statSohNow, L.statT80],
    150,
  );
  const chemTabs = new Tabs<Chemistry>({
    items: [
      { id: 'LFP', label: 'LFP' },
      { id: 'NMC', label: 'NMC' },
    ],
    value: 'LFP',
    onChange: (id) => chemPick.set(id),
  });
  const chemPick = ui.external('chem10', 'LFP', (id) => (chemTabs.value = id as Chemistry));
  // the two «звички» of the document: T = 35, mean SOC 95 · T = 20, mean SOC 50, DoD 60
  const habit = (to: Partial<Record<'temp10' | 'soc10' | 'dod10', number>>) => (): void => {
    for (const [k, v] of Object.entries(to)) ui.set(k, v);
    audio.play('click');
  };
  const habits = [
    new Button({
      label: L.habitHot,
      icon: 'warning',
      onClick: ui.action('habitHot10', habit({ temp10: 35, soc10: 95 })),
    }),
    new Button({
      label: L.habitCare,
      icon: 'check',
      onClick: ui.action('habitCare10', habit({ temp10: 20, soc10: 50, dod10: 60 })),
    }),
  ];
  const notes = notices(
    'notes10',
    { toy: { text: L.toyModel, tone: 'honesty' }, out: { text: L.outOfModel, tone: 'warning' } },
    ['toy'],
  );
  lab.holo.add(ID, {
    title: L.boardSoh,
    width: 540,
    children: [
      chemTabs,
      chart,
      stats.node,
      row({ gap: 10, wrap: true, width: 'fill', children: habits }),
      notes.spec.node,
    ],
  });

  /* --------------------------------------------------------------------------------------- state */
  let year = 0;
  let hold = 0;
  let drawn = '';
  let yearText = '';
  const chem = (): Chemistry => ui.value<Chemistry>('chem10');
  const yours = (): AgeingScenario => ({
    chem: chem(),
    tempC: ui.value<number>('temp10'),
    cyclesPerYear: ui.value<number>('cycles10'),
    dodPct: ui.value<number>('dod10'),
    socAvgPct: ui.value<number>('soc10'),
  });
  const reference = (): AgeingScenario => ({ chem: chem(), ...CAREFUL });
  const heat = (tC: number): number => Math.min(Math.max((tC - 15) / 30, 0), 1);
  const t80 = (s: AgeingScenario): string => {
    const y = yearsTo80(s);
    return y === null ? '> 60' : fmtNumber(y, { digits: 1 });
  };
  const v = new Vector3();

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [2.0, 4.6, 13.2],
        target: [-1.6, 2.5, 0],
        fov: 28,
        orbit: { azimuth: 0.8, polar: 0.3 },
      },
    },
    stage: { show: [left.group, right.group, calendar], enter: () => ((year = 0), (hold = 0)) },
    ui: {
      hint: L.hint10,
      honesty: ['illustrative'],
      controls: [
        {
          type: 'slider',
          id: 'temp10',
          label: L.storageTemp,
          min: 0,
          max: 45,
          step: 1,
          unit: '°C',
          value: 25,
          hint: L.tempHint,
        },
        { type: 'slider', id: 'cycles10', label: L.cyclesPerYear, min: 0, max: 730, step: 10, value: 300 },
        { type: 'slider', id: 'dod10', label: L.dod, min: 10, max: 100, step: 5, unit: '%', value: 80 },
        { type: 'slider', id: 'soc10', label: L.avgSoc, min: 20, max: 100, step: 5, unit: '%', value: 60 },
      ],
      callouts: [
        {
          anchor: () => left.lens.getWorldPosition(v).set(v.x - 0.3, v.y - 0.45, v.z),
          text: L.seiLens,
          side: 'down',
        },
      ],
      hotspots: [
        {
          anchor: () => left.lens.getWorldPosition(v).set(v.x - 0.3, v.y + 0.1, v.z + 0.1),
          title: 'SEI growth — ріст SEI',
        },
        {
          anchor: () => right.lens.getWorldPosition(v).set(v.x + 0.24, v.y + 0.1, v.z + 0.1),
          title: 'Cracked particle — тріснута частинка',
        },
      ],
    },
    probe: () => ({
      year,
      yours: ageingAt(yours(), 10).soh,
      reference: ageingAt(reference(), 10).soh,
      out: notes.isShown('out'),
    }),
    update(dt, t) {
      // years sweep by on their own; scrubbing the chart takes over for a moment
      if (lab.isCurrent(ID)) {
        if (hold > 0) hold -= dt;
        else
          year =
            year > AGEING_YEARS + (HOLD_S * AGEING_YEARS) / SWEEP_S
              ? 0
              : year + (dt * AGEING_YEARS) / SWEEP_S;
      }
      const y = Math.min(year, AGEING_YEARS);
      const mine = yours();
      const ref = reference();
      const key = JSON.stringify(mine);
      if (key !== drawn) {
        drawn = key;
        const a = ageingCurve(ref);
        const b = ageingCurve(mine);
        chart.setData('ref', a.solid.xs, a.solid.ys);
        chart.setData('yours', b.solid.xs, b.solid.ys);
        chart.setData('yoursOut', b.beyond.xs, b.beyond.ys);
        notes.show('out', b.outOfModel);
        stats.set(0, 1, t80(ref));
        stats.set(1, 1, t80(mine));
      }
      const a = ageingAt(ref, y);
      const b = ageingAt(mine, y);
      chart.setMarker('ref', { x: y, y: a.soh * 100, color: 'teal', guides: false });
      chart.setMarker(
        'yours',
        b.soh * 100 >= AGEING_CHART_MIN ? { x: y, y: b.soh * 100, color: 'violet', guides: false } : null,
      );
      stats.set(0, 0, fmtNumber(a.soh * 100, { digits: 1 }));
      stats.set(1, 0, fmtNumber(b.soh * 100, { digits: 1 }));
      // lens scale: a loss of 20 % of the capacity fills the picture (thick SEI / wide cracks)
      left.apply({ soh: a.soh, sei: a.calendar / 0.2, cracks: a.cycle / 0.2, heat: heat(ref.tempC) }, t);
      right.apply({ soh: b.soh, sei: b.calendar / 0.2, cracks: b.cycle / 0.2, heat: heat(mine.tempC) }, t);
      const text = `${L.year} ${Math.floor(y)}`;
      if (text !== yearText) calendar.text = yearText = text;
    },
  };
};
