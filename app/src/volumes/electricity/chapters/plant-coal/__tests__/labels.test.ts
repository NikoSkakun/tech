/**
 * Labels = document. `DOC` reads control captions from `steps[].labels` by position: this test pins the expected
 * wording, so a re-ordered or re-worded document fails here instead of mislabelling a control. `QUOTED` words
 * (segment names and states the document writes as `code` items) must still stand in the document; own labels
 * must be plain Ukrainian (DECISIONS §54: no «English — українською» pairs).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DOC } from '../content';
import { OWN, QUOTED } from '../labels';

/** The export typesets units with no-break spaces and the document wraps its lines: compare the words. */
const plain = (s: string): string => s.replace(/\s+/g, ' ');
const document = plain(readFileSync(new URL('../../../../../../../docs/volumes/electricity/chapters/plant-coal.md', import.meta.url), 'utf8'));
const D = Object.fromEntries(Object.entries(DOC).map(([k, v]) => [k, typeof v === 'string' ? plain(v) : v.map(plain)])) as Record<keyof typeof DOC, string | string[]>;

describe('plant-coal labels', () => {
  it('takes control captions from the document', () => {
    expect([D.goToStep, D.timeOfDay, D.coalType]).toEqual(['Перейти до кроку…', 'Час доби', 'Тип вугілля']);
    expect(D.wagonsQuestion).toBe('Скільки вагонів на добу потрібно блоку 1000 MW з ККД 40 %');
    expect([D.fineness, D.unburnt, D.hair]).toEqual(['Тонкість помелу', 'Недопал (втрата з горючими в золі)', 'Порівняти з волосиною']);
    expect([D.showPath, D.noWalls, D.pressure, D.temperature]).toEqual(['Показати шлях', 'Без екранів', 'Тиск пари', 'Температура']);
    expect([D.presetOld200, D.preset300, D.presetUsc, D.presetPingshan]).toEqual(['Старий блок 200 MW (Україна)', 'Блок 300 MW (Україна)', 'Ультранадкритичний 1000 MW', 'Pingshan II']);
    expect([D.wetness, D.simplified, D.load]).toEqual(['Вологість', 'спрощена модель', 'Навантаження']);
    expect(D.regen).toEqual(['Регенерація: увімкнено', 'вимкнено']);
    expect([D.coolingWater, D.coal, D.euLimit, D.byproducts]).toEqual(['Температура охолоджувальної води', 'Вугілля', 'Норма ЄС', 'Побічні продукти']);
    expect(D.ccs).toEqual(['Уловлювання CO₂: вимкнено', 'увімкнено']);
    expect([D.unitEta, D.heatToCity, D.morningPeak]).toEqual(['ККД блока', 'Тепло місту', 'Ранковий пік']);
    expect(D.gapFillers).toBe('Цю діру закриють ГЕС, ГАЕС, газ або батареї');
    expect([D.occupied, D.destroyed, D.asOf]).toEqual(['окупована з 2022 р.', 'зруйнована 11.04.2024', 'станом на 2026 р.']);
    expect([D.worldShare, D.nextGas, D.backToGallery]).toEqual(['Світ: частка вугілля в генерації', 'Далі: газові станції', 'Назад до галереї']);
  });

  it('quotes the segment names and states of the document exactly', () => {
    for (const [key, text] of Object.entries(QUOTED)) expect(document.includes(plain(text)), `${key}: «${text}»`).toBe(true);
  });

  it('writes its own labels in plain Ukrainian', () => {
    for (const [key, text] of Object.entries(OWN)) {
      expect(/ — [a-zа-яіїєґ]/i.test(text) && /[A-Za-z]{3,} —/.test(text), `${key}: «${text}»`).toBe(false);
      expect(text.trim(), key).toBe(text);
    }
  });
});
