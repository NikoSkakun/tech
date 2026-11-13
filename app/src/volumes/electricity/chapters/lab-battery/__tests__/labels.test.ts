import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import raw from '@electricity/content/generated/lab-battery.json';
import { CHEMS, CHEM_TABLE } from '../chem-data';
import { DOC, L, OWN, spedUp } from '../labels';

/** Letters and digits only, lower case: quotes, NBSP and punctuation do not matter for "is this the same wording". */
const norm = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const stepSources = (): string => {
  const dir = new URL('../steps/', import.meta.url);
  return readdirSync(dir)
    .map((f) => readFileSync(new URL(f, dir), 'utf8'))
    .join('\n');
};

describe('lab-battery labels', () => {
  // the export keeps the builder guidance (`interaction`, `see`) that the runtime file drops
  const doc = JSON.parse(
    readFileSync(
      new URL(
        '../../../../../../../docs/volumes/electricity/chapters/_export/lab-battery.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as { steps: { see?: unknown; interaction?: unknown }[] };
  const guidance = norm(JSON.stringify(doc.steps.map((s) => [s.interaction, s.see])));

  it('DOC labels are verbatim wording of the chapter document', () => {
    const missing = Object.entries(DOC).filter(([, text]) => !guidance.includes(norm(text)));
    expect(missing).toEqual([]);
  });
  it('DOC labels read by index from `steps[].labels` still mean what the code thinks they mean', () => {
    // a document edit that inserts a quoted label shifts the indices: this pins the ones a mix-up would hurt
    expect([DOC.discharge, DOC.charge, DOC.pause]).toEqual(['Розряд', 'Заряд', 'Пауза']);
    expect([DOC.verdictGood, DOC.verdictOk, DOC.verdictBad]).toEqual(['добре', 'можна', 'погано']);
    // (the document writes numbers with a no-break space before the unit: compare the words)
    expect([DOC.balancing, DOC.balOff, DOC.balPassive, DOC.balActive].map(norm)).toEqual(
      ['Балансування', 'вимк.', 'пасивне 0,1 A', 'активне 2 A'].map(norm),
    );
    expect([DOC.link, DOC.can, DOC.linkNone]).toEqual(['Зв’язок з інвертором', 'CAN', 'без зв’язку']);
    expect([DOC.runDischarge, DOC.runCharge, DOC.start, DOC.unbalance]).toEqual([
      'Розрядити',
      'Зарядити',
      'Старт',
      'Розбалансувати',
    ]);
    expect([DOC.nail, DOC.overchargeScenario, DOC.propagation, DOC.bmsOn]).toEqual([
      'Цвях',
      'Перезаряд',
      'Поширення',
      'BMS увімк.',
    ]);
    expect(DOC.li6Ok).toBe('Підходить');
    expect(DOC.habitCare).toBe('Дбайливо');
    expect(DOC.scale).toBe('Масштаб');
  });
  it('DOC and OWN keys do not collide and no label is empty', () => {
    expect(Object.keys(DOC).filter((k) => k in OWN)).toEqual([]);
    for (const [key, text] of Object.entries(L)) expect(text.trim(), key).not.toBe('');
  });
  it('labels written in the chapter are plain Ukrainian: no «English — українська» pairs (DECISIONS §54)', () => {
    const pairs = Object.entries(OWN).filter(([, text]) =>
      /^[A-Za-z][A-Za-z -]{3,} — \p{Script=Cyrillic}/u.test(text),
    );
    expect(pairs).toEqual([]);
  });
  it('every hotspot of the document is placed by a step, bound by its content id', () => {
    const used = [...stepSources().matchAll(/content: '([^']+)'/g)].map((m) => m[1]!);
    const ids = raw.steps.flatMap((s) => s.hotspots.map((h) => h.id));
    expect(used.filter((id) => !ids.includes(id))).toEqual([]);
    expect(ids.filter((id) => !used.includes(id))).toEqual([]);
  });
  it('no step retypes a hotspot title or hides an annotation off screen', () => {
    const source = stepSources();
    expect(source).not.toMatch(/title: '[A-Z][A-Za-z -]+ — /);
    expect(source).not.toMatch(/nowhere\(/);
  });
  it('the time-lapse note prints the real factor', () => {
    expect(spedUp(890.4)).toBe('прискорено ×890');
    expect(spedUp(17.2)).toBe('прискорено ×17');
    expect(spedUp(1)).toBe('у реальному часі');
  });
});

describe('lab-battery chemistry table (from the content)', () => {
  it('has seven columns and a row for every chemistry of the showcase', () => {
    expect(CHEM_TABLE.headers).toHaveLength(7);
    for (const id of CHEMS) expect(CHEM_TABLE.rows[id], id).toHaveLength(7);
    expect(CHEM_TABLE.rows.LFP![1]).toBe('3,2');
  });
});
