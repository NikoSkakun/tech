import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import raw from '@electricity/content/generated/lab-battery.json';
import manifest from '../index';

/** The manifest takes its text from the generated manifest file; these guard what the chapter adds to it. */
describe('lab-battery manifest', () => {
  it('has the steps of the chapter document, in order, with their titles', () => {
    expect(manifest.steps.map((s) => s.id)).toEqual(raw.steps.map((s) => s.id));
    expect(manifest.steps.map((s) => s.title)).toEqual(raw.steps.map((s) => s.title));
  });
  it('has the chapter title of the document and is a lab under `home`', () => {
    expect(manifest.title).toBe(raw.title);
    expect(manifest.group).toBe(raw.group);
    expect(manifest.parent).toBe('home');
    expect(manifest.subtitle).not.toBe(manifest.steps[0]!.title);
  });
  it('has a teaser for every step', () => {
    for (const s of manifest.steps) expect(s.blurb.length).toBeGreaterThan(10);
  });
  it('has one step module per step, numbered in manifest order', () => {
    const files = readdirSync(new URL('../steps/', import.meta.url))
      .filter((f) => /^\d\d-/.test(f))
      .sort();
    expect(files.map((f) => f.replace(/^\d\d-|\.ts$/g, ''))).toEqual(manifest.steps.map((s) => s.id));
  });
});
