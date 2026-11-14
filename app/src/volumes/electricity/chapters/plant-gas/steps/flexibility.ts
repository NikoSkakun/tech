/**
 * Step 7 `flexibility` — «Перегони запуску: хто першим дасть струм». Dawn over the island; the start board is
 * the HUD board: five lanes (gas engine, aeroderivative GT, heavy GT, CCGT after a stop of 4 / 24 / 72 h, CCGT
 * cold) drawn by model M4 (delay + ramp) against the clock, 1 s = 1 min, with the rising `red` morning demand;
 * a table gives each lane's power and finish time. The island wakes in sync: engines start, the peaker's haze
 * appears, the combined-cycle unit ramps. «Аварія: вимкнувся блок 1000 MW» draws an illustrative frequency dip
 * (no frequency model — see `grid/inertia`, `grid/reserves`) and the fast machines jump in first.
 */
import { fmtNumber } from '@/content';
import { finishMin, lanePowerPct, type CcgtStart, type StartLane } from '@electricity/sim/plant-gas';
import type { Chart } from '@/ui3d';
import { HOTSPOTS } from '../hotspots';
import { hot } from './hot';
import type { StepFactory } from './types';

interface Lane {
  id: string;
  lane: StartLane;
  start: () => CcgtStart;
  label: () => string;
  color: 'pink' | 'magenta' | 'coral' | 'violet' | 'blue';
}

const T_MAX = 200; // minutes on the clock

export const flexibility: StepFactory = ({ ctx, ui, L, live, isl, shell }) => {
  const start = (): CcgtStart => ({ h4: 'hot', h24: 'warm', h72: 'cold' })[ui.value<string>('fx.hours')] as CcgtStart;
  const ccgtLabel = (): string => ({ hot: L.laneHot, warm: L.laneWarm, cold: L.laneCold })[start()];
  const lanes: Lane[] = [
    { id: 'eng', lane: 'gasEngine', start, label: () => L.laneEngine, color: 'pink' },
    { id: 'aero', lane: 'aeroGt', start, label: () => L.laneAero, color: 'magenta' },
    { id: 'heavy', lane: 'heavyGt', start, label: () => L.laneHeavy, color: 'coral' },
    { id: 'ccgt', lane: 'ccgt', start, label: ccgtLabel, color: 'violet' },
    { id: 'cold', lane: 'ccgt', start: () => 'cold', label: () => L.laneCold, color: 'blue' },
  ];
  let tMin = 0;
  let tripAt = -1;
  const run = (): void => {
    tMin = 0;
    tripAt = -1;
  };
  const p = (l: Lane, t = tMin): number => lanePowerPct(l.lane, t, l.start());
  // illustrative morning demand on the same axis: from 40 % of the island's peak toward 100 %
  const demand = (t: number): number => 40 + 60 * (1 - Math.exp(-t / 45));
  // illustrative frequency after a 1000 MW trip: a quick dip, then recovery as reserves come in (t in s)
  const freq = (s: number): number => 50 - 0.32 * (1 - Math.exp(-s / 1.5)) * Math.exp(-s / 14);
  let drawn = -1;
  const ts = Array.from({ length: 90 }, (_, i) => 10 ** (Math.log10(0.5) + (i / 89) * (Math.log10(T_MAX) - Math.log10(0.5))));
  ctx.qa.expose('race', () => ({ tMin, trip: tripAt >= 0, start: start(), ccgt: p(lanes[3]!) }));
  return {
    id: 'flexibility',
    stage: { camera: 'flexibility', show: [...shell.outside], env: 'golden', enter: run },
    ui: {
      honesty: [{ sped: 60, text: L.clockScale }, 'illustrative'],
      controls: [
        {
          type: 'segmented',
          id: 'fx.hours',
          label: L.standstill,
          items: [
            { id: 'h4', label: `${L.h4} · ${L.hot}` },
            { id: 'h24', label: `${L.h24} · ${L.warm}` },
            { id: 'h72', label: `${L.h72} · ${L.cold}` },
          ],
          value: 'h4',
          onChange: () => (drawn = -1),
        },
        { type: 'button', id: 'fx.start', label: L.startAll, icon: 'play', primary: true, onClick: run },
      ],
      board: {
        title: L.raceTitle,
        size: 'md',
        children: [
          { type: 'readout', id: 'fx.clock', label: L.clock, unit: 'min', digits: 0, get: () => tMin },
  { type: 'note', id: 'fx.rescue', icon: 'lightning', color: 'amber', text: `${L.rescue}: ${L.laneEngine}, ${L.laneAero}`, visible: () => tripAt >= 0 },
          {
            type: 'chart',
            id: 'fx.race',
            chart: {
              height: 190,
              x: { min: 0.5, max: T_MAX, log: true, label: 't, min' },
              y: { min: 0, max: 105, label: 'P, %', ticks: [0, 50, 100] },
              series: [
                { id: 'demand', label: L.demand, color: 'red', dash: true, width: 2 },
                ...lanes.map((l) => ({ id: l.id, label: l.id === 'ccgt' ? L.ccgtShort : l.label(), color: l.color, width: 2.6 })),
              ],
            },
            update: (c: Chart) => {
              const key = Math.floor(tMin * 2) + (start() === 'hot' ? 0 : start() === 'warm' ? 1e4 : 2e4);
              if (key === drawn) return;
              drawn = key;
              const upto = ts.filter((t) => t <= Math.max(0.5, tMin));
              c.setData('demand', upto, upto.map(demand));
              for (const l of lanes) c.setData(l.id, upto, upto.map((t) => p(l, t)));
            },
          },
          {
            type: 'table',
            id: 'fx.table',
            head: [L.lane, L.powerNow, L.fullAt],
            rows: () => lanes.map((l) => [l.label(), fmtNumber(p(l), { digits: 0 }), tMin >= finishMin(l.lane, l.start()) ? `${fmtNumber(finishMin(l.lane, l.start()), { digits: 0 })} min` : '…']),
          },
          {
            type: 'chart',
            id: 'fx.freq',
            visible: () => tripAt >= 0,
            chart: { height: 90, x: { min: 0, max: 40, label: 't, s' }, y: { min: 49.6, max: 50.05, label: 'f, Hz', ticks: [49.7, 50] }, series: [{ id: 'f', label: L.frequency, color: 'red', width: 2.4 }] },
            update: (c: Chart) => {
              if (tripAt < 0) return;
              const span = Math.min(40, (tMin - tripAt) * 6); // the dip plays over ≈ 7 s of the clock
              const xs = Array.from({ length: 60 }, (_, i) => (i / 59) * span);
              c.setData('f', xs, xs.map(freq));
            },
          },
          // the accident lives with its chart: on small phones the dock's action row holds one button
  { type: 'button', id: 'fx.trip', label: L.trip, icon: 'warning', onClick: () => (tripAt = tMin) },
        ],
      },
      hotspots: [hot(() => isl.ccgt.hrsg.anchorWorld('drum.hp'), HOTSPOTS.flexibility.stress)],
    },
    update(dt) {
      tMin = Math.min(T_MAX, tMin + dt);
      const [eng, aero, heavy, ccgt] = lanes.map((l) => p(l) / 100) as [number, number, number, number];
      const rescue = tripAt >= 0 ? 1 : 0;
      live.enginesTarget = 8 * Math.max(eng, rescue);
      live.peakerTarget = Math.max(aero, rescue);
      live.gtTarget = Math.max(0.02, Math.max(heavy * 0.1, ccgt));
      live.stTarget = ccgt;
      live.spinTarget = 2.2 * Math.max(0.05, Math.min(1, ccgt * 1.5));
      live.nightTarget = Math.max(0, 0.6 - tMin / 40); // the windows go out as the sun rises
    },
  };
};
