/**
 * Step 7 `feedwater` — «Конденсатор і живильний тракт: вода повертається». The turbine hall stays open; its LP
 * exhaust steam falls into the condenser (cutaway: `blue` cooling tubes), and the feed-water train is unrolled in
 * one line in front of it, up to the riser into the boiler. Temperatures ≈ 30 → 150 → 180 → 290 °C.
 * Interaction: «Регенерація: увімкнено / вимкнено» — the extraction lines vanish, the water reaches the boiler at
 * ≈ 30 °C (all `blue`), the condenser glows (more heat to the river), η 44,9 → 38,9 % (model M2); «Температура
 * охолоджувальної води» 5…35 °C → η (≈ −0,1 point per +1 °C above 15 °C, simplified).
 */
import { Vector3 } from 'three';
import { fuelUse, unitEfficiency } from '@electricity/sim/plant-coal';
import { applyHeat, createFlow } from '@/fx';
import type { KToonMaterial } from '@/style';
import { HOTSPOTS } from '../hotspots';
import { buildFeedTrain } from '../parts/feed-train';
import type { StepFactory } from './types';

/** The ultra-supercritical unit of the document (27 MPa, 600 °C): η 44,9 % with everything on. */
const UNIT = { pressureMPa: 27, tempC: 600 } as const;

export const feedwater: StepFactory = ({ ctx, ui, L, plant, hot }) => {
  const feed = buildFeedTrain(ctx, plant.main);
  ctx.root.add(feed.group);
  const aExt = ctx.stage.actor(feed.extraction, { appear: 'fade' });
  // exhaust steam: LP exhaust under the turbine → out of the hall → condenser neck
  const t = plant.main.turbo;
  const ex = t.anchorWorld('exhaust1');
  const neck = feed.condenser.anchorWorld('hotIn');
  const steam = createFlow(ctx, { kind: 'blob', color: 'mist', paths: [ex, new Vector3(ex.x, ex.y - 2, neck.z - 10), neck.clone().add(new Vector3(0, 8, 0)), neck], count: ctx.quality.count(30, 12), radius: 0.7, speed: 7, spread: 1.4, halo: false });
  ctx.root.add(steam);
  const condMat = (feed.condenser.mats.has('gloss') ? feed.condenser.mats.get('gloss') : feed.condenser.mats.get('toon')) as KToonMaterial;
  ctx.stage.param('condHeat', 0, { duration: 1, onChange: (v) => applyHeat(condMat, v, 1.2) });
  const regen = (): boolean => ui.value<string>('f.regen') === 'on';
  const cw = (): number => ui.value<number>('f.cw');
  const eta = (): number => unitEfficiency({ ...UNIT, regeneration: regen(), coolingWaterC: cw() });
  const setRegen = (on: boolean, instant = false): void => {
    ctx.stage.toggle(aExt, on, { instant });
    feed.setRegen(on);
    ctx.stage.setParam('condHeat', on ? 0 : 0.45, { instant });
  };
  const P = feed.points;
  const [regenOn, regenOff] = L.regen;
  const label = regenOn.split(':')[0]!;
  ctx.qa.expose('feed', () => ({ regen: regen(), cw: cw(), eta: eta(), extraction: ctx.stage.shown(aExt) }));
  return {
    id: 'feedwater',
    stage: {
      camera: 'feedwater',
      params: { hallOpen: 1 },
      show: [feed.group, steam, aExt],
      enter: () => setRegen(regen(), true),
    },
    ui: {
      reset: true,
      honesty: ['notToScale', { kind: 'simplified', text: `${L.coolingWater}: ${L.simplified}` }],
      controls: [
        {
          type: 'segmented',
          id: 'f.regen',
          label,
          value: 'on',
          items: [
            { id: 'on', label: regenOn.split(': ')[1] ?? regenOn },
            { id: 'off', label: regenOff },
          ],
          onChange: (v) => setRegen(v === 'on'),
        },
        { type: 'slider', id: 'f.cw', label: L.coolingWater, min: 5, max: 35, step: 1, value: 15, unit: '°C', digits: 0 },
        { type: 'readout', id: 'f.eta', label: L.etaNet, get: () => eta() * 100, unit: '%', digits: 1, color: () => (regen() ? 'ui.ok' : 'ui.warning') },
        { type: 'readout', id: 'f.coal', label: L.coalPerMWh, get: () => fuelUse('bituminous', 1000, eta()).coalKgPerMWh, unit: 'kg', digits: 0 },
      ],
      callouts: [
        { anchor: () => P.condenser, text: () => `${L.condenser} · ${L.t30}`, side: 'up', priority: 0 },
        { anchor: () => P.lp, text: () => (regen() ? `${L.lpHeaters} · ${L.t150}` : L.lpHeaters), side: 'down', priority: 3 },
        { anchor: () => P.deaerator, text: () => (regen() ? `${L.deaerator} · ${L.t180}` : L.deaerator), side: 'up', priority: 2 },
        { anchor: () => P.pump, text: L.feedPump, side: 'down', priority: 4 },
        { anchor: () => P.hp, text: () => (regen() ? `${L.hpHeaters} · ${L.t290}` : L.hpHeaters), side: 'left', priority: 5 },
        { anchor: () => P.riser, text: () => `${L.waterIn} · ${regen() ? L.t290 : L.t30}`, side: 'right', priority: 1 },
        { anchor: () => P.o2, text: L.o2, side: 'up', priority: 6 },
        { anchor: () => ex, text: L.exhaustSteam, side: 'left', priority: 7 },
      ],
      hotspots: [hot(() => P.vacuum, HOTSPOTS.feedwater.vacuum), hot(() => P.treatment, HOTSPOTS.feedwater.treatment)],
    },
  };
};
