/**
 * Control captions the chapter document quotes «…» in its «Інтерактив» texts. They are read from the generated
 * content (`steps[].labels`, document order) and never retyped; `__tests__/manifest.test.ts` pins the indexes.
 * Labels the document does not carry live in `labels-own.ts`.
 */
import raw from '@electricity/content/generated/magnetism.json';
import type { StepId } from './chapter';

const labelsOf = (step: StepId): readonly string[] => raw.steps.find((s) => s.id === step)?.labels ?? [];

/** Label `index` of the step's quoted captions (document order). */
function pick(step: StepId, index: number): string {
  const text = labelsOf(step)[index];
  if (text === undefined) throw new Error(`magnetism: label ${step}[${index}] is missing in the generated content`);
  return text;
}
/** A quoted list «A / B / C» (or «A/B») as its items. */
const list = (step: StepId, index: number): string[] => pick(step, index).split(/\s*\/\s*/);
/** «Назва: A / B» → its title and items. */
function titled(step: StepId, index: number): { title: string; items: string[] } {
  const [title, rest] = pick(step, index).split(/:\s*/, 2) as [string, string];
  return { title, items: rest.split(/\s*\/\s*/) };
}

export const DOC = {
  // 1 magnet-field
  flip: pick('magnet-field', 2),
  peek: pick('magnet-field', 3),
  cut: pick('magnet-field', 4),
  glue: pick('magnet-field', 5),
  // 2 domains
  fieldH: pick('domains', 0),
  temperature: pick('domains', 2),
  curie: pick('domains', 3),
  // 3 oersted
  wireI: pick('oersted', 0),
  probeR: pick('oersted', 2),
  // 4 solenoid
  coilI: pick('solenoid', 0),
  turns: pick('solenoid', 1),
  core: pick('solenoid', 2),
  polarity: pick('solenoid', 3),
  bCentre: pick('solenoid', 4),
  clips: pick('solenoid', 5),
  simplified: pick('solenoid', 6),
  // 5 lorentz
  beamB: pick('lorentz', 0),
  accelU: pick('lorentz', 1),
  energy: pick('lorentz', 2),
  charge: pick('lorentz', 3),
  positive: pick('lorentz', 4),
  swingI: pick('lorentz', 5),
  flipMagnet: pick('lorentz', 6),
  // 6 dc-motor
  motorU: pick('dc-motor', 0),
  load: pick('dc-motor', 1),
  jammedAlarm: pick('dc-motor', 2),
  jam: pick('dc-motor', 3),
  output: list('dc-motor', 4),
  slow: pick('dc-motor', 6),
  slowChip: pick('dc-motor', 7),
  averaged: pick('dc-motor', 8),
  // 7 induction
  autoDrop: pick('induction', 0),
  coilTurns: pick('induction', 1),
  move: titled('induction', 2),
  // 8 lenz
  releaseAll: pick('lenz', 0),
  slot: pick('lenz', 1),
  ring: pick('lenz', 2),
  ringKinds: list('lenz', 3),
  // 9 inductance
  s1: list('inductance', 0),
  breakS2: pick('inductance', 1),
  rejoin: pick('inductance', 2),
  ironCore: pick('inductance', 3),
  breakTime: pick('inductance', 4),
  rlSimplified: pick('inductance', 5),
  withoutLimiter: pick('inductance', 6),
  // 10 maxwell
  frequency: pick('maxwell', 0),
  battery: pick('maxwell', 1),
  loadR: pick('maxwell', 2),
  show: titled('maxwell', 3),
  slowed: pick('maxwell', 5),
  notToScale: pick('maxwell', 6),
  // 11 to-generator
  steady: pick('to-generator', 0),
  rings: list('to-generator', 1),
  toGenerator: pick('to-generator', 4),
} as const;
