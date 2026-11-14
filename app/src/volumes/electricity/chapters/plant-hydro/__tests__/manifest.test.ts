/**
 * Guards of the chapter's data bindings: the manifest comes from the generated manifest file, every hotspot
 * id the steps bind to exists in the content (and every content hotspot is bound), the step-9 links are full
 * addresses of built chapters' steps.
 */
import { describe, expect, it } from 'vitest';
import { linkTarget } from '@/content';
import raw from '@electricity/content/generated/plant-hydro.json';
import content, { crossTargets } from '../content';
import manifest from '../index';
import { HOTSPOTS } from '../hotspots';
import { STEPS } from '../steps';

describe('plant-hydro manifest and content', () => {
  it('takes title and steps from the generated manifest', () => {
    expect(manifest.id).toBe(raw.id);
    expect(manifest.title).toBe(raw.title);
    expect(manifest.group).toBe(raw.group);
    expect(manifest.parent).toBe('plants');
    expect(manifest.steps.map((s) => s.id)).toEqual(raw.steps.map((s) => s.id));
    expect(manifest.steps.every((s) => s.blurb.length > 0)).toBe(true);
    expect(content.steps.map((s) => s.id)).toEqual(manifest.steps.map((s) => s.id));
    expect(STEPS).toHaveLength(raw.steps.length);
  });

  it('binds every hotspot of the document by its content id', () => {
    for (const step of raw.steps) {
      const ids = step.hotspots.map((h) => h.id);
      expect(Object.values(HOTSPOTS[step.id as keyof typeof HOTSPOTS] ?? {}).sort(), step.id).toEqual(
        [...ids].sort(),
      );
    }
  });

  it('reads the step-9 links as full addresses', () => {
    const links = crossTargets('крок 9');
    expect(links).toEqual(['electricity/plant-wind/overview', 'electricity/plants/gallery']);
    for (const address of links) expect(linkTarget(address)?.chapterId, address).toBeTruthy();
  });
});
