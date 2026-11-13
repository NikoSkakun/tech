import { describe, expect, it } from 'vitest';
import raw from '@electricity/content/generated/atom.json';
import { STEP_IDS } from '../chapter';
import manifest from '../index';
import { FLAT_LABELS, L } from '../labels';
import { SM_TEXT } from '../labels-sm';
import { SHOTS } from '../shots';

describe('atom manifest', () => {
  it('lists the steps of the generated content, in order — and the typed STEP_IDS match', () => {
    expect(manifest.steps.map((s) => s.id)).toEqual(raw.steps.map((s) => s.id));
    expect(manifest.steps.map((s) => s.title)).toEqual(raw.steps.map((s) => s.title));
    expect([...STEP_IDS]).toEqual(raw.steps.map((s) => s.id));
    expect(manifest.title).toBe(raw.title);
    expect(manifest.group).toBe(raw.group);
  });

  it('gives every step a teaser', () => {
    for (const step of manifest.steps) expect(step.blurb.length).toBeGreaterThan(10);
  });
});

describe('atom labels', () => {
  it('contain no empty captions', () => {
    for (const [key, text] of Object.entries(FLAT_LABELS)) expect(text.trim(), key).not.toBe('');
  });

  it('take the document captions from the export (loading labels.ts already checked every wording)', () => {
    const exported = new Set(raw.steps.flatMap((s) => s.labels ?? []));
    for (const text of [
      L.anatomy.trueScale,
      L.electron.reset,
      L.shells.group11,
      L.photons.fire,
      L.builder.plus,
    ])
      expect(exported.has(text), text).toBe(true);
    expect([L.sm.strong, L.sm.electromagnetic, L.sm.weak, L.sm.gravity].join(' | ')).toBe(
      'Сильна | Електромагнітна | Слабка | Гравітація',
    );
  });

  it('are plain Ukrainian: no «English — українською» pairs (DECISIONS §54)', () => {
    const pair = /[A-Za-z]{3,}[A-Za-z ]* — [а-яґєії]/;
    for (const [key, text] of Object.entries(FLAT_LABELS))
      expect(pair.test(text), `${key}: ${text}`).toBe(false);
    for (const [id, text] of Object.entries(SM_TEXT))
      expect(pair.test(text.name), `${id}: ${text.name}`).toBe(false);
  });

  it('describe all 17 Standard Model particles', () => {
    expect(Object.keys(SM_TEXT)).toHaveLength(17);
    for (const text of Object.values(SM_TEXT)) expect(text.discovered).toMatch(/^\d{4}/);
  });
});

describe('atom camera shots', () => {
  it('declare the subject bounds (`fit`) on every shot (DECISIONS §57 d)', () => {
    for (const [name, shot] of Object.entries(SHOTS)) expect(shot.fit, name).toBeDefined();
  });
});
