/**
 * Font-atlas coverage of the course copy: every character that can reach the screen from the chapter exports
 * (`docs/volumes/<volume>/chapters/_export/*.json`, on-screen fields only — see `docs/CONTENT_EXPORT.md`) must have a glyph in every
 * face of `public/fonts/fonts.json`. Exit 1 and a list of missing code points otherwise.
 *
 *   node scripts/font-coverage.mjs            # (from app/) or: pnpm fonts:check
 *   node scripts/font-coverage.mjs --list     # also print every non-ASCII character in use
 *   node scripts/font-coverage.mjs --volume electricity   # one volume only (default: all volumes)
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const VOLUMES = join(APP, '../docs/volumes');
// `--volume <id>`: only that volume's exports; default: every volume (the font atlases are shared by all).
const only = process.argv.includes('--volume') ? process.argv[process.argv.indexOf('--volume') + 1] : null;
const EXPORTS = readdirSync(VOLUMES)
  .filter((v) => (only === null || v === only) && existsSync(join(VOLUMES, v, 'chapters/_export')))
  .flatMap((v) =>
    readdirSync(join(VOLUMES, v, 'chapters/_export'))
      .filter((f) => f.endsWith('.json'))
      .map((f) => join(VOLUMES, v, 'chapters/_export', f)),
  );

/** On-screen string fields, by path pattern (`*` = any array index). Guidance fields are not listed. */
const FIELDS = [
  'title',
  'groupLabel',
  'axisLabel',
  'learningGoals.*',
  'steps.*.title',
  'steps.*.panel.*',
  'steps.*.terms.*.{international,ukrainian,symbol,unit,definition,raw}',
  'steps.*.formulas.items.*',
  'steps.*.facts.items.*.{text,source}',
  'steps.*.hotspots.*.{name,international,ukrainian,text}',
  'steps.*.misconceptions.*.{myth,correction}',
  // the simple reading level (docs/briefs/L-simple-level.md): present only in chapters that have it
  'steps.*.simple.title',
  'steps.*.simple.{panel,facts}.*',
  'steps.*.simple.{words,hotspots}.*.{word,text}',
  'steps.*.simple.misconception.{myth,correction}',
  'simpleQuiz.*.{question,explanation}',
  'simpleQuiz.*.options.*',
  'glossary.*.{international,ukrainian,symbol,unit,definition}',
  'quiz.*.{question,explanation}',
  'quiz.*.options.*',
  'crossReferences.*.{where,note}',
];

function* walk(node, parts) {
  if (parts.length === 0) {
    if (typeof node === 'string') yield node;
    return;
  }
  if (node === null || typeof node !== 'object') return;
  const [head, ...rest] = parts;
  if (head === '*') {
    if (Array.isArray(node)) for (const v of node) yield* walk(v, rest);
    return;
  }
  const keys = head.startsWith('{') ? head.slice(1, -1).split(',') : [head];
  for (const k of keys) yield* walk(node[k], rest);
}

/** UI labels quoted «…» inside interaction texts are copy too (export README). */
function* interactionLabels(doc) {
  for (const step of doc.steps ?? [])
    for (const item of step.interaction?.items ?? [])
      for (const m of String(item.text ?? '').matchAll(/«([^«»]*)»/g)) yield m[1];
}

const fonts = JSON.parse(readFileSync(join(APP, 'public/fonts/fonts.json'), 'utf8'));
const faces = Object.entries(fonts.faces).map(([id, f]) => [id, new Set(f.glyphs.map((g) => g[0]))]);

/** cp → chapters using it */
const used = new Map();
for (const file of EXPORTS.sort()) {
  const doc = JSON.parse(readFileSync(file, 'utf8'));
  const strings = [
    ...FIELDS.flatMap((p) => [...walk(doc, p.split(/\.(?![^{]*})/))]),
    ...interactionLabels(doc),
  ];
  for (const s of strings)
    for (const ch of s) {
      const cp = ch.codePointAt(0);
      if (cp < 0x20) continue; // \n, \t: layout controls, not glyphs
      if (!used.has(cp)) used.set(cp, new Set());
      used.get(cp).add(doc.id);
    }
}

const hex = (cp) => 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
const missing = [...used.keys()].filter((cp) => faces.some(([, set]) => !set.has(cp))).sort((a, b) => a - b);
if (process.argv.includes('--list')) {
  const nonAscii = [...used.keys()].filter((cp) => cp > 0x7e).sort((a, b) => a - b);
  console.log(nonAscii.map((cp) => `${String.fromCodePoint(cp)} ${hex(cp)}`).join('\n'));
}
console.log(`font coverage: ${used.size} distinct characters in on-screen copy of the chapter exports`);
for (const cp of missing) {
  const lacking = faces.filter(([, set]) => !set.has(cp)).map(([id]) => id);
  const where = [...used.get(cp)].slice(0, 4).join(', ');
  console.log(
    `  MISSING ${hex(cp)} '${String.fromCodePoint(cp)}' in ${lacking.join('/')} — used in ${where}`,
  );
}
console.log(
  missing.length ? `FAIL: ${missing.length} missing` : 'OK: every character has a glyph in every face',
);
process.exit(missing.length ? 1 : 0);
