/**
 * Step 6 `voltage-capacity` — the test bench: a 21700 NMC cell and a 100 Ah LFP brick are discharged into an
 * electronic load; the U(Q) curves grow on the board while level tubes, heater coils, leads and the
 * instrument follow the same replayed samples. Model: `discharge` (§M2: OCV + R₀ + 1RC, temperature factors).
 */
import { Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtNumber, fmtSI } from '@/content';
import { CELLS, type DischargeResult } from '@electricity/sim/lab-battery';
import type { Chart } from '@/ui3d';
import type { StepFactory } from '../lab';
import { L, spedUp } from '../labels';
import { note } from '../notes';
import { createBench } from '../parts/bench';
import { createPowerBank } from '../parts/props';
import { capacityPct, dischargeReplay, type BenchCell, type Replay } from '../sim-bindings/runs';
import { frame } from '../shots';
import { group } from '../world';

const ID = 'voltage-capacity';
/** Screen time of one full discharge («повний розряд за ≈ 8 s екранного часу»). */
const RUN_S = 8;
const SERIES: Record<BenchCell, { key: 'nmc' | 'lfp'; name: string; color: 'violet' | 'teal' }> = {
  '21700-NMC': { key: 'nmc', name: L.cellNmc, color: 'violet' },
  'LFP-100': { key: 'lfp', name: L.cellLfp, color: 'teal' },
};
const ORDER: readonly BenchCell[] = ['21700-NMC', 'LFP-100'];
const NONE: [number[], number[]] = [[], []];

export const voltageCapacity: StepFactory = (lab) => {
  const { ctx, ui, mats } = lab;
  // steps 6 and 7 share one bench: it stays in place while the load becomes a charger
  const bench = lab.share('bench', () => {
    const b = createBench(ctx, mats);
    lab.stageRoot.add(group('set:bench', 0.55, 0, 0.3, [b.group]));
    return b;
  });
  const bank = createPowerBank();
  bank.position.set(2.6, 0.66, 0.85);
  bench.group.add(bank);

  /* -------------------------------------------------------------------------------------- runs */
  interface Run {
    replay: Replay;
    result: DischargeResult;
    cRate: number;
    drawn: number;
  }
  let runs: Run[] = [];
  let elapsed = RUN_S;
  /** Bumped by every new run; the chart repaints its history when it lags behind (or is a new chart). */
  let revision = 0;
  let painted = -1;
  let over = false;
  /** Live results per run: Ah, Wh, minutes, mean voltage, heat (the board's table shows them by column). */
  let results: string[][] = [];
  const history: { xs: number[]; ys: number[] }[][] = [[], []]; // per cell: newest first
  const active = (): BenchCell[] => {
    const pick = ui.value<string>('cell6');
    return pick === 'both' ? [...ORDER] : [pick as BenchCell];
  };
  const curve = (r: Replay, upTo: number, ocv = false): [number[], number[]] => {
    const pts = r.points.slice(0, upTo + 1);
    return [pts.map((p) => capacityPct(r.cell, p.ah)), pts.map((p) => (ocv ? p.ocvV : p.voltageV))];
  };
  function start(): void {
    // the finished traces move one step back in the history (up to three stay on the chart)
    for (const r of runs) {
      const k = ORDER.indexOf(r.replay.cell);
      const [xs, ys] = curve(r.replay, r.replay.points.length - 1);
      history[k]!.unshift({ xs, ys });
      history[k]!.length = Math.min(history[k]!.length, 3);
    }
    const cRate = ui.value<number>('current6');
    runs = active().map((c) => ({
      ...dischargeReplay(c, cRate, ui.value<number>('temp6')),
      cRate,
      drawn: -1,
    }));
    elapsed = 0;
    revision++;
  }
  /** Chart side of the step: called every frame while the board is on screen. */
  function paint(chart: Chart): void {
    if (painted !== revision) {
      painted = revision;
      ORDER.forEach((c, k) => {
        [1, 2, 3].forEach((n) => {
          const h = history[k]![n - 1];
          chart.setData(`${SERIES[c].key}H${n}`, h?.xs ?? [], h?.ys ?? []);
        });
        if (!runs.some((r) => r.replay.cell === c)) {
          chart.setData(SERIES[c].key, ...NONE);
          chart.setData(`${SERIES[c].key}Ocv`, ...NONE);
          chart.setMarker(SERIES[c].key, null);
        }
      });
      for (const r of runs) r.drawn = -1;
    }
    const showOcv = ui.value<boolean>('ocv6');
    for (const run of runs) {
      const c = run.replay.cell;
      const key = SERIES[c].key;
      // the curve follows the play head: redraw only when another sample is revealed
      const upTo = run.replay.index() * 2 + (showOcv ? 1 : 0);
      if (upTo !== run.drawn) {
        run.drawn = upTo;
        chart.setData(key, ...curve(run.replay, run.replay.index()));
        chart.setData(`${key}Ocv`, ...(showOcv ? curve(run.replay, run.replay.index(), true) : NONE));
      }
      const p = run.replay.at();
      chart.setMarker(key, { x: capacityPct(c, p.ah), y: p.voltageV, color: SERIES[c].color, guides: false });
    }
  }
  /** Real time lapse of the run on screen: model seconds per screen second (longest cell). */
  const speed = (): number => Math.max(0, ...runs.map((r) => r.result.minutes * 60)) / RUN_S;
  const v = new Vector3();
  const fmt = (x: number, digits: number): string => fmtNumber(x, { digits });

  return {
    id: ID,
    shots: {
      [ID]: frame([0.55, 1.8, 0.3], 7.4, 4.1, { azimuth: 0.18, elevation: 0.22 }),
    },
    stage: {
      show: [bench.group, bank],
      // every entry starts a fresh run so the bench is alive (and deep links show a curve being drawn)
      enter: () => start(),
      leave: () => audio.loop('buzz').set({ gain: 0 }),
    },
    ui: {
      hint: L.hint6,
      honesty: ['simplified'],
      controls: [
        {
          type: 'slider',
          id: 'current6',
          label: L.dischargeCurrent,
          min: 0.1,
          max: 3,
          step: 0.1,
          unit: 'C',
          digits: 1,
          value: 0.5,
        },
        {
          type: 'slider',
          id: 'temp6',
          label: L.temperature,
          min: -20,
          max: 45,
          step: 1,
          unit: '°C',
          value: 25,
        },
        {
          type: 'segmented',
          id: 'cell6',
          items: [
            { id: '21700-NMC', label: L.cellNmc },
            { id: 'LFP-100', label: L.cellLfp },
            { id: 'both', label: L.bothCells },
          ],
          value: 'both',
        },
        note('over6', L.overCurrent, 'warning', () => over),
        {
          type: 'button',
          id: 'run6',
          label: L.runDischarge,
          icon: 'play',
          primary: true,
          onClick: () => (audio.play('relay'), start()),
        },
      ],
      board: {
        title: L.boardDischarge,
        size: 'md',
        children: [
          {
            type: 'chart',
            id: 'chart6',
            chart: {
              height: 236,
              x: { min: 0, max: 100, label: L.axisCapacity },
              y: { min: 2.4, max: 4.3, label: L.axisVoltage },
              series: [
                // up to three earlier runs stay as thin traces for comparison
                ...[3, 2, 1].flatMap((n) =>
                  ORDER.map((c) => ({
                    id: `${SERIES[c].key}H${n}`,
                    color: `${SERIES[c].color}.dark` as const,
                    width: 1.5,
                  })),
                ),
                // «напруга спокою»: the dashed companion of each working curve
                ...ORDER.map((c) => ({
                  id: `${SERIES[c].key}Ocv`,
                  color: `${SERIES[c].color}.light` as const,
                  dash: true,
                  opacity: 0.8,
                })),
                ...ORDER.map((c) => ({ id: SERIES[c].key, label: SERIES[c].name, color: SERIES[c].color })),
              ],
            },
            init: () => (painted = -1),
            update: paint,
          },
          {
            type: 'table',
            id: 'stats6',
            // one row per quantity, one column per cell on the bench
            rows: () => [
              ['', ...runs.map((r) => SERIES[r.replay.cell].name)],
              ...[L.statAh, L.statWh, L.statMin, L.statMeanV, L.statHeat].map((name, i) => [
                name,
                ...results.map((r) => r[i]!),
              ]),
            ],
          },
          note('speed6', () => spedUp(speed()), 'honesty'),
          { type: 'toggle', id: 'ocv6', label: L.showOcv, value: false },
        ],
      },
      callouts: [
        { anchor: () => bench.device.getWorldPosition(v).setY(v.y + 1.45), text: L.load, side: 'up' },
        {
          anchor: () => bench.station['LFP-100'].getWorldPosition(v).set(v.x - 0.05, v.y + 0.5, v.z + 0.3),
          text: L.internalR,
          color: 'orange',
          side: 'down',
        },
        {
          anchor: () => bench.station['21700-NMC'].getWorldPosition(v).set(v.x + 0.52, v.y + 1.4, v.z + 0.3),
          text: L.socTube,
          color: 'lime',
          side: 'up',
        },
      ],
      hotspots: [
        {
          anchor: () => bench.station['21700-NMC'].getWorldPosition(v).set(v.x + 0.52, v.y + 0.2, v.z + 0.42),
          content: 'cut-off',
        },
        { anchor: bank, content: 'mah-on-a-power-bank' },
      ],
    },
    probe: () => ({
      elapsed,
      runs: runs.map((r) => `${r.replay.cell}@${r.cRate}`).join('+'),
      ah: runs[0]?.replay.at().ah ?? 0,
      volts: runs[0]?.replay.at().voltageV ?? 0,
      ocv: ui.value<boolean>('ocv6'),
      temperature: bench.temperature,
      over,
      speed: speed(),
      history: history.map((h) => h.length).join(),
    }),
    update(dt, t) {
      if (!lab.isCurrent(ID)) return; // the bench is shared with step 7: only the current step drives it
      const running = elapsed < RUN_S;
      elapsed = Math.min(elapsed + dt, RUN_S);
      const cNow = ui.value<number>('current6');
      over = active().some((c) => cNow * CELLS[c].capacityAh > CELLS[c].iMaxA + 1e-9);
      for (const c of ORDER) bench.state[c].active = active().includes(c);
      results = [];
      runs.forEach((run, k) => {
        const c = run.replay.cell;
        run.replay.head = elapsed / RUN_S;
        const p = run.replay.at();
        results.push([
          fmt(p.ah, p.ah < 10 ? 2 : 1),
          fmt(p.wh, p.wh < 100 ? 1 : 0),
          fmt(p.timeS / 60, 0),
          p.ah > 0 ? fmt(p.wh / p.ah, 2) : '—',
          fmtSI(p.heatJ, 'J', { maxDigits: 1 }),
        ]);
        // 3D: level tube = SOC, coil glow = I·(U_OCV − U) relative to the cell's rated-current loss, leads ∝ current
        const spec = CELLS[c];
        const st = bench.state[c];
        st.soc = Math.max(p.socPct, 0) / 100;
        st.cRate = running ? -run.cRate : 0;
        st.heat = running ? p.heatW / (spec.iMaxA ** 2 * (spec.r0Ohm + spec.r1Ohm)) : 0;
        if (k === 0) {
          bench.meters.current = running ? run.cRate / 3 : 0;
          bench.meters.voltage = (p.voltageV - 2.4) / 1.9;
        }
      });
      bench.temperature = ui.value<number>('temp6');
      bench.update(dt, t);
      audio.loop('buzz').set({ gain: running ? 0.04 * Math.min(cNow, 2) : 0, pitch: 0.8 + 0.2 * cNow });
    },
  };
};
