/**
 * All text of the chapter. Panel pages, terms, formulas, facts, hotspot cards, misconceptions, glossary and
 * quiz come from the generated runtime content (never retyped). Control captions the document quotes «…» in
 * its «Інтерактив» items are read from `steps[].labels` (`DOC`, by position — `__tests__/labels.test.ts` pins
 * every one of them to the document). `labels.ts` holds what the export does not carry: the document's
 * `code`-quoted switch items (`QUOTED`, also pinned by the test) and the chapter's own short scene labels.
 */
import { defineContent } from '@/content';
import raw from '@electricity/content/generated/plant-gas.json';
import { SCENE } from './labels';

/** The n-th «…» label of a step's «Інтерактив», in document order. */
function doc(stepId: string, n: number): string {
  const text = raw.steps.find((s) => s.id === stepId)?.labels[n];
  if (!text) throw new Error(`plant-gas: the document has no label ${n} in step "${stepId}"`);
  return text;
}

/** First letter upper-cased (the document quotes some labels mid-sentence). */
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Captions taken verbatim from the document (see the test for the expected wording). */
export const DOC = {
  islandMode: doc('overview', 0), // «Режим острова»
  fuel: doc('natural-gas', 0), // «Паливо»
  reaction: cap(doc('natural-gas', 1)), // «реакція»
  energyPerKg: cap(doc('natural-gas', 2)), // «енергія на kg»
  co2PerGJ: doc('natural-gas', 3), // «CO₂ на GJ»
  cubicMetre: doc('natural-gas', 4), // «1 m³ газу»
  cut: doc('gas-turbine', 0), // «Розрізати»
  jetEngine: doc('gas-turbine', 1), // «Порівняти з авіадвигуном»
  airFor500: cap(doc('brayton-sim', 0)), // «витрата повітря для 500 MW»
  classE: doc('brayton-sim', 1), // «Клас E (1990-ті)»
  classF: doc('brayton-sim', 2), // «Клас F»
  classHJ: doc('brayton-sim', 3), // «Клас H/J (2020-ті)»
  aero: doc('brayton-sim', 4), // «Авіапохідна»
  beyondMaterials: cap(doc('brayton-sim', 5)), // «за межами сучасних матеріалів»
  barelyRuns: cap(doc('brayton-sim', 6)), // «машина ледве тягне сама себе»
  thermometer: cap(doc('hot-section', 0)), // «термометр шарів»
  melting: cap(doc('hot-section', 1)), // «оплавлення»
  restore: doc('hot-section', 2), // «Відновити»
  tit: doc('hot-section', 3), // «TIT»
  hrsg: doc('combined-cycle', 0), // «Котел-утилізатор»
  levels: doc('combined-cycle', 1), // «Кількість рівнів тиску»
  firing: doc('combined-cycle', 2), // «Допалювання»
  startAll: doc('flexibility', 0), // «Старт усім»
  standstill: doc('flexibility', 1), // «Скільки годин стояла ПГУ»
  trip: doc('flexibility', 2), // «Аварія: вимкнувся блок 1000 MW»
  rescue: cap(doc('flexibility', 3)), // «рятують»
  strokeByStroke: doc('gas-engines', 0), // «Такт за тактом»
  districtMap: doc('gas-engines', 1), // «Мапа району»
  unitFails: doc('gas-engines', 2), // «Подія: одна установка вийшла з ладу»
  oneStation: cap(doc('gas-engines', 3)), // «одна станція»
  twentyUnits: doc('gas-engines', 4), // «20 установок»
  offShare: cap(doc('gas-engines', 5)), // «відключені споживачі %»
  heatToCity: doc('gas-engines', 6), // «Тепло місту»
  plantEta: doc('emissions-hydrogen', 0), // «ККД станції»
  leaks: doc('emissions-hydrogen', 1), // «Витоки метану»
  cloud: cap(doc('emissions-hydrogen', 2)), // «хмара»
  ghost: cap(doc('emissions-hydrogen', 3)), // «примара»
  hydrogen: doc('emissions-hydrogen', 4), // «Водень у суміші, % за об’ємом»
  h2Available: cap(doc('emissions-hydrogen', 5)), // «доступно на сучасних ГТ, готових до водню»
  h2Development: cap(doc('emissions-hydrogen', 6)), // «у розробці/демонстраціях»
  asOf: doc('role', 0), // «станом на 2026 р.»
  nextNuclear: doc('role', 1), // «Далі: атомна станція»
  backToGallery: doc('role', 2), // «Назад до галереї»
} as const;

/** Everything the step modules print: document captions + the chapter's own scene labels. */
export const L = { ...DOC, ...SCENE } as const;

export default defineContent(raw, { labels: Object.fromEntries(Object.entries(L).filter(([, v]) => typeof v === 'string')) as Record<string, string> });

/** Addresses of the document's cross-reference whose `where` mentions `mark` (full `volume/chapter/step`). */
export function crossTargets(mark: string): readonly string[] {
  return raw.crossReferences.find((x) => x.where.includes(mark))?.targets ?? [];
}
