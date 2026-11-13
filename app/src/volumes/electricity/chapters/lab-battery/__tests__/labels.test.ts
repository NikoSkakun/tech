import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import raw from '@electricity/content/generated/lab-battery.json';
import { CHEMS, CHEM_TABLE } from '../chem-data';
import { DOC, L, OWN } from '../labels';

/** Letters and digits only, lower case: quotes, NBSP and punctuation do not matter for "is this the same wording". */
const norm = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

describe('lab-battery labels', () => {
  // the export keeps the builder guidance (`interaction`, `see`) that the runtime file drops
  const doc = JSON.parse(
    readFileSync(new URL('../../../../../../../docs/volumes/electricity/chapters/_export/lab-battery.json', import.meta.url), 'utf8'),
  ) as {
    steps: { see?: unknown; interaction?: unknown }[];
  };
  const guidance = norm(JSON.stringify(doc.steps.map((s) => [s.interaction, s.see])));

  it('DOC labels are verbatim wording of the chapter document', () => {
    const missing = Object.entries(DOC).filter(([, text]) => !guidance.includes(norm(text)));
    expect(missing).toEqual([]);
  });
  it('DOC and OWN keys do not collide and no label is empty', () => {
    expect(Object.keys(DOC).filter((k) => k in OWN)).toEqual([]);
    for (const [key, text] of Object.entries(L)) expect(text.trim(), key).not.toBe('');
  });
  it('every hotspot of the document is placed by a step, under its exact name (the HUD looks the text up by it)', () => {
    const dir = new URL('../steps/', import.meta.url);
    const source = readdirSync(dir)
      .map((f) => readFileSync(new URL(f, dir), 'utf8'))
      .join('\n');
    const used = [...source.matchAll(/title: '([^']+)'/g)].map((m) => m[1]!);
    const names = raw.steps.flatMap((s) => s.hotspots.map((h) => h.name));
    expect(used.filter((t) => !names.includes(t))).toEqual([]);
    expect(names.filter((n) => !used.includes(n))).toEqual([]);
  });
});

describe('lab-battery chemistry table (parsed from the content)', () => {
  it('has seven columns and a row for every chemistry of the showcase', () => {
    expect(CHEM_TABLE.headers).toHaveLength(7);
    for (const id of CHEMS) expect(CHEM_TABLE.rows[id], id).toHaveLength(7);
    expect(CHEM_TABLE.rows.LFP![1]).toBe('3,2');
  });
});
