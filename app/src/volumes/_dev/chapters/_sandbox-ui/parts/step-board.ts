import type { Object3D } from 'three';
import type { ChapterContext } from '@/engine/api';
import type { StepUiApi } from '@/hud';
import { STATUS, StatGrid, worldConsole, type WorldConsole } from '@/ui3d';

/** Illustrative chemistry table (QA fixture; the real numbers live in `lab-battery`). */
const CHEMS = [
  { id: 'lfp', label: 'LFP', vmax: 3.65, row: ['LFP', '3,2 V', '160–205', '3000–6000'] },
  { id: 'nmc', label: 'NMC', vmax: 4.2, row: ['NMC', '3,6 V', '200–280', '1000–2500'] },
  { id: 'lto', label: 'LTO', vmax: 2.8, row: ['LTO', '2,4 V', '60–110', '10 000+'] },
] as const;

/** Installed capacity by year with a gap (NaN) where no data were published — illustrative. */
const YEARS = [2010, 2012, 2014, 2016, 2018, 2020, 2022, 2024];
const GW = [1, 2, 4, Number.NaN, 12, 25, 40, 70];

/**
 * The `board` step of the kitchen sink (QA fixture of `ui-check`): a board with a chart (dashed series, a NaN
 * gap, year ticks), a table that follows the segmented choice, a stat grid and a conditional note; controls with
 * a live slider range (`ui.patch`), a toggle that hides the table, a toggle that shows a callout, a hotspot bound
 * to the content by id, and a world console that keeps its text legible.
 */
export function declareBoardStep(
  ctx: ChapterContext,
  ui: StepUiApi,
  parts: { core: Object3D },
): { console: WorldConsole; update(): void } {
  const chem = (): (typeof CHEMS)[number] =>
    CHEMS.find((c) => c.id === ui.value<string>('bd-chem')) ?? CHEMS[0];
  const stats = new StatGrid({
    items: [
      { label: 'Межа заряду', value: '' },
      { label: 'Режим', value: '' },
    ],
    columns: 2,
  });
  const console3d = worldConsole(ctx, {
    title: 'Пульт комірки',
    unit: 0.012,
    children: [stats],
    name: 'board-console',
  });
  console3d.surface.position.set(5, 0.6, -1);
  console3d.surface.visible = false;
  ui.onChange('bd-chem', () =>
    ui.patch('bd-v', { max: chem().vmax, label: `Напруга заряду, ${chem().label}` }),
  );
  ui.define({
    board: {
      hint: 'Оберіть хімію: межа слайдера й рядок таблиці зміняться',
      honesty: [
        'illustrative',
        {
          kind: 'simplified',
          text: 'спрощена модель комірки',
          visible: () => ui.value<boolean>('bd-labels'),
        },
      ],
      board: {
        title: 'Хімії акумуляторів',
        size: 'md',
        children: [
          {
            type: 'chart',
            id: 'bd-chart',
            chart: {
              height: 200,
              x: { min: 2010, max: 2024, label: 'рік' },
              y: { min: 0, max: 80, label: 'P, GW' },
              series: [
                { id: 'gw', label: 'Встановлено', color: 'sky' },
                { id: 'plan', label: 'План', color: 'yellow', dash: true, opacity: 0.7 },
              ],
            },
            init: (c) => {
              c.setData('gw', YEARS, GW);
              c.setData('plan', [2020, 2022, 2024], [25, 45, 80]);
            },
          },
          {
            type: 'table',
            id: 'bd-table',
            head: ['Хімія', 'U_nom', 'Wh/kg', 'Цикли'],
            rows: CHEMS.map((c) => c.row),
            highlight: () => CHEMS.findIndex((c) => c.id === ui.value<string>('bd-chem')),
            visible: () => ui.value<boolean>('bd-table-on'),
          },
          {
            type: 'stats',
            id: 'bd-stats',
            items: [
              { label: 'Межа заряду', get: () => chem().vmax, unit: 'V', digits: 2 },
              { label: 'Напруга', get: () => ui.value<number>('bd-v'), unit: 'V', digits: 2 },
              { label: 'Хімія', get: () => chem().label, color: () => STATUS.info },
            ],
          },
          {
            type: 'note',
            id: 'bd-warn',
            text: 'Напруга на межі: BMS зупиняє заряд',
            icon: 'warning',
            color: STATUS.warning,
            visible: () => ui.value<number>('bd-v') >= chem().vmax - 0.01,
          },
          {
            type: 'button',
            id: 'bd-max',
            label: 'До межі',
            icon: 'target',
            onClick: () => ui.set('bd-v', chem().vmax, { notify: true }),
          },
        ],
      },
      controls: [
        {
          type: 'segmented',
          id: 'bd-chem',
          label: 'Хімія',
          items: CHEMS.map((c) => ({ id: c.id, label: c.label })),
          value: 'lfp',
        },
        {
          type: 'slider',
          id: 'bd-v',
          label: 'Напруга заряду, LFP',
          min: 2,
          max: 3.65,
          step: 0.01,
          digits: 2,
          unit: 'V',
          value: 3.3,
        },
        { type: 'toggle', id: 'bd-table-on', label: 'Показати таблицю', value: true },
        { type: 'toggle', id: 'bd-labels', label: 'Підписи', value: false },
        {
          type: 'toggle',
          id: 'bd-console',
          label: 'Пульт у світі',
          value: false,
          onChange: (on) => (console3d.surface.visible = on),
        },
        {
          type: 'readout',
          id: 'bd-mode',
          label: 'Стан',
          text: () => (ui.value<number>('bd-v') >= chem().vmax - 0.01 ? 'на межі' : 'заряд'),
        },
        {
          type: 'button',
          id: 'bd-ping',
          label: 'Повідомлення',
          icon: 'info',
          onClick: () =>
            ui.toast(`Обрано ${chem().label}: межа ${chem().vmax.toFixed(2).replace('.', ',')} V`),
        },
      ],
      callouts: [
        {
          anchor: parts.core,
          text: () => `Комірка ${chem().label}`,
          side: 'left',
          visible: () => ui.value<boolean>('bd-labels'),
        },
      ],
      hotspots: [
        { anchor: [0, 1.4, 0], content: 'cell-cap', visible: () => !ui.value<boolean>('bd-labels') },
      ],
    },
  });
  ctx.root.add(console3d.surface);
  return {
    console: console3d,
    update() {
      if (!console3d.surface.visible) return;
      stats.set(0, `${chem().vmax.toFixed(2).replace('.', ',')}\u00a0V`);
      stats.set(1, ui.value<number>('bd-v') >= chem().vmax - 0.01 ? 'на межі' : 'заряд');
    },
  };
}
