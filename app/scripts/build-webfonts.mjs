// Builds the web fonts of the DOM interface (docs/HUD_DOM.md §5): each face of webfaces.mjs subset to the
// course charset (charset.mjs — the same code points as the SDF atlases), WOFF2, OpenType layout features and
// the `name` table (OFL copyright / licence) kept.
//
//   pnpm webfonts         → public/fonts/web/<face>.woff2
//
// Build dependency: Python 3 with fontTools ≥ 4.40 and brotli (`pip install fonttools brotli`; Ubuntu:
// `apt install python3-fonttools python3-brotli`). No JavaScript subsetter keeps GSUB/GPOS (kerning,
// ligatures, `sups` / `subs`) and writes WOFF2, so the subsetting itself runs in fontTools
// (build-webfonts.py, which also composes the glyphs no font has, as the atlas builder does).
import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { charset, DC_SYMBOL, SYNTH } from './charset.mjs';
import { WEB_FACES, isSymbolFace } from './webfaces.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'node_modules/@expo-google-fonts');
const OUT = join(ROOT, 'public/fonts/web');

mkdirSync(OUT, { recursive: true });
// text faces get the composed glyphs of the atlases (SYNTH, ⎓); the symbol faces are subset as they are
const faces = Object.fromEntries(
  Object.entries(WEB_FACES).map(([name, rel]) => [name, { src: join(SRC, rel), synth: !isSymbolFace(name) }]),
);
const job = JSON.stringify({ faces, codepoints: charset(), synth: SYNTH, dc: DC_SYMBOL, out: OUT });
const script = join(dirname(fileURLToPath(import.meta.url)), 'build-webfonts.py');
const run = spawnSync('python3', [script], { input: job, encoding: 'utf8' });
if (run.status !== 0) {
  console.error(run.stderr || run.error?.message || 'python3 failed');
  console.error('build-webfonts needs Python 3 with fontTools and brotli (see the header of this script).');
  process.exit(1);
}
let total = 0;
for (const name of Object.keys(WEB_FACES)) {
  const size = statSync(join(OUT, `${name}.woff2`)).size;
  total += size;
  console.log(`  ${name.padEnd(11)} ${(size / 1024).toFixed(1)} kB`);
}
console.log(`web fonts: ${Object.keys(WEB_FACES).length} faces, ${(total / 1024).toFixed(0)} kB → public/fonts/web/`);
