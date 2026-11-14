import { describe, expect, it } from 'vitest';
import raw from '@electricity/content/generated/generator-ac.json';
import meta from '@electricity/content/generated/generator-ac.manifest.json';
import { STEP_IDS } from '../chapter';
import manifest from '../index';
import { doc, splitAll, splitPair } from '../labels';
import { OWN } from '../labels-own';

describe('generator-ac manifest', () => {
  it('has the 11 steps of the generated content, in order', () => {
    const ids = manifest.steps.map((s) => s.id);
    expect(ids).toEqual(raw.steps.map((s) => s.id));
    expect(ids).toEqual([...STEP_IDS]);
    expect(ids).toHaveLength(11);
  });

  it('takes identity and place from the generated manifest', () => {
    expect(manifest.id).toBe('generator-ac');
    expect(manifest.title).toBe(meta.title);
    expect(manifest.order).toBe(meta.order);
    expect(manifest.group).toBe(meta.group);
    expect(manifest.axisLabel).toBe(meta.axisLabel);
  });
});

describe('generator-ac labels', () => {
  // the quoted captions the steps use (doc(step, i)); a changed document must fail here, not at runtime
  const used: [string, number][] = [
    ['rotating-loop', 0], ['rotating-loop', 2], ['rotating-loop', 3], ['rotating-loop', 4],
    ['ac-anatomy', 0], ['ac-anatomy', 1], ['ac-anatomy', 2], ['ac-anatomy', 3],
    ['war-of-currents', 0],
    ['three-phase', 0], ['three-phase', 2], ['three-phase', 4], ['three-phase', 7],
    ['star-delta', 0], ['star-delta', 1], ['star-delta', 4],
    ['rotating-field', 0], ['rotating-field', 1], ['rotating-field', 4], ['rotating-field', 5], ['rotating-field', 7], ['rotating-field', 8], ['rotating-field', 9],
    ['synchronous-generator', 0], ['synchronous-generator', 1], ['synchronous-generator', 2], ['synchronous-generator', 5],
    ['synchronization', 0], ['synchronization', 1], ['synchronization', 2], ['synchronization', 3], ['synchronization', 4], ['synchronization', 5], ['synchronization', 6], ['synchronization', 7], ['synchronization', 9], ['synchronization', 10],
    ['rlc', 0], ['rlc', 1], ['rlc', 2], ['rlc', 3], ['rlc', 4], ['rlc', 5],
    ['ac-power', 0], ['ac-power', 1], ['ac-power', 2],
    ['to-transformer', 0], ['to-transformer', 1],
  ];
  it.each(used)('%s has quoted label #%i', (step, i) => {
    expect(doc(step as (typeof STEP_IDS)[number], i).length).toBeGreaterThan(0);
  });

  it('splits the segmented captions the steps rely on', () => {
    expect(splitPair(doc('three-phase', 2))).toHaveLength(2);
    expect(splitAll(doc('rlc', 4))).toHaveLength(4);
    expect(splitAll(doc('synchronous-generator', 5))).toHaveLength(4);
  });

  it('every hotspot the scene binds by content id exists in its step', () => {
    const bound: Record<string, string[]> = {
      'rotating-loop': ['loop-normal', 'phasor-trace'],
      'ac-anatomy': ['rms-line', 'frequency-map'],
      'war-of-currents': ['pole-transformer', 'edison-dynamo', 'hvdc-cable'],
      'three-phase': ['coil-l1', 'neutral-ammeter', 'phasor-triangle'],
      'star-delta': ['line-voltage-vector', 'terminal-box'],
      'rotating-field': ['cage-bars', 'slip-indicator', 'stator'],
      'synchronous-generator': ['stator-bars', 'rotor', 'hydrogen-cooler', 'voltage-regulator', 'hydro-poles'],
      synchronization: ['synchroscope', 'sync-lamps', 'field-springs'],
      rlc: ['inductor', 'capacitor', 'resonance-peak'],
      'ac-power': ['meter', 'capacitor-bank', 'power-triangle'],
      'to-transformer': ['core'],
    };
    for (const s of raw.steps) expect((s.hotspots ?? []).map((h: { id?: string }) => h.id)).toEqual(bound[s.id]);
  });

  it('own labels are plain Ukrainian text', () => {
    for (const v of Object.values(OWN)) {
      expect(v.trim()).toBe(v);
      // no English words; proper names stay as they are (DECISIONS §54 e)
      expect(v.replace(/Pearl Street|Westinghouse/g, '')).not.toMatch(/[A-Za-z]{4,}/);
    }
  });
});
