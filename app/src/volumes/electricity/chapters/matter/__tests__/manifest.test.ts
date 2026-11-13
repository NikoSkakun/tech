import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import raw from '@electricity/content/generated/matter.json';
import manifest from '../index';
import { DOC, FLAT_LABELS } from '../labels';

const here = dirname(fileURLToPath(import.meta.url));
const chapter = join(here, '..');
const document = readFileSync(
  join(here, '../../../../../../../docs/volumes/electricity/chapters/matter.md'),
  'utf8',
);
const stepSources = readdirSync(join(chapter, 'steps'))
  .filter((f) => /^\d\d-/.test(f))
  .sort()
  .map((f) => readFileSync(join(chapter, 'steps', f), 'utf8'));

describe('matter manifest', () => {
  it('has the steps of the generated content, in order, with the same titles', () => {
    expect(manifest.steps.map((s) => s.id)).toEqual(raw.steps.map((s) => s.id));
    expect(manifest.steps.map((s) => s.title)).toEqual(raw.steps.map((s) => s.title));
    expect(manifest.title).toBe(raw.title);
    expect(manifest.group).toBe(raw.group);
    expect(manifest.id).toBe(raw.id);
  });

  it('has one step module per manifest step', () => {
    expect(stepSources).toHaveLength(manifest.steps.length);
    manifest.steps.forEach((s, i) => expect(stepSources[i], s.id).toContain(`const ID = '${s.id}'`));
  });
});

describe('matter labels', () => {
  it('contain no empty captions', () => {
    for (const [key, text] of Object.entries(FLAT_LABELS)) expect(text.trim(), key).not.toBe('');
  });

  it('quote the document verbatim where they claim to (DOC)', () => {
    for (const [key, text] of Object.entries(DOC)) expect(document, key).toContain(`«${text}»`);
  });

  it('are plain Ukrainian: no «International — українською» pairs (DECISIONS §54)', () => {
    for (const [key, text] of Object.entries(FLAT_LABELS))
      expect(text, key).not.toMatch(/^[A-Za-z][A-Za-z ]+ — /);
  });
});

describe('matter hotspots', () => {
  it('places every hotspot of the document in its step, bound by id', () => {
    raw.steps.forEach((step, i) => {
      for (const h of step.hotspots)
        expect(stepSources[i], `${step.id}: ${h.id}`).toContain(`content: '${h.id}'`);
    });
  });

  it('reads every caption the document quotes for the controls it builds', () => {
    // each step with quoted captions takes at least one of them from the content (`docLabel` / `docItems`)
    raw.steps.forEach((step, i) => {
      expect(stepSources[i], step.id).toMatch(/doc(Label|Items)\(ID, \d/);
    });
  });
});
