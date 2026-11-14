// Building blocks of chapter-check (M3): layout checks at the current viewport, robust frame-time sampling,
// and UI snapshots for comparing device pixel ratios.
import { fmt } from './lib.mjs';
import { hudChecks } from './dom-parts.mjs';

/** Advance a few deterministic frames so a resize / navigation is laid out and drawn. */
export async function settleFrames(page, n = 3) {
  for (let i = 0; i < n; i++) await page.evaluate(() => window.__app.step(1 / 60, 1));
}

/**
 * Layout checks of the step on screen at the current viewport:
 *  - controls outside the viewport (`__ui.offscreen()`, the HUD hook of M3-ui: interactive nodes whose visible hit
 *    box leaves the viewport; content scrolled out of a scroll view does not count) → fail;
 *  - world text below `minText` px-eq → fail, at 1280×720 only (the legibility reference size);
 *  - SDF text magnified beyond `sdfMaxMag` × the atlas resolution (soft corners) → warning;
 *  - interface text below caption units, overlapping chrome regions → fail (`hudChecks`, dom-parts.mjs).
 */
export async function layoutAt(page, { step, minText, sdfMaxMag, fail, note, warn }) {
  const vp = page.viewportSize();
  const size = `${vp.width}x${vp.height}`;
  const r = await page.evaluate(() => {
    const ui = window.__ui;
    return {
      off:
        typeof ui?.offscreen === 'function'
          ? ui.offscreen().map((n) => `${n.name} (${n.reason}, y ${Math.round(n.y)})`)
          : typeof ui?.offscreenControls === 'function'
            ? ui.offscreenControls()
            : null,
      texts: window.__app.textSizes(),
      uiTexts: typeof ui?.worldTextSizes === 'function' ? ui.worldTextSizes() : null,
    };
  });
  const entry = { step, size };
  if (r.off === null) note('HUD has no __ui.offscreen() hook — control overflow not checked');
  else {
    entry.offscreen = r.off;
    if (Array.isArray(r.off) && r.off.length > 0)
      fail(`${step} @${size}: ${r.off.length} control(s) outside the viewport: ${JSON.stringify(r.off).slice(0, 200)}`);
  }
  const texts = [...r.texts, ...(Array.isArray(r.uiTexts) ? r.uiTexts : [])];
  entry.textCount = texts.length;
  entry.textMin = texts.length ? Math.min(...texts.map((t) => t.pxEq)) : null;
  if (vp.width === 1280 && vp.height === 720) {
    if (r.uiTexts === null) note('ui3d world surfaces are not measured (no __ui.worldTextSizes() hook); Text3D only');
    const small = texts.filter((t) => typeof t.pxEq === 'number' && t.pxEq < minText);
    for (const t of small.slice(0, 5))
      fail(`${step} @${size}: text «${t.text}» is ${fmt(t.pxEq, 1)} px-eq on screen (< ${minText})${t.path ? ` [${t.path}]` : ''}`);
    if (small.length > 5) fail(`${step} @${size}: … ${small.length - 5} more texts below ${minText} px-eq`);
  }
  const soft = r.texts.filter((t) => typeof t.magnification === 'number' && t.magnification > sdfMaxMag);
  entry.maxMagnification = r.texts.length ? Math.max(...r.texts.map((t) => t.magnification ?? 0)) : null;
  for (const t of soft.slice(0, 3))
    warn(`${step} @${size}: text «${t.text}» is drawn at ${fmt(t.magnification, 1)}× the SDF atlas resolution (> ${sdfMaxMag}×: corners may look soft)`);
  // D8: interface text ≥ caption units and no overlapping regions, both renderers (dom-parts.mjs)
  await hudChecks(page, entry, { step, size, fail, note });
  return entry;
}

/**
 * Frame time per step: `rounds` interleaved passes over all steps (each pass visits every step once), so load
 * from other GPU users spoils one sample per step at most. Returns step → { best, samples, spread }.
 */
export async function measurePerf(page, { chapterId, steps, rounds, frames }) {
  const samples = new Map(steps.map((s) => [s, []]));
  for (let r = 0; r < rounds; r++) {
    for (const step of steps) {
      await page.evaluate(([c, s]) => window.__app.goto(c, s, { instant: true }), [chapterId, step]);
      await page.waitForTimeout(r === 0 ? 700 : 300); // camera moves and tweens settle in real time
      const m = await page.evaluate((n) => window.__app.measure(n), frames);
      const s = await page.evaluate(() => window.__app.stats());
      samples.get(step).push({ ...m, drawCalls: s.drawCalls, triangles: s.triangles, quality: s.quality, resolution: s.resolution });
    }
  }
  return summarise(samples, steps);
}

/**
 * Confirmation pass for steps whose best sample is over `limit`: up to `extra` more samples each, spaced by a
 * pause, so load that lasted the whole interleaved run (another agent's chapter-check) is not reported as the
 * chapter's cost. Returns the updated summary.
 */
export async function confirmPerf(page, perf, { chapterId, limit, frames, extra = 3, pauseMs = 4000 }) {
  for (const [step, r] of perf) {
    if (r.best.frameAvg <= limit) continue;
    await page.evaluate(([c, s]) => window.__app.goto(c, s, { instant: true }), [chapterId, step]);
    for (let i = 0; i < extra && r.best.frameAvg > limit; i++) {
      await page.waitForTimeout(pauseMs);
      const m = await page.evaluate((n) => window.__app.measure(n), frames);
      const s = await page.evaluate(() => window.__app.stats());
      const sample = { ...m, drawCalls: s.drawCalls, triangles: s.triangles, quality: s.quality, resolution: s.resolution };
      r.samples.push(m.frameAvg);
      if (m.frameAvg < r.best.frameAvg) r.best = sample;
      r.spread = Math.max(...r.samples) - Math.min(...r.samples);
      r.confirmed = (r.confirmed ?? 0) + 1;
    }
  }
  return perf;
}

function summarise(samples, steps) {
  const out = new Map();
  for (const step of steps) {
    const list = samples.get(step);
    const best = list.reduce((a, b) => (b.frameAvg < a.frameAvg ? b : a));
    const all = list.map((m) => m.frameAvg);
    out.set(step, { best, samples: all, spread: Math.max(...all) - Math.min(...all) });
  }
  return out;
}

/**
 * CSS-px rectangles of every visible named HUD node, chapter probes and small hit targets. HUD transitions advance
 * per rendered frame (not with the frozen clock), so the page is settled and stepped first — otherwise the dock is
 * caught mid-slide and the comparison is timing noise.
 */
export async function uiSnapshot(page) {
  await page.evaluate(() => window.__app.settled());
  await settleFrames(page, 30);
  return page.evaluate(() => {
    const ui = window.__ui;
    const nodes = {};
    for (const n of ui?.names?.() ?? []) nodes[n] = ui.locate(n);
    const probes = {};
    for (const p of window.__app.probes().filter((n) => !n.startsWith('read:'))) probes[p] = window.__app.locate(p);
    return { nodes, probes, small: (ui?.smallTargets?.() ?? []).slice().sort() };
  });
}

/** Differences between two UI snapshots taken at different device pixel ratios (tolerance in CSS px). */
export function compareSnapshots(a, b, tol = 2) {
  const diffs = [];
  const near = (p, q, keys) => keys.every((k) => Math.abs((p?.[k] ?? 0) - (q?.[k] ?? 0)) <= tol);
  for (const [kind, keys] of [['nodes', ['x', 'y', 'w', 'h']], ['probes', ['x', 'y']]]) {
    for (const name of new Set([...Object.keys(a[kind]), ...Object.keys(b[kind])])) {
      const p = a[kind][name];
      const q = b[kind][name];
      if (!p || !q) diffs.push(`${name}: present only at DPR ${p ? 1 : 2}`);
      else if (!near(p, q, keys)) diffs.push(`${name}: ${keys.map((k) => `${k} ${fmt(p[k], 0)}→${fmt(q[k], 0)}`).join(' ')}`);
    }
  }
  if (a.small.join('|') !== b.small.join('|')) diffs.push(`small hit targets differ: [${a.small.join(', ')}] vs [${b.small.join(', ')}]`);
  return diffs;
}
