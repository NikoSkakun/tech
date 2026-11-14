/**
 * Step 8 `pumped-storage` — «ГАЕС: найбільший акумулятор світу». Night: the town sleeps behind the stand; on it
 * the section of a pumped-storage plant (`psh-rig.ts`). The day simulator M7 on the board: 24 hour cells
 * (bars: pumping below zero, generating above, stopped flat) over the illustrative price line; click or drag on
 * the chart paints the chosen mode («Насос» / «Турбіна» / «Стоп») into the hours. «Автоплан» loads the
 * document's plan; «Відтворити добу» plays it in 24 s: the bowl fills / empties, the unit reverses (pump: it
 * turns the other way, power flows from the grid; turbine: water down, pulses into the grid, the town lights
 * up), MWh in / out, «прибуток», and the cycle efficiency of a full cycle (M7: 79 %, not the day's ratio).
 */
import { Vector3 } from 'three';
import {
  AUTO_PLAN,
  fullCycle,
  PSH,
  PSH_PRICES,
  simulatePshDay,
  storedEnergyMWh,
  type PshHourMode,
} from '@electricity/sim/plant-hydro';
import { fmtNumber } from '@/content';
import { HOTSPOTS } from '../hotspots';
import { buildPshRig } from '../parts/psh-rig';
import { hot } from './hot';
import type { StepFactory } from './types';

const HOURS = Array.from({ length: 24 }, (_, h) => h + 0.5);
const PLAY_S = 24;

export const pumpedStorage: StepFactory = ({ ctx, ui, L, live, stand }) => {
  const rig = buildPshRig(ctx);
  stand.top.add(rig.group);
  const aRig = ctx.stage.actor(rig.group, { appear: 'grow' });
  let plan: PshHourMode[] = [...AUTO_PLAN];
  let day = simulatePshDay(plan);
  let play = -1; // seconds into the playback, −1 = not playing
  const setPlan = (next: PshHourMode[]): void => {
    plan = next;
    day = simulatePshDay(plan);
  };
  const hourNow = (): number => (play >= 0 ? Math.min(23.999, play * (24 / PLAY_S)) : -1);
  const volumeAt = (t: number): number => {
    if (t < 0) return PSH.v0Share * PSH.volumeMaxM3;
    const h = Math.floor(t);
    const v0 = h === 0 ? PSH.v0Share * PSH.volumeMaxM3 : day.hours[h - 1]!.volumeEndM3;
    const v1 = day.hours[h]!.volumeEndM3;
    return v0 + (v1 - v0) * (t - h);
  };
  const modeAt = (t: number): PshHourMode =>
    t < 0 ? 'stop' : day.hours[Math.floor(t)]!.fraction > 0 ? plan[Math.floor(t)]! : 'stop';
  const sum = (key: 'energyInMWh' | 'energyOutMWh' | 'profitEur'): number => {
    const t = hourNow();
    if (t < 0) return 0;
    let s = 0;
    for (let h = 0; h <= Math.floor(t); h++) s += day.hours[h]![key] * (h < Math.floor(t) ? 1 : t - h);
    return s;
  };
  const bar = (m: PshHourMode) =>
    HOURS.map((_, h) =>
      plan[h] === m ? (m === 'pump' ? -PSH.pumpMW : m === 'turbine' ? PSH.turbineMW : 18) : NaN,
    );
  const paint = (x: number): void => {
    const h = Math.max(0, Math.min(23, Math.floor(x)));
    const m = ui.value<PshHourMode>('ps.brush');
    if (plan[h] === m) return;
    const next = [...plan];
    next[h] = m;
    setPlan(next);
  };
  const v = new Vector3();
  ctx.qa.expose('psh', () => ({ plan: plan.join(','), play, fill: volumeAt(hourNow()) / PSH.volumeMaxM3 }));
  const at = (n: Parameters<typeof rig.at>[0]) => (): Vector3 => rig.at(n, v.clone());
  return {
    id: 'pumped-storage',
    stage: { camera: 'pumped-storage', show: [stand.group, aRig], env: 'night', enter: () => (play = -1) },
    ui: {
      honesty: [{ kind: 'simplified', text: L.illustrativePrices }, 'notToScale', { sped: 3600 }],
      controls: [
        {
          type: 'segmented',
          id: 'ps.brush',
          label: L.brush,
          value: 'pump',
          items: [
            { id: 'pump', label: L.pump },
            { id: 'turbine', label: L.turbine },
            { id: 'stop', label: L.stop },
          ],
        },
        {
          type: 'note',
          id: 'ps.limit',
          text: L.limitNote,
          icon: 'info',
          visible: () => day.hours.some((h) => h.mode !== 'stop' && h.fraction < 1),
        },
        {
          type: 'button',
          id: 'ps.auto',
          label: L.autoPlan,
          icon: 'check',
          onClick: () => setPlan([...AUTO_PLAN]),
        },
        {
          type: 'button',
          id: 'ps.play',
          label: L.playDay,
          icon: 'play',
          primary: true,
          onClick: () => (play = 0),
        },
      ],
      board: {
        title: L.dayTitle,
        size: 'md',
        children: [
          {
            type: 'chart',
            id: 'ps.day',
            chart: {
              height: 170,
              x: { min: 0, max: 24, label: 'h' },
              y: { min: -450, max: 450, label: 'P, MW' },
              y2: { min: 0, max: 180, label: '€/MWh' },
              series: [
                { id: 'pump', label: L.pump, color: 'mist', kind: 'bars' },
                { id: 'turbine', label: L.turbine, color: 'sky', kind: 'bars' },
                { id: 'stop', label: L.stop, color: 'slate', kind: 'bars' },
                { id: 'price', label: L.priceSeries, color: 'white', axis: 'y2', dash: true },
              ],
              onScrub: (x: number) => paint(x),
            },
            init: (c) => c.setData('price', HOURS, [...PSH_PRICES]),
            update: (c) => {
              for (const m of ['pump', 'turbine', 'stop'] as const) c.setData(m, HOURS, bar(m));
              const t = hourNow();
              c.setMarker('now', t >= 0 ? { x: t, y: 0, color: 'yellow' } : { x: -10, y: 0 });
            },
          },
          {
            type: 'stats',
            id: 'ps.stats',
            columns: 3,
            items: [
              { label: L.energyIn, unit: 'MWh', digits: 0, get: () => sum('energyInMWh') },
              { label: L.energyOut, unit: 'MWh', digits: 0, get: () => sum('energyOutMWh') },
              { label: L.profit, unit: '€', digits: 0, get: () => sum('profitEur') },
              {
                label: L.upperLevel,
                unit: '%',
                digits: 0,
                get: () => (volumeAt(hourNow()) / PSH.volumeMaxM3) * 100,
              },
              { label: L.cycleEff, unit: '%', digits: 1, get: () => fullCycle().efficiency * 100 },
            ],
          },
        ],
      },
      callouts: [
        {
          anchor: at('bowl'),
          text: () => `${L.stored}: ${fmtNumber(storedEnergyMWh(volumeAt(hourNow())), { digits: 0 })}`,
          side: 'up',
          priority: 0,
        },
        { anchor: at('unit'), text: L.pumpTurbine, side: 'right', priority: 1 },
        { anchor: at('motor'), text: L.motorGenerator, side: 'left', priority: 3 },
        { anchor: at('lower'), text: L.lowerReservoir, side: 'down', priority: 2 },
        {
          anchor: at('line'),
          text: () =>
            modeAt(hourNow()) === 'pump' ? L.fromGrid : modeAt(hourNow()) === 'turbine' ? L.toGrid : L.stop,
          side: 'up',
          priority: 4,
        },
      ],
      hotspots: [
        hot(at('unit'), HOTSPOTS['pumped-storage'].reversal),
        hot(at('motor'), HOTSPOTS['pumped-storage'].variableSpeed),
      ],
    },
    update(dt) {
      if (play >= 0) {
        play += dt;
        if (play > PLAY_S + 2) play = -1;
      }
      const t = hourNow();
      const mode = modeAt(t);
      const m = mode === 'turbine' ? 1 : mode === 'pump' ? -1 : 0;
      rig.setFill(volumeAt(t) / PSH.volumeMaxM3);
      rig.setMode(m);
      // the unit turns one way as a turbine, the other way as a pump (slowed); stopped units coast down
      const spin = rig.runner.group.userData as { w?: number };
      spin.w = (spin.w ?? 0) + (m * 2.6 - (spin.w ?? 0)) * Math.min(1, dt * 1.5);
      rig.runner.group.rotation.y += dt * spin.w;
      rig.rotor.rotation.y = rig.runner.group.rotation.y;
      live.nightTarget = 1;
      live.townTarget = mode === 'turbine' ? 1 : 0.25;
      live.pshTarget = m;
      live.bowlTarget = volumeAt(t) / PSH.volumeMaxM3;
    },
  };
};
