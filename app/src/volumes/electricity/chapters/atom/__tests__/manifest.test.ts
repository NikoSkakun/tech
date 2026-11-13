import { describe, expect, it } from 'vitest';
import raw from '@electricity/content/generated/atom.json';
import manifest from '../index';
import { FLAT_LABELS } from '../labels';
import { SM_TEXT } from '../labels-sm';

/**
 * The manifest is eager and cannot import the generated content (59 kB), so its step ids / titles are typed by
 * hand — this test keeps them identical to the generated copy of the chapter document.
 */
describe('atom manifest', () => {
  it('has the same steps, in the same order, with the same titles as the generated content', () => {
    expect(manifest.steps.map((s) => s.id)).toEqual(raw.steps.map((s) => s.id));
    expect(manifest.steps.map((s) => s.title)).toEqual(raw.steps.map((s) => s.title));
    expect(manifest.title).toBe(raw.title);
    expect(manifest.group).toBe(raw.group);
  });

  it('gives every step a non-empty teaser', () => {
    for (const step of manifest.steps) expect(step.blurb.length).toBeGreaterThan(10);
  });
});

describe('atom labels', () => {
  it('contain no empty captions', () => {
    for (const [key, text] of Object.entries(FLAT_LABELS)) expect(text.trim(), key).not.toBe('');
  });

  it('describe all 17 Standard Model particles', () => {
    expect(Object.keys(SM_TEXT)).toHaveLength(17);
    for (const text of Object.values(SM_TEXT)) {
      // international term first (CURRICULUM language rule): Latin name, dash, Ukrainian name
      expect(text.name).toMatch(/^[A-Za-z ]+ — \S/);
      expect(text.discovered).toMatch(/^\d{4}/);
    }
  });
});
