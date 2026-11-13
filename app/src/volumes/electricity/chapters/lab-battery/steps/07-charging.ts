/**
 * Step 7 `charging` — the same bench, now with a charger: CC then CV on the holo board (current, voltage,
 * SOC over time), CC / CV lamps on the instrument, and a lens on the anode where lithium needles grow when
 * the regime is violated. Model: `chargeCcCv` (§M3) with its plating / overcharge flags.
 */
import { Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtNumber } from '@/content';
import { CELLS, CELL_LIMITS, platingRisk, type ChargeResult } from '@electricity/sim/lab-battery';
import type { StepUiSpec } from '@/hud';
import { Button, Chart, Tabs, row } from '@/ui3d';
import { notices, statGrid } from '../hud-bits';
import type { StepFactory } from '../lab';
import { L } from '../labels';
import { createBench, createMagnifier } from '../parts';
import { chargeReplay, type BenchCell, type Replay } from '../sim';
import { group } from '../world';

const ID = 'charging';
const RUN_S = 9;
/** Voltage-limit sliders per cell (the document's ranges; default = the chemistry's limit). */
const LIMIT: Record<BenchCell, { id: string; min: number; max: number }> = {
  '21700-NMC': { id: 'umaxNmc7', min: 4.0, max: 4.3 },
  'LFP-100': { id: 'umaxLfp7', min: 3.45, max: 3.7 },
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

  const chart = new Chart({
    height: 236,
    x: { min: 0, max: 140, label: L.axisTime },
    y: { min: 2.4, max: 4.4, label: L.axisVoltage },
    y2: { min: 0, max: 100, label: L.axisPercent },
    series: [
      { id: 'soc', label: L.seriesSoc, color: 'lime', axis: 'y2', kind: 'area' },
      { id: 'i', label: L.seriesI, color: 'yellow', axis: 'y2' },
      { id: 'u', label: L.seriesU, color: 'pink' },
    ],
  });
  const stats = statGrid([{ name: '', color: 'white' }], [L.statCc, L.stat80, L.statTotal, L.statSocEnd]);
  const notes = notices('notes7', {
    over: { text: L.overcharge, tone: 'alarm' },
    amber: { text: L.platingRisk, tone: 'warning' },
    red: { text: L.platingRisk, tone: 'alarm' },
  });
  // the cell selector sits on the board (keeps the dock to three sliders and the «Зарядити» button)
  const cellTabs = new Tabs<BenchCell>({
    items: [
      { id: '21700-NMC', label: L.cellNmc },
      { id: 'LFP-100', label: L.cellLfp },
    ],
    value: '21700-NMC',
    onChange: (id) => cellPick.set(id),
  });
  const cellPick = ui.external('cell7', '21700-NMC', (id) => (cellTabs.value = id as BenchCell));
  const go = new Button({
    label: L.runCharge,
    icon: 'play',
    variant: 'primary',
    onClick: ui.action('run7', () => (audio.play('relay'), start())),
  });
  lab.holo.add(ID, {
    title: L.boardCharge,
    width: 540,
    children: [
      row({ gap: 12, width: 'fill', align: 'center', children: [cellTabs, go] }),
      chart,
      stats.node,
      notes.spec.node,
    ],
  });

  let chosen: BenchCell = '21700-NMC';
  const cell = (): BenchCell => chosen;
  const limit = (): number => ui.value<number>(LIMIT[cell()].id);
  let run: { replay: Replay; result: ChargeResult; cRate: number; uMax: number; drawn: number } | null = null;
  let elapsed = RUN_S;
  function start(): void {
    const cRate = ui.value<number>('cc7');
    run = {
      ...chargeReplay(cell(), cRate, limit(), ui.value<number>('temp7')),
      cRate,
      uMax: limit(),
      drawn: -1,
    };
    chart.setAxis('x', { max: Math.max(Math.ceil(run.result.totalMinutes / 20) * 20, 20) });
    elapsed = 0;
  }
  const spec = (): StepUiSpec => {
    const c = cell();
    const lim = LIMIT[c];
    return {
      hint: L.hint7,
      honesty: ['simplified', { sped: 900 }],
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
          id: lim.id,
          label: L.voltageLimit,
          min: lim.min,
          max: lim.max,
          step: 0.01,
          unit: 'V',
          digits: 2,
          value: CELL_LIMITS[CELLS[c].chem].uMaxV,
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
      ],
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
          title: 'CV phase — фаза CV',
        },
        {
          anchor: () => bench.thermometer.getWorldPosition(v).setY(v.y + 1.3),
          title: 'Heated battery — батарея з підігрівом',
        },
      ],
    };
  };
  const v = new Vector3();
  // the voltage-limit slider depends on the chemistry: re-declare the step UI when the cell changes
  ui.onChange('cell7', (id) => {
    chosen = id as BenchCell;
    ui.define({ [ID]: spec() });
    start();
  });

  const num = (x: number | null, digits = 0): string => (x === null ? '—' : fmtNumber(x, { digits }));
  return {
    id: ID,
    shots: {
      [ID]: {
        position: [2.3, 4.4, 12.6],
        target: [-1.15, 2.7, 0],
        fov: 28,
        orbit: { azimuth: 0.8, polar: 0.3 },
      },
    },
    stage: {
      show: [bench.group, lens.group],
      enter: () => start(),
      leave: () => audio.loop('hum').set({ gain: 0 }),
    },
    ui: spec(),
    probe: () => ({
      elapsed,
      cell: run?.replay.cell,
      cRate: run?.cRate,
      uMax: run?.uMax,
      soc: run?.replay.at().socPct ?? 0,
      total: run?.result.totalMinutes ?? 0,
      over: notes.isShown('over'),
      plating: notes.isShown('red') ? 'red' : notes.isShown('amber') ? 'amber' : 'none',
    }),
    update(dt, t) {
      if (!lab.isCurrent(ID) || !run) return; // shared bench: only the current step drives it
      const running = elapsed < RUN_S;
      elapsed = Math.min(elapsed + dt, RUN_S);
      const c = run.replay.cell;
      const q = CELLS[c].capacityAh;
      run.replay.head = elapsed / RUN_S;
      const p = run.replay.at();
      const i = run.replay.index();
      if (i !== run.drawn) {
        run.drawn = i;
        const pts = run.replay.points.slice(0, i + 1);
        const ts = pts.map((s) => s.timeS / 60);
        chart.setData(
          'u',
          ts,
          pts.map((s) => s.voltageV),
        );
        chart.setData(
          'i',
          ts,
          pts.map((s) => (s.currentA / (run!.cRate * q)) * 100),
        );
        chart.setData(
          'soc',
          ts,
          pts.map((s) => Math.min(s.socPct, 100)),
        );
      }
      chart.setMarker('u', { x: p.timeS / 60, y: p.voltageV, color: 'pink', guides: false });
      // the times appear on the board as the play head passes them
      const now = p.timeS / 60;
      const r = run.result;
      const reached = (m: number | null): number | null => (m !== null && now >= m - 1e-6 ? m : null);
      stats.set(0, 0, num(reached(r.socAtCvPct === null ? null : r.ccMinutes), 1));
      stats.set(0, 1, num(reached(r.minutesTo80), 0));
      stats.set(0, 2, num(running ? null : r.totalMinutes, 1));
      stats.set(0, 3, num(Math.min(p.socPct, 100), 1));

      // live warnings follow the sliders (§M3): limit above the chemistry's U_max; cold or cold + fast
      const chem = CELLS[cell()].chem;
      const over = limit() > CELL_LIMITS[chem].uMaxV + 1e-9;
      const risk = platingRisk(ui.value<number>('temp7'), ui.value<number>('cc7'));
      notes.show('over', over);
      notes.show('amber', risk === 'amber');
      notes.show('red', risk === 'red');

      const phase = run.replay.points[i]!.phase;
      for (const id of Object.keys(bench.state) as BenchCell[]) bench.state[id].active = id === c;
      const st = bench.state[c];
      st.soc = Math.min(p.socPct, 100) / 100;
      st.cRate = running ? p.currentA / q : 0;
      const spec0 = CELLS[c];
      st.heat = Math.max(
        running ? p.heatW / (spec0.iMaxA ** 2 * (spec0.r0Ohm + spec0.r1Ohm)) : 0,
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
      lens.plating = PLATING[r.plating] * Math.min(run.replay.head * 1.3, 1);
      lens.update(dt);
      bench.update(dt, t);
      audio.loop('hum').set({ gain: running ? 0.05 : 0, pitch: phase === 'CV' ? 1.1 : 1 });
    },
  };
};
