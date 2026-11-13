/**
 * Boot: splash → volumes → engine → fonts → plugins → first chapter. Errors end on the Ukrainian fatal screen.
 */
import { Engine, parseFlags, type EnginePlugin } from '@/engine/app';
import { createBootUi, hasWebGL2 } from '@/engine/boot-ui';
import { installDebugApi, installErrorCapture } from '@/engine/debug/api';
import { discoverVolumes, LIBRARY_CONFIG } from '@/engine/discover';
import { Library } from '@/engine/library';
import { loadFonts } from '@/text/fonts';

type PluginModule = { plugin?: EnginePlugin };
/**
 * Plugins, in mount order (owner: F3 for fx/audio, F2 for hud). Imported dynamically so the libraries never sit
 * in the entry chunk. A library may provide a tiny `<lib>/plugin.ts` that exports only `plugin`: then just that
 * module loads at boot and the rest of the library arrives with the first chapter chunk that uses it.
 * Otherwise the barrel is imported (one shared chunk, fetched in parallel with the fonts).
 */
const PLUGIN_LIBS = ['fx', 'audio', 'hud'] as const;
const TINY = import.meta.glob<PluginModule>(['./fx/plugin.ts', './audio/plugin.ts', './hud/plugin.ts']);
const BARREL: Record<(typeof PLUGIN_LIBS)[number], () => Promise<PluginModule>> = {
  fx: () => import('@/fx'),
  audio: () => import('@/audio'),
  hud: () => import('@/hud'),
};
function loadPlugins(): Promise<EnginePlugin[]> {
  return Promise.all(PLUGIN_LIBS.map((lib) => (TINY[`./${lib}/plugin.ts`] ?? BARREL[lib])())).then((mods) =>
    mods.map((m) => m.plugin).filter((p): p is EnginePlugin => p !== undefined),
  );
}

installErrorCapture();
const boot = createBootUi();

async function start(): Promise<Engine> {
  const flags = parseFlags(window.location.search);
  if (!hasWebGL2()) {
    boot.fatal('webgl');
    throw new Error('WebGL2 is not available');
  }
  const canvas = document.getElementById('stage') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('index.html: <canvas id="stage"> is missing');
  boot.progress(0.05);
  const pluginsReady = loadPlugins(); // fetch the library chunks while the fonts load
  // dev volumes are discovered (and their code requested) only with ?debug
  const volumes = await discoverVolumes({ includeDev: flags.debug });
  const library = new Library(volumes, LIBRARY_CONFIG, { includeDev: flags.debug });
  // a debug session knows every chapter from the start (debug overlay, `__app.listChapters()`, QA tools)
  if (flags.debug) await library.loadAll();
  const engine = new Engine(canvas, flags, library);
  engine.onContextLost(() => boot.contextLost());
  engine.onContextRestored(() => boot.contextRestored());
  await loadFonts((f) => boot.progress(0.08 + 0.42 * f));

  for (const plugin of await pluginsReady) plugin.mount(engine);

  engine.start();
  const offLoading = engine.runtime.on('loading', ({ progress }) => boot.progress(0.5 + 0.5 * progress));
  const offStart = engine.runtime.on('transitionStart', () => {
    offLoading();
    offStart();
    boot.hide(flags.freeze !== null);
  });
  const offError = engine.runtime.on('error', ({ error }) => {
    // the very first chapter failed: nothing to fall back to
    if (engine.runtime.chapter === null)
      boot.fatal('boot', error instanceof Error ? error.message : String(error));
  });
  if (flags.debug && flags.overlay)
    void import('@/engine/debug/overlay').then((m) => m.mountDebugOverlay(engine));
  await engine.nav.start();
  offError();
  canvas.focus({ preventScroll: true });
  return engine;
}

const ready = start();
installDebugApi(ready);
ready.catch((error: unknown) => {
  console.error('[boot]', error);
  if (hasWebGL2()) boot.fatal('boot', error instanceof Error ? error.message : String(error));
});
