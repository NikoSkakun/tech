/**
 * Labels = document. `DOC` reads control captions from `steps[].labels` by position: this test pins the
 * expected wording, so a re-ordered or re-worded document fails here instead of mislabelling a control.
 * `QUOTED` wordings must still stand in the document; own scene labels must be plain Ukrainian (DECISIONS §54).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DOC, L } from '../content';
import { QUOTED, SCENE, fill } from '../labels';

/** The export typesets units with no-break spaces and the document wraps its lines: compare the words. */
const plain = (s: string): string => s.replace(/\s+/g, ' ');
const document = plain(readFileSync(new URL('../../../../../../../docs/volumes/electricity/chapters/plant-gas.md', import.meta.url), 'utf8'));
const D = Object.fromEntries(Object.entries(DOC).map(([k, v]) => [k, plain(v)])) as Record<keyof typeof DOC, string>;

describe('plant-gas labels', () => {
  it('takes control captions from the document', () => {
    expect(D.islandMode).toBe('Режим острова');
    expect([D.fuel, D.reaction, D.energyPerKg, D.co2PerGJ, D.cubicMetre]).toEqual(['Паливо', 'Реакція', 'Енергія на kg', 'CO₂ на GJ', '1 m³ газу']);
    expect([D.cut, D.jetEngine]).toEqual(['Розрізати', 'Порівняти з авіадвигуном']);
    expect([D.airFor500, D.classE, D.classF, D.classHJ, D.aero]).toEqual(['Витрата повітря для 500 MW', 'Клас E (1990-ті)', 'Клас F', 'Клас H/J (2020-ті)', 'Авіапохідна']);
    expect([D.beyondMaterials, D.barelyRuns]).toEqual(['За межами сучасних матеріалів', 'Машина ледве тягне сама себе']);
    expect([D.thermometer, D.melting, D.restore, D.tit]).toEqual(['Термометр шарів', 'Оплавлення', 'Відновити', 'TIT']);
    expect([D.hrsg, D.levels, D.firing]).toEqual(['Котел-утилізатор', 'Кількість рівнів тиску', 'Допалювання']);
    expect([D.startAll, D.standstill, D.trip, D.rescue]).toEqual(['Старт усім', 'Скільки годин стояла ПГУ', 'Аварія: вимкнувся блок 1000 MW', 'Рятують']);
    expect([D.strokeByStroke, D.districtMap, D.unitFails, D.oneStation, D.twentyUnits, D.offShare, D.heatToCity]).toEqual([
      'Такт за тактом',
      'Мапа району',
      'Подія: одна установка вийшла з ладу',
      'Одна станція',
      '20 установок',
      'Відключені споживачі %',
      'Тепло місту',
    ]);
    expect([D.plantEta, D.leaks, D.cloud, D.ghost, D.hydrogen]).toEqual(['ККД станції', 'Витоки метану', 'Хмара', 'Примара', 'Водень у суміші, % за об’ємом']);
    expect([D.h2Available, D.h2Development]).toEqual(['Доступно на сучасних ГТ, готових до водню', 'У розробці/демонстраціях']);
    expect([D.asOf, D.nextNuclear, D.backToGallery]).toEqual(['станом на 2026 р.', 'Далі: атомна станція', 'Назад до галереї']);
  });

  it('quotes the document’s switch items exactly', () => {
    for (const [key, text] of Object.entries(QUOTED)) expect(document.includes(plain(text)), `${key}: «${text}»`).toBe(true);
  });

  it('writes its own labels in plain Ukrainian', () => {
    for (const [key, text] of Object.entries(SCENE)) {
      expect(text.length, key).toBeGreaterThan(0);
      expect(/^[A-Za-z][A-Za-z -]+ — /.test(text), `${key}: ${text}`).toBe(false);
    }
    expect(Object.keys(L).length).toBe(Object.keys(DOC).length + Object.keys(SCENE).length);
  });

  it('fills value slots in order', () => {
    expect(fill('{} · {}', 'a', 'b')).toBe('a · b');
  });
});
