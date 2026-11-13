/**
 * Settings overlay: reading level («Просто / Докладно»), quality tier, sound, reduced motion, text size, dynamic resolution, reset progress.
 * Everything writes straight to the engine store (persisted in localStorage by the engine).
 */
import { clearedProgress, fmtPercent, READING_LEVELS, type ReadingLevel } from '@/content';
import { Button, Divider, Slider, Tabs, Toggle, UiNode } from '@/ui3d';
import type { Hud, Overlay } from '../shell';
import { createModal, field } from './modal';

const TIER_NAME: Record<string, string> = {
  low: 'низька',
  medium: 'середня',
  high: 'висока',
  ultra: 'ультра',
  mobile: 'мобільна',
};

export function createSettings(hud: Hud): Overlay {
  const store = hud.engine.store;
  return createModal(hud, {
    title: 'Налаштування',
    icon: 'settings',
    width: 600,
    fresh: true,
    build(body) {
      const s = store.get().settings;
      // segments `reading-level:simple` / `reading-level:detailed` for QA
      const level = new Tabs({
        name: 'reading-level',
        items: READING_LEVELS.map((l) => ({ id: l.id, label: l.label })),
        value: hud.engine.readingLevel(),
        onChange: (id) => hud.engine.setReadingLevel(id as ReadingLevel),
      });
      // phones and tablets: «Авто» means the mobile tier there, and it can be picked by name; the heaviest
      // desktop tier is not offered (a desktop sees the five choices it always had)
      const touch = hud.engine.device.formFactor !== 'desktop';
      const quality = new Tabs({
        items: touch
          ? [
              { id: 'auto', label: 'Авто' },
              { id: 'mobile', label: 'Мобільна' },
              { id: 'low', label: 'Низька' },
              { id: 'medium', label: 'Середня' },
              { id: 'high', label: 'Висока' },
            ]
          : [
              { id: 'auto', label: 'Авто' },
              { id: 'low', label: 'Низька' },
              { id: 'medium', label: 'Середня' },
              { id: 'high', label: 'Висока' },
              { id: 'ultra', label: 'Ультра' },
            ],
        value: s.quality,
        onChange: (id) => hud.engine.setQuality(id as typeof s.quality),
      });
      const motion = new Tabs({
        items: [
          { id: 'auto', label: 'Як у системі' },
          { id: 'on', label: 'Менше руху' },
          { id: 'off', label: 'Повна анімація' },
        ],
        value: s.reducedMotion === 'auto' ? 'auto' : s.reducedMotion ? 'on' : 'off',
        onChange: (id) => store.updateSettings({ reducedMotion: id === 'auto' ? 'auto' : id === 'on' }),
      });
      const sizes = [0.9, 1, 1.15, 1.3];
      const text = new Tabs({
        items: [
          { id: '0', label: 'Менший' },
          { id: '1', label: 'Звичайний' },
          { id: '2', label: 'Більший' },
          { id: '3', label: 'Великий' },
        ],
        value: String(
          Math.max(
            0,
            sizes.findIndex((v) => Math.abs(v - s.textScale) < 0.04),
          ),
        ),
        onChange: (id) => store.updateSettings({ textScale: sizes[Number(id)] ?? 1 }),
      });
      const volume = new Slider({
        label: 'Гучність',
        min: 0,
        max: 1,
        step: 0.05,
        value: s.volume,
        format: (v) => fmtPercent(v),
        onChange: (v) => store.updateSettings({ volume: v }),
      });
      volume.disabled = !s.audio;
      const sound = new Toggle({ label: 'Звук', value: s.audio, onChange: (on) => {
        store.updateSettings({ audio: on });
        volume.disabled = !on;
      } }); // prettier-ignore
      const dynamic = new Toggle({
        label: 'Знижувати роздільну здатність, якщо кадри не встигають',
        value: s.dynamicResolution,
        onChange: (on) => store.updateSettings({ dynamicResolution: on }),
      });
      let armed = false;
      const reset: Button = new Button({
        label: 'Скинути прогрес',
        icon: 'resetView',
        onClick: () => {
          if (!armed) {
            armed = true;
            reset.label = 'Натисніть ще раз, щоб підтвердити';
            hud.host.tweens.delay(4, () => {
              armed = false;
              reset.label = 'Скинути прогрес';
            });
            return;
          }
          store.set(clearedProgress());
          armed = false;
          reset.label = 'Скинути прогрес';
          hud.toast('Прогрес скинуто.', { tone: 'ok', duration: 3 });
        },
      });
      const frames = new Tabs({
        items: [
          { id: 'auto', label: 'Авто' },
          { id: '60', label: 'Повна' },
          { id: '30', label: '30 кадрів/с' },
        ],
        value: String(s.frameCap),
        onChange: (id) => store.updateSettings({ frameCap: id === 'auto' ? 'auto' : id === '30' ? 30 : 60 }),
      });
      const tierNow = TIER_NAME[store.get().quality] ?? store.get().quality;
      body.add(
        field(
          'Рівень тексту',
          level,
          '«Просто» — коротко і без формул. Де простого тексту ще немає, буде докладний.',
        ),
        field(
          'Якість графіки',
          quality,
          touch
            ? `Зараз: ${tierNow}. «Авто» на телефоні й планшеті — мобільний рівень: менше ефектів, довше тримає заряд.`
            : `Зараз: ${tierNow}. «Авто» обирає рівень за швидкістю відеокарти.`,
        ),
      );
      if (touch)
        body.add(
          field(
            'Частота кадрів',
            frames,
            '30 кадрів/с — рівніше й прохолодніше на слабших пристроях. «Авто» вмикає це саме, якщо кадри не встигають.',
          ),
        );
      body.add(
        field('Розмір тексту', text),
        field('Анімація', motion, '«Менше руху» скорочує польоти камери й вимикає паралакс.'),
        new Divider(),
        new UiNode({ dir: 'col', gap: 4, width: 'fill', children: [sound, volume] }),
        dynamic,
        new Divider(),
        new UiNode({ dir: 'row', justify: 'between', align: 'center', width: 'fill', children: [reset] }),
      );
    },
  });
}
