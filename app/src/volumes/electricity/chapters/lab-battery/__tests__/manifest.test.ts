import { describe, expect, it } from 'vitest';
import raw from '@electricity/content/generated/lab-battery.json';
import manifest from '../index';

/** The manifest repeats step ids and titles (it must stay tiny): they have to equal the generated content. */
describe('lab-battery manifest', () => {
  it('has the same steps, in the same order, with the same titles as the chapter document', () => {
    expect(manifest.steps.map((s) => s.id)).toEqual(raw.steps.map((s) => s.id));
    expect(manifest.steps.map((s) => s.title)).toEqual(raw.steps.map((s) => s.title));
  });
  it('has the chapter title of the document and is a lab under `home`', () => {
    expect(manifest.title).toBe(raw.title);
    expect(manifest.group).toBe(raw.group);
    expect(manifest.parent).toBe('home');
  });
  it('has a teaser for every step', () => {
    for (const s of manifest.steps) expect(s.blurb.length).toBeGreaterThan(10);
  });
});
