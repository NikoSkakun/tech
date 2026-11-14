/**
 * Step 6 `combined-cycle` — «Парогазовий цикл: ККД понад 60 %». Along the boiler with its south wall off: the
 * exhaust (`orange`, ≈ 650 °C) crosses the tube bundles and leaves `steel`-grey at ≈ 90 °C; water `blue` →
 * boiling `sky` → steam `white`+`pink` in the bundles; HP steam runs to the steam turbine on the same shaft.
 * Board: where the gas's energy goes (bars) and the numbers of model M3. «Котел-утилізатор» off → the damper
 * sends the exhaust up the bypass stack, the steam turbine stops, η falls ≈ 62 → 44 %; «Кількість рівнів
 * тиску» 1…3 sets the stack temperature; «Допалювання» 0…100 MW_th lights duct burners (more steam power,
 * slightly lower η). Pressure ratio and TIT carry over from step 4.
 */
import { Vector3 } from 'three';
import { fmtUnit } from '@/content';
import { STACK_TEMP_K, combinedCycle as ccModel } from '@electricity/sim/plant-gas';
import type { Chart } from '@/ui3d';
import { HOTSPOTS } from '../hotspots';
import { fill } from '../labels';
import { BYPASS, HRSG } from '../layout';
import { buildHrsgFlow } from '../parts/hrsg-flow';
import { hot } from './hot';
import type { StepFactory } from './types';

export const combinedCycle: StepFactory = ({ ctx, ui, L, live, isl, shell }) => {
  const { ccgt } = isl;
  const flow = buildHrsgFlow(ctx, ctx.root, ccgt);
  const items = [...flow.gas, ...flow.water, flow.steam, flow.bypass, ...flow.burners];
  const levels = (): 1 | 2 | 3 => Math.round(ui.value<number>('cc.levels')) as 1 | 2 | 3;
  const cc = (): ReturnType<typeof ccModel> =>
    ccModel({ pressureRatio: ui.value<number>('br.r'), titC: ui.value<number>('br.tit'), levels: levels(), hrsg: ui.value<boolean>('cc.hrsg'), firingMW: ui.value<number>('cc.firing') });
  const pct = (): number[] => {
    const r = cc();
    const gt = (r.gtMW / r.fuelMW) * 100;
    const st = (r.stMW / r.fuelMW) * 100;
    return [100, gt, st, Math.max(0, 100 - gt - st)];
  };
  const bundle = (kind: 'sh' | 'evap' | 'eco', level: 'hp' | 'ip' | 'lp'): (() => Vector3) => {
    const u = ccgt.hrsg.bundles.find((b) => b.kind === kind && b.level === level);
    return () => ccgt.hrsg.group.localToWorld(ccgt.hrsg.drum.hp.clone().setX(u?.x ?? 0).setY(HRSG.height * 0.82).setZ(HRSG.width / 2));
  };
  const on = (): boolean => ui.value<boolean>('cc.hrsg');
  ctx.qa.expose('cc', () => ({ eta: cc().eta, totalMW: cc().totalMW, stTarget: live.stTarget, bypass: live.bypassTarget, firing: flow.burners[0]?.power ?? 0 }));
  return {
    id: 'combined-cycle',
    stage: { camera: 'combined-cycle', show: [shell.roof, shell.front, shell.intake, shell.duct, shell.engineRoof, shell.engineFront, ...items] },
    ui: {
      honesty: ['notToScale', 'simplified'],
      controls: [
        { type: 'toggle', id: 'cc.hrsg', label: L.hrsg, value: true },
        { type: 'slider', id: 'cc.levels', label: L.levels, min: 1, max: 3, step: 1, value: 3, digits: 0, disabled: () => !on() },
        { type: 'slider', id: 'cc.firing', label: L.firing, min: 0, max: 100, step: 5, value: 0, unit: 'MW', digits: 0, disabled: () => !on() },
        { type: 'note', id: 'cc.bypass', icon: 'info', text: L.bypassOn, visible: () => !on() },
      ],
      board: {
        title: L.energyOfGas,
        size: 'sm',
        children: [
          {
            type: 'chart',
            id: 'cc.sankey',
            chart: {
              height: 150,
              x: { min: 0.4, max: 4.6, ticks: [1, 2, 3, 4], format: (v: number) => [L.fuelIn, L.gtEl, L.stEl, L.losses][Math.round(v) - 1] ?? '' },
              y: { min: 0, max: 100, label: '%', ticks: [0, 25, 50, 75, 100] },
              series: [
                { id: 'fuel', color: 'violet', kind: 'bars', width: 0.55 },
                { id: 'el', color: 'yellow', kind: 'bars', width: 0.55 },
                { id: 'loss', color: 'steel', kind: 'bars', width: 0.55 },
              ],
              legend: false,
            },
            update: (c: Chart) => {
              const [f, g, s, l] = pct() as [number, number, number, number];
              c.setData('fuel', [1], [f]);
              c.setData('el', [2, 3], [g, s]);
              c.setData('loss', [4], [l]);
            },
          },
          {
            type: 'stats',
            id: 'cc.stats',
            items: [
              { label: L.etaCC, get: () => cc().eta * 100, unit: '%', digits: 1 },
              { label: L.powerTotal, get: () => cc().totalMW, unit: 'MW', digits: 0 },
              { label: L.powerGt, get: () => cc().gtMW, unit: 'MW', digits: 0 },
              { label: L.powerSt, get: () => cc().stMW, unit: 'MW', digits: 0 },
              { label: L.t4, get: () => cc().exhaustC, unit: '°C', digits: 0 },
              { label: L.stackTemp, get: () => (on() ? STACK_TEMP_K[levels()] - 273.15 : cc().exhaustC), unit: '°C', digits: 0 },
            ],
          },
        ],
      },
      callouts: [
        { anchor: () => ccgt.hrsg.anchorWorld('inlet'), text: () => fill(L.exhaustIn, fmtUnit(Math.round(cc().exhaustC), '°C')), color: 'orange', side: 'down', priority: 0 },
        { anchor: () => ccgt.hrsg.anchorWorld('outlet'), text: () => fill(L.toStack, fmtUnit(Math.round(STACK_TEMP_K[levels()] - 273.15), '°C')), side: 'right', priority: 1, visible: on },
        { anchor: () => ccgt.steamPath[2]!, text: L.steamToSt, side: 'up', priority: 2, visible: on },
        { anchor: bundle('sh', 'hp'), text: L.superheater, color: 'pink', priority: 3 },
        { anchor: bundle('evap', 'hp'), text: L.evaporator, color: 'sky', priority: 4 },
        { anchor: bundle('eco', 'hp'), text: L.economiser, color: 'blue', priority: 5 },
      ],
      hotspots: [
        hot(() => ccgt.hrsg.anchorWorld('drum.hp'), HOTSPOTS['combined-cycle'].drum),
        hot(() => ccgt.bypass.group.position.clone().add(new Vector3(0, BYPASS.height * 0.55, 0)), HOTSPOTS['combined-cycle'].bypass),
        hot(() => ccgt.acc.duct(), HOTSPOTS['combined-cycle'].acc),
      ],
    },
    update() {
      const r = cc();
      live.gtTarget = 1;
      live.stTarget = on() ? 1 : 0;
      live.bypassTarget = on() ? 0 : 1;
      flow.set(r.exhaustC, STACK_TEMP_K[levels()] - 273.15, 1 - live.bypass, ui.value<number>('cc.firing') / 100);
    },
  };
};
