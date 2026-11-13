import { describe, expect, it } from 'vitest';
import raw from '@electricity/content/generated/current.json';
import manifest from '../index';
import { DOC } from '../labels';
import { OWN } from '../labels-own';

describe('current manifest', () => {
  it('has the steps and titles of the chapter document', () => {
    expect(manifest.steps.map((s) => s.id)).toEqual(raw.steps.map((s) => s.id));
    expect(manifest.steps.map((s) => s.title)).toEqual(raw.steps.map((s) => s.title));
    expect(manifest.title).toBe(raw.title);
    expect(manifest.group).toBe(raw.group);
    expect(manifest.order).toBe(4);
  });
  it('has a teaser for every step', () => {
    for (const s of manifest.steps) expect(s.blurb.length).toBeGreaterThan(10);
  });
});

describe('current labels', () => {
  // landmarks: if the document's quoted captions are re-ordered, the indexes in labels.ts must follow
  it('picks the captions the code expects', () => {
    expect(DOC.currentSlider).toContain('I');
    expect(DOC.showElectrons).toMatch(/електрон/);
    expect(DOC.balls).toMatch(/кульк/);
    expect(DOC.water).toMatch(/аналогія/i);
    expect(DOC.materials).toHaveLength(4);
    expect(DOC.samples).toHaveLength(2);
    expect(DOC.record).toMatch(/точку/);
    expect(DOC.newFuse).toMatch(/запобіжник/);
    expect(DOC.boil).toMatch(/1\sL/);
    expect(DOC.presets).toHaveLength(5);
    expect(DOC.walkLoop).toMatch(/контур/);
    expect(DOC.voltages).toHaveLength(7);
    expect(DOC.modes).toHaveLength(6);
    expect(DOC.replaceFuse).toMatch(/запобіжник/);
    expect(DOC.dcAc).toHaveLength(2);
    expect(DOC.currentOn).toMatch(/струм/);
  });
  it('has no empty label', () => {
    for (const v of [...Object.values(DOC), ...Object.values(OWN)].flat())
      expect(v.trim().length).toBeGreaterThan(0);
  });
});
