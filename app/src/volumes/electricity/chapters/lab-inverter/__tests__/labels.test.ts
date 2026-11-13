import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import raw from '@electricity/content/generated/lab-inverter.json';
import { STEP_IDS, type StepId } from '../chapter';
import { doc, pairTitle, splitPair } from '../labels';
import { OWN } from '../labels-own';

const STEPS_DIR = join(__dirname, '..', 'steps');
const sources = readdirSync(STEPS_DIR)
  .filter((f) => /^\d\d-/.test(f))
  .map((f) => ({ file: f, text: readFileSync(join(STEPS_DIR, f), 'utf8') }));
const sourceOf = (step: StepId): string => sources[STEP_IDS.indexOf(step)]!.text;

describe('lab-inverter labels', () => {
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
    // one caption per step that the code relies on by index (non-breaking spaces as in the export)
    expect(doc('why-inverter', 0)).toBe('Рентген');
    expect(doc('switches', 8)).toBe('Затвор');
    expect(doc('h-bridge', 5)).toBe('Автомат 50 Hz');
    expect(doc('pwm', 3)).toBe('ШІМ однополярна');
    expect(doc('lc-filter', 6)).toBe('Компенсація мертвого часу');
    expect(doc('dc-link', 0)).toBe('Напруга ланцюжка панелей');
    expect(doc('mppt-controller', 1)).toBe('Авто MPPT');
    expect(doc('grid-tie', 3)).toBe('Замкнути реле');
    expect(doc('inverter-types', 3)).toBe('Порівняти');
    expect(doc('ups', 6)).toBe('Просідання до 190 V');
    expect(doc('three-phase-and-scale', 1)).toBe('Кількість рівнів');
    expect(doc('choosing', 0)).toBe('Пуск');
  });

  it('splits quoted pairs into two captions', () => {
    expect(splitPair('Кран / Ключ')).toEqual(['Кран', 'Ключ']);
    expect(splitPair(doc('h-bridge', 8))).toEqual(['Лампа', 'Двигун (RL)']);
    expect(pairTitle(doc('h-bridge', 8))).toBe('Навантаження');
  });

  it('every hotspot of the content is placed in its step', () => {
    for (const step of raw.steps) {
      const text = sourceOf(step.id as StepId);
      for (const h of step.hotspots ?? [])
        expect(text, `${step.id}: hotspot '${h.id}'`).toContain(`content: '${h.id}'`);
    }
  });

  it('own labels are non-empty Ukrainian strings without an English-first pair', () => {
    for (const [key, text] of Object.entries(OWN)) {
      expect(text.length, key).toBeGreaterThan(0);
      expect(/^[A-Za-z][A-Za-z -]+ — /.test(text), `${key}: «${text}»`).toBe(false);
    }
  });
});
