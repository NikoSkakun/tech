import { describe, expect, it } from 'vitest';
import { bindChapter, defineChapter, defineScene, type ChapterManifest, type ChapterSpec } from '../chapter';
import { Library, type VolumeSource } from '../library';
import { Nav, type NavRouter } from '../nav';
import { Registry } from '../registry';
import { formatHash, type Route } from '../router';
import { Store, type Position } from '../store';
import { defineVolume, type VolumeIdentity, type VolumeManifest } from '../volume';

const scene = defineScene(() => undefined);
function chapter(
  volume: string,
  id: string,
  order: number,
  steps: string[],
  extra: Partial<ChapterSpec> = {},
): ChapterManifest {
  return bindChapter(
    defineChapter({
      id,
      order,
      group: 'micro',
      title: id,
      subtitle: '',
      axisLabel: '',
      axisValue: 0,
      theme: { accent: 'cyan', sky: 'micro', mood: 'micro' },
      steps: steps.map((s) => ({ id: s, title: s, blurb: '' })),
      load: () => Promise.resolve({ default: scene }),
      ...extra,
    }),
    volume,
  );
}

function volume(
  id: string,
  order: number,
  extra: Partial<VolumeIdentity> = {},
  ascending: 'out' | 'in' = 'out',
): VolumeManifest {
  return defineVolume(
    {
      id,
      title: id,
      subtitle: `about ${id}`,
      order,
      accent: 'cyan',
      status: id.startsWith('_') ? 'dev' : 'published',
      axis: { label: 'Масштаб', unit: 'm' },
      groups: [{ id: 'micro', label: 'Мікросвіт' }],
      journey: [],
      ...extra,
    },
    {
      journey: {
        axis: { min: -18, max: 6, origin: -10, tick: 1, majorEvery: 4, format: (v) => `10^${v}`, ascending },
      },
      theme: { sky: 'micro', mood: 'micro' },
    },
  );
}

const EL = volume('electricity', 1);
const RADIO = volume('radio', 2);

// deliberately registered out of order, with children and a dev chapter
const el = (id: string, order: number, steps: string[], extra: Partial<ChapterSpec> = {}): ChapterManifest =>
  chapter('electricity', id, order, steps, extra);
const MANIFESTS = [
  el('home', 12, ['panel', 'socket'], { axisValue: 1 }),
  el('plant-wind', 5, ['overview'], { parent: 'plants', axisValue: 2 }),
  el('atom', 1, ['intro', 'nucleus', 'quarks'], { axisValue: -10 }),
  el('plants', 8, ['hub'], { axisValue: 3 }),
  el('plant-coal', 1, ['overview', 'boiler'], { parent: 'plants', axisValue: 2 }),
  el('lab-pv', 1, ['sun'], { parent: 'home', axisValue: 0 }),
  el('_sandbox', 9000, ['a'], { dev: true }),
];
// a second volume that reuses a chapter id of the first one
const RADIO_MANIFESTS = [
  chapter('radio', 'waves', 1, ['intro', 'spectrum'], { axisValue: 3 }),
  chapter('radio', 'atom', 2, ['clock'], { axisValue: 9 }),
];
const at = (chapterId: string, stepId: string, volumeId = 'electricity'): Position => ({
  volumeId,
  chapterId,
  stepId,
});

describe('Registry (one volume)', () => {
  const registry = new Registry(EL, MANIFESTS);

  it('orders chapters by `order`, children depth-first after their parent, dev chapters hidden', () => {
    expect(registry.chapters.map((c) => c.id)).toEqual([
      'atom',
      'plants',
      'plant-coal',
      'plant-wind',
      'home',
      'lab-pv',
    ]);
    expect(registry.childrenOf('plants').map((c) => c.id)).toEqual(['plant-coal', 'plant-wind']);
    expect(registry.parentOf('lab-pv')?.id).toBe('home');
    expect(registry.has('_sandbox')).toBe(false);
    expect(new Registry(EL, MANIFESTS, { includeDev: true }).has('_sandbox')).toBe(true);
  });

  it('falls back to dev chapters when nothing else exists; rejects duplicates, foreign chapters, unknown groups', () => {
    expect(new Registry(EL, [el('_only', 1, ['x'], { dev: true })]).first.id).toBe('_only');
    expect(() => new Registry(EL, [el('a', 1, ['x']), el('a', 2, ['y'])])).toThrow(/duplicate/);
    expect(() => new Registry(EL, RADIO_MANIFESTS)).toThrow(/bound to volume 'radio'/);
    expect(() => new Registry(EL, [el('a', 1, ['x'], { group: 'nope' })])).toThrow(/unknown group/);
  });

  it('walks the journey linearly across chapter boundaries', () => {
    const walk: string[] = [];
    let pos: Position | null = at('atom', 'intro');
    while (pos) {
      expect(pos.volumeId).toBe('electricity');
      walk.push(`${pos.chapterId}/${pos.stepId}`);
      pos = registry.next(pos);
    }
    expect(walk).toEqual([
      'atom/intro',
      'atom/nucleus',
      'atom/quarks',
      'plants/hub',
      'plant-coal/overview',
      'plant-coal/boiler',
      'plant-wind/overview',
      'home/panel',
      'home/socket',
      'lab-pv/sun',
    ]);
    expect(registry.prev(at('plants', 'hub'))).toEqual(at('atom', 'quarks'));
    expect(registry.prev(at('atom', 'intro'))).toBeNull();
    expect(registry.journeyProgress(at('home', 'panel'))).toEqual({ index: 7, total: 10 });
  });

  it('resolves partial and invalid routes', () => {
    expect(registry.resolve('atom', null)).toEqual(at('atom', 'intro'));
    expect(registry.resolve('atom', 'nope')).toEqual(at('atom', 'intro'));
    expect(registry.resolve('atom', 'quarks')).toEqual(at('atom', 'quarks'));
    expect(registry.resolve('nope', 'x')).toBeNull();
    expect(registry.resolve(null, null)).toBeNull();
  });

  it('derives the zoom direction from the journey axis (order breaks ties)', () => {
    expect(registry.zoomDirection('atom', 'plants')).toBe(-1); // up in scale → zoom out
    expect(registry.zoomDirection('plants', 'atom')).toBe(1); // down in scale → zoom in
    expect(registry.zoomDirection('plant-coal', 'plant-wind')).toBe(1); // same scale, forward
    expect(registry.zoomDirection('plant-wind', 'plant-coal')).toBe(-1);
    expect(registry.zoomDirection(null, 'atom')).toBe(1);
    // an axis where "more" means "closer" zooms in when the value grows
    const inward = new Registry(volume('electricity', 1, {}, 'in'), MANIFESTS);
    expect(inward.zoomDirection('atom', 'plants')).toBe(1);
  });

  it('defineChapter validates ids', () => {
    expect(() => el('bad id', 1, ['a'])).toThrow(/invalid chapter id/);
    expect(() => el('ok', 1, ['a', 'a'])).toThrow(/duplicate step/);
    expect(() => el('ok', 1, [])).toThrow(/at least one step/);
  });
});

/** A library whose volumes count how often their chapter chunk was requested. */
function library(
  volumes: [VolumeManifest, ChapterManifest[]][] = [
    [EL, MANIFESTS],
    [RADIO, RADIO_MANIFESTS],
  ],
) {
  const loads: string[] = [];
  const sources: VolumeSource[] = volumes.map(([manifest, chapters]) => ({
    manifest,
    chapters: () => {
      loads.push(manifest.id);
      return Promise.resolve(chapters);
    },
  }));
  return { lib: new Library(sources, { title: null, defaultVolume: 'electricity' }), loads };
}

describe('Library', () => {
  it('lists volumes in order, loads each volume once and lazily', async () => {
    const { lib, loads } = library([
      [RADIO, RADIO_MANIFESTS],
      [EL, MANIFESTS],
    ]);
    expect(lib.volumes.map((v) => v.id)).toEqual(['electricity', 'radio']);
    expect(lib.defaultVolume.id).toBe('electricity');
    expect(lib.title).toBe('electricity'); // no umbrella title configured: the default volume's headline
    expect(lib.multi).toBe(true);
    expect(lib.registry('radio')).toBeUndefined();
    expect(loads).toEqual([]);
    const [a, b] = await Promise.all([lib.load('radio'), lib.load('radio')]);
    expect(a).toBe(b);
    expect(loads).toEqual(['radio']);
    expect(lib.registry('radio')?.chapters.map((c) => c.id)).toEqual(['waves', 'atom']);
    await expect(lib.load('nope')).rejects.toThrow(/unknown volume/);
  });

  it('a single published volume has no library level; dev volumes always show it', () => {
    const dev = volume('_demo', 9);
    const sandboxes = volume('_dev', 10, { listed: false });
    const { lib } = library([
      [EL, MANIFESTS],
      [dev, []],
      [sandboxes, []],
    ]);
    expect(lib.multi).toBe(false);
    expect(lib.showsLibrary('electricity')).toBe(false);
    expect(lib.showsLibrary('_demo')).toBe(true);
    expect(lib.showsLibrary('_dev')).toBe(false); // unlisted: looks like a stand-alone course
    expect(lib.listed.map((v) => v.id)).toEqual(['electricity', '_demo']);
    expect(library().lib.showsLibrary('electricity')).toBe(true);
    expect(() => volume('_demo', 9, { status: 'published' })).toThrow(/dev volume/);
  });

  it('resolves full addresses, and short ones in the caller volume, then the default, then the others', async () => {
    const { lib, loads } = library();
    expect(await lib.resolve({ volumeId: 'radio', chapterId: 'atom', stepId: null })).toEqual(
      at('atom', 'clock', 'radio'),
    );
    expect(loads).toEqual(['radio']); // an explicit volume loads only that volume
    expect(await lib.resolve({ volumeId: null, chapterId: 'atom', stepId: 'quarks' })).toEqual(
      at('atom', 'quarks'),
    );
    expect(await lib.resolve({ volumeId: null, chapterId: 'atom', stepId: null }, 'radio')).toEqual(
      at('atom', 'clock', 'radio'),
    );
    expect(await lib.resolve({ volumeId: null, chapterId: 'waves', stepId: 'spectrum' })).toEqual(
      at('waves', 'spectrum', 'radio'),
    );
    expect(await lib.resolve({ volumeId: null, chapterId: 'nope', stepId: null })).toBeNull();
    expect(await lib.resolve({ volumeId: 'nope', chapterId: 'atom', stepId: null })).toBeNull();
    expect(lib.chapter('radio/atom')?.steps[0]?.id).toBe('clock');
    expect(lib.chapter('atom')?.volume).toBe('electricity');
    expect(lib.chapter('atom', 'radio')?.volume).toBe('radio');
  });

  it('resolveLoaded() never loads: undefined means "ask resolve()"', async () => {
    const { lib, loads } = library();
    expect(lib.resolveLoaded({ volumeId: null, chapterId: 'atom', stepId: null })).toBeUndefined();
    expect(lib.resolveLoaded({ volumeId: 'nope', chapterId: 'atom', stepId: null })).toBeNull();
    await lib.load('electricity');
    expect(lib.resolveLoaded({ volumeId: null, chapterId: 'atom', stepId: null })).toEqual(
      at('atom', 'intro'),
    );
    // `waves` is not in the default volume and radio is not loaded: the answer is not known yet
    expect(lib.resolveLoaded({ volumeId: null, chapterId: 'waves', stepId: null })).toBeUndefined();
    expect(loads).toEqual(['electricity']);
  });

  it('zooms by the axis inside a volume and by library order between volumes', async () => {
    const { lib } = library();
    await lib.loadAll();
    expect(lib.zoomDirection({ volumeId: 'electricity', chapterId: 'atom' }, at('plants', 'hub'))).toBe(-1);
    expect(
      lib.zoomDirection({ volumeId: 'electricity', chapterId: 'atom' }, at('waves', 'intro', 'radio')),
    ).toBe(1);
    expect(lib.zoomDirection({ volumeId: 'radio', chapterId: 'waves' }, at('atom', 'intro'))).toBe(-1);
    expect(lib.zoomDirection(null, at('atom', 'intro'))).toBe(1);
  });
});

function fakeRouter(
  initial: Route,
): NavRouter & { pushed: Route[]; replaced: Route[]; emit(r: Route): void } {
  let listener: ((r: Route) => void) | null = null;
  const router = {
    route: initial,
    pushed: [] as Route[],
    replaced: [] as Route[],
    push(r: Route) {
      router.route = r;
      router.pushed.push(r);
    },
    replace(r: Route) {
      router.route = r;
      router.replaced.push(r);
    },
    onChange(fn: (r: Route) => void) {
      listener = fn;
      return () => undefined;
    },
    emit(r: Route) {
      router.route = r;
      listener?.(r);
    },
  };
  return router;
}
const route = (volumeId: string | null, chapterId: string | null, stepId: string | null): Route => ({
  volumeId,
  chapterId,
  stepId,
});
/** Let the async part of navigation (volume loading) finish. */
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe('Nav', () => {
  const setup = (start: Route, last: Position | null = null) => {
    const { lib, loads } = library();
    const store = new Store(null);
    if (last) store.settle(last);
    const router = fakeRouter(start);
    const requests: (Position & { instant: boolean })[] = [];
    const nav = new Nav(lib, router, store, {
      request: (p, o) => {
        requests.push({ ...p, instant: o.instant });
        store.settle(p); // what the chapter runtime does once the step is on screen
        return Promise.resolve();
      },
    });
    return { nav, router, store, requests, lib, loads };
  };

  it('start(): deep link wins, then the last position, then the first chapter of the default volume', async () => {
    const deep = setup(route('electricity', 'plant-coal', 'boiler'), at('home', 'socket'));
    await deep.nav.start();
    expect(deep.requests[0]).toMatchObject({ ...at('plant-coal', 'boiler'), instant: true });
    expect(deep.router.pushed).toEqual([]); // initial navigation never adds a history entry
    expect(deep.loads).toEqual(['electricity']); // the other volume was not requested

    const resumed = setup(route(null, null, null), at('waves', 'spectrum', 'radio'));
    await resumed.nav.start();
    expect(resumed.nav.position).toEqual(at('waves', 'spectrum', 'radio'));

    const fresh = setup(route('electricity', 'unknown', 'x'));
    await fresh.nav.start();
    expect(fresh.nav.position).toEqual(at('atom', 'intro'));
    expect(fresh.router.replaced.at(-1)).toEqual(at('atom', 'intro'));
  });

  it('start(): a legacy two-part link lands in the default volume and the address is rewritten', async () => {
    const legacy = setup(route(null, 'atom', 'quarks'));
    await legacy.nav.start();
    expect(legacy.nav.position).toEqual(at('atom', 'quarks'));
    expect(formatHash(legacy.router.replaced.at(-1)!)).toBe('#/electricity/atom/quarks');
    // a chapter that exists only in another volume is still found by its short address
    const other = setup(route(null, 'waves', null));
    await other.nav.start();
    expect(other.nav.position).toEqual(at('waves', 'intro', 'radio'));
  });

  it('start(): a volume-only link enters that volume where the user left it', async () => {
    const first = setup(route('radio', null, null));
    await first.nav.start();
    expect(first.nav.position).toEqual(at('waves', 'intro', 'radio'));
    const back = setup(route('radio', null, null));
    back.store.settle(at('atom', 'clock', 'radio'));
    back.store.settle(at('home', 'panel'));
    await back.nav.start();
    expect(back.nav.position).toEqual(at('atom', 'clock', 'radio'));
  });

  it('goto / next / prev / up keep router, store and runtime in agreement', async () => {
    const { nav, router, store, requests } = setup(route(null, null, null));
    await nav.start();
    expect(await nav.goto('atom', 'quarks')).toBe(true);
    expect(router.pushed.at(-1)).toEqual(at('atom', 'quarks'));
    expect(store.get().target).toEqual(at('atom', 'quarks'));
    await nav.next();
    expect(nav.position).toEqual(at('plants', 'hub'));
    await nav.next();
    expect(nav.position).toEqual(at('plant-coal', 'overview'));
    await nav.up();
    expect(nav.position).toEqual(at('plants', 'hub'));
    await nav.prev();
    expect(nav.position).toEqual(at('atom', 'quarks'));
    expect(await nav.goto('nope')).toBe(false);
    expect(await nav.goto('nope/atom')).toBe(false);
    expect(nav.canPrev).toBe(true);
    await nav.goto('lab-pv');
    expect(nav.canNext).toBe(false); // the journey ends with the volume
    expect(await nav.next()).toBe(false);
    expect(requests.at(-1)).toMatchObject(at('lab-pv', 'sun'));
  });

  it('goes to other volumes by full id, address or volume; short ids prefer the current volume', async () => {
    const { nav, router, loads } = setup(route(null, null, null));
    await nav.start();
    expect(nav.volume?.id).toBe('electricity');
    expect(nav.locate('radio/waves/spectrum')).toBeNull(); // not loaded yet
    expect(await nav.goto('radio/waves', 'spectrum')).toBe(true);
    expect(nav.position).toEqual(at('waves', 'spectrum', 'radio'));
    expect(formatHash(router.pushed.at(-1)!)).toBe('#/radio/waves/spectrum');
    expect(loads).toEqual(['electricity', 'radio']);
    expect(nav.chapters.map((c) => c.id)).toEqual(['waves', 'atom']);
    await nav.goto('atom'); // inside radio the short id is radio's own chapter
    expect(nav.position).toEqual(at('atom', 'clock', 'radio'));
    expect(nav.locate('electricity/atom/quarks')).toEqual(at('atom', 'quarks'));
    expect(nav.locate('plants/hub')).toEqual(at('plants', 'hub')); // falls back to the default volume
    expect(await nav.open('electricity/home/socket')).toBe(true);
    expect(nav.position).toEqual(at('home', 'socket'));
    expect(await nav.gotoVolume('radio')).toBe(true); // back to where radio was left
    expect(nav.position).toEqual(at('atom', 'clock', 'radio'));
    expect(await nav.gotoVolume('nope')).toBe(false);
  });

  it('a newer request wins over an older one that is still loading its volume', async () => {
    const { nav } = setup(route(null, null, null));
    await nav.start();
    const slow = nav.goto('radio/waves', 'intro'); // has to load radio first
    const fast = nav.goto('home', 'socket');
    expect(await fast).toBe(true);
    expect(await slow).toBe(false);
    expect(nav.position).toEqual(at('home', 'socket'));
  });

  it('follows the address bar (back/forward) and repairs invalid hashes', async () => {
    const { nav, router, requests } = setup(route('electricity', 'atom', 'intro'));
    await nav.start();
    router.emit(route('electricity', 'home', 'socket'));
    await flush();
    expect(nav.position).toEqual(at('home', 'socket'));
    expect(requests.at(-1)).toMatchObject({ ...at('home', 'socket'), instant: false });
    router.emit(route('electricity', 'home', 'bogus')); // unknown step → first step, address corrected
    await flush();
    expect(nav.position).toEqual(at('home', 'panel'));
    expect(router.replaced.at(-1)).toEqual(at('home', 'panel'));
    router.emit(route('electricity', 'bogus', null)); // unknown chapter → stay, address restored
    await flush();
    expect(nav.position).toEqual(at('home', 'panel'));
    expect(router.replaced.at(-1)).toEqual(at('home', 'panel'));
    router.emit(route(null, 'plants', 'hub')); // a legacy link typed into the address bar
    await flush();
    expect(nav.position).toEqual(at('plants', 'hub'));
    expect(formatHash(router.replaced.at(-1)!)).toBe('#/electricity/plants/hub');
    router.emit(route('radio', null, null)); // volume-only address
    await flush();
    expect(nav.position).toEqual(at('waves', 'intro', 'radio'));
  });
});
