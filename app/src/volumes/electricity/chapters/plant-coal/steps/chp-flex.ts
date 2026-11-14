/**
 * Step 10 `chp-flex` — «ТЕЦ: електрика і тепло разом; маневреність». Winter evening; the city on its islet glows;
 * district-heating mains (supply `orange`, return `blue`) run from the network heaters by the turbine hall to the
 * city; a thermometer in a flat at the city edge warms up. The board splits the fuel's energy into electricity
 * (`yellow`), heat for the city (`orange`) and losses (`steel`), and shows the morning ramp of the unit.
 * Interaction: «Тепло місту» 0…480 MW (unit 300 MW, η 36 %) → P_el, Q, fuel utilisation (model M5); the cooling-tower
 * plumes thin as heat goes to the city; «Ранковий пік» plays the 40 → 100 % ramp at 3 %/min against the 15-minute
 * target — the red shortfall fills (model M6, speeded up).
 */
import { CHP, CHP_FUEL_MW, MORNING_RAMP, actualPct, chpOperatingPoint, shortfallMWh, targetPct } from '@electricity/sim/plant-coal';
import { fmtNumber } from '@/content';
import { HOTSPOTS } from '../hotspots';
import { buildChp } from '../parts/chp';
import type { StepFactory } from './types';

const Q_MAX = 1.6 * CHP.p0MW;
/** Minutes of the ramp chart and the seconds the animation takes. */
const SPAN = 25;
const PLAY_S = 8;

export const chpFlex: StepFactory = ({ ctx, ui, L, live, plant, hot }) => {
  const chp = buildChp(ctx);
  ctx.root.add(chp.city.group, chp.group);
  // the city islet costs ≈ 15 draw calls: it is on stage only where the camera turns toward it
  const aCity = ctx.stage.actor(chp.city.group, { appear: 'fade' });
  plant.lit.push(...chp.lit);
  const q = (): number => ui.value<number>('h.q');
  const op = () => chpOperatingPoint(q());
  let tau = 0;
  let playing = false;
  const peak = (): void => {
    tau = 0;
    playing = true;
  };
  const ramp = () => {
    // the target is drawn over the whole span; the unit and its shortfall only up to the time reached so far
    const tx: number[] = [];
    const tg: number[] = [];
    for (let t = 0; t <= SPAN + 1e-6; t += 0.25) {
      tx.push(t);
      tg.push(targetPct(t));
    }
    const xs: number[] = [];
    const a: number[] = [];
    const gap: number[] = [];
    const end = Math.max(0.25, tau);
    for (let t = 0; t <= end + 1e-6; t += 0.25) {
      xs.push(t);
      a.push(actualPct(t));
      gap.push(Math.max(0, targetPct(t) - actualPct(t)));
    }
    return { xs, a, gap, tx, tg };
  };
  let drawnTau = -1;
  ctx.qa.expose('chp', () => ({ q: q(), el: op().electricMW, eps: op().fuelUtilisation, tau, shortfall: shortfallMWh(tau) }));
  return {
    id: 'chp-flex',
    stage: {
      camera: 'chp-flex',
      env: 'night',
      envTune: { stars: 0.6 },
      show: [chp.group, aCity],
      enter: () => {
        tau = 0;
        playing = false;
        drawnTau = -1;
      },
    },
    ui: {
      reset: true,
      honesty: ['notToScale', 'simplified', { sped: 190, visible: () => playing || tau > 0 }],
      controls: [
        { type: 'slider', id: 'h.q', label: L.heatToCity, min: 0, max: Q_MAX, step: 10, value: 0, unit: 'MW', digits: 0 },
        { type: 'readout', id: 'h.el', label: L.electricity, get: () => op().electricMW, unit: 'MW', digits: 0, color: () => 'yellow' },
        { type: 'readout', id: 'h.heat', label: L.heat, get: () => op().heatMW, unit: 'MW', digits: 0, color: () => 'orange' },
        { type: 'readout', id: 'h.eps', label: L.fuelUse, get: () => op().fuelUtilisation * 100, unit: '%', digits: 0, color: () => 'ui.ok' },
        { type: 'button', id: 'h.peak', label: L.morningPeak, icon: 'play', primary: true, onClick: peak },
      ],
      board: {
        title: L.dayLoad,
        size: 'md',
        children: [
          {
            type: 'chart',
            id: 'h.split',
            chart: {
              height: 150,
              x: { min: 0.4, max: 3.6, ticks: [1, 2, 3], format: (v) => [L.electricity, L.heat, L.losses][Math.round(v) - 1] ?? '' },
              y: { min: 0, max: 600, label: 'P, MW' },
              series: [
                { id: 'el', color: 'yellow', kind: 'bars' },
                { id: 'heat', color: 'orange', kind: 'bars' },
                { id: 'loss', color: 'steel', kind: 'bars' },
              ],
            },
            update: (c) => {
              const o = op();
              c.setData('el', [1], [o.electricMW]);
              c.setData('heat', [2], [o.heatMW]);
              c.setData('loss', [3], [CHP_FUEL_MW - o.electricMW - o.heatMW]);
            },
          },
          {
            type: 'chart',
            id: 'h.ramp',
            chart: {
              height: 150,
              x: { min: 0, max: SPAN, label: 't, min' },
              y: { min: 0, max: 110, label: 'P, %' },
              series: [
                { id: 'act', label: L.actual, color: 'plantType.coal', kind: 'area', stack: 'p' },
                { id: 'gap', label: L.shortfall, color: 'red', kind: 'area', stack: 'p', opacity: 0.8 },
                { id: 'tg', label: L.target, color: 'white', dash: true },
              ],
              legend: true,
            },
            update: (c) => {
              if (Math.abs(tau - drawnTau) < 0.05 && drawnTau >= 0) return;
              drawnTau = tau;
              const r = ramp();
              c.setData('act', r.xs, r.a);
              c.setData('gap', r.xs, r.gap);
              c.setData('tg', r.tx, r.tg);
            },
          },
          { type: 'readout', id: 'h.short', label: L.shortfall, text: () => `${fmtNumber(shortfallMWh(tau), { digits: 1 })} MWh · ${MORNING_RAMP.unitMW} MW`, color: () => 'ui.alarm' },
          { type: 'note', id: 'h.fill', icon: 'info', text: L.gapFillers, visible: () => tau > 2 },
        ],
      },
      callouts: [
        { anchor: () => chp.points.supply, text: L.supplyLine, side: 'left', priority: 1 },
        { anchor: () => chp.points.back, text: L.returnLine, side: 'down', priority: 2 },
        { anchor: () => chp.points.flat, text: L.flatTemp, side: 'up', priority: 0 },
      ],
      hotspots: [hot(() => chp.points.heaters, HOTSPOTS['chp-flex'].exchanger), hot(() => chp.points.accumulator, HOTSPOTS['chp-flex'].accumulator)],
    },
    update(dt) {
      if (playing) {
        tau = Math.min(SPAN, tau + (dt * SPAN) / PLAY_S);
        if (tau >= SPAN) playing = false;
      }
      const share = q() / Q_MAX;
      chp.setHeat(share);
      live.nightTarget = 1;
      live.towerPlumeTarget = 1 - 0.75 * share;
    },
  };
};
