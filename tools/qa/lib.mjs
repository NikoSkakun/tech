// Shared helpers for the QA tools (ARCHITECTURE §5). Runs on lenovo with the system Chrome on the GPU.
//
// Common options of every tool:
//   --port <n>      dev/preview server port            (default: $QA_PORT or 5201)
//   --base <url>    full base URL instead of --port     (e.g. http://localhost:8080/)
//   --size WxH      viewport in CSS px                  (default 1920x1080)
//   --q <tier>      quality tier low|medium|high|ultra  (default high)
//   --out <path>    output file or directory            (default /srv/electricity/qa/$QA_ID or .../misc)
//   --hud dom|gl    interface renderer, passed as ?hud= (default: $QA_HUD, else none = the app's default;
//                   docs/HUD_DOM.md §16). `openApp` reports the mode in effect (`gpu.hud`, one log line).
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// playwright-core is a devDependency of the app; resolve it from there so no extra install is needed.
const require = createRequire(new URL('../../app/package.json', import.meta.url));
const { chromium } = require('playwright-core');

/**
 * Without `--use-angle=vulkan` headless Chrome silently falls back to SwiftShader / the integrated GPU.
 * `--enable-features=Vulkan` (listed in ARCHITECTURE §5) is deliberately NOT used: it also switches the
 * compositor to Vulkan, which fails to create a surface in headless mode and makes every WebGL context get
 * lost and restored ~1 s after page load. ANGLE-on-Vulkan alone renders on the RTX 5060 without that hiccup.
 * `openApp()` asserts the NVIDIA renderer string either way.
 */
export const GPU_ARGS = [
  '--use-angle=vulkan',
  '--enable-gpu',
  '--ignore-gpu-blocklist',
  '--no-sandbox',
  '--hide-scrollbars',
  '--force-color-profile=srgb',
  '--autoplay-policy=no-user-gesture-required',
];

export function parseArgs(argv = process.argv.slice(2)) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) args[key] = true;
      else {
        args[key] = next;
        i++;
      }
    } else args._.push(a);
  }
  if (args.hud !== undefined) {
    if (args.hud !== 'dom' && args.hud !== 'gl') {
      console.error(`--hud must be dom or gl (got ${JSON.stringify(args.hud)})`);
      process.exit(2);
    }
    // through the environment, so `appUrl` sees it and child tools (chapter-check → mobile-check) inherit it
    process.env.QA_HUD = args.hud;
  }
  return args;
}

/** The `?hud=` value QA pages are opened with (`--hud` / `QA_HUD`), or null = the app's default. */
export function hudParam() {
  const v = process.env.QA_HUD;
  return v === 'dom' || v === 'gl' ? v : null;
}

let hudLogged = false;

export function baseUrl(args) {
  if (typeof args.base === 'string') return args.base.endsWith('/') ? args.base : `${args.base}/`;
  return `http://localhost:${args.port ?? process.env.QA_PORT ?? 5201}/`;
}

export function parseSize(value, fallback = [1920, 1080]) {
  const m = /^(\d+)x(\d+)$/.exec(String(value ?? ''));
  return m ? [Number(m[1]), Number(m[2])] : fallback;
}

export function outRoot(args) {
  return typeof args.out === 'string' ? args.out : `/srv/electricity/qa/${process.env.QA_ID ?? 'misc'}`;
}

export function ensureDir(path) {
  mkdirSync(path, { recursive: true });
  return path;
}

export function ensureParent(file) {
  mkdirSync(dirname(file), { recursive: true });
  return file;
}

/**
 * Build an app URL. `route` is a step address: the full `volume/chapter/step`, or the short `chapter/step`
 * (the app looks the chapter up in the default volume first, then in the others — `atom/quarks`,
 * `_sandbox-ui/controls`); `volume/chapter`, `chapter` and the empty route work too. Dev volumes and dev
 * chapters are included (`debug`) but the HTML overlay is hidden so screenshots show only the product.
 */
export function appUrl(base, { route = '', q = 'high', freeze = null, extra = {} } = {}) {
  // --hud / QA_HUD=dom|gl: run any QA script against that interface renderer (?hud=, HUD_DOM §16); `extra` wins
  const hud = hudParam() ? { hud: hudParam() } : {};
  const params = new URLSearchParams({ debug: '', overlay: '0', noaudio: '', q, ...hud, ...extra });
  if (q === 'auto') params.delete('q'); // let the app pick the tier itself (`mobile` on phones / tablets)
  if (freeze !== null && freeze !== undefined) params.set('freeze', String(freeze));
  const hash = route ? `#/${route.replace(/^\/+/, '')}` : '';
  return `${base}?${params.toString().replace(/=(&|$)/g, '$1')}${hash}`;
}

/** Launch Chrome on the GPU and open a page with the given viewport. */
export async function launch({ width = 1920, height = 1080, dpr = 1, uncapped = false, touch = false } = {}) {
  // QA_CHROME_ARGS replaces the GPU flags (e.g. to test another ANGLE backend; combine with QA_ALLOW_SOFTWARE=1)
  const base = process.env.QA_CHROME_ARGS ? process.env.QA_CHROME_ARGS.split(/\s+/).filter(Boolean) : GPU_ARGS;
  const browser = await chromium.launch({
    executablePath: process.env.QA_CHROME ?? '/usr/bin/google-chrome',
    headless: true,
    // `uncapped`: let requestAnimationFrame run as fast as the machine can render (throughput measurements)
    args: uncapped ? [...base, '--disable-gpu-vsync', '--disable-frame-rate-limit'] : base,
  });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: touch });
  const page = await context.newPage();
  /** Every request the page makes, for the "no third-party network" assertion. */
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  return { browser, context, page, requests, pageErrors };
}

/**
 * Navigate to an app URL (full page load), wait for `__app.ready` and assert that WebGL runs on the NVIDIA
 * GPU. Returns the GPU info.
 */
export async function openApp(page, url, { timeout = 60000 } = {}) {
  await page.goto(url, { waitUntil: 'load', timeout });
  await page.waitForFunction(() => typeof window.__app === 'object', null, { timeout });
  await page.evaluate(() => window.__app.ready);
  const gpu = await page.evaluate(() => window.__app.gpu());
  if (!/nvidia/i.test(gpu.renderer) && !process.env.QA_ALLOW_SOFTWARE) {
    throw new Error(`WebGL is not running on the NVIDIA GPU (renderer: "${gpu.renderer}"). Check the Chrome GPU flags.`);
  }
  gpu.hud = await hudMode(page);
  // DOM text reflows when the web fonts arrive: screenshots and boxes only after they are in (HUD_DOM §12)
  if (gpu.hud === 'dom') await page.evaluate(() => document.fonts.ready.then(() => undefined));
  if (!hudLogged) {
    hudLogged = true;
    console.log(`  interface: ${gpu.hud}${hudParam() ? '' : ' (app default)'}`);
  }
  return gpu;
}

/** The interface renderer the page runs (`dom` | `gl`), as the engine parsed it from `?hud=`. */
export async function hudMode(page) {
  return page.evaluate(() => window.__app?.engine?.flags?.hud ?? 'gl');
}

/** Console errors/warnings captured by the app since boot (or since the last clear). */
export async function appErrors(page) {
  return page.evaluate(() => window.__app.errors());
}

/** Requests that left the app's own origin (must be none: ARCHITECTURE §1). */
export function thirdPartyRequests(requests, base) {
  const origin = new URL(base).origin;
  return requests.filter((u) => {
    if (u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('about:')) return false;
    try {
      return new URL(u).origin !== origin;
    } catch {
      return true;
    }
  });
}

export async function screenshot(page, file, quality = 90) {
  await page.screenshot({ path: ensureParent(file), type: 'jpeg', quality });
  return file;
}

export function fmt(n, digits = 2) {
  return Number(n).toFixed(digits);
}

/** The playwright-core module (for tools that need other browser types or PNG decoding helpers). */
export const playwright = require('playwright-core');
const { PNG } = require('pngjs');

/** Decode a PNG buffer (e.g. `await page.screenshot({ type: 'png' })`) → { width, height, data: RGBA }. */
export function decodePng(buffer) {
  return PNG.sync.read(buffer);
}

const HUE_NAMES = ['red', 'yellow', 'green', 'cyan', 'blue', 'magenta'];

/**
 * Colour-discipline metric (STYLE_GUIDE §2: "1 dominant + 1–2 supporting accents per shot").
 * Looks at the clearly coloured pixels of a frame (saturation ≥ 0.35, value ≥ 0.3), sorts them into six
 * 60°-wide hue families and returns the families that hold at least `minShare` of them.
 * A disciplined frame has 2–4 families; 5–6 means "rainbow".
 */
export function hueFamilies(png, minShare = 0.08) {
  const bins = new Array(6).fill(0);
  let total = 0;
  const { width, height, data } = png;
  for (let y = 0; y < height; y += 3) {
    for (let x = 0; x < width; x += 3) {
      const i = (y * width + x) * 4;
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const d = max - min;
      if (max < 0.3 || d / max < 0.35) continue;
      let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h = (h * 60 + 360) % 360;
      bins[Math.floor(((h + 30) % 360) / 60)]++;
      total++;
    }
  }
  const shares = bins.map((n) => (total ? n / total : 0));
  const families = HUE_NAMES.filter((_, k) => shares[k] >= minShare);
  return { families, shares: Object.fromEntries(HUE_NAMES.map((n, k) => [n, Math.round(shares[k] * 100) / 100])), coloured: total };
}
