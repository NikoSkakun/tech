import { describe, expect, it } from 'vitest';
import raw from '@electricity/content/generated/magnetism.json';
import manifest from '../index';
import { DOC } from '../labels';
import { OWN } from '../labels-own';

describe('magnetism manifest', () => {
  it('has the steps and titles of the chapter document', () => {
    expect(manifest.steps.map((s) => s.id)).toEqual(raw.steps.map((s) => s.id));
    expect(manifest.steps.map((s) => s.title)).toEqual(raw.steps.map((s) => s.title));
    expect(manifest.title).toBe(raw.title);
    expect(manifest.group).toBe(raw.group);
    expect(manifest.order).toBe(5);
  });
  it('has a teaser for every step', () => {
    // `induction`'s generated blurb is only «1831 рік.» (first sentence of the panel) — see docs/requests/B-magnetism.md
    for (const s of manifest.steps) expect(s.blurb.length).toBeGreaterThan(8);
  });
});

describe('magnetism labels', () => {
  // landmarks: if the document's quoted captions are re-ordered, the indexes in labels.ts must follow
  it('picks the captions the code expects', () => {
    expect(DOC.cut).toMatch(/Розрізати/);
    expect(DOC.glue).toMatch(/Склеїти/);
    expect(DOC.peek).toMatch(/всередину/);
    expect(DOC.curie).toMatch(/Кюрі/);
    expect(DOC.probeR).toMatch(/зонда/);
    expect(DOC.clips).toMatch(/скріпок/);
    expect(DOC.accelU).toMatch(/напруга/);
    expect(DOC.output).toHaveLength(2);
    expect(DOC.move.items).toHaveLength(2);
    expect(DOC.ringKinds).toHaveLength(2);
    expect(DOC.s1).toHaveLength(2);
    expect(DOC.show.items).toHaveLength(3);
    expect(DOC.rings).toHaveLength(2);
    expect(DOC.toGenerator).toMatch(/генератора/);
  });
  it('has no empty label', () => {
    const all = [...Object.values(DOC), ...Object.values(OWN)].flatMap((v): readonly string[] | string =>
      typeof v === 'string' ? v : 'title' in v ? [v.title, ...v.items] : v,
    );
    for (const v of all) expect(String(v).trim().length).toBeGreaterThan(0);
  });
});
