import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import raw from '@electricity/content/generated/current.json';

/** Every hotspot of the chapter document must be placed in the scene (`content: '<id>'` in its step module). */
describe('current hotspots', () => {
  const steps = join(dirname(fileURLToPath(import.meta.url)), '..', 'steps');
  const sources = readdirSync(steps)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => ({ file: f, text: readFileSync(join(steps, f), 'utf8') }));

  it('has one module per step, named NN-<id>.ts', () => {
    raw.steps.forEach((s, k) => {
      const name = `${String(k + 1).padStart(2, '0')}-${s.id}.ts`;
      expect(sources.map((x) => x.file)).toContain(name);
    });
  });

  it('places every hotspot of every step', () => {
    raw.steps.forEach((s, k) => {
      const source =
        sources.find((x) => x.file === `${String(k + 1).padStart(2, '0')}-${s.id}.ts`)?.text ?? '';
      for (const h of s.hotspots) expect(source, `${s.id}: hotspot ${h.id}`).toContain(`content: '${h.id}'`);
    });
  });

  it('declares a camera fit on every shot (DECISIONS §57 d)', () => {
    for (const { file, text } of sources.filter((x) => /^\d\d-/.test(x.file) && !x.file.includes('board'))) {
      const shots = text.match(/position: \[/g)?.length ?? 0;
      const fits = text.match(/fit: \{/g)?.length ?? 0;
      expect(fits, file).toBe(shots);
    }
  });
});
