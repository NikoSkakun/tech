#!/usr/bin/env node
// Colour-management check: do palette tokens land on screen as specified (STYLE_GUIDE §2, brief §3)?
//
//   node tools/qa/color-check.mjs [--port 5201] [--q high] [--out dir]
//
// Works against the DEV server only (it imports source modules in the page). It puts two rows of swatches
// into the HUD layer — unlit `K.flat(token)` and fully lit `K.toon(token)` — takes a lossless screenshot and
// compares the mean colour of each swatch with the token's sRGB hex. Everything between the material and the
// screen is exercised: HDR targets, bloom threshold, display transform, grade, vignette, grain, FXAA.
// Fails if any channel of any swatch is off by more than --tolerance (default 6 of 255).
import { createRequire } from 'node:module';
import { appUrl, baseUrl, ensureDir, launch, openApp, outRoot, parseArgs } from './lib.mjs';

const require = createRequire(new URL('../../app/package.json', import.meta.url));
const { PNG } = require('pngjs');

const args = parseArgs();
const base = baseUrl(args);
const tolerance = Number(args.tolerance ?? 6);
const outDir = ensureDir(outRoot(args));
const width = 1920;
const height = 1080;

const { browser, page } = await launch({ width, height });
let failed = false;
try {
  await openApp(page, appUrl(base, { q: String(args.q ?? 'high'), freeze: 1 }));
  const swatches = await page.evaluate(async () => {
    const engine = window.__app.engine;
    // the same module instances the app uses (Vite dev URLs)
    const hudSource = await (await fetch('/src/engine/hud.ts')).text();
    const threeUrl = /from\s+"([^"]*three[^"]*)"/.exec(hudSource)[1];
    const THREE = await import(threeUrl);
    const style = await import('/src/style/index.ts');
    const tokens = [
      ...Object.keys(style.ACCENT),
      ...Object.keys(style.NEUTRAL),
      ...Object.keys(style.BG).map((k) => `bg.${k}`),
    ];
    // compact grid in the middle of the screen, where the vignette is zero
    const size = 44;
    const gap = 8;
    const cols = 8;
    const rowsPerKind = Math.ceil(tokens.length / cols);
    const pitch = size + gap;
    const group = new THREE.Group();
    const out = [];
    // an opaque backdrop so nothing of the scene shows through
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(cols * pitch + 60, 2 * rowsPerKind * pitch + 100),
      style.K.flat('bg.deep'),
    );
    back.position.z = 30;
    group.add(back);
    const m = engine.hud.metrics;
    // HUD units → CSS px (z = 32 is slightly in front of the screen plane: account for perspective)
    const d = m.height / 2 / Math.tan((24 * Math.PI) / 360);
    const k = (d / (d - 32)) * m.pxPerUnit;
    tokens.forEach((token, i) => {
      for (const [block, make] of [
        [0, () => style.K.flat(token)],
        [1, () => style.K.toon({ color: token, rim: 0, highlight: 0, fog: false })],
      ]) {
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), make());
        const col = i % cols;
        const row = Math.floor(i / cols) + block * rowsPerKind;
        mesh.position.set((col - (cols - 1) / 2) * pitch, ((2 * rowsPerKind - 1) / 2 - row) * pitch + (block ? -12 : 12), 32);
        group.add(mesh);
        out.push({
          token,
          kind: block === 0 ? 'flat' : 'toon',
          hex: style.hex(token),
          x: Math.round(m.cssWidth / 2 + mesh.position.x * k),
          y: Math.round(m.cssHeight / 2 - mesh.position.y * k),
        });
      }
    });
    engine.hud.root.add(group);
    await window.__app.step(1 / 60, 2);
    return out;
  });
  const png = PNG.sync.read(await page.screenshot({ type: 'png', path: `${outDir}/color-check.png` }));
  let worst = { d: 0 };
  const rows = [];
  for (const s of swatches) {
    const sum = [0, 0, 0];
    let n = 0;
    for (let dy = -9; dy <= 9; dy++) {
      for (let dx = -9; dx <= 9; dx++) {
        const i = ((s.y + dy) * png.width + (s.x + dx)) * 4;
        sum[0] += png.data[i];
        sum[1] += png.data[i + 1];
        sum[2] += png.data[i + 2];
        n++;
      }
    }
    const got = sum.map((v) => v / n);
    const want = [1, 3, 5].map((k) => parseInt(s.hex.slice(k, k + 2), 16));
    const d = Math.max(...got.map((v, k) => Math.abs(v - want[k])));
    rows.push({ ...s, got: got.map((v) => Math.round(v)), want, d });
    if (d > worst.d) worst = { ...s, d, got, want };
  }
  const report = (kind) => {
    const list = rows.filter((r) => r.kind === kind);
    const max = Math.max(...list.map((r) => r.d));
    const mean = list.reduce((a, r) => a + r.d, 0) / list.length;
    console.log(`${kind.padEnd(5)} swatches: ${list.length} · max channel error ${max.toFixed(1)} / 255 · mean ${mean.toFixed(1)}`);
    return max;
  };
  const maxFlat = report('flat');
  const maxToon = report('toon');
  console.log(`worst: ${worst.token} (${worst.kind}) want ${worst.want} got ${worst.got.map((v) => v.toFixed(1))}`);
  if (Math.max(maxFlat, maxToon) > tolerance) {
    failed = true;
    for (const r of rows.filter((x) => x.d > tolerance)) console.log(`  FAIL ${r.kind} ${r.token}: want ${r.want} got ${r.got} (Δ ${r.d.toFixed(1)})`);
  }
  console.log(`screenshot: ${outDir}/color-check.png`);
} catch (e) {
  failed = true;
  console.error(`color-check failed: ${e.message}`);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
