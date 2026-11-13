import { describe, expect, it } from 'vitest';
import { parseFlags } from '@/engine/app';
import { Store, type StorageLike } from '@/engine/store';
import { LEVEL_LABELS, stepAtLevel } from '../level';
import type { StepContent } from '../types';

const STEP: StepContent = {
  id: 's',
  title: 'Довга назва кроку',
  panel: ['Докладна сторінка.'],
  terms: [{ international: 'Wave', ukrainian: 'хвиля', definition: 'Коливання.' }],
  formulas: { items: ['λ = v / f'] },
  facts: { items: [{ text: 'Факт.' }] },
  hotspots: [
    { id: 'bead', name: 'Bead — кулька', text: 'Докладно про кульку.' },
    { id: 'disc', name: 'Disc — диск', text: 'Докладно про диск.' },
  ],
  misconceptions: [{ myth: 'Міф', correction: 'Докладно.' }],
  simple: {
    title: 'Коротко',
    panel: ['Проста сторінка.'],
    words: [{ word: 'хвиля', text: 'рух, що біжить.' }],
    facts: ['Цікаво.'],
    hotspots: [{ id: 'bead', text: 'Просто про кульку.' }],
    misconception: { myth: 'Простий міф', correction: 'Просто.' },
  },
};

describe('reading level selector', () => {
  it('keeps the detailed step as it is', () => {
    const d = stepAtLevel(STEP, 'detailed');
    expect(d.level).toBe('detailed');
    expect({ ...d, level: undefined }).toEqual({ ...STEP, level: undefined });
  });

  it('replaces the parts of a simple step and hides formulas', () => {
    const s = stepAtLevel(STEP, 'simple');
    expect(s.level).toBe('simple');
    expect(s.title).toBe('Коротко');
    expect(s.panel).toEqual(['Проста сторінка.']);
    expect(s.terms).toEqual([
      { international: null, ukrainian: 'хвиля', name: 'хвиля', definition: 'рух, що біжить.' },
    ]);
    expect(s.formulas).toBeUndefined();
    expect(s.facts).toEqual({ items: [{ text: 'Цікаво.' }] });
    expect(s.misconceptions).toEqual([{ myth: 'Простий міф', correction: 'Просто.' }]);
  });

  it('falls back per hotspot, and per step without a simple layer', () => {
    const s = stepAtLevel(STEP, 'simple');
    expect(s.hotspots?.map((h) => h.text)).toEqual(['Просто про кульку.', 'Докладно про диск.']);
    const plain = stepAtLevel({ ...STEP, simple: undefined }, 'simple');
    expect(plain.level).toBe('detailed');
    expect(plain.panel).toEqual(['Докладна сторінка.']);
    expect(plain.formulas?.items).toEqual(['λ = v / f']);
  });

  it('leaves out simple parts the layer does not have, keeps the title without a short one', () => {
    const s = stepAtLevel({ ...STEP, simple: { panel: ['Тільки текст.'] } }, 'simple');
    expect(s.title).toBe('Довга назва кроку');
    expect(s.terms).toBeUndefined();
    expect(s.facts).toBeUndefined();
    expect(s.misconceptions).toBeUndefined();
    expect(s.hotspots?.[0]?.text).toBe('Докладно про кульку.');
  });

  it('labels the sections by level', () => {
    expect(LEVEL_LABELS.simple.terms).toBe('Слова');
    expect(LEVEL_LABELS.simple.facts).toBe('Цікаво');
    expect(LEVEL_LABELS.detailed.terms).toBe('Терміни');
  });
});

describe('reading level setting', () => {
  const memory = (init: Record<string, string> = {}): StorageLike => ({
    getItem: (k) => init[k] ?? null,
    setItem: (k, v) => void (init[k] = v),
  });

  it('parses ?level= and ignores other values', () => {
    expect(parseFlags('?level=simple').level).toBe('simple');
    expect(parseFlags('?level=detailed').level).toBe('detailed');
    expect(parseFlags('?level=easy').level).toBeNull();
    expect(parseFlags('').level).toBeNull();
  });

  it('defaults to detailed and persists the choice', () => {
    const data: Record<string, string> = {};
    const store = new Store(memory(data));
    expect(store.get().settings.readingLevel).toBe('detailed');
    store.updateSettings({ readingLevel: 'simple' });
    expect(new Store(memory(data)).get().settings.readingLevel).toBe('simple');
  });
});
