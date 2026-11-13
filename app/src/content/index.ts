/**
 * `@/content` — content model shared by the HUD and the chapters: types that mirror the chapter export,
 * `defineContent`, lazy loading, glossary aggregation, progress helpers, uk-locale number formatting.
 */
export type * from './types';
export {
  defineContent,
  stepContent,
  termName,
  termIntl,
  linkTarget,
  contentKey,
  type ContentSource,
} from './define';
export { manifestText } from './meta';
export {
  stepAtLevel,
  quizAtLevel,
  hasSimpleLayer,
  READING_LEVELS,
  LEVEL_LABELS,
  DEFAULT_READING_LEVEL,
  isReadingLevel,
  type ReadingLevel,
  type LeveledStep,
  type LevelLabels,
} from './level';
export { loadContent, loadContents, contentIds } from './loader';
export {
  buildGlossary,
  filterGlossary,
  recordKey,
  glossaryLetter,
  glossaryHeading,
  glossaryIntl,
  UK_ALPHABET,
  type GlossaryFilter,
} from './glossary';
export {
  chapterProgress,
  journeyProgress,
  firstUnvisited,
  isVisited,
  clearedProgress,
  type Visited,
  type StepsLike,
} from './progress';
export {
  NBSP,
  fmtNumber,
  fmtUnit,
  fmtSci,
  fmtSI,
  fmtScale,
  fmtPercent,
  fmtRange,
  fmtDuration,
  superscript,
  plural,
  type NumberFormat,
} from './format';
