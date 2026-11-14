// Chrome DevTools Protocol helpers of dom-cost.mjs (D8, docs/HUD_DOM.md §15): renderer metrics over a window
// of real frames, and script time attributed to the interface's source files by the sampling profiler.

/** Metrics of `Performance.getMetrics` that dom-cost reports (durations in seconds, counts as counts). */
const KEYS = ['ScriptDuration', 'LayoutCount', 'LayoutDuration', 'RecalcStyleCount', 'RecalcStyleDuration', 'TaskDuration'];

async function metrics(cdp) {
  const { metrics: list } = await cdp.send('Performance.getMetrics');
  return Object.fromEntries(list.filter((m) => KEYS.includes(m.name)).map((m) => [m.name, m.value]));
}

/** Let `n` real animation frames pass in the page. */
export function rafFrames(page, n) {
  return page.evaluate(
    (count) =>
      new Promise((resolve) => {
        let k = 0;
        const tick = () => (++k >= count ? resolve() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      }),
    n,
  );
}

/**
 * Metric deltas while `run()` executes (default: `frames` real frames), per frame: durations in ms, counts as
 * the total over the window. `Performance.enable` must have been sent on `cdp`.
 */
export async function metricWindow(page, cdp, frames, run = () => rafFrames(page, frames)) {
  const a = await metrics(cdp);
  await run();
  const b = await metrics(cdp);
  const d = (k) => (b[k] ?? 0) - (a[k] ?? 0);
  return {
    frames,
    scriptMs: (d('ScriptDuration') * 1000) / frames,
    taskMs: (d('TaskDuration') * 1000) / frames,
    layouts: d('LayoutCount'),
    layoutMs: d('LayoutDuration') * 1000,
    recalcs: d('RecalcStyleCount'),
    recalcMs: (d('RecalcStyleDuration') * 1000) / frames,
  };
}

/**
 * Script time per frame spent in source files whose URL matches each pattern (inclusive of what they call —
 * DOM setters, style writes), from a V8 sampling profile over `frames` real frames. Needs the dev server: in a
 * production bundle the files are merged and nothing can be attributed (the result is then 0 with `bundled`).
 */
export async function profileWindow(page, cdp, frames, patterns) {
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
  await cdp.send('Profiler.start');
  await rafFrames(page, frames);
  const { profile } = await cdp.send('Profiler.stop');
  await cdp.send('Profiler.disable');
  const self = new Map();
  const { samples = [], timeDeltas = [] } = profile;
  for (let i = 0; i < samples.length; i++) self.set(samples[i], (self.get(samples[i]) ?? 0) + (timeDeltas[i + 1] ?? 0));
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const out = Object.fromEntries(Object.keys(patterns).map((k) => [k, 0]));
  // every sample goes to the innermost frame of a matching file on its stack: the native DOM work a region's
  // update() causes counts to that region, a DOM region called from the WebGL HUD's loop counts to the DOM
  const walk = (n, bucket) => {
    const url = n.callFrame.url ?? '';
    const b = Object.keys(patterns).find((k) => patterns[k].test(url)) ?? bucket;
    if (b) out[b] += self.get(n.id) ?? 0;
    for (const c of n.children ?? []) walk(byId.get(c), b);
  };
  walk(profile.nodes[0], null);
  const bundled = !profile.nodes.some((n) => /\/src\//.test(n.callFrame.url ?? ''));
  return { ...Object.fromEntries(Object.entries(out).map(([k, us]) => [k, us / 1000 / frames])), bundled };
}

/** Element count of the DOM interface layer (`#kd-hud`), 0 without it. */
export function domNodes(page) {
  return page.evaluate(() => document.querySelectorAll('#kd-hud *').length);
}
