/**
 * Step 7 `charging` — the same bench, now a charger: CC then CV on the board, CC / CV lamps on the instrument,
 * the lens over the anode shows ions arriving — and lithium needles when the model flags plating.
 * Model: `chargeCcCv` (§M3) with `platingRisk`.
 */
import { Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtNumber } from '@/content';
import { CELLS, CELL_LIMITS, platingRisk, type ChargeResult } from '@electricity/sim/lab-battery';
import type { Chart } from '@/ui3d';
import type { StepFactory } from '../lab';
import { L, spedUp } from '../labels';
import { note } from '../notes';
import { createBench } from '../parts/bench';
import { createMagnifier } from '../parts/magnifier';
import { chargeReplay, type BenchCell, type Replay } from '../sim-bindings/runs';
import { frame } from '../shots';
import { group } from '../world';

const ID = 'charging';
const RUN_S = 9;
/** Range of the voltage-limit slider per cell (the document's ranges; default = the chemistry's limit). */
const LIMIT: Record<BenchCell, { min: number; max: number }> = {
  '21700-NMC': { min: 4.0, max: 4.3 },
  'LFP-100': { min: 3.45, max: 3.7 },
};
const PLATING = { none: 0, amber: 0.55, red: 1 } as const;

export const charging: StepFactory = (lab) => {
  const { ctx, ui, mats } = lab;
  const bench = lab.share('bench', () => {
    const b = createBench(ctx, mats);
    lab.stageRoot.add(group('set:bench', 0.55, 0, 0.3, [b.group]));
    return b;
  });
  const lens = createMagnifier(ctx, mats);
  lens.group.position.set(-3.1, 1.5, 1.3);
  lens.group.scale.setScalar(0.85);
  lens.group.rotation.y = 0.2;
  bench.group.add(lens.group);

  const cell = (): BenchCell => ui.value<BenchCell>('cell7');
  const limit = (): number => ui.value<number>('umax7');
  let run: { replay: Replay; result: ChargeResult; cRate: number; uMax: number; drawn: number } | null = null;
  let elapsed = RUN_S;
  let revision = 0;
  let painted = -1;
  let over = false;
  let risk: 'none' | 'amber' | 'red' = 'none';
  function start(): void {
    const cRate = ui.value<number>('cc7');
    run = {
      ...chargeReplay(cell(), cRate, limit(), ui.value<number>('temp7')),
      cRate,
      uMax: limit(),
      drawn: -1,
    };
    elapsed = 0;
    revision++;
  }
  /** The slider «Межа напруги» takes the range of the chosen chemistry (and its default limit). */
  const fitLimit = (reset: boolean): void => {
    const c = cell();
    const value = reset ? CELL_LIMITS[CELLS[c].chem].uMaxV : limit();
    ui.patch('umax7', { ...LIMIT[c], value: Math.min(Math.max(value, LIMIT[c].min), LIMIT[c].max) });
  };
  ui.onChange('cell7', () => {
    fitLimit(true);
    start();
  });
  function paint(chart: Chart): void {
    if (!run) return;
    if (painted !== revision) {
      painted = revision;
      run.drawn = -1;
      chart.setAxis('x', { max: Math.max(Math.ceil(run.result.totalMinutes / 20) * 20, 20) });
    }
    const i = run.replay.index();
    if (i !== run.drawn) {
      run.drawn = i;
      const q = CELLS[run.replay.cell].capacityAh;
      const pts = run.replay.points.slice(0, i + 1);
      const ts = pts.map((s) => s.timeS / 60);
      chart.setData('u', ts, pts.map((s) => s.voltageV)); // prettier-ignore
      chart.setData('i', ts, pts.map((s) => (s.currentA / (run!.cRate * q)) * 100)); // prettier-ignore
      chart.setData('soc', ts, pts.map((s) => Math.min(s.socPct, 100))); // prettier-ignore
    }
    const p = run.replay.at();
    chart.setMarker('u', { x: p.timeS / 60, y: p.voltageV, color: 'pink', guides: false });
  }
  const v = new Vector3();
  const num = (x: number | null, digits = 0): string => (x === null ? '—' : fmtNumber(x, { digits }));
  /** A time of the result appears on the board once the play head has passed it. */
  const reached = (m: number | null): number | null =>
    run && m !== null && run.replay.at().timeS / 60 >= m - 1e-6 ? m : null;

  return {
    id: ID,
    shots: {
      [ID]: frame([0.45, 1.8, 0.3], 7.6, 4.1, { azimuth: 0.18, elevation: 0.22 }),
    },
    stage: {
      show: [bench.group, lens.group],
      enter: () => {
        fitLimit(false);
        start();
      },
      leave: () => audio.loop('hum').set({ gain: 0 }),
    },
    ui: {
      hint: L.hint7,
      honesty: ['simplified'],
      controls: [
        {
          type: 'slider',
          id: 'cc7',
          label: L.ccCurrent,
          min: 0.1,
          max: 2,
          step: 0.1,
          unit: 'C',
          digits: 1,
          value: 0.5,
        },
        {
          type: 'slider',
          id: 'umax7',
          label: L.voltageLimit,
          ...LIMIT['21700-NMC'],
          step: 0.01,
          unit: 'V',
          digits: 2,
          value: CELL_LIMITS.NMC.uMaxV,
        },
        {
          type: 'slider',
          id: 'temp7',
          label: L.temperature,
          min: -20,
          max: 45,
          step: 1,
          unit: '°C',
          value: 25,
        },
        // live warnings follow the sliders (§M3): limit above the chemistry's U_max; cold, or cold and fast
        note('over7', L.overcharge, 'alarm', () => over),
        note('plating7', L.platingRisk, () => (risk === 'red' ? 'alarm' : 'warning'), () => risk !== 'none', 'warning'), // prettier-ignore
        {
          type: 'button',
          id: 'run7',
          label: L.runCharge,
          icon: 'play',
          primary: true,
          onClick: () => (audio.play('relay'), start()),
        },
      ],
      board: {
        title: L.boardCharge,
        size: 'md',
        children: [
          {
            type: 'segmented',
            id: 'cell7',
            items: [
              { id: '21700-NMC', label: L.cellNmc },
              { id: 'LFP-100', label: L.cellLfp },
            ],
            value: '21700-NMC',
          },
          {
            type: 'chart',
            id: 'chart7',
            chart: {
              height: 236,
              x: { min: 0, max: 140, label: L.axisTime },
              y: { min: 2.4, max: 4.4, label: L.axisVoltage },
              y2: { min: 0, max: 100, label: L.axisPercent },
              series: [
                { id: 'soc', label: L.seriesSoc, color: 'lime', axis: 'y2', kind: 'area' },
                { id: 'i', label: L.seriesI, color: 'yellow', axis: 'y2' },
                { id: 'u', label: L.seriesU, color: 'pink' },
              ],
            },
            init: () => (painted = -1),
            update: paint,
          },
          {
            type: 'stats',
            id: 'stats7',
            columns: 4,
            items: [
              { label: L.statCc, get: () => num(reached(!run || run.result.socAtCvPct === null ? null : run.result.ccMinutes), 1) }, // prettier-ignore
              { label: L.stat80, get: () => num(reached(run?.result.minutesTo80 ?? null), 0) },
              {
                label: L.statTotal,
                get: () => num(run && elapsed >= RUN_S ? run.result.totalMinutes : null, 1),
              },
              { label: L.statSocEnd, get: () => num(run ? Math.min(run.replay.at().socPct, 100) : null, 1) },
            ],
          },
          note('speed7', () => spedUp(((run?.result.totalMinutes ?? 0) * 60) / RUN_S), 'honesty'),
        ],
      },
      callouts: [
        { anchor: () => bench.device.getWorldPosition(v).setY(v.y + 1.45), text: L.charger, side: 'up' },
        {
          anchor: () => lens.group.getWorldPosition(v).setY(v.y + 0.62),
          text: L.lens,
          color: 'lime',
          side: 'up',
        },
      ],
      hotspots: [
        {
          anchor: () => bench.device.getWorldPosition(v).set(v.x + 0.3, v.y + 0.72, v.z + 0.55),
          content: 'cv-phase',
        },
        { anchor: () => bench.thermometer.getWorldPosition(v).setY(v.y + 1.3), content: 'heated-battery' },
      ],
    },
    probe: () => ({
      elapsed,
      cell: run?.replay.cell,
      cRate: run?.cRate,
      uMax: run?.uMax,
      soc: run?.replay.at().socPct ?? 0,
      total: run?.result.totalMinutes ?? 0,
      over,
      plating: risk,
    }),
    update(dt, t) {
      if (!lab.isCurrent(ID) || !run) return; // shared bench: only the current step drives it
      const running = elapsed < RUN_S;
      elapsed = Math.min(elapsed + dt, RUN_S);
      const c = run.replay.cell;
      const q = CELLS[c].capacityAh;
      run.replay.head = elapsed / RUN_S;
      const p = run.replay.at();
      const chem = CELLS[cell()].chem;
      over = limit() > CELL_LIMITS[chem].uMaxV + 1e-9;
      risk = platingRisk(ui.value<number>('temp7'), ui.value<number>('cc7'));
      const phase = run.replay.points[run.replay.index()]!.phase;
      for (const id of Object.keys(bench.state) as BenchCell[]) bench.state[id].active = id === c;
      const st = bench.state[c];
      st.soc = Math.min(p.socPct, 100) / 100;
      st.cRate = running ? p.currentA / q : 0;
      const spec = CELLS[c];
      st.heat = Math.max(
        running ? p.heatW / (spec.iMaxA ** 2 * (spec.r0Ohm + spec.r1Ohm)) : 0,
        run.uMax > CELL_LIMITS[chem].uMaxV + 1e-9 ? 0.75 + 0.35 * Math.sin(t * 6) : 0,
      );
      bench.meters.current = running ? p.currentA / q / 2 : 0;
      bench.meters.voltage = (p.voltageV - 2.4) / 2;
      bench.meters.cc = running && phase === 'CC';
      bench.meters.cv = running && phase === 'CV';
      bench.temperature = ui.value<number>('temp7');
      // the lens sits in front of the cell under charge; needles grow with the run when the model flags plating
      lens.group.position.x +=
        ((c === '21700-NMC' ? -3.1 : -1.62) - lens.group.position.x) * Math.min(1, dt * 6);
      lens.flow = running ? p.currentA / q : 0;
      lens.plating = PLATING[run.result.plating] * Math.min(run.replay.head * 1.3, 1);
      lens.update(dt);
      bench.update(dt, t);
      audio.loop('hum').set({ gain: running ? 0.05 : 0, pitch: phase === 'CV' ? 1.1 : 1 });
    },
  };
};
