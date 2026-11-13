import { describe, expect, it } from 'vitest';
import { defineContent, type ContentSource } from '@/content/define';
import { manifestText } from '@/content/meta';
import { termName } from '@/content/define';
import type { ChapterMeta } from '@/content/types';
import labBatteryMeta from '../generated/lab-battery.manifest.json';
import plantWindMeta from '../generated/plant-wind.manifest.json';

/** Static, typed imports: a shape change of the generated manifests fails `pnpm typecheck`. */
const TYPED: ChapterMeta[] = [labBatteryMeta, plantWindMeta];

const metas = import.meta.glob<ChapterMeta>('../generated/*.manifest.json', {
  eager: true,
  import: 'default',
});
const contents = import.meta.glob<ContentSource>(['../generated/*.json', '!../generated/*.manifest.json'], {
  eager: true,
  import: 'default',
});

describe('generated manifests (M3)', () => {
  it('exist for every chapter and mirror the content step ids and titles', () => {
    expect(TYPED.length).toBe(2);
    expect(Object.keys(metas)).toHaveLength(25);
    for (const [path, meta] of Object.entries(metas)) {
      const content = contents[path.replace('.manifest.json', '.json')]!;
      expect(meta.title).toBe(content.title);
      expect(meta.steps.map((s) => [s.id, s.title])).toEqual(content.steps.map((s) => [s.id, s.title]));
      for (const s of meta.steps) {
        expect(s.blurb.length).toBeGreaterThan(0);
        expect(s.blurb.length).toBeLessThanOrEqual(141);
        expect(s.blurb).not.toMatch(/\*\*|`/);
      }
      expect(manifestText(meta).steps).toHaveLength(meta.steps.length);
    }
  });

  it('parses table facts, step labels and display names (§54)', () => {
    const battery = defineContent(contents['../generated/lab-battery.json']!);
    const tables = battery.steps.flatMap((s) => s.facts?.items ?? []).filter((f) => f.table);
    expect(tables.length).toBeGreaterThan(0);
    for (const f of tables) for (const row of f.table!.rows) expect(row.length).toBe(f.table!.head.length);
    expect(battery.steps.some((s) => (s.labels?.length ?? 0) > 0)).toBe(true);
    for (const s of battery.steps) for (const t of s.terms ?? []) expect(termName(t)).not.toMatch(/ — /);
    expect(termName({ international: 'BMS', ukrainian: 'система керування батареєю' })).toBe(
      'система керування батареєю (BMS)',
    );
    expect(termName({ international: 'Atom', ukrainian: 'атом' })).toBe('атом');
    expect(termName({ international: 'MV', ukrainian: 'середня напруга (СН)' })).toBe('середня напруга (СН)');
  });
});
