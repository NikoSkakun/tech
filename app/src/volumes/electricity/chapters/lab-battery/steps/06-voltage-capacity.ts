/**
 * Step 6 `voltage-capacity` — the test bench: a 21700 NMC cell and a 100 Ah LFP brick are discharged into an
 * electronic load; the U(Q) curves grow on the holo board while level tubes, heater coils, leads and the
 * instrument follow the same replayed samples. Model: `discharge` (§M2: OCV + R₀ + 1RC, temperature factors).
 */
import { Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtNumber, fmtSI } from '@/content';
import { CELLS, type DischargeResult } from '@electricity/sim/lab-battery';
import { Button, Chart, Toggle, row, spacer } from '@/ui3d';
import { notices, statGrid } from '../hud-bits';
import type { StepFactory } from '../lab';
import { L } from '../labels';
import { createBench, createPowerBank } from '../parts';
import { capacityPct, dischargeReplay, type BenchCell, type Replay } from '../sim';
import { group } from '../world';

const ID = 'voltage-capacity';
/** Screen time of one full discharge («повний розряд за ≈ 8 s екранного часу»). */
const RUN_S = 8;
const SERIES: Record<BenchCell, { key: 'nmc' | 'lfp'; name: string; color: 'violet' | 'teal' }> = {
  '21700-NMC': { key: 'nmc', name: L.cellNmc, color: 'violet' },
  'LFP-100': { key: 'lfp', name: L.cellLfp, color: 'teal' },
};
const ORDER: readonly BenchCell[] = ['21700-NMC', 'LFP-100'];

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

  /* --------------------------------------------------------------------------------- holo board */
  const chart = new Chart({
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
      ...ORDER.map((c) => ({
        id: `${SERIES[c].key}Ocv`,
        color: `${SERIES[c].color}.light` as const,
        width: 1.3,
      })),
      ...ORDER.map((c) => ({ id: SERIES[c].key, label: SERIES[c].name, color: SERIES[c].color })),
    ],
  });
  const stats = statGrid(
    ORDER.map((c) => ({ name: SERIES[c].name, color: SERIES[c].color })),
    [L.statAh, L.statWh, L.statMin, L.statMeanV, L.statHeat],
  );
  // «Показати OCV» belongs to the chart, so it lives on the board (and keeps the dock short)
  const ocvToggle = new Toggle({ label: L.showOcv, value: false, onChange: (on) => ocv.set(on) });
  const ocv = ui.external('ocv6', false, (on) => (ocvToggle.value = on === true));
  const go = new Button({
    label: L.runDischarge,
    icon: 'play',
    variant: 'primary',
    onClick: ui.action('run6', () => (audio.play('relay'), start())),
  });
  lab.holo.add(ID, {
    title: L.boardDischarge,
    width: 540,
    children: [
      chart,
      stats.node,
      row({ gap: 12, width: 'fill', align: 'center', children: [ocvToggle, spacer(), go] }),
    ],
  });

  /* -------------------------------------------------------------------------------------- runs */
  interface Run {
    replay: Replay;
    result: DischargeResult;
    cRate: number;
    drawn: number;
  }
  let runs: Run[] = [];
  let elapsed = RUN_S;
  const history: { xs: number[]; ys: number[] }[][] = [[], []]; // per cell: newest first
  const notes = notices('notes6', { over: { text: L.overCurrent, tone: 'warning' } });
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
    ORDER.forEach((c, k) =>
      [1, 2, 3].forEach((n) =>
        chart.setData(`${SERIES[c].key}H${n}`, history[k]![n - 1]?.xs ?? [], history[k]![n - 1]?.ys ?? []),
      ),
    );
    const cRate = ui.value<number>('current6');
    runs = active().map((c) => ({
      ...dischargeReplay(c, cRate, ui.value<number>('temp6')),
      cRate,
      drawn: -1,
    }));
    for (const c of ORDER)
      if (!runs.some((r) => r.replay.cell === c))
        for (const s of ['', 'Ocv']) chart.setData(SERIES[c].key + s, [], []);
    elapsed = 0;
  }

  const v = new Vector3();
  const fmt = (x: number, digits: number): string => fmtNumber(x, { digits });
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
      show: [bench.group, bank],
      // every entry starts a fresh run so the bench is alive (and deep links show a curve being drawn)
      enter: () => start(),
      leave: () => audio.loop('buzz').set({ gain: 0 }),
    },
    ui: {
      hint: L.hint6,
      honesty: ['simplified', { sped: 900 }],
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
        notes.spec,
      ],
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
          title: 'Cut-off — відсічка',
        },
        { anchor: bank, title: 'mAh on a power bank — mAh на павербанку' },
      ],
    },
    probe: () => ({
      elapsed,
      runs: runs.map((r) => `${r.replay.cell}@${r.cRate}`).join('+'),
      ah: runs[0]?.replay.at().ah ?? 0,
      volts: runs[0]?.replay.at().voltageV ?? 0,
      ocv: ui.value<boolean>('ocv6'),
      temperature: bench.temperature,
      over: notes.isShown('over'),
    }),
    update(dt, t) {
      if (!lab.isCurrent(ID)) return; // the bench is shared with step 7: only the current step drives it
      const running = elapsed < RUN_S;
      elapsed = Math.min(elapsed + dt, RUN_S);
      const cNow = ui.value<number>('current6');
      notes.show(
        'over',
        active().some((c) => cNow * CELLS[c].capacityAh > CELLS[c].iMaxA + 1e-9),
      );
      const showOcv = ui.value<boolean>('ocv6');
      for (const c of ORDER) bench.state[c].active = active().includes(c);
      let first = true;
      ORDER.forEach((c, row) => {
        const run = runs.find((r) => r.replay.cell === c);
        stats.showRow(row, run !== undefined);
        if (!run) return;
        run.replay.head = elapsed / RUN_S;
        const p = run.replay.at();
        const key = SERIES[c].key;
        // the chart follows the play head: redraw only when another sample is revealed
        const upTo = run.replay.index() * 2 + (showOcv ? 1 : 0);
        if (upTo !== run.drawn) {
          run.drawn = upTo;
          chart.setData(key, ...curve(run.replay, run.replay.index()));
          chart.setData(
            `${key}Ocv`,
            ...(showOcv ? curve(run.replay, run.replay.index(), true) : ([[], []] as [number[], number[]])),
          );
        }
        chart.setMarker(key, {
          x: capacityPct(c, p.ah),
          y: p.voltageV,
          color: SERIES[c].color,
          guides: false,
        });
        stats.set(row, 0, fmt(p.ah, p.ah < 10 ? 2 : 1));
        stats.set(row, 1, fmt(p.wh, p.wh < 100 ? 1 : 0));
        stats.set(row, 2, fmt(p.timeS / 60, 0));
        stats.set(row, 3, p.ah > 0 ? fmt(p.wh / p.ah, 2) : '—');
        stats.set(row, 4, fmtSI(p.heatJ, 'J', { maxDigits: 1 }));
        // 3D: level tube = SOC, coil glow = I·(U_OCV − U) relative to the cell's rated-current loss, leads ∝ current
        const spec = CELLS[c];
        const st = bench.state[c];
        st.soc = Math.max(p.socPct, 0) / 100;
        st.cRate = running ? -run.cRate : 0;
        st.heat = running ? p.heatW / (spec.iMaxA ** 2 * (spec.r0Ohm + spec.r1Ohm)) : 0;
        if (first) {
          bench.meters.current = running ? run.cRate / 3 : 0;
          bench.meters.voltage = (p.voltageV - 2.4) / 1.9;
          first = false;
        }
      });
      bench.temperature = ui.value<number>('temp6');
      bench.update(dt, t);
      audio.loop('buzz').set({ gain: running ? 0.04 * Math.min(cNow, 2) : 0, pitch: 0.8 + 0.2 * cNow });
    },
  };
};
