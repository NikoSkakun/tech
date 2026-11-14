import { describe, expect, it } from 'vitest';
import raw from '@electricity/content/generated/plants.json';
import meta from '@electricity/content/generated/plants.manifest.json';
import { STEP_IDS, type StepId } from '../chapter';
import manifest from '../index';
import { doc, fact, plantBlurb, plantTitle, splitAll } from '../labels';
import { LISTS, OWN } from '../labels-own';
import { PLANT_IDS } from '../plants-data';

describe('plants manifest', () => {
  it('has the 11 steps of the generated content, in order', () => {
    const ids = manifest.steps.map((s) => s.id);
    expect(ids).toEqual(raw.steps.map((s) => s.id));
    expect(ids).toEqual([...STEP_IDS]);
    expect(ids).toHaveLength(11);
  });

  it('takes identity and place from the generated manifest', () => {
    expect(manifest.id).toBe('plants');
    expect(manifest.title).toBe(meta.title);
    expect(manifest.order).toBe(meta.order);
    expect(manifest.group).toBe(meta.group);
    expect(manifest.axisLabel).toBe(meta.axisLabel);
  });
});

describe('plants labels', () => {
  // the quoted captions the steps use (doc(step, i)); a changed document must fail here, not at runtime
  const used: [StepId, number][] = [
    ['intro', 0],
    ['turbine-generator', 0], ['turbine-generator', 1], ['turbine-generator', 3],
    ['energy-chains', 2],
    ['heat-engine', 0], ['heat-engine', 1], ['heat-engine', 2], ['heat-engine', 3], ['heat-engine', 4], ['heat-engine', 5],
    ['rankine', 0], ['rankine', 1], ['rankine', 2], ['rankine', 3], ['rankine', 4], ['rankine', 5], ['rankine', 6], ['rankine', 8], ['rankine', 9], ['rankine', 10], ['rankine', 12], ['rankine', 13],
    ['brayton', 0], ['brayton', 1],
    ['steam-island', 0], ['steam-island', 1], ['steam-island', 2], ['steam-island', 3], ['steam-island', 4], ['steam-island', 5],
    ['metrics', 0], ['metrics', 1], ['metrics', 3], ['metrics', 4], ['metrics', 5],
    ['flexibility', 0], ['flexibility', 1], ['flexibility', 3],
    ['mix', 0], ['mix', 2], ['mix', 3],
    ['gallery', 0], ['gallery', 1], ['gallery', 2], ['gallery', 3],
  ];
  it.each(used)('%s has quoted label #%i', (step, i) => {
    expect(doc(step, i).length).toBeGreaterThan(0);
  });

  it('splits the captions the steps rely on', () => {
    expect(splitAll(doc('metrics', 3))).toHaveLength(3);
    expect(doc('mix', 0).split(':')[1]!.split('·')).toHaveLength(2);
    expect(doc('mix', 2).split(':')[1]!.split('·')).toHaveLength(2);
  });

  it('binds every content hotspot by id', () => {
    const bound: Record<string, string[]> = {
      intro: ['grid'],
      'turbine-generator': ['exciter', 'shaft'],
      'energy-chains': ['waste-heat-branch', 'hydro-chain'],
      'heat-engine': ['cold-reservoir'],
      rankine: ['pump', 'condenser'],
      brayton: ['compressor'],
      'steam-island': ['cooling-tower', 'acc'],
      metrics: ['discount-rate'],
      flexibility: ['base-mid-peak'],
      mix: ['data-note'],
    };
    for (const s of raw.steps) {
      const ids = (s.hotspots ?? []).map((h) => (h as { id?: string }).id).filter(Boolean);
      expect(ids).toEqual(bound[s.id] ?? []);
    }
  });

  it('has a plaque line and a chapter title for every island', () => {
    PLANT_IDS.forEach((id, i) => {
      expect(fact('gallery', i).length).toBeGreaterThan(10);
      expect(plantTitle(id).length).toBeGreaterThan(2);
      expect(plantBlurb(id).length).toBeGreaterThan(10);
    });
  });

  it('own labels are plain Ukrainian text (symbols and units international)', () => {
    const all = [...Object.values(OWN), ...Object.values(LISTS).flat()];
    for (const v of all) {
      expect(v.trim()).toBe(v);
      // no English words: allow units, subscripts and short abbreviations (HP, IP, LP, CF, LCOE)
      expect(v.replace(/_\w+/g, '').replace(/LCOE|MWh|kWh/g, '')).not.toMatch(/[A-Za-z]{4,}/);
    }
    expect(LISTS.compareNames).toHaveLength(15);
    expect(LISTS.sources).toHaveLength(6);
  });
});
