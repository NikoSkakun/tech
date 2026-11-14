/**
 * Step 10 `reactor-types` — «Типи реакторів». A shelf of seven cutaways; tap one (or pick it in the dock) and it
 * rolls forward and comes alive (its glow brightens, the BWR boils); the board shows its card — moderator,
 * coolant, fuel, example — and «скільки контурів» as a row of circuit dots. «Порівняти температури виходу»:
 * bars of the outlet temperatures with the Carnot limit of each above them (T_c = 30 °C, the hub's formula).
 */
import { Vector3 } from 'three';
import { HOTSPOTS } from '../hotspots';
import { HALL_TUNE, INNER_POST } from '../looks';
import { TYPES, buildShelf, type ReactorType } from '../parts/reactor-shelf';
import { hot, probe } from './hot';
import type { StepFactory } from './types';

const KEY: Record<ReactorType, 'Pwr' | 'Bwr' | 'Candu' | 'Rbmk' | 'Fast' | 'Htgr' | 'Smr'> = { pwr: 'Pwr', bwr: 'Bwr', candu: 'Candu', rbmk: 'Rbmk', fast: 'Fast', htgr: 'Htgr', smr: 'Smr' };
/** Card data: moderator, coolant, fuel, example (document: step 10 text, terms and facts; steps 3, 9, 12). */
const CARD: Record<ReactorType, [string, string, string, string]> = {
  pwr: ['вода', 'вода під тиском', '≈ 3–5 % U-235', 'ВВЕР-1000 — усі 15 блоків України'],
  bwr: ['вода', 'вода кипить у корпусі', 'збагачений уран', 'BWRX-300, Канада (будується)'],
  candu: ['важка вода', 'важка вода', 'природний уран', 'CANDU, Канада'],
  rbmk: ['графіт', 'кипляча вода в каналах', 'збагачений уран', 'Чорнобильська АЕС (зупинена)'],
  fast: ['немає', 'рідкий натрій', 'напрацьовує плутоній з U-238', 'БН-800'],
  htgr: ['графіт', 'гелій', 'графітові кульки', 'HTR-PM, Китай (з 2023 р.)'],
  smr: ['залежить від проєкту', 'залежить від проєкту', 'заводські модулі до ≈ 300 MW', 'BWRX-300; «Академік Ломоносов»'],
};
const CIRCUITS: Record<ReactorType, string> = { pwr: '●● 2', bwr: '● 1', candu: '●● 2', rbmk: '● 1', fast: '●●● 3', htgr: '●● 2', smr: '● / ●● 1–2' };
const OUTLET: [ReactorType, number][] = [['pwr', 320], ['bwr', 285], ['candu', 310], ['rbmk', 284], ['fast', 550], ['htgr', 750]];
const carnot = (tC: number): number => (1 - 303.15 / (tC + 273.15)) * 100;

export const reactorTypes: StepFactory = ({ ctx, ui, L, inner }) => {
  const set = inner.sets.types;
  const shelf = buildShelf(ctx);
  set.add(shelf.group);
  const pick = (): ReactorType => ui.value<ReactorType>('rt.pick');
  const active = (): boolean => ctx.stage.current === 'reactor-types';
  for (const k of TYPES) ctx.input.register(shelf.models[k].group, { cursor: 'pointer', tooltip: L[`type${KEY[k]}`], enabled: active, click: () => ui.set('rt.pick', k, { notify: true }) });
  const w = (p: Vector3): Vector3 => set.localToWorld(p.clone());
  const nameOf = (k: ReactorType): string => L[`type${KEY[k]}`];
  ctx.qa.expose('types', () => ({ pick: pick(), compare: ui.value<boolean>('rt.cmp'), z: shelf.models[pick()].group.position.z }));
  for (const k of TYPES) probe(`type.${k}`, () => w(shelf.models[k].group.position.clone().add(new Vector3(0, 2, 0))));
  return {
    id: 'reactor-types',
    stage: { camera: 'reactor-types', envTune: HALL_TUNE, post: INNER_POST },
    ui: {
      reset: true,
      honesty: ['notToScale'],
      controls: [
        { type: 'segmented', id: 'rt.pick', items: TYPES.map((k) => ({ id: k, label: L[`short${KEY[k]}`] })), value: 'pwr' },
        { type: 'toggle', id: 'rt.cmp', label: L.outletTemps, value: false },
      ],
      board: {
        title: L.cardTitle,
        size: 'md',
        children: [
          { type: 'table', id: 'rt.card', rows: () => [[L.fModerator, CARD[pick()][0]], [L.fCoolant, CARD[pick()][1]], [L.fFuel, CARD[pick()][2]], [L.fExample, CARD[pick()][3]], [L.loopsCount, CIRCUITS[pick()]]], visible: () => !ui.value<boolean>('rt.cmp') },
          {
            type: 'chart',
            id: 'rt.temps',
            visible: () => ui.value<boolean>('rt.cmp'),
            chart: {
              height: 170,
              legend: true,
              x: { min: 0.4, max: 6.6, ticks: [1, 2, 3, 4, 5, 6], format: (v) => L[`short${KEY[OUTLET[Math.round(v) - 1]?.[0] ?? 'pwr']}`] },
              y: { min: 0, max: 800, label: L.outletAxis },
              y2: { min: 0, max: 80, label: L.carnotAxis },
              series: [{ id: 't', label: L.outletSeries, color: 'orange', kind: 'bars' }, { id: 'c', label: L.carnotSeries, color: 'green', axis: 'y2' }],
            },
            init: (chart) => {
              const xs = OUTLET.map((_, i) => i + 1);
              chart.setData('t', xs, OUTLET.map(([, t]) => t));
              chart.setData('c', xs, OUTLET.map(([, t]) => carnot(t)));
            },
          },
        ],
      },
      callouts: [{ anchor: () => w(shelf.models[pick()].group.position.clone().add(new Vector3(0, 5.6, 0))), text: () => nameOf(pick()), side: 'up', priority: 0 }],
      hotspots: [hot(() => w(shelf.models.rbmk.group.position.clone().add(new Vector3(1.6, 3.2, 1.6))), HOTSPOTS['reactor-types'].void)],
    },
    update(dt, t) {
      const sel = pick();
      for (const k of TYPES) {
        const g = shelf.models[k].group;
        const target = shelf.home[k].clone().add(k === sel ? new Vector3(0, 0, 5) : new Vector3());
        g.position.lerp(target, Math.min(1, dt * 3));
        const s = k === sel ? 1.9 : 1.45;
        g.scale.setScalar(g.scale.x + (s - g.scale.x) * Math.min(1, dt * 3));
      }
      shelf.glows.forEach((h, i) => (h.fade = (['pwr', 'bwr', 'fast', 'htgr', 'candu', 'rbmk', 'smr'] as const)[i] === sel ? 0.7 + 0.3 * Math.sin(t * 3) : 0.2));
      shelf.bubbles.visible = sel === 'bwr';
    },
  };
};
