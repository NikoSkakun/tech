/**
 * Labels = document. `DOC` reads control captions from `steps[].labels` by position: this test pins the
 * expected wording, so a re-ordered or re-worded document fails here instead of mislabelling a control.
 * `QUOTED` wordings must still stand in the document's «Бачимо»; own scene labels must be plain Ukrainian
 * (DECISIONS §54: no «English — українською» pairs).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DOC, L } from '../content';
import { QUOTED, SCENE } from '../labels';

/** The export typesets units with no-break spaces and the document wraps its lines: compare the words. */
const plain = (s: string): string => s.replace(/\s+/g, ' ');
const document = plain(readFileSync(new URL('../../../../../../../docs/volumes/electricity/chapters/plant-wind.md', import.meta.url), 'utf8'));
const D = Object.fromEntries(Object.entries(DOC).map(([k, v]) => [k, typeof v === 'string' ? plain(v) : v.map(plain)])) as { [K in keyof typeof DOC]: (typeof DOC)[K] extends string ? string : string[] };

describe('plant-wind labels', () => {
  it('takes control captions from the document', () => {
    expect(D.turbineTip).toBe('Вітрова турбіна · 6 MW');
    expect(D.dayNight).toBe('День / Ніч');
    expect(D.double).toBe('×2 швидкості');
    expect(D.betzChip).toBe('Межа Беца 59,3 %');
    expect(D.betzModel).toBe('спрощена модель: ідеальний диск');
    expect(D.glide).toBe('Якість профілю C_L/C_D');
    expect(D.span).toBe('Позиція вздовж лопаті');
    expect([D.energyPath, D.total, D.cutaway]).toEqual(['Шлях енергії', 'разом ≈ 90–93 %', 'Розріз / Зовнішній вигляд']);
    expect([D.movingParts, D.converterShare]).toEqual(['Кількість рухомих частин', 'Частка потужності через перетворювач']);
    expect([D.gust, D.storm, D.stormChip]).toEqual(['Порив', 'Шторм', 'Захист від шторму']);
    expect(D.stormModes).toEqual(['Пряме вимкнення', 'Штормове регулювання']);
    expect(D.farmEff).toBe('Ефективність ВЕС = ΣP / (N·P_одинокої)');
    expect(D.steering).toBe('Керування слідом');
    expect(D.steeringHint).toBe('Керування слідом вмикають тільки для „поганих“ напрямків');
    expect(D.wakeModel).toBe('спрощена модель сліду');
    expect([D.cf, D.aep, D.hubHeight, D.dayOfYear]).toEqual(['КВВП, %', 'Річний виробіток, GWh', 'Висота маточини', 'День року']);
    expect([D.terrainSea, D.terrainSteppe, D.terrainForest]).toEqual(['море α=0,10', 'степ α=0,14', 'ліс α=0,25']);
    expect([D.depth, D.shoreDistance, D.compare]).toEqual(['Глибина', 'Відстань до берега', 'Порівняти розміри']);
    expect(D.gridModes).toEqual(['Мережевідомий', 'Мережоформувальний']);
    expect(D.simplifiedChip).toBe('спрощено');
  });

  it('quotes the wordings of «Бачимо» exactly', () => {
    for (const [key, text] of Object.entries(QUOTED)) {
      // zone labels are «I · штиль» on screen and «I «штиль»» in the document: compare the words
      const words = plain(text.replace(/^[IV]+ · /, ''));
      expect(document.includes(words), `${key}: «${words}»`).toBe(true);
    }
  });

  it('writes its own labels in plain Ukrainian', () => {
    for (const [key, text] of Object.entries(SCENE)) {
      expect(text.length, key).toBeGreaterThan(0);
      // «Latin word — українською» pairs are the withdrawn "international first" style
      expect(/^[A-Za-z][A-Za-z -]+ — /.test(text), `${key}: ${text}`).toBe(false);
    }
    expect(Object.keys(L).length).toBe(Object.keys(DOC).length + Object.keys(SCENE).length);
  });
});
