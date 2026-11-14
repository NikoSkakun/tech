/**
 * Step 8 `flue-gas` — «Очищення димових газів». Daylight; the precipitator opens its south wall, the absorber shows
 * its slurry rain; four streams of chips ride the gas path from the boiler to the stack. The plume over the stack
 * is dark and dense without the precipitator, nearly invisible with everything on (only the white vapour of the
 * wet scrubber shows). Interaction: «Каталізатор», «Електрофільтр», «Сіркоочищення» (all on) and «Вугілля»
 * (sulphur 0,5 / 1 / 2,5 %) → outlet concentrations against the EU limits, yearly emissions and by-products
 * (gypsum cone grows; model M3). CO₂ does not change with any switch.
 */
import { Vector3 } from 'three';
import { LIMITS_MG_NM3, flueGasCleaning, fuelUse } from '@electricity/sim/plant-coal';
import { fmtNumber } from '@/content';
import { HOTSPOTS } from '../hotspots';
import { GAS, ISLAND } from '../layout';
import { buildGasFx } from '../parts/gas-fx';
import type { StepFactory } from './types';

/** The unit of model M3's checkpoints: bituminous coal, 1000 MW, η 45 %. */
const UNIT = { coal: 'bituminous', netMW: 1000, eta: 0.45 } as const;
const SULPHUR = ['0.5', '1', '2.5'] as const;

export const flueGas: StepFactory = ({ ctx, ui, L, live, plant, hot }) => {
  const fx = buildGasFx(ctx, plant.gas);
  ctx.root.add(fx.group);
  const on = (id: string): boolean => ui.value<boolean>(id);
  const result = () => flueGasCleaning({ ...UNIT, sulphurPct: Number(ui.value<string>('g.s')), scr: on('g.scr'), esp: on('g.esp'), fgd: on('g.fgd') });
  const co2 = fuelUse(UNIT.coal, UNIT.netMW, UNIT.eta).co2Tph;
  const mg = (v: number): string => fmtNumber(v, { digits: v < 100 ? 1 : 0 });
  const row = (name: string, p: ReturnType<typeof result>['so2'], limit: number): string[] => [name, mg(p.rawMgPerNm3), mg(p.outMgPerNm3), fmtNumber(limit), fmtNumber(p.annualT / 1000, { digits: 1 })];
  const status = (over: boolean) => (over ? 'ui.alarm' : 'ui.ok');
  ctx.qa.expose('fluegas', () => {
    const r = result();
    return { so2: r.so2.outMgPerNm3, dust: r.dust.outMgPerNm3, nox: r.nox.outMgPerNm3, gypsum: r.gypsumTph, co2, smoke: live.smoke };
  });
  const toggle = (id: string, label: string) => ({ type: 'toggle' as const, id, label, value: true });
  return {
    id: 'flue-gas',
    stage: { camera: 'flue-gas', env: 'day', params: { gasOpen: 1 }, show: [fx.group] },
    ui: {
      reset: true,
      honesty: ['notToScale', 'simplified'],
      controls: [
        toggle('g.scr', L.scr),
        toggle('g.esp', L.esp),
        toggle('g.fgd', L.fgd),
        { type: 'segmented', id: 'g.s', label: `${L.coal}: ${L.sulphur.toLowerCase()}`, value: '1', items: SULPHUR.map((s) => ({ id: s, label: `${s.replace('.', ',')} %` })) },
      ],
      board: {
        title: L.gasCleaning,
        size: 'md',
        children: [
          {
            type: 'stats',
            id: 'g.out',
            items: [
              { label: L.so2, get: () => result().so2.outMgPerNm3, unit: 'mg/Nm³', digits: 0, color: () => status(result().so2.overLimit) },
              { label: L.nox, get: () => result().nox.outMgPerNm3, unit: 'mg/Nm³', digits: 0, color: () => status(result().nox.overLimit) },
              { label: L.flyAsh, get: () => result().dust.outMgPerNm3, unit: 'mg/Nm³', digits: 0, color: () => status(result().dust.overLimit) },
            ],
          },
          {
            type: 'table',
            id: 'g.table',
            head: [L.substance, L.before, L.after, L.euLimit, L.perYear],
            rows: () => {
              const r = result();
              return [row(L.so2, r.so2, LIMITS_MG_NM3.so2), row(L.nox, r.nox, LIMITS_MG_NM3.nox), row(L.flyAsh, r.dust, LIMITS_MG_NM3.dust)];
            },
          },
          { type: 'note', id: 'g.unit', icon: 'info', text: L.mgNote },
          {
            type: 'stats',
            id: 'g.by',
            items: [
              { label: L.co2, get: () => co2, unit: 't/h', digits: 0 },
              { label: L.gypsum, get: () => result().gypsumTph, unit: 't/h', digits: 1 },
              { label: L.limestone, get: () => result().limestoneTph, unit: 't/h', digits: 1 },
              { label: L.ammonia, get: () => result().ammoniaKgPerH, unit: 'kg/h', digits: 0 },
            ],
          },
        ],
      },
      callouts: [
        { anchor: () => fx.points.nox, text: L.nox, side: 'up', priority: 0 },
        { anchor: () => fx.points.dust, text: L.flyAsh, side: 'up', priority: 1 },
        { anchor: () => fx.points.so2, text: L.so2, side: 'up', priority: 2 },
        { anchor: () => fx.points.co2, text: L.co2, side: 'right', priority: 3 },
        { anchor: () => plant.gas.marks.esp.clone().add(new Vector3(0, 12, 0)), text: L.esp, side: 'up', priority: 4 },
        { anchor: () => plant.gas.marks.fgd.clone().add(new Vector3(0, 24, 0)), text: L.fgd, side: 'up', priority: 5 },
        { anchor: () => plant.gas.marks.scr.clone().add(new Vector3(0, 10, 0)), text: L.scr, side: 'left', priority: 6 },
      ],
      hotspots: [
        hot(() => plant.gas.marks.esp.clone().add(new Vector3(-8, 10, 0)), HOTSPOTS['flue-gas'].rapping),
        // same point as the overview's «stack» hotspot: the probe `hs.stack` is shared by both steps
        hot(() => plant.gas.marks.stackTop.clone().setY(ISLAND.ground + GAS.stack.h * 0.42), HOTSPOTS['flue-gas'].stack),
        hot(() => plant.site.gypsum.position.clone().add(new Vector3(0, 8, 0)), HOTSPOTS['flue-gas'].gypsum),
      ],
    },
    update(dt, t) {
      const r = result();
      fx.setPass({ dust: r.dust.outKgPerH / r.dust.rawKgPerH, so2: r.so2.outKgPerH / r.so2.rawKgPerH, nox: r.nox.outKgPerH / r.nox.rawKgPerH });
      fx.update(dt, t);
      // plume: dust makes it dark and dense; the wet scrubber adds white vapour
      live.smokeTarget = Math.min(1, r.dust.outMgPerNm3 / 2000);
      live.vapourTarget = on('g.fgd') ? 0.9 : 0.15;
      plant.site.setGypsum(0.6 + 0.12 * Math.cbrt(r.gypsumTph));
    },
  };
};
