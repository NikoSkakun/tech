/**
 * docs/UI_API.md example 1 — the standard step UI of a chapter: content from `content.ts`, controls, readouts,
 * a live chart, honesty chips, callouts and a hotspot, all declared per step. Type-checked with the app.
 */
import type { Object3D } from 'three';
import type { ChapterContext } from '@/engine/api';
import { stepUi } from '@/hud';
import { STATUS } from '@/ui3d';

/** Ohm's law for the demo circuit. */
const current = (u: number, r: number): number => u / r;

export function declareUi(
  ctx: ChapterContext,
  parts: { lamp: Object3D; battery: Object3D; wire: Object3D },
): void {
  const ui = stepUi(ctx);
  ui.define({
    ohm: {
      hint: 'Змініть опір і стежте за струмом',
      honesty: ['simplified', { slowed: 1000 }],
      controls: [
        { type: 'slider', id: 'U', label: 'Напруга U', min: 0, max: 12, step: 0.5, unit: 'V', value: 9 },
        {
          type: 'slider',
          id: 'R',
          label: 'Опір R',
          min: 1,
          max: 1000,
          scale: 'log',
          step: 2,
          unit: 'Ω',
          value: 100,
          snaps: [100],
        },
        { type: 'toggle', id: 'closed', label: 'Коло замкнене', value: true },
        {
          type: 'segmented',
          id: 'view',
          items: [
            { id: 'flow', label: 'Потік' },
            { id: 'heat', label: 'Тепло' },
          ],
        },
        {
          type: 'readout',
          id: 'I',
          label: 'Струм I',
          unit: 'mA',
          digits: 1,
          get: () => (ui.value<boolean>('closed') ? current(ui.value('U'), ui.value('R')) * 1000 : 0),
          color: (i) => (i > 500 ? STATUS.alarm : i > 200 ? STATUS.warning : 'white'),
        },
        {
          type: 'chart',
          id: 'iv',
          chart: {
            height: 170,
            x: { min: 0, max: 12, label: 'U, V' },
            y: { min: 0, max: 0.2, label: 'I, A' },
            series: [{ id: 'line', color: 'yellow' }],
          },
          update: (chart) => {
            const r = ui.value<number>('R');
            chart.setData('line', [0, 12], [0, current(12, r)]);
            chart.setMarker('now', { x: ui.value('U'), y: current(ui.value('U'), r), color: 'white' });
          },
        },
        {
          type: 'button',
          id: 'reset',
          label: 'Скинути',
          icon: 'resetView',
          onClick: () => {
            ui.set('U', 9);
            ui.set('R', 100);
          },
        },
      ],
      callouts: [
        { anchor: parts.battery, text: 'Батарея', side: 'left' },
        { anchor: parts.lamp, text: 'Лампа розжарення', occluders: [parts.wire] },
      ],
      hotspots: [{ anchor: parts.wire, content: 'conductor' }], // card title and text: step content → hotspots[id]
    },
  });
  // react to a control directly (most scenes just read ui.value() in update())
  ui.onChange('closed', (on) => (parts.lamp.visible = Boolean(on)));
}
