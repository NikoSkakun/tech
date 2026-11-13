/**
 * All text of the chapter. Panel pages, terms, formulas, facts, hotspot cards, misconceptions, glossary and
 * quiz come from the generated runtime content (never retyped). Control captions the document quotes «…» in
 * its «Інтерактив» items are read from `steps[].labels` (`DOC`, by position — `__tests__/labels.test.ts` pins
 * every one of them to the document). `labels.ts` holds the short scene labels the document does not carry.
 */
import { defineContent } from '@/content';
import raw from '@electricity/content/generated/plant-wind.json';
import { SCENE } from './labels';

/** The n-th «…» label of a step's «Інтерактив», in document order. */
function doc(stepId: string, n: number): string {
  const text = raw.steps.find((s) => s.id === stepId)?.labels[n];
  if (!text) throw new Error(`plant-wind: the document has no label ${n} in step "${stepId}"`);
  return text;
}

/** «A / B» switch label of the document → its two halves. */
function halves(text: string): [string, string] {
  const [a = text, b = text] = text.split(' / ');
  return [a, b];
}

/** First letter upper-cased (the document quotes some labels mid-sentence). */
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Captions taken verbatim from the document (see the test for the expected wording). */
export const DOC = {
  turbineTip: doc('overview', 0), // «Вітрова турбіна · 6 MW»
  dayNight: doc('overview', 1), // «День / Ніч»
  double: doc('wind-power', 1), // «×2 швидкості»
  betzChip: doc('betz', 2), // «Межа Беца 59,3 %»
  betzModel: doc('betz', 3), // «спрощена модель: ідеальний диск»
  glide: cap(doc('blade', 1).replace(/`/g, '')), // «якість профілю C_L/C_D»
  span: cap(doc('blade', 2)), // «позиція вздовж лопаті»
  energyPath: doc('nacelle', 0), // «Шлях енергії»
  total: doc('nacelle', 1), // «разом ≈ 90–93 %»
  cutaway: doc('nacelle', 2), // «Розріз / Зовнішній вигляд»
  movingParts: cap(doc('drivetrain', 1)), // «кількість рухомих частин»
  converterShare: cap(doc('drivetrain', 2)), // «частка потужності через перетворювач»
  gust: doc('power-curve', 0), // «Порив»
  storm: doc('power-curve', 1), // «Шторм»
  stormChip: doc('power-curve', 2), // «Захист від шторму»
  stormModes: halves(doc('power-curve', 3)), // «Пряме вимкнення / Штормове регулювання»
  farmEff: doc('wind-farm', 1), // «Ефективність ВЕС = ΣP / (N·P_одинокої)»
  steering: doc('wind-farm', 2), // «Керування слідом»
  steeringHint: cap(doc('wind-farm', 3)), // «керування слідом вмикають тільки для „поганих“ напрямків»
  wakeModel: doc('wind-farm', 4), // «спрощена модель сліду»
  cf: doc('capacity-factor', 0), // «КВВП, %»
  aep: doc('capacity-factor', 1), // «Річний виробіток, GWh»
  hubHeight: cap(doc('capacity-factor', 2)), // «висота маточини»
  terrainSea: doc('capacity-factor', 3), // «море α=0,10»
  terrainSteppe: doc('capacity-factor', 4), // «степ α=0,14»
  terrainForest: doc('capacity-factor', 5), // «ліс α=0,25»
  dayOfYear: cap(doc('capacity-factor', 8)), // «день року»
  depth: doc('offshore', 0), // «Глибина»
  shoreDistance: doc('offshore', 1), // «Відстань до берега»
  compare: doc('offshore', 3), // «Порівняти розміри»
  gridModes: halves(doc('role', 1)), // «Мережевідомий / Мережоформувальний»
  simplifiedChip: doc('role', 2), // «спрощено»
} as const;

/** Everything the step modules print: document captions + the chapter's own scene labels. */
export const L = { ...DOC, ...SCENE } as const;

export default defineContent(raw, { labels: Object.fromEntries(Object.entries(L).filter(([, v]) => typeof v === 'string')) as Record<string, string> });

/** Addresses of the document's cross-reference whose `where` mentions `mark` (full `volume/chapter/step`). */
export function crossTargets(mark: string): readonly string[] {
  return raw.crossReferences.find((x) => x.where.includes(mark))?.targets ?? [];
}
