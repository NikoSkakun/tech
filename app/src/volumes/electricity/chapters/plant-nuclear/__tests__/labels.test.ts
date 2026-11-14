/**
 * Labels = document. `DOC` reads control captions from `steps[].labels` by position: this test pins the
 * expected wording, so a re-ordered or re-worded document fails here instead of mislabelling a control.
 * `QUOTED` wordings must still stand in the document; no scene label may shadow a document caption.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DOC } from '../content';
import { OWN, QUOTED } from '../labels';

/** The export typesets units with no-break spaces and the document wraps its lines: compare the words. */
const plain = (s: string): string => s.replace(/\s+/g, ' ').replace(/\u00a0/g, ' ');
const document = plain(readFileSync(new URL('../../../../../../../docs/volumes/electricity/chapters/plant-nuclear.md', import.meta.url), 'utf8'));

describe('plant-nuclear labels', () => {
  it('takes control captions from the document', () => {
    expect(plain(DOC.lookInside)).toBe('Зазирнути всередину');
    expect(plain(DOC.neutronEnergy)).toBe('Енергія нейтрона');
    expect(plain(DOC.compareBurn)).toBe('Порівняти з горінням');
    expect(plain(DOC.enrichment)).toBe('Збагачення');
    expect(plain(DOC.rods)).toBe('Стрижні-поглиначі');
    expect(plain(DOC.launch)).toBe('Запустити 1 нейтрон');
    expect(plain(DOC.slowDown)).toBe('Сповільнити нейтрон');
    expect(DOC.delayedSwitch).toEqual({ title: 'Запізнілі нейтрони', items: ['увімкнено', 'вимкнено (уявний світ)'] });
    expect(plain(DOC.scale)).toBe('Масштаб');
    expect(plain(DOC.coreMap)).toBe('Карта зони');
    expect(plain(DOC.reload)).toBe('Перевантаження');
    expect(plain(DOC.cut)).toBe('Розріз');
    expect(plain(DOC.unpower)).toBe('Знеструмити приводи');
    expect(plain(DOC.pressure)).toBe('Тиск у компенсаторі');
    expect(plain(DOC.circuits)).toBe('Показати контури');
    expect(plain(DOC.restore)).toBe('Відновити роботу');
    expect(plain(DOC.blackout)).toBe('Повне знеструмлення');
    expect(plain(DOC.barriers)).toBe('Бар’єри');
    expect(plain(DOC.outletTemps)).toBe('Порівняти температури виходу');
    expect(plain(DOC.year)).toBe('Рік');
    expect(plain(DOC.howMuch)).toBe('Скільки займає?');
    expect(DOC.share).toEqual({ title: 'Частка АЕС', items: ['Україна', 'Франція', 'світ'] });
    expect(plain(DOC.nextHydro)).toBe('Далі: ГЕС');
    expect(plain(DOC.backGallery)).toBe('Назад до галереї');
  });

  it('quotes only wordings that stand in the document', () => {
    for (const [key, text] of Object.entries(QUOTED)) expect(document.includes(plain(text)), `${key}: «${text}»`).toBe(true);
  });

  it('never shadows a document caption with a scene label', () => {
    for (const key of Object.keys(OWN)) expect(Object.keys(DOC).includes(key), key).toBe(false);
    for (const key of Object.keys(QUOTED)) expect(Object.keys(DOC).includes(key), key).toBe(false);
  });
});
