import type { ChapterContext } from '@/engine/api';
import type { StepUiApi } from '@/hud';
import { STATUS } from '@/ui3d';

/**
 * The worst case of the step column (QA fixture of `ui-check`): a three-line title, four honesty chips, a long
 * page and a full dock — three sliders, two toggles, two segmented controls, a chart, three readouts, a gauge and
 * two buttons. Every control must stay reachable at 1280×720, 1024×768 and in portrait.
 */
export function declareOverflowStep(ctx: ChapterContext, ui: StepUiApi): void {
  const xs = Array.from({ length: 60 }, (_, k) => k / 59);
  let drawn = '';
  ui.define({
    overflow: {
      honesty: ['simplified', 'notToScale', { slowed: 1e9 }, { text: 'збільшено ×2' }],
      controls: [
        { type: 'slider', id: 'ov-a', label: 'Напруга U', min: 0, max: 400, step: 5, unit: 'V', value: 230 },
        {
          type: 'slider',
          id: 'ov-b',
          label: 'Струм I',
          min: 0,
          max: 20,
          step: 0.1,
          unit: 'A',
          digits: 1,
          value: 6,
        },
        {
          type: 'slider',
          id: 'ov-c',
          label: 'Коефіцієнт потужності cos φ',
          min: 0.5,
          max: 1,
          step: 0.01,
          digits: 2,
          value: 0.95,
        },
        { type: 'toggle', id: 'ov-t1', label: 'Втрати в лінії', value: true },
        { type: 'toggle', id: 'ov-t2', label: 'Показати фазори' },
        {
          type: 'segmented',
          id: 'ov-mode',
          label: 'Режим мережі',
          items: [
            { id: 'one', label: 'Однофазна' },
            { id: 'three', label: 'Трифазна' },
            { id: 'dc', label: 'Постійний струм' },
            { id: 'hvdc', label: 'Електромагнітна' },
          ],
          value: 'one',
        },
        {
          type: 'segmented',
          id: 'ov-load',
          items: [
            { id: 'r', label: 'R' },
            { id: 'rl', label: 'RL' },
            { id: 'rc', label: 'RC' },
          ],
        },
        {
          type: 'chart',
          id: 'ov-chart',
          chart: {
            height: 150,
            x: { min: 0, max: 1, label: 't, s' },
            y: { min: -1.2, max: 1.2, label: 'u, в. о.' },
            series: [{ id: 'u', label: 'u(t)', color: 'sky' }],
          },
          update: (chart) => {
            const key = `${ui.value('ov-a')}|${ui.value('ov-c')}`;
            if (key === drawn) return;
            drawn = key;
            const k = ui.value<number>('ov-a') / 400;
            chart.setData(
              'u',
              xs,
              xs.map((x) => k * Math.sin(2 * Math.PI * 3 * x)),
            );
          },
        },
        {
          type: 'readout',
          id: 'ov-p',
          label: 'Потужність P',
          unit: 'W',
          digits: 0,
          get: () => ui.value<number>('ov-a') * ui.value<number>('ov-b') * ui.value<number>('ov-c'),
        },
        {
          type: 'readout',
          id: 'ov-s',
          label: 'Повна S',
          unit: 'VA',
          digits: 0,
          get: () => ui.value<number>('ov-a') * ui.value<number>('ov-b'),
        },
        {
          type: 'readout',
          id: 'ov-q',
          label: 'Режим',
          text: () => (ui.value<boolean>('ov-t1') ? 'з втратами' : 'ідеальний'),
          color: () => STATUS.info,
        },
        {
          type: 'gauge',
          id: 'ov-f',
          label: 'Частота f',
          min: 49,
          max: 51,
          unit: 'Hz',
          digits: 2,
          get: () => 50 + 0.05 * Math.sin(ctx.clock.time),
        },
        {
          type: 'button',
          id: 'ov-reset',
          label: 'Скинути',
          icon: 'resetView',
          onClick: () => ui.set('ov-a', 230, { notify: true }),
        },
        {
          type: 'button',
          id: 'ov-run',
          label: 'Запустити',
          icon: 'play',
          primary: true,
          onClick: () => ui.toast('Запуск: модель працює'),
        },
      ],
    },
  });
}
