/**
 * Scene and control labels of the chapter.
 *
 * `DOC` — captions the chapter document quotes «…» in its «Інтерактив» texts. They are read from the generated
 * content (`steps[].labels`, document order) and never retyped; `__tests__/labels.test.ts` pins the indexes.
 * `OWN` — labels the document does not carry (part names, axis titles, short captions). Plain Ukrainian
 * (DECISIONS §54); symbols and units international.
 */
import raw from '@electricity/content/generated/current.json';
import type { StepId } from './chapter';

const labelsOf = (step: StepId): readonly string[] => raw.steps.find((s) => s.id === step)?.labels ?? [];

/** Label `index` of the step's quoted captions (document order). */
function pick(step: StepId, index: number): string {
  const text = labelsOf(step)[index];
  if (text === undefined)
    throw new Error(`current: label ${step}[${index}] is missing in the generated content`);
  return text;
}
/** A quoted list «A | B | C» as its items. */
const list = (step: StepId, index: number): string[] => pick(step, index).split(' | ');

export const DOC = {
  // 1 current
  currentSlider: pick('current', 0),
  labSupply1: pick('current', 1),
  fractionChip: pick('current', 3),
  showElectrons: pick('current', 4),
  // 2 drift
  electronTime: pick('drift', 0),
  signalTime: pick('drift', 1),
  race: pick('drift', 2),
  slowedChip: pick('drift', 3),
  balls: pick('drift', 4),
  // 3 source-emf
  water: pick('source-emf', 0),
  analogyChip: pick('source-emf', 2),
  pumpForce: pick('source-emf', 3),
  labSupply: pick('source-emf', 4),
  same: pick('source-emf', 5),
  // 4 ohm
  cc: pick('ohm', 0),
  materials: list('ohm', 1),
  samples: list('ohm', 3),
  record: pick('ohm', 6),
  clear: pick('ohm', 7),
  // 5 circuit
  switch: pick('circuit', 0),
  noFuse: pick('circuit', 1),
  fuseScope: pick('circuit', 2),
  fuse: pick('circuit', 3),
  overheat: pick('circuit', 4),
  newFuse: pick('circuit', 5),
  // 6 power
  scrubTime: pick('power', 0),
  carLifts: pick('power', 1),
  boil: pick('power', 2),
  // 7 series-parallel
  presets: [0, 1, 2, 3, 5].map((i) => pick('series-parallel', i)),
  burn: pick('series-parallel', 4),
  walkLoop: pick('series-parallel', 6),
  repair: pick('series-parallel', 7),
  shortAlarm: pick('series-parallel', 8),
  // 8 losses
  voltages: list('losses', 0),
  dcChip: pick('losses', 4),
  // 9 measure
  modes: list('measure', 0),
  jackVOhm: pick('measure', 1),
  jumper: pick('measure', 3),
  rCalc: pick('measure', 4),
  ohmLive: pick('measure', 5),
  seriesOnly: pick('measure', 6),
  replaceFuse: pick('measure', 7),
  shortWarn: pick('measure', 8),
  // 10 dc-ac
  dcAc: list('dc-ac', 0),
  sweep: pick('dc-ac', 1),
  currentOn: pick('dc-ac', 2),
  magnetism: pick('dc-ac', 3),
} as const;
