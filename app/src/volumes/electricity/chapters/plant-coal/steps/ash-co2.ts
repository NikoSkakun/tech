/**
 * Step 9 `ash-co2` — «Зола, CO₂ і уловлювання вуглецю». A balance floats in front of the plant: one gondola of
 * coal (70 t) against the CO₂ (≈ 166 t, a translucent ball) and the ash (≈ 10 t) it becomes; the ash pond lies in the
 * north-east, the capture plant and a strata block (geological section) by the south rim.
 * Interaction: «Уловлювання CO₂: вимкнено / увімкнено» → the ball shrinks to the 10 % that still leaves the stack,
 * the captured CO₂ runs down into the storage layer, net power 1000 → 750 MW, g CO₂/kWh ≈ 757 → ≈ 101 (model M4);
 * «ККД блока» 30…50 % → g CO₂/kWh (`EF · 3,6 / η`).
 */
import { Vector3 } from 'three';
import { CCS as CCS_MODEL, COALS, WAGON_T, ccs, co2PerTonneKg } from '@electricity/sim/plant-coal';
import { fmtNumber, fmtUnit } from '@/content';
import { HOTSPOTS } from '../hotspots';
import { buildCarbon } from '../parts/carbon';
import type { StepFactory } from './types';

const COAL = 'bituminous';

export const ashCo2: StepFactory = ({ ctx, ui, L, plant, hot }) => {
  const carbon = buildCarbon(ctx);
  ctx.root.add(carbon.scales, carbon.ground);
  const aCcs = ctx.stage.actor(plant.site.ccs.group, { appear: 'grow' });
  const aInject = ctx.stage.actor(carbon.injection, { appear: 'fade' });
  const on = (): boolean => ui.value<string>('a.ccs') === 'on';
  const eta = (): number => ui.value<number>('a.eta') / 100;
  const result = () => ccs(COAL, 1000, eta(), on());
  const co2Wagon = (WAGON_T * co2PerTonneKg(COAL)) / 1000;
  const ashWagon = (WAGON_T * COALS[COAL].ashPct) / 100;
  const toStack = (): number => co2Wagon * (on() ? 1 - CCS_MODEL.capture : 1);
  const [offLabel, onLabel] = L.ccs;
  const title = offLabel.split(':')[0]!;
  ctx.qa.expose('carbon', () => ({ ccs: on(), eta: eta(), netMW: result().netMW, gPerKWh: result().stackGPerKWh, ball: toStack() }));
  return {
    id: 'ash-co2',
    stage: {
      camera: 'ash-co2',
      show: [carbon.scales, carbon.ground, aCcs],
      enter: () => ctx.stage.toggle(aInject, on(), { instant: true }),
    },
    ui: {
      reset: true,
      honesty: ['notToScale', 'simplified'],
      controls: [
        {
          type: 'segmented',
          id: 'a.ccs',
          label: title,
          value: 'off',
          items: [
            { id: 'off', label: offLabel.split(': ')[1] ?? offLabel },
            { id: 'on', label: onLabel },
          ],
          onChange: (v) => ctx.stage.toggle(aInject, v === 'on'),
        },
        { type: 'slider', id: 'a.eta', label: L.unitEta, min: 30, max: 50, step: 1, value: 45, unit: '%', digits: 0 },
        { type: 'readout', id: 'a.net', label: L.netPower, get: () => result().netMW, unit: 'MW', digits: 0 },
        { type: 'readout', id: 'a.g', label: L.stackCo2, get: () => result().stackGPerKWh, unit: 'g/kWh', digits: 0, color: () => (on() ? 'ui.ok' : 'ui.alarm') },
        { type: 'note', id: 'a.hint', icon: 'info', text: L.lifeCycleHint, visible: on },
      ],
      callouts: [
        { anchor: () => carbon.points.wagon, text: L.oneWagon, side: 'down', priority: 1 },
        { anchor: () => carbon.points.ball, text: () => `${L.co2} · ${fmtUnit(Math.round(toStack()), 't')}`, side: 'up', priority: 0 },
        { anchor: () => carbon.points.ash, text: () => `${L.ash} · ${fmtNumber(ashWagon, { digits: 1 })} t`, side: 'down', priority: 2 },
        { anchor: () => plant.site.points.ccsTop, text: L.ccsPlant, side: 'right', priority: 3 },
        { anchor: () => carbon.points.storage, text: () => `${L.captured} · ${fmtUnit(Math.round(result().capturedTph), 't/h')}`, side: 'right', priority: 5, visible: on },
        { anchor: () => plant.site.points.pond.clone().add(new Vector3(0, 6, 0)), text: L.ashPond, side: 'up', priority: 4 },
      ],
      hotspots: [hot(() => plant.site.points.pond, HOTSPOTS['ash-co2'].pond), hot(() => carbon.points.storage, HOTSPOTS['ash-co2'].storage)],
    },
    update(_dt, t) {
      carbon.set(WAGON_T, toStack(), ashWagon);
      carbon.scales.rotation.y = Math.sin(t * 0.15) * 0.06;
    },
  };
};
