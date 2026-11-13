/**
 * Glossary aggregation (pure, unit-tested): chapter glossaries and step term cards → one sorted list, each
 * entry tagged with the step where the term is introduced (first chapter in journey order wins — the same
 * rule as `docs/volumes/<volume>/GLOSSARY.md`).
 */
import { contentKey, termIntl, termName } from './define';
import type { ChapterContent, GlossaryEntry, GlossaryRecord } from './types';

/** Ukrainian alphabet in order (index letters of the glossary, DECISIONS §54). */
export const UK_ALPHABET = [...'АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯ'];
const collator = new Intl.Collator('uk', { sensitivity: 'base' });

const norm = (s: string): string =>
  s
    .toLocaleLowerCase('uk')
    .replace(/[\s\u00a0]+/g, ' ')
    .trim();

/** Words of a term name for matching glossary rows to step term cards. */
function keyOf(international: string): string {
  return norm(international)
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .trim();
}

/**
 * @param contents chapter contents in journey order — of one volume, or of several volumes one after another
 *   (library order) for the whole-library glossary: a term shared by two volumes is one record, introduced
 *   where it comes first, with the other chapters in `alsoIn`.
 */
export function buildGlossary(contents: readonly ChapterContent[]): GlossaryRecord[] {
  const byKey = new Map<string, GlossaryRecord>();
  for (const chapter of contents) {
    const stepOf = (entry: GlossaryEntry): string | null => {
      const key = keyOf(entry.international);
      const uk = norm(entry.ukrainian);
      for (const step of chapter.steps) {
        for (const t of step.terms ?? []) {
          if (
            (t.international && keyOf(t.international) === key) ||
            (t.ukrainian && norm(t.ukrainian) === uk)
          )
            return step.id;
        }
      }
      return null;
    };
    const rows: GlossaryEntry[] = [...(chapter.glossary ?? [])];
    // term cards that never made it into the chapter table still belong in the glossary
    for (const step of chapter.steps) {
      for (const t of step.terms ?? []) {
        if (!t.international || !t.ukrainian || !t.definition) continue;
        if (rows.some((r) => keyOf(r.international) === keyOf(t.international!))) continue;
        rows.push({
          international: t.international,
          ukrainian: t.ukrainian,
          name: t.name,
          intl: t.intl,
          symbol: t.symbol,
          unit: t.unit,
          definition: t.definition,
        });
      }
    }
    for (const row of rows) {
      const key = keyOf(row.international);
      const existing = byKey.get(key);
      if (existing) {
        const here = contentKey(chapter);
        if (recordKey(existing) !== here && !existing.alsoIn.includes(here)) existing.alsoIn.push(here);
        continue;
      }
      byKey.set(key, {
        ...row,
        volumeId: chapter.volume ?? null,
        chapterId: chapter.id,
        stepId: stepOf(row),
        alsoIn: [],
      });
    }
  }
  // sorted by the displayed Ukrainian name (ґ after г, є after е, і ї after и); Latin-only names go last
  return [...byKey.values()].sort((a, b) => {
    const la = glossaryLetter(a) === '#';
    const lb = glossaryLetter(b) === '#';
    return la !== lb ? (la ? 1 : -1) : collator.compare(termName(a), termName(b));
  });
}

/** Content key (`volume/chapter`) of the chapter that introduces a record. */
export function recordKey(r: Pick<GlossaryRecord, 'volumeId' | 'chapterId'>): string {
  return r.volumeId ? `${r.volumeId}/${r.chapterId}` : r.chapterId;
}

/** Index letter of an entry: the first letter of its Ukrainian name, `#` for Latin names, digits and symbols. */
export function glossaryLetter(entry: GlossaryEntry): string {
  const c = termName(entry).trim().charAt(0).toLocaleUpperCase('uk');
  return UK_ALPHABET.includes(c) ? c : '#';
}

export interface GlossaryFilter {
  /** Free text: matches the displayed name, the international and the Ukrainian term, the symbol or the unit. */
  query?: string;
  /** Only terms of this volume (introduced in it or also listed in it). Omit for the whole library. */
  volume?: string;
  /** Only terms introduced in (or also listed in) these chapters — content keys `volume/chapter`. */
  chapters?: ReadonlySet<string>;
  letter?: string;
}

export function filterGlossary(records: readonly GlossaryRecord[], filter: GlossaryFilter): GlossaryRecord[] {
  const q = norm(filter.query ?? '');
  return records.filter((r) => {
    if (
      filter.volume !== undefined &&
      r.volumeId !== filter.volume &&
      !r.alsoIn.some((c) => c.startsWith(`${filter.volume}/`))
    )
      return false;
    if (
      filter.chapters &&
      !filter.chapters.has(recordKey(r)) &&
      !r.alsoIn.some((c) => filter.chapters!.has(c))
    )
      return false;
    if (filter.letter && glossaryLetter(r) !== filter.letter) return false;
    if (!q) return true;
    return (
      norm(termName(r)).includes(q) ||
      norm(r.international).includes(q) ||
      norm(r.ukrainian).includes(q) ||
      norm(r.symbol ?? '') === q ||
      norm(r.unit ?? '') === q
    );
  });
}

/** One-line heading of an entry: `**напруга** · U, V` (the international form goes to `glossaryIntl`). */
export function glossaryHeading(e: GlossaryEntry): string {
  const tail = [e.symbol, e.unit].filter((v): v is string => !!v && v !== '—').join(', ');
  return `**${termName(e)}**${tail ? ` · \`${tail}\`` : ''}`;
}

/** Secondary line of an entry: the international form, or null when the name already shows it. */
export function glossaryIntl(e: GlossaryEntry): string | null {
  return termIntl(e);
}
