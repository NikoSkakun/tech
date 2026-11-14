/**
 * All text of the chapter. Panel pages, terms, formulas, facts, hotspot cards, misconceptions, glossary and
 * quiz come from the generated runtime content (never retyped). Control captions the document quotes «…» in
 * its «Інтерактив» items are read from `steps[].labels` (`DOC`, by position — `__tests__/labels.test.ts` pins
 * each one to the document). `labels.ts` holds the captions the export does not carry (quoted in `…` or in
 * «Бачимо») and the short scene labels.
 */
import { defineContent } from '@/content';
import raw from '@electricity/content/generated/plant-nuclear.json';
import { SCENE } from './labels';

/** The n-th «…» label of a step's «Інтерактив», in document order. */
function doc(stepId: string, n: number): string {
  const text = raw.steps.find((s) => s.id === stepId)?.labels[n];
  if (!text) throw new Error(`plant-nuclear: the document has no label ${n} in step "${stepId}"`);
  return text;
}

/** «Назва: A / B / C» switch label of the document → its title and its items. */
function titled(text: string): { title: string; items: string[] } {
  const [title = text, rest = text] = text.split(': ');
  const items = rest.split(' / ');
  return { title, items };
}

/** First letter upper-cased (the document quotes some labels mid-sentence). */
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Captions taken verbatim from the document (see the test for the expected wording). */
export const DOC = {
  lookInside: doc('overview', 0), // «Зазирнути всередину»
  slingshot: cap(doc('fission', 0)), // «рогатка»
  neutronEnergy: doc('fission', 1), // «Енергія нейтрона»
  mev: doc('fission', 2), // «MeV»
  compareBurn: doc('fission', 3), // «Порівняти з горінням»
  fourEv: doc('fission', 4), // «4 eV»
  enrichment: doc('chain-reaction', 0), // «Збагачення»
  moderator: doc('chain-reaction', 1), // «Сповільнювач (вода)»
  rods: doc('chain-reaction', 2), // «Стрижні-поглиначі»
  coreSize: doc('chain-reaction', 3), // «Розмір зони»
  launch: doc('chain-reaction', 4), // «Запустити 1 нейтрон»
  reset: doc('chain-reaction', 5), // «Скинути»
  density: cap(doc('chain-reaction', 6)), // «густина»
  noModerator: doc('chain-reaction', 7), // «Без сповільнювача ланцюг у паливі АЕС не підтримується»
  weapons: doc('chain-reaction', 8), // «Збройний уран — неможливий у паливі АЕС»
  slowDown: doc('control', 0), // «Сповільнити нейтрон»
  delayedSwitch: titled(doc('control', 1)), // «Запізнілі нейтрони: увімкнено / вимкнено (уявний світ)»
  wall: cap(doc('control', 2)), // «стіна»
  perSecond: cap(doc('control', 3)), // «у скільки разів за 1 s»
  simplified: doc('control', 4), // «спрощена модель»
  scale: doc('fuel', 0), // «Масштаб»
  coalChip: doc('fuel', 1), // «≈ 0,6 t вугілля»
  compare: doc('fuel', 2), // «Порівняти»
  coreMap: doc('fuel', 3), // «Карта зони»
  age: cap(doc('fuel', 4)), // «віком»
  reload: doc('fuel', 5), // «Перевантаження»
  cut: doc('reactor', 0), // «Розріз»
  layers: cap(doc('reactor', 1)), // «шари»
  unpower: doc('reactor', 2), // «Знеструмити приводи»
  pressure: doc('primary-loop', 0), // «Тиск у компенсаторі»
  margin: cap(doc('primary-loop', 1)), // «запас до кипіння»
  boiling: cap(doc('primary-loop', 2)), // «кипіння в першому контурі»
  circuits: doc('primary-loop', 3), // «Показати контури»
  pipeInfo: doc('primary-loop', 4), // «середовище, тиск, температура»
  simReset: doc('reactor-sim', 0), // «Скинути»
  restore: doc('reactor-sim', 1), // «Відновити роботу»
  restartNote: cap(doc('reactor-sim', 2)), // «у реальності повторний пуск триває від кількох годин до діб»
  blackout: doc('safety', 0), // «Повне знеструмлення»
  boilingRising: cap(doc('safety', 1)), // «кипіння в першому контурі, тиск росте»
  uncovering: cap(doc('safety', 2)), // «вода википає, зона оголюється — ризик пошкодження палива»
  barriers: doc('safety', 3), // «Бар’єри»
  loopsCount: cap(doc('reactor-types', 0)), // «скільки контурів»
  outletTemps: doc('reactor-types', 1), // «Порівняти температури виходу»
  year: doc('fuel-cycle', 0), // «Рік»
  howMuch: doc('fuel-cycle', 2), // «Скільки займає?»
  estimate: doc('fuel-cycle', 3), // «оцінка»
  asOf: doc('role-ukraine', 0), // «станом на …»
  share: titled(doc('role-ukraine', 1)), // «Частка АЕС: Україна / Франція / світ»
  nextHydro: doc('role-ukraine', 2), // «Далі: ГЕС»
  backGallery: doc('role-ukraine', 3), // «Назад до галереї»
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
