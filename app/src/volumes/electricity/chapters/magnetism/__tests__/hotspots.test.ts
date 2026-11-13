import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import raw from '@electricity/content/generated/magnetism.json';

/** Every hotspot of the chapter document must be placed in the scene (`content: '<id>'` or its index). */
describe('magnetism hotspots', () => {
  const steps = join(dirname(fileURLToPath(import.meta.url)), '..', 'steps');
  const sources = readdirSync(steps)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => ({ file: f, text: readFileSync(join(steps, f), 'utf8') }));
  const fileOf = (k: number, id: string): string => `${String(k + 1).padStart(2, '0')}-${id}.ts`;

  it('has one module per step, named NN-<id>.ts', () => {
    raw.steps.forEach((s, k) => expect(sources.map((x) => x.file)).toContain(fileOf(k, s.id)));
  });

  it('places every hotspot of every step', () => {
    raw.steps.forEach((s, k) => {
      const source = sources.find((x) => x.file === fileOf(k, s.id))?.text ?? '';
      s.hotspots.forEach((h, i) => {
        const id = (h as { id?: string }).id;
        const bound = (id && source.includes(`content: '${id}'`)) || source.includes(`content: ${i} `) || source.includes(`content: ${i},`);
        expect(bound, `${s.id}: hotspot ${id ?? i}`).toBe(true);
      });
    });
  });

  it('declares a camera fit on every shot (DECISIONS §57 d)', () => {
    for (const { file, text } of sources.filter((x) => /^\d\d-/.test(x.file))) {
      const shots = text.match(/position: \[/g)?.length ?? 0;
      const fits = text.match(/fit: \{/g)?.length ?? 0;
      expect(fits, file).toBeGreaterThanOrEqual(shots);
    }
  });
});
