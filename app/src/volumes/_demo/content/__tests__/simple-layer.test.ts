/** The `_demo/wave` fixture of the simple reading level (docs/briefs/L-simple-level.md) through `@/content`. */
import { describe, expect, it } from 'vitest';
import { defineContent, hasSimpleLayer, quizAtLevel, stepAtLevel } from '@/content';
import antenna from '../generated/antenna.json';
import wave from '../generated/wave.json';

describe('generated fixture (_demo)', () => {
  const w = defineContent(wave);
  const a = defineContent(antenna);

  it('carries the simple layer and the simple quiz through defineContent', () => {
    expect(hasSimpleLayer(w)).toBe(true);
    expect(w.steps.every((s) => !!s.simple)).toBe(true);
    expect(w.steps[0]!.simple?.hotspots?.find((h) => h.id === 'bead')?.text).toBeTruthy();
    expect(quizAtLevel(w, 'simple')).toMatchObject({ level: 'simple', items: { length: 3 } });
    expect(quizAtLevel(w, 'detailed')?.items).toBe(w.quiz);
  });

  it('a chapter without a simple layer falls back to its detailed quiz and copy', () => {
    expect(hasSimpleLayer(a)).toBe(false);
    expect(quizAtLevel(a, 'simple')?.level).toBe('detailed');
    expect(stepAtLevel(a.steps[0]!, 'simple').level).toBe('detailed');
  });

  it('never shows the builder part of a misconception', () => {
    expect(JSON.stringify(wave)).not.toContain('Сцена');
  });
});
