import { defineChapter } from '@/engine/api';

/**
 * Lab «Літій-іонні акумулятори: енергія в кишені й у підвалі» (docs/volumes/electricity/chapters/lab-battery.md) — child of `home`.
 *
 * The manifest is eager and must stay tiny, so it does not import the generated content (67 kB): step ids and
 * titles are repeated here and `__tests__/manifest.test.ts` asserts that they equal the generated copy.
 * Blurbs are menu teasers (not in the chapter document).
 */
export default defineChapter({
  id: 'lab-battery',
  order: 24,
  group: 'labs',
  parent: 'home',
  title: 'Літій-іонні акумулятори: енергія в кишені й у підвалі',
  subtitle: 'Від іона Li⁺ між шарами графіту до домашньої батареї',
  axisLabel: '10⁻¹⁰…10⁰ m',
  axisValue: -1,
  theme: { accent: 'lime', sky: 'studio', mood: 'studio' },
  steps: [
    {
      id: 'what-is-battery',
      title: 'Хімія, що віддає електрони за розкладом',
      blurb: 'Два метали, електроліт і дріт: звідки береться напруга.',
    },
    {
      id: 'cell-anatomy',
      title: 'Будова літій-іонної комірки: рулет із фольги',
      blurb: 'Розмотуємо комірку 21700 шар за шаром.',
    },
    {
      id: 'intercalation',
      title: 'Інтеркаляція: крісло-гойдалка для іонів',
      blurb: 'Іони Li⁺ гойдаються між графітом і катодом.',
    },
    { id: 'why-lithium', title: 'Чому саме літій', blurb: 'Найлегший метал на терезах енергії.' },
    {
      id: 'chemistries',
      title: 'Хімії катода: від кобальту до заліза — і що далі',
      blurb: 'Вітрина катодів: енергія, ресурс, безпека, ціна.',
    },
    {
      id: 'voltage-capacity',
      title: 'Напруга, ємність, кратність струму і крива розряду',
      blurb: 'Розряджаємо дві комірки на стенді.',
    },
    {
      id: 'charging',
      title: 'Заряд у дві фази: швидко, але не бездумно',
      blurb: 'Сталий струм, стала напруга і мороз.',
    },
    {
      id: 'pack',
      title: 'Батарея з комірок: конструктор sS·pP',
      blurb: 'Збираємо батарею для інвертора ЛІ-6.',
    },
    {
      id: 'bms',
      title: 'Система керування батареєю: мозок і охоронець',
      blurb: 'Захисти, балансування і розмова з інвертором.',
    },
    {
      id: 'degradation',
      title: 'Старіння: плівка, осадження літію, тріщини і залишкова ємність',
      blurb: 'Машина часу: що з’їдає ємність.',
    },
    {
      id: 'safety',
      title: 'Тепловий розгін: коли батарея гріє сама себе',
      blurb: 'Піч безпеки: нікелева комірка проти залізо-фосфатної.',
    },
    {
      id: 'scale-and-future',
      title: 'Від телефона до мегаватгодин: масштаб, ціна, переробка',
      blurb: 'Від 15 Wh у кишені до гігават-годин.',
    },
  ],
  load: () => import('./scene'),
  emblem: () => import('./emblem'),
});
