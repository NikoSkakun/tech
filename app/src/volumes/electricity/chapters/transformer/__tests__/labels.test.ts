import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import raw from '@electricity/content/generated/transformer.json';
import { STEP_IDS, type StepId } from '../chapter';
import { doc, hot, splitCaps, splitList } from '../labels';
import { OWN, OWN_LISTS } from '../labels-own';

const STEPS_DIR = join(__dirname, '..', 'steps');
const sources = readdirSync(STEPS_DIR)
  .filter((f) => /^\d\d-/.test(f))
  .map((f) => ({ file: f, text: readFileSync(join(STEPS_DIR, f), 'utf8') }));
const sourceOf = (step: StepId): string => sources[STEP_IDS.indexOf(step)]!.text;

describe('transformer labels', () => {
  it('every doc(step, i) used by a step exists in the generated content', () => {
    for (const { file, text } of sources) {
      const own = /const ID = '([a-z0-9-]+)'/.exec(text)?.[1] as StepId;
      for (const m of text.matchAll(/doc\((ID|'[a-z0-9-]+'), (\d+)\)/g)) {
        const step = (m[1] === 'ID' ? own : m[1]!.slice(1, -1)) as StepId;
        expect(() => doc(step, Number(m[2])), `${file}: doc(${step}, ${m[2]})`).not.toThrow();
      }
    }
  });

  it('anchors of the quoted labels did not move in the document', () => {
    expect(doc('mutual-induction', 0)).toBe('Постійний / змінний');
    expect(doc('turns-ratio', 4)).toBe('Опір навантаження R');
    expect(doc('why-high-voltage', 1)).toBe('Напруга передачі U');
    expect(doc('anatomy', 3)).toBe('Внутрішня іскра');
    expect(doc('tap-changer', 2)).toBe('Автомат РПН / ручне');
    expect(doc('losses-efficiency', 3)).toBe('Товщина листа d');
    expect(doc('three-phase-groups', 1)).toBe('НН: y / yn / d');
    expect(doc('types', 1)).toBe('Струм шини');
    expect(doc('voltage-ladder', 0)).toBe('Далі: магістральні мережі →');
  });

  it('splits quoted lists into captions', () => {
    expect(splitCaps(doc('mutual-induction', 0))).toEqual(['Постійний', 'Змінний']);
    expect(splitList(doc('three-phase-groups', 1))).toEqual(['y', 'yn', 'd']);
    expect(splitList(doc('anatomy', 0))).toHaveLength(5);
  });

  it('every hotspot of the content is placed in its step', () => {
    for (const step of raw.steps) {
      const text = sourceOf(step.id as StepId);
      (step.hotspots ?? []).forEach((_, i) => {
        expect(() => hot(step.id as StepId, i)).not.toThrow();
        expect(text, `${step.id}: hotspot #${i}`).toContain(`content: hot(ID, ${i})`);
      });
    }
  });

  it('own lists are non-empty strings', () => {
    for (const list of Object.values(OWN_LISTS)) for (const text of list) expect(text.length).toBeGreaterThan(0);
  });

  it('own labels are non-empty Ukrainian strings without an English-first pair', () => {
    for (const [key, text] of Object.entries(OWN)) {
      expect(text.length, key).toBeGreaterThan(0);
      expect(/^[A-Za-z][A-Za-z -]+ — /.test(text), `${key}: «${text}»`).toBe(false);
    }
  });
});
