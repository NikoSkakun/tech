/**
 * All text of the chapter. Panel pages, terms, formulas, facts, hotspot cards, misconceptions, glossary and
 * quiz come from the generated runtime content (never retyped). Control captions the document quotes «…» in
 * its «Інтерактив» items are read from `steps[].labels` (`DOC`, by position — `__tests__/labels.test.ts` pins
 * every one of them to the document). `labels.ts` holds the short scene labels the document does not carry.
 */
import { defineContent } from '@/content';
import raw from '@electricity/content/generated/plant-hydro.json';
import { SCENE } from './labels';

/** The n-th «…» label of a step's «Інтерактив», in document order. */
function doc(stepId: string, n: number): string {
  const text = raw.steps.find((s) => s.id === stepId)?.labels[n];
  if (!text) throw new Error(`plant-hydro: the document has no label ${n} in step "${stepId}"`);
  return text;
}

/** First letter upper-cased (the document quotes some labels mid-sentence). */
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Captions taken verbatim from the document (see the test for the expected wording). */
export const DOC = {
  level: doc('overview', 0), // «Рівень водосховища»
  homes: cap(doc('water-energy', 0)), // «скільки осель живить»
  estimate: doc('water-energy', 1), // «оцінка»
  presetGorges: doc('water-energy', 3), // «Три ущелини (агрегат)»
  presetDnipro: doc('water-energy', 4), // «ДніпроГЕС (агрегат, ≈)»
  presetPelton: doc('water-energy', 5), // «Гірська ковшова»
  presetSmall: doc('water-energy', 6), // «Мала ГЕС у Карпатах»
  waterLevel: doc('dams', 0), // «Рівень води»
  gate: doc('water-path', 0), // «Відкриття напрямного апарата»
  trip: doc('water-path', 1), // «Аварійне закриття»
  hammer: doc('water-path', 2), // «гідроудар!»
  surgeTank: doc('water-path', 4), // «Зрівняльний резервуар»
  stationModel: doc('water-path', 5), // «умовна станція · спрощена модель»
  yourPlant: doc('turbines', 0), // «ваша ГЕС»
  chosen: doc('turbines', 1), // «вибрано»
  load: doc('turbines', 2), // «Навантаження»
  illustrativeCurves: doc('turbines', 3), // «ілюстративні криві»
  vortex: cap(doc('turbines', 4)), // «вихровий джгут, вібрації»
  polePairs: doc('generator-governor', 0), // «Пари полюсів»
  likeTurbo: doc('generator-governor', 1), // «як турбогенератор»
  sharp: doc('generator-governor', 2), // «Різко відкрити напрямний апарат»
  smooth: doc('generator-governor', 3), // «Плавно»
  blackStart: doc('generator-governor', 4), // «Блекаут → пуск з нуля»
  inflow: doc('reservoir-environment', 0), // «Приплив води»
  storm: doc('reservoir-environment', 1), // «Злива»
  spillMode: doc('reservoir-environment', 2), // «Водоскид: авто/вручну»
  forced: cap(doc('reservoir-environment', 3)), // «форсований рівень»
  overtop: cap(doc('reservoir-environment', 4)), // «перелив греблі!»
  auto: doc('reservoir-environment', 5), // «авто»
  stormModel: doc('reservoir-environment', 6), // «умовна станція · 1 s = 1 h»
  pshModel: doc('pumped-storage', 0), // «умовна станція»
  autoPlan: doc('pumped-storage', 1), // «Автоплан»
  playDay: doc('pumped-storage', 2), // «Відтворити добу»
  profit: cap(doc('pumped-storage', 3)), // «прибуток»
  asOf: doc('role-ukraine', 0), // «станом на …»
  waterYear: doc('role-ukraine', 1), // «Водний рік: посушливий / середній / багатоводний»
  illustration: doc('role-ukraine', 2), // «ілюстрація»
  nextWind: doc('role-ukraine', 3), // «Далі: вітрова станція»
  backGallery: doc('role-ukraine', 4), // «Назад до галереї»
} as const;

/** «Водоскид: авто/вручну» → caption and the two modes; «Водний рік: a / b / c» → caption and items. */
export function splitCaption(text: string, sep: string): { label: string; items: string[] } {
  const [label = text, rest = ''] = text.split(': ');
  return { label, items: rest.split(sep).map((s) => s.trim()) };
}

/** Everything the step modules print: document captions + the chapter's own scene labels. */
export const L = { ...DOC, ...SCENE } as const;

export default defineContent(raw, {
  labels: Object.fromEntries(Object.entries(L).filter(([, v]) => typeof v === 'string')) as Record<
    string,
    string
  >,
});

/** Addresses of the document's cross-reference whose `where` mentions `mark` (full `volume/chapter/step`). */
export function crossTargets(mark: string): readonly string[] {
  return raw.crossReferences.find((x) => x.where.includes(mark))?.targets ?? [];
}

/** The «Цифри і факти» table of a step (step 9: the stations of Ukraine), as exported. */
export function factTable(stepId: string): { head: string[]; rows: string[][]; note?: string } | null {
  const step = raw.steps.find((s) => s.id === stepId) as
    { facts?: { items?: { table?: { head: string[]; rows: string[][]; note?: string } }[] } } | undefined;
  return step?.facts?.items?.find((i) => i.table)?.table ?? null;
}
