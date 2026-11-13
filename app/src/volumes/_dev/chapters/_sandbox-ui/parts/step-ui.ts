import type { Object3D } from 'three';
import type { ChapterContext } from '@/engine/api';
import { stepUi, type StepUiApi } from '@/hud';
import { STATUS } from '@/ui3d';

/** Single-diode-like I-V curve of the lab module «ЛМ-440» (V_oc 39,4 V, I_sc 13,9 A) — illustrative. */
function current(u: number, g: number): number {
  return Math.max(13.9 * g * (1 - Math.exp((u - 39.4) / 2.6)), 0);
}

/** Operating point for a load resistance R: intersection of I = U/R with the curve (bisection on U). */
function operatingPoint(r: number, g: number): { u: number; i: number; p: number } {
  let lo = 0;
  let hi = 39.4;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (current(mid, g) > mid / r) lo = mid;
    else hi = mid;
  }
  const u = (lo + hi) / 2;
  const i = current(u, g);
  return { u, i, p: u * i };
}

/** The declarative step UI of the sandbox: the same API every chapter uses. */
export function declareStepUi(ctx: ChapterContext, parts: { core: Object3D; ring: Object3D }): StepUiApi {
  const ui = stepUi(ctx);
  const point = (): { u: number; i: number; p: number } =>
    operatingPoint(ui.value('R'), ui.value<number>('G') / 1000);
  const us = Array.from({ length: 100 }, (_, k) => (39.4 * k) / 99);
  let drawn = '';
  ui.define({
    controls: {
      hint: 'Покрутіть реостат і знайдіть максимум потужності',
      honesty: ['simplified', { slowed: 50 }],
      controls: [
        {
          type: 'slider',
          id: 'R',
          label: 'Опір навантаження R',
          min: 0.05,
          max: 1000,
          scale: 'log',
          step: 3,
          unit: 'Ω',
          value: 10,
          snaps: [2.48],
          hint: 'Логарифмічна шкала: 0,05…1000 Ω',
        },
        {
          type: 'slider',
          id: 'G',
          label: 'Освітленість G',
          min: 100,
          max: 1200,
          step: 50,
          unit: 'W/m²',
          value: 1000,
          marks: [{ value: 1000, label: 'STC' }],
        },
        { type: 'toggle', id: 'line', label: 'Лінія навантаження', value: true },
        {
          type: 'segmented',
          id: 'view',
          items: [
            { id: 'iv', label: 'I-V' },
            { id: 'pv', label: 'P-V' },
            { id: 'both', label: 'Обидві' },
          ],
          value: 'both',
        },
        {
          type: 'chart',
          id: 'curve',
          chart: {
            height: 190,
            x: { min: 0, max: 45, label: 'U, V' },
            y: { min: 0, max: 16, label: 'I, A' },
            y2: { min: 0, max: 500, label: 'P, W' },
            series: [
              { id: 'iv', label: 'I(U)', color: 'sky' },
              { id: 'pv', label: 'P(U)', color: 'yellow', axis: 'y2' },
              { id: 'load', color: 'cyan', width: 1.6 },
            ],
          },
          update: (chart) => {
            const g = ui.value<number>('G') / 1000;
            const view = ui.value<string>('view');
            // rebuild the curves only when an input changed (the dock calls this every frame)
            const key = `${g}|${view}|${ui.value<number>('R')}|${ui.value<boolean>('line')}`;
            if (key === drawn) return;
            drawn = key;
            chart.setData('iv', us, view === 'pv' ? [] : us.map((u) => current(u, g)));
            chart.setData('pv', us, view === 'iv' ? [] : us.map((u) => u * current(u, g)));
            const op = point();
            chart.setData('load', [0, 45], ui.value<boolean>('line') ? [0, 45 / ui.value<number>('R')] : []);
            chart.setMarker('op', { x: op.u, y: op.i, color: 'white' });
          },
        },
        { type: 'readout', id: 'U', label: 'Напруга U', unit: 'V', digits: 1, get: () => point().u },
        { type: 'readout', id: 'I', label: 'Струм I', unit: 'A', digits: 2, get: () => point().i },
        {
          type: 'readout',
          id: 'P',
          label: 'Потужність P',
          unit: 'W',
          digits: 0,
          get: () => point().p,
          color: (p) => (p > 400 ? STATUS.ok : 'white'),
        },
        {
          type: 'button',
          id: 'mpp',
          label: 'До MPP',
          icon: 'target',
          primary: true,
          onClick: () => ui.set('R', 2.48),
        },
        {
          type: 'button',
          id: 'reset',
          label: 'Скинути',
          icon: 'resetView',
          onClick: () => {
            ui.set('R', 10);
            ui.set('G', 1000);
          },
        },
      ],
    },
    readouts: {
      honesty: ['illustrative'],
      controls: [
        {
          type: 'gauge',
          id: 'f',
          label: 'Частота f',
          min: 49,
          max: 51,
          unit: 'Hz',
          digits: 2,
          get: () => 50 + 0.12 * Math.sin(ctx.clock.time * 0.9),
          zones: [
            { from: 49, to: 49.8, color: STATUS.alarm },
            { from: 49.8, to: 50.2, color: STATUS.ok },
            { from: 50.2, to: 51, color: STATUS.alarm },
          ],
        },
        {
          type: 'gauge',
          id: 'soc',
          kind: 'linear',
          label: 'Рівень заряду (SOC)',
          min: 0,
          max: 100,
          unit: '%',
          digits: 0,
          get: () => 60 + 30 * Math.sin(ctx.clock.time * 0.3),
        },
      ],
    },
    world: {
      honesty: ['notToScale'],
      hint: 'Натисніть гарячу точку або покрутіть оберти на консолі',
      callouts: [
        { anchor: parts.core, text: 'Ротор', color: 'coral', side: 'left' },
        {
          anchor: () => parts.ring.localToWorld(parts.ring.position.clone().set(2.2, 0, 0)),
          text: 'Обмотка статора',
          occluders: [parts.core],
        },
      ],
      hotspots: [
        {
          anchor: [0, 1.25, 0],
          title: 'Контактні кільця',
          text: 'Через кільця і щітки на обмотку ротора подається постійний струм збудження: саме він створює магнітне поле, що обертається разом із ротором.',
        },
      ],
    },
  });
  return ui;
}
