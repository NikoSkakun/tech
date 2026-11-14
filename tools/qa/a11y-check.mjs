#!/usr/bin/env node
// Accessibility smoke test of the DOM interface (D8, docs/HUD_DOM.md §14) on one or more steps.
//
//   node tools/qa/a11y-check.mjs [<chapter/step> …] [--size WxH] [--tabs 60] [--hud dom] [--port <n> | --base <url>] [--out <dir>]
//
// Default step: atom/dive-in; default interface: dom (the checks read #kd-hud). Per step:
//   Tab order   focus the canvas, press Tab until the focus cycles; prints the order. Fails when the focus lands
//               on a hidden element or the landmarks go backwards against the reading order of §14
//               (header → step column → dock → board → navigator → spine → system; a skip link may come first)
//   names       Chrome's accessible name (CDP Accessibility) of every visible interactive element — none empty
//   aria-*      expanded / controls / labelledby / describedby / current / dialog / aria-hidden sanity (a11y-parts.mjs)
//   contrast    every visible text against its plate colour from the computed styles — ≥ 4.5:1 (≥ 3:1 large text)
// Regions still drawn by WebGL are invisible to all four (they have no DOM) — the report lists them by name.
// Writes <out>/a11y/<step>.json; exit 1 on any failure.
import { writeFileSync } from 'node:fs';
import { ariaProblems, contrastList, markInteractive } from './a11y-parts.mjs';
import { appUrl, baseUrl, ensureDir, launch, openApp, outRoot, parseArgs, parseSize } from './lib.mjs';
import { webglNames } from './ui-dom-parts.mjs';

const args = parseArgs();
if (!args.hud) process.env.QA_HUD = 'dom';
const routes = args._.length ? args._.map(String) : ['atom/dive-in'];
const [width, height] = parseSize(args.size);
const maxTabs = Number(args.tabs ?? 60);
const base = baseUrl(args);
const out = ensureDir(`${outRoot(args)}/a11y`);
const ORDER = ['header', 'column', 'dock', 'board', 'navigator', 'spine', 'system'];
let failures = 0;

const { browser, page } = await launch({ width, height });
const cdp = await page.context().newCDPSession(page);
try {
  for (const route of routes) {
    const fails = [];
    const fail = (m) => {
      fails.push(m);
      console.log(`  FAIL ${m}`);
    };
    const gpu = await openApp(page, appUrl(base, { route, freeze: 3, extra: { n: route } }));
    await page.evaluate(() => window.__app.settled());
    console.log(`[a11y] ${route} @${width}x${height} · interface ${gpu.hud}`);

    // 1. Tab order from the canvas
    await page.evaluate(() => document.querySelector('canvas')?.focus());
    const order = [];
    for (let i = 0; i < maxTabs; i++) {
      await page.keyboard.press('Tab');
      const a = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const region = el.closest('[data-region]')?.getAttribute('data-region') ?? (el.closest('[data-ui="step-panel"]') ? 'column' : null);
        const r = el.getBoundingClientRect();
        return { id: `${el.tagName.toLowerCase()}:${el.getAttribute('data-ui') ?? el.getAttribute('aria-label') ?? ''}`, dom: Boolean(el.closest('#kd-hud')), region, visible: r.width > 0 && r.height > 0 && el.checkVisibility({ checkOpacity: true }) };
      });
      if (!a || (order.length && a.id === order[0].id)) break;
      order.push(a);
    }
    console.log(`  Tab order (${order.length}): ${order.map((a) => `${a.region ?? '?'}/${a.id}`).join(' → ').slice(0, 900)}`);
    for (const a of order.filter((x) => !x.visible)) fail(`${route}: Tab focuses a hidden element ${a.id}`);
    let last = -1;
    for (const a of order.filter((x) => x.dom && ORDER.includes(x.region))) {
      const k = ORDER.indexOf(a.region);
      if (k < last) fail(`${route}: Tab order goes back to ${a.region} (${a.id}) after ${ORDER[last]}`);
      last = Math.max(last, k);
    }

    // 2. accessible names (Chrome's own computation)
    const marked = await markInteractive(page);
    const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
    const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '[data-a11y-i]' });
    const names = [];
    for (const nodeId of nodeIds) {
      const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
      const { attributes = [] } = await cdp.send('DOM.getAttributes', { nodeId });
      const k = Number(attributes[attributes.indexOf('data-a11y-i') + 1]);
      names.push({ ...marked[k], name: nodes[0]?.name?.value ?? '', axRole: nodes[0]?.role?.value ?? '' });
    }
    await page.evaluate(() => document.querySelectorAll('[data-a11y-i]').forEach((e) => e.removeAttribute('data-a11y-i')));
    for (const n of names.filter((x) => !String(x.name).trim())) fail(`${route}: ${n.tag}[${n.ui}] (${n.axRole}) has no accessible name`);
    console.log(`  names: ${names.length} interactive, ${names.filter((x) => String(x.name).trim()).length} named`);

    // 3. aria sanity, 4. contrast
    for (const p of await ariaProblems(page)) fail(`${route}: ${p}`);
    const contrast = await contrastList(page);
    const judged = contrast.filter((c) => c.ratio !== null);
    for (const c of judged.filter((x) => x.ratio < x.need)) fail(`${route}: contrast ${c.ratio.toFixed(2)}:1 < ${c.need}:1 — «${c.text}» [${c.ui}] ${c.px.toFixed(1)} px`);
    const worst = judged.length ? Math.min(...judged.map((c) => c.ratio)) : null;
    console.log(`  contrast: ${judged.length} texts on plates (worst ${worst?.toFixed(2) ?? '—'}:1), ${contrast.length - judged.length} over the scene (not judged)`);
    const gl = gpu.hud === 'dom' ? await webglNames(page) : [];
    if (gl.length) console.log(`  not covered (still WebGL, no DOM): ${gl.slice(0, 12).join(', ')}${gl.length > 12 ? ` … ${gl.length - 12} more` : ''}`);
    writeFileSync(`${out}/${route.replace(/\//g, '-')}.json`, JSON.stringify({ route, hud: gpu.hud, size: `${width}x${height}`, order, names, contrast, webgl: gl, failures: fails }, null, 2));
    console.log(fails.length ? `FAILED a11y ${route}: ${fails.length} problem(s)` : `PASS a11y ${route}`);
    failures += fails.length;
  }
} catch (e) {
  failures++;
  console.log(`  FAIL aborted: ${e.message}`);
} finally {
  await browser.close();
}
process.exit(failures ? 1 : 0);
