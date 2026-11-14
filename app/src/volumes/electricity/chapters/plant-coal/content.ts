/**
 * All text of the chapter. Panel pages, terms, formulas, facts, hotspot cards, misconceptions, glossary and
 * quiz come from the generated runtime content (never retyped). Control captions the document quotes «…» in
 * its «Інтерактив» items are read from `steps[].labels` (`DOC`, by position — `__tests__/labels.test.ts` pins
 * each one to the document). `labels.ts` holds the words the document writes as `code` items (segment names)
 * and the chapter's own short scene labels.
 */
import { defineContent } from '@/content';
import raw from '@electricity/content/generated/plant-coal.json';
import { SCENE } from './labels';

/** The n-th «…» label of a step's «Інтерактив», in document order. */
function doc(stepId: string, n: number): string {
  const text = raw.steps.find((s) => s.id === stepId)?.labels[n];
  if (!text) throw new Error(`plant-coal: the document has no label ${n} in step "${stepId}"`);
  return text;
}

/** «A / B» switch label → its two halves («Регенерація: увімкнено / вимкнено» → prefix + both states). */
function halves(text: string): [string, string] {
  const [a = text, b = text] = text.split(' / ');
  return [a, b];
}

/** First letter upper-cased (the document quotes some labels mid-sentence). */
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Captions taken verbatim from the document (the test pins the expected wording). */
export const DOC = {
  goToStep: doc('overview', 0), // «Перейти до кроку…»
  timeOfDay: doc('overview', 1), // «Час доби»
  coalType: doc('coal', 0), // «Тип вугілля»
  wagonsQuestion: cap(doc('coal', 2)), // «скільки вагонів на добу потрібно блоку 1000 MW з ККД 40 %»
  fineness: doc('coal-to-dust', 0), // «Тонкість помелу»
  unburnt: cap(doc('coal-to-dust', 2)), // «недопал (втрата з горючими в золі)»
  hair: doc('coal-to-dust', 4), // «Порівняти з волосиною»
  showPath: doc('boiler', 0), // «Показати шлях»
  noWalls: doc('boiler', 2), // «Без екранів»
  pressure: doc('steam-params', 0), // «Тиск пари»
  temperature: doc('steam-params', 1), // «Температура»
  presetOld200: doc('steam-params', 4), // «Старий блок 200 MW (Україна)»
  preset300: doc('steam-params', 5), // «Блок 300 MW (Україна)»
  presetUsc: doc('steam-params', 6), // «Ультранадкритичний 1000 MW»
  presetPingshan: doc('steam-params', 7), // «Pingshan II»
  wetness: cap(doc('turbine', 0)), // «вологість»
  simplified: doc('turbine', 1), // «спрощена модель»
  load: doc('turbine', 2), // «Навантаження»
  regen: halves(doc('feedwater', 0)), // «Регенерація: увімкнено / вимкнено»
  coolingWater: doc('feedwater', 2), // «Температура охолоджувальної води»
  coal: doc('flue-gas', 0), // «Вугілля»
  euLimit: cap(doc('flue-gas', 1)), // «норма ЄС»
  byproducts: cap(doc('flue-gas', 2)), // «побічні продукти»
  ccs: halves(doc('ash-co2', 0)), // «Уловлювання CO₂: вимкнено / увімкнено»
  unitEta: doc('ash-co2', 2), // «ККД блока»
  heatToCity: doc('chp-flex', 0), // «Тепло місту»
  morningPeak: doc('chp-flex', 2), // «Ранковий пік»
  gapFillers: cap(doc('chp-flex', 4)), // «цю діру закриють ГЕС, ГАЕС, газ або батареї»
  occupied: doc('role-ukraine', 0), // «окупована з 2022 р.»
  destroyed: doc('role-ukraine', 1), // «зруйнована 11.04.2024»
  asOf: doc('role-ukraine', 2), // «станом на 2026 р.»
  worldShare: doc('role-ukraine', 3), // «Світ: частка вугілля в генерації»
  nextGas: doc('role-ukraine', 5), // «Далі: газові станції»
  backToGallery: doc('role-ukraine', 6), // «Назад до галереї»
} as const;

/** Everything the step modules print: document captions + the chapter's own scene labels. */
export const L = { ...DOC, ...SCENE } as const;

export default defineContent(raw, {
  labels: Object.fromEntries(Object.entries(L).filter(([, v]) => typeof v === 'string')) as Record<string, string>,
});

/** Addresses of the document's cross-reference whose `where` mentions `mark` (full `volume/chapter/step`). */
export function crossTargets(mark: string): readonly string[] {
  return raw.crossReferences.find((x) => x.where.includes(mark))?.targets ?? [];
}
