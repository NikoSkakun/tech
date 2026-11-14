/**
 * Labels = document. `DOC` reads control captions from `steps[].labels` by position: this test pins the
 * expected wording. `QUOTED` wordings and the step-9 station table / records must still stand in the document
 * verbatim; own scene labels must be plain Ukrainian (DECISIONS §54).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DOC, splitCaption } from '../content';
import { QUOTED, SCENE } from '../labels';
import { RECORDS, STATION_HEAD, STATIONS } from '../stations';

const plain = (s: string): string => s.replace(/\s+/g, ' ');
const document = plain(
  readFileSync(
    new URL('../../../../../../../docs/volumes/electricity/chapters/plant-hydro.md', import.meta.url),
    'utf8',
  ),
);
const D = Object.fromEntries(Object.entries(DOC).map(([k, v]) => [k, plain(v)])) as Record<
  keyof typeof DOC,
  string
>;

describe('plant-hydro labels', () => {
  it('takes control captions from the document', () => {
    expect(D.level).toBe('Рівень водосховища');
    expect([D.homes, D.estimate]).toEqual(['Скільки осель живить', 'оцінка']);
    expect([D.presetGorges, D.presetDnipro, D.presetPelton, D.presetSmall]).toEqual([
      'Три ущелини (агрегат)',
      'ДніпроГЕС (агрегат, ≈)',
      'Гірська ковшова',
      'Мала ГЕС у Карпатах',
    ]);
    expect(D.waterLevel).toBe('Рівень води');
    expect([D.gate, D.trip, D.hammer, D.surgeTank, D.stationModel]).toEqual([
      'Відкриття напрямного апарата',
      'Аварійне закриття',
      'гідроудар!',
      'Зрівняльний резервуар',
      'умовна станція · спрощена модель',
    ]);
    expect([D.yourPlant, D.chosen, D.load, D.illustrativeCurves, D.vortex]).toEqual([
      'ваша ГЕС',
      'вибрано',
      'Навантаження',
      'ілюстративні криві',
      'Вихровий джгут, вібрації',
    ]);
    expect([D.polePairs, D.likeTurbo, D.sharp, D.smooth, D.blackStart]).toEqual([
      'Пари полюсів',
      'як турбогенератор',
      'Різко відкрити напрямний апарат',
      'Плавно',
      'Блекаут → пуск з нуля',
    ]);
    expect([D.inflow, D.storm, D.forced, D.overtop, D.auto]).toEqual([
      'Приплив води',
      'Злива',
      'Форсований рівень',
      'Перелив греблі!',
      'авто',
    ]);
    expect(splitCaption(D.spillMode, '/')).toEqual({ label: 'Водоскид', items: ['авто', 'вручну'] });
    expect([D.pshModel, D.autoPlan, D.playDay, D.profit]).toEqual([
      'умовна станція',
      'Автоплан',
      'Відтворити добу',
      'Прибуток',
    ]);
    expect(splitCaption(D.waterYear, ' / ')).toEqual({
      label: 'Водний рік',
      items: ['посушливий', 'середній', 'багатоводний'],
    });
    expect([D.nextWind, D.backGallery, D.asOf]).toEqual([
      'Далі: вітрова станція',
      'Назад до галереї',
      'станом на …',
    ]);
  });

  it('quotes the document verbatim', () => {
    for (const [key, text] of Object.entries(QUOTED)) expect(document, key).toContain(plain(text));
  });

  it('copies the station table and the records of step 9 from the document', () => {
    expect(document).toContain(`| ${STATION_HEAD.join(' | ')} |`);
    for (const s of STATIONS)
      expect(document, s.name).toContain(`| ${s.name} | ${s.type} | ${s.powerMW} | ${s.firstUnit} |`);
    for (const [name, figure] of RECORDS) {
      expect(document, name).toContain(name);
      expect(document, figure).toContain(figure);
    }
  });

  it('writes its own labels in plain Ukrainian', () => {
    for (const [key, text] of Object.entries(SCENE)) expect(text, key).not.toMatch(/ — [a-z]/i);
  });
});
