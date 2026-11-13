import { describe, expect, it } from 'vitest';
import { contentKey, defineContent, linkTarget, termName } from '../define';
import { fmtNumber, fmtPercent, fmtSI, fmtSci, fmtScale, fmtUnit, plural } from '../format';
import { buildGlossary, filterGlossary, glossaryLetter, recordKey } from '../glossary';
import { chapterProgress, firstUnvisited, journeyProgress } from '../progress';

describe('format (uk locale)', () => {
  it('uses a decimal comma, a real minus and no-break thousands', () => {
    expect(fmtNumber(1.5)).toBe('1,5');
    expect(fmtNumber(-0.25)).toBe('−0,25');
    expect(fmtNumber(1250000)).toBe('1 250 000');
    expect(fmtNumber(1000)).toBe('1000');
    expect(fmtNumber(3, { digits: 2 })).toBe('3,00');
    expect(fmtNumber(-0.001)).toBe('0');
  });
  it('binds the unit with a no-break space', () => {
    expect(fmtUnit(230, 'V')).toBe('230 V');
    expect(fmtPercent(0.983, 1)).toBe('98,3 %');
    expect(fmtSI(1500, 'W')).toBe('1,5 kW');
    expect(fmtSI(0.0032, 'A')).toBe('3,2 mA');
    expect(fmtSI(4.7e-6, 'F')).toBe('4,7 μF');
  });
  it('writes powers of ten the course way', () => {
    expect(fmtSci(8.5e22)).toBe('8,5×10²²');
    expect(fmtSci(1e-19)).toBe('10⁻¹⁹');
    expect(fmtScale(-10)).toBe('10⁻¹⁰ m');
  });
  it('picks Ukrainian plural forms', () => {
    const f = ['крок', 'кроки', 'кроків'] as const;
    expect([1, 2, 5, 11, 21, 22, 25, 112].map((n) => plural(n, f))).toEqual([
      'крок',
      'кроки',
      'кроків',
      'кроків',
      'крок',
      'кроки',
      'кроків',
      'кроків',
    ]);
  });
});

const atom = defineContent({
  id: 'atom',
  steps: [
    {
      id: 'dive-in',
      title: 'Усе складається з атомів',
      panel: ['a'],
      terms: [{ international: 'Atom', ukrainian: 'атом', definition: 'x' }],
    },
    {
      id: 'electron',
      title: 'Електрон',
      panel: ['b'],
      terms: [{ international: 'Electron', ukrainian: 'електрон', symbol: 'e⁻', definition: 'y' }],
    },
  ],
  glossary: [
    {
      international: 'Electron',
      ukrainian: 'електрон',
      symbol: 'e⁻',
      unit: null,
      definition: 'Елементарна частинка.',
    },
    {
      international: 'Atom',
      ukrainian: 'атом',
      symbol: null,
      unit: null,
      definition: 'Найменша частинка елемента.',
    },
  ],
  quiz: [{ question: 'q', options: ['a', 'b'], correct: 1 }],
});
const current = defineContent({
  id: 'current',
  steps: [
    {
      id: 'ohm',
      title: 'Закон Ома',
      panel: ['c'],
      terms: [
        {
          international: 'Voltage',
          ukrainian: 'напруга',
          symbol: 'U',
          unit: 'V',
          definition: 'Різниця потенціалів.',
        },
      ],
    },
  ],
  glossary: [
    { international: 'Electron', ukrainian: 'електрон', symbol: 'e⁻', unit: null, definition: 'дубль' },
  ],
});

describe('content', () => {
  it('rejects duplicate steps and bad quiz indices', () => {
    expect(() =>
      defineContent({
        id: 'x',
        steps: [
          { id: 'a', title: '', panel: [] },
          { id: 'a', title: '', panel: [] },
        ],
      }),
    ).toThrow();
    expect(() =>
      defineContent({ id: 'x', steps: [], quiz: [{ question: '', options: ['a'], correct: 3 }] }),
    ).toThrow();
  });
  it('names terms in Ukrainian (DECISIONS §54) and recognises links', () => {
    expect(termName({ international: 'Atom', ukrainian: 'атом' })).toBe('атом');
    expect(linkTarget('grid/frequency-balance')).toEqual({
      volumeId: null,
      chapterId: 'grid',
      stepId: 'frequency-balance',
    });
    expect(linkTarget('electricity/grid/frequency-balance')).toEqual({
      volumeId: 'electricity',
      chapterId: 'grid',
      stepId: 'frequency-balance',
    });
    expect(linkTarget('a/b/c/d')).toBeNull();
    expect(linkTarget('U = I·R')).toBeNull();
  });
  it('aggregates the glossary with the introducing step', () => {
    const g = buildGlossary([atom, current]);
    expect(g.map((r) => r.international)).toEqual(['Atom', 'Electron', 'Voltage']);
    const electron = g[1]!;
    expect(electron.chapterId).toBe('atom');
    expect(electron.stepId).toBe('electron');
    expect(electron.alsoIn).toEqual(['current']);
    expect(electron.definition).toBe('Елементарна частинка.');
    expect(g[2]!.stepId).toBe('ohm');
    expect(glossaryLetter(g[2]!)).toBe('Н');
    expect(filterGlossary(g, { query: 'напру' })).toHaveLength(1);
    expect(filterGlossary(g, { query: 'u' }).map((r) => r.international)).toEqual(['Voltage']);
    expect(filterGlossary(g, { chapters: new Set(['current']) })).toHaveLength(2);
  });
  it('counts progress and ignores stale step ids', () => {
    const visited = { atom: ['dive-in', 'gone'], current: [] };
    expect(chapterProgress(visited, atom)).toEqual({ done: 1, total: 2, fraction: 0.5 });
    expect(journeyProgress(visited, [atom, current]).total).toBe(3);
    expect(firstUnvisited(visited, [atom, current])).toEqual({
      volumeId: null,
      chapterId: 'atom',
      stepId: 'electron',
    });
  });

  it('keys progress and glossary records by volume/chapter when the content states its volume', () => {
    const a = { ...atom, volume: 'electricity' };
    const c = { ...current, volume: 'electricity' };
    const other = { ...atom, volume: 'radio' }; // another volume may reuse a chapter id
    const visited = { 'electricity/atom': ['dive-in'], 'radio/atom': ['dive-in', 'electron'] };
    expect(contentKey(a)).toBe('electricity/atom');
    expect(chapterProgress(visited, a).done).toBe(1);
    expect(chapterProgress(visited, other).done).toBe(2);
    expect(firstUnvisited(visited, [a, c])).toEqual({
      volumeId: 'electricity',
      chapterId: 'atom',
      stepId: 'electron',
    });
    // one volume
    const g = buildGlossary([a, c]);
    expect(recordKey(g[1]!)).toBe('electricity/atom');
    expect(g[1]!.alsoIn).toEqual(['electricity/current']);
    expect(filterGlossary(g, { chapters: new Set(['electricity/current']) })).toHaveLength(2);
    // the whole library: a term shared by two volumes is one record, introduced where it comes first
    const all = buildGlossary([a, c, other]);
    expect(all).toHaveLength(g.length);
    expect(all[0]!.volumeId).toBe('electricity');
    expect(all[0]!.alsoIn).toContain('radio/atom');
    expect(filterGlossary(all, { volume: 'radio' }).map((r) => r.international)).toEqual([
      'Atom',
      'Electron',
    ]);
    expect(filterGlossary(all, { volume: 'electricity' })).toHaveLength(all.length);
  });
});
