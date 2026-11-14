/**
 * Step 6 `turbine` — «Турбіна і генератор». The turbine-hall roof lifts away; the turbo-set's upper casings rise
 * so the blade rows show; steam swells from the small HP cylinder to the two big LP cylinders; the reheat loop runs
 * back to the boiler; `yellow`/`green`/`red` pulses leave the generator for the step-up transformer and the yard.
 * Interaction: «Без проміжного перегріву / З проміжним перегрівом» → the loop disappears, the LP steam gets wetter
 * (≈ 20 % vs ≈ 9 % droplets, illustrative) and the unit efficiency drops by 3 points (model M2); «Навантаження»
 * 30…100 % → steam flow and power pulses; the shaft keeps 3000 rpm (frequency 50 Hz) at any load.
 */
import { unitEfficiency } from '@electricity/sim/plant-coal';
import { fmtUnit } from '@/content';
import { HOTSPOTS } from '../hotspots';
import { buildTurbineFx } from '../parts/turbine-fx';
import type { StepFactory } from './types';

/** The ultra-supercritical unit the document's ±3 points refer to (27 MPa, 600 °C). */
const UNIT = { pressureMPa: 27, tempC: 600 } as const;
/** Real speed of a two-pole 50 Hz turbo-set vs the drawn shaft (2,2 rad/s ≈ 21 rpm). */
const SLOWED = Math.round(3000 / ((2.2 * 60) / (2 * Math.PI)));

export const turbine: StepFactory = ({ ctx, ui, L, live, plant, hot }) => {
  const fx = buildTurbineFx(ctx, plant.main, plant.site.points.gantry);
  ctx.root.add(fx.group);
  const aLoop = ctx.stage.actor(fx.loop, { appear: 'grow' });
  const reheat = (): boolean => ui.value<string>('t.reheat') === 'on';
  const load = (): number => ui.value<number>('t.load') / 100;
  const eta = (): number => unitEfficiency({ ...UNIT, reheat: reheat() });
  const setReheat = (on: boolean, instant = false): void => {
    ctx.stage.toggle(aLoop, on, { instant });
    fx.setWetness(on ? 0.09 : 0.2);
  };
  ctx.qa.expose('turbine', () => ({ reheat: reheat(), eta: eta(), load: load(), loop: ctx.stage.shown(aLoop), rpm: 3000 }));
  const P = fx.points;
  return {
    id: 'turbine',
    stage: {
      camera: 'turbine',
      params: { hallOpen: 1, turboOpen: 0.85 },
      show: [fx.group, aLoop],
      enter: () => setReheat(reheat(), true),
    },
    ui: {
      reset: true,
      honesty: ['notToScale', { slowed: SLOWED }, { kind: 'simplified', text: `${L.wetness}: ${L.simplified}` }],
      controls: [
        {
          type: 'segmented',
          id: 't.reheat',
          label: L.reheat,
          value: 'on',
          items: [
            { id: 'off', label: L.noReheat },
            { id: 'on', label: L.withReheat },
          ],
          onChange: (v) => setReheat(v === 'on'),
        },
        { type: 'slider', id: 't.load', label: L.load, min: 30, max: 100, step: 5, value: 100, unit: '%', digits: 0 },
        { type: 'readout', id: 't.eta', label: L.etaNet, get: () => eta() * 100, unit: '%', digits: 1, color: () => (reheat() ? 'ui.ok' : 'ui.warning') },
        { type: 'readout', id: 't.wet', label: L.wetness, get: () => (reheat() ? 9 : 20), unit: '%', digits: 0 },
        { type: 'readout', id: 't.rpm', label: L.rpm, text: () => `${fmtUnit(3000, 'rpm')} · ${fmtUnit(50, 'Hz')}` },
      ],
      callouts: [
        { anchor: () => P.hp, text: L.hp, side: 'up', priority: 0 },
        { anchor: () => P.ip, text: L.ip, side: 'down', priority: 3 },
        { anchor: () => P.lp1, text: L.lp, side: 'up', priority: 1 },
        { anchor: () => P.gen, text: L.generator, side: 'up', priority: 2 },
        { anchor: () => P.gsu, text: L.gsu, side: 'right', priority: 4 },
        { anchor: () => P.loop, text: L.reheat, side: 'left', priority: 5, visible: reheat },
      ],
      hotspots: [hot(() => P.turning, HOTSPOTS.turbine.turning), hot(() => P.valves, HOTSPOTS.turbine.valves), hot(() => P.gen, HOTSPOTS.turbine.hydrogen)],
    },
    update() {
      live.loadTarget = load();
      fx.setLoad(live.load);
    },
  };
};
