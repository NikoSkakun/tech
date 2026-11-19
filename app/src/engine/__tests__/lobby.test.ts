// The front door of the library (DECISIONS §60, docs/VOLUMES.md §3): an empty default volume shown by its home
// screen alone (the lobby), a published volume kept aside behind its own button, links and saved data from
// before the change. Library shaped like the real one: `circuit` (default, no chapters yet) and `electricity`
// (legacy volume, aside).
import { describe, expect, it } from 'vitest';
import { bindChapter, defineChapter, defineScene, type ChapterManifest } from '../chapter';
import { Library } from '../library';
import { Nav, type NavRouter } from '../nav';
import { formatHash, type Route } from '../router';
import { Store, type Position, type StorageLike } from '../store';
import { defineVolume, type VolumeIdentity, type VolumeManifest } from '../volume';

const scene = defineScene(() => undefined);
const chapter = (volume: string, id: string, order: number, steps: string[]): ChapterManifest =>
  bindChapter(
    defineChapter({
      id,
      order,
      group: 'g',
      title: id,
      subtitle: '',
      axisLabel: '',
      axisValue: 0,
      theme: { accent: 'cyan', sky: 'micro', mood: 'micro' },
      steps: steps.map((s) => ({ id: s, title: s, blurb: '' })),
      load: () => Promise.resolve({ default: scene }),
    }),
    volume,
  );
const volume = (id: string, order: number, extra: Partial<VolumeIdentity> = {}): VolumeManifest =>
  defineVolume(
    {
      id,
      title: id,
      subtitle: `about ${id}`,
      order,
      accent: 'cyan',
      status: 'published',
      axis: { label: 'Масштаб', unit: 'm' },
      groups: [{ id: 'g', label: 'Група' }],
      journey: [],
      ...extra,
    },
    {
      journey: {
        axis: { min: -18, max: 6, origin: -10, tick: 1, majorEvery: 4, format: String, ascending: 'out' },
      },
      theme: { sky: 'micro', mood: 'micro' },
    },
  );

const CIRCUIT = volume('circuit', 1, { emptyNote: 'Том у роботі' });
const ELECTRICITY = volume('electricity', 2, {
  aside: { label: 'Попередній том: Електроенергія (чернетка)' },
});
const EL_CHAPTERS = [
  chapter('electricity', 'atom', 1, ['intro', 'quarks']),
  chapter('electricity', 'home', 2, ['socket']),
];
const at = (chapterId: string, stepId: string, volumeId = 'electricity'): Position => ({
  volumeId,
  chapterId,
  stepId,
});
const route = (
  volumeId: string | null,
  chapterId: string | null = null,
  stepId: string | null = null,
): Route => ({
  volumeId,
  chapterId,
  stepId,
});

function makeLibrary(circuitChapters: ChapterManifest[] = []): Library {
  return new Library(
    [
      { manifest: ELECTRICITY, chapters: () => Promise.resolve(EL_CHAPTERS) },
      { manifest: CIRCUIT, chapters: () => Promise.resolve(circuitChapters) },
    ],
    { title: null, defaultVolume: 'circuit', legacyVolume: 'electricity' },
  );
}

function fakeRouter(
  initial: Route,
): NavRouter & { pushed: Route[]; replaced: Route[]; emit(r: Route): void } {
  let listener: ((r: Route) => void) | null = null;
  const router = {
    route: initial,
    pushed: [] as Route[],
    replaced: [] as Route[],
    push: (r: Route) => void ((router.route = r), router.pushed.push(r)),
    replace: (r: Route) => void ((router.route = r), router.replaced.push(r)),
    onChange: (fn: (r: Route) => void) => ((listener = fn), () => undefined),
    emit: (r: Route) => void ((router.route = r), listener?.(r)),
  };
  return router;
}

class MemoryStorage implements StorageLike {
  readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

function setup(start: Route, opts: { store?: Store; circuit?: ChapterManifest[] } = {}) {
  const lib = makeLibrary(opts.circuit);
  const store = opts.store ?? new Store(null, lib.legacyVolume.id);
  const router = fakeRouter(start);
  const requests: Position[] = [];
  const lobbies: [string | null, boolean][] = [];
  const nav = new Nav(lib, router, store, {
    request: (p) => {
      requests.push(p);
      store.settle(p);
      return Promise.resolve();
    },
  });
  nav.onLobby((v, entered) => lobbies.push([v?.id ?? null, entered]));
  return { lib, store, router, requests, lobbies, nav };
}
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe('Library with an aside volume', () => {
  it('an aside volume does not make a library level and is not on the shelf', () => {
    const lib = makeLibrary();
    expect(lib.defaultVolume.id).toBe('circuit');
    expect(lib.legacyVolume.id).toBe('electricity');
    expect(lib.multi).toBe(false);
    expect(lib.showsLibrary('circuit')).toBe(false);
    expect(lib.showsLibrary('electricity')).toBe(false);
    expect(lib.listed.map((v) => v.id)).toEqual(['circuit']);
    expect(lib.aside.map((v) => [v.id, v.aside])).toEqual([
      ['electricity', 'Попередній том: Електроенергія (чернетка)'],
    ]);
    expect(lib.title).toBe('circuit'); // the umbrella title follows the default volume
  });

  it('short links without a caller try the legacy volume first, even when the default has the same id', async () => {
    const lib = makeLibrary([chapter('circuit', 'atom', 1, ['electron'])]);
    expect(await lib.resolve(route(null, 'atom', 'quarks'))).toEqual(at('atom', 'quarks'));
    expect(await lib.resolve(route(null, 'atom', null))).toEqual(at('atom', 'intro'));
    // a caller inside the pilot volume means its own chapter
    expect(await lib.resolve(route(null, 'atom', null), 'circuit')).toEqual(
      at('atom', 'electron', 'circuit'),
    );
    expect(await lib.resolve(route('circuit', 'atom', null))).toEqual(at('atom', 'electron', 'circuit'));
  });
});

describe('Nav: the lobby of an empty default volume', () => {
  it('a fresh start at #/ shows the default volume by its home screen alone', async () => {
    const { nav, router, requests, lobbies } = await started(route(null));
    expect(nav.lobby?.id).toBe('circuit');
    expect(nav.position).toBeNull();
    expect(requests).toEqual([]); // no chapter is loaded
    expect(lobbies).toEqual([['circuit', false]]);
    expect(formatHash(router.route)).toBe('#/');
    expect(router.pushed).toEqual([]);
  });

  it('the aside button enters electricity where it was left; the way back is the lobby again', async () => {
    const { nav, router, requests, lobbies, store } = await started(route(null));
    store.settle(at('home', 'socket'));
    expect(await nav.gotoVolume('electricity')).toBe(true);
    expect(nav.position).toEqual(at('home', 'socket'));
    expect(nav.lobby).toBeNull();
    expect(lobbies.at(-1)).toEqual([null, true]); // left by entering a volume: its home screen is expected
    expect(formatHash(router.pushed.at(-1)!)).toBe('#/electricity/home/socket');
    expect(await nav.gotoVolume('circuit')).toBe(true);
    expect(nav.lobby?.id).toBe('circuit');
    expect(nav.position).toEqual(at('home', 'socket')); // still loaded behind the home screen
    expect(formatHash(router.pushed.at(-1)!)).toBe('#/');
    // entering electricity again from the lobby is a move, though the step behind is the same
    await nav.gotoVolume('electricity');
    expect(formatHash(router.pushed.at(-1)!)).toBe('#/electricity/home/socket');
    expect(requests).toHaveLength(2);
  });

  it('back/forward between the lobby and a step', async () => {
    const { nav, router, lobbies } = await started(route('electricity', 'atom', 'intro'));
    expect(nav.lobby).toBeNull();
    router.emit(route(null)); // back to #/
    await flush();
    expect(nav.lobby?.id).toBe('circuit');
    router.emit(route('electricity', 'home', 'socket'));
    await flush();
    expect(nav.lobby).toBeNull();
    expect(lobbies.at(-1)).toEqual([null, false]); // left for a step: no home screen
    expect(nav.position).toEqual(at('home', 'socket'));
    router.emit(route('circuit')); // the volume-only address of the empty volume
    await flush();
    expect(nav.lobby?.id).toBe('circuit');
    expect(formatHash(router.replaced.at(-1)!)).toBe('#/');
  });

  it('old links and full addresses of electricity keep working', async () => {
    const legacy = await started(route(null, 'atom', 'quarks'));
    expect(legacy.nav.position).toEqual(at('atom', 'quarks'));
    expect(formatHash(legacy.router.replaced.at(-1)!)).toBe('#/electricity/atom/quarks');
    const full = await started(route('electricity', 'home', 'socket'));
    expect(full.nav.position).toEqual(at('home', 'socket'));
    const volumeLink = await started(route('electricity'));
    expect(volumeLink.nav.position).toEqual(at('atom', 'intro'));
    const bogus = await started(route('electricity', 'bogus', 'x'));
    expect(bogus.nav.lobby?.id).toBe('circuit');
  });
});

describe('saved data survives the change of the default volume', () => {
  it('progress and positions of electricity in an existing profile are kept; #/ opens the front door', async () => {
    const storage = new MemoryStorage();
    // a profile saved while electricity was the default (and only) volume
    const before = new Store(storage, 'electricity', false);
    before.markVisited(at('atom', 'intro'));
    before.markVisited(at('atom', 'quarks'));
    before.settle(at('atom', 'quarks'));
    before.updateSettings({ textScale: 1.25 });
    await flush();
    const store = new Store(storage, makeLibrary().legacyVolume.id, false);
    expect(store.get().progress.visited).toEqual({ 'electricity/atom': ['intro', 'quarks'] });
    expect(store.get().lastIn['electricity']).toEqual(at('atom', 'quarks'));
    expect(store.get().settings.textScale).toBe(1.25);
    const { nav } = await started(route(null), store);
    expect(nav.lobby?.id).toBe('circuit'); // the last position lies in the aside volume: not restored at #/
    expect(store.get().progress.visited['electricity/atom']).toEqual(['intro', 'quarks']);
    await nav.gotoVolume('electricity');
    expect(nav.position).toEqual(at('atom', 'quarks')); // resumed where the learner left it
  });

  it('a profile from before the library is migrated into electricity, not into the new default', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      'electricity:v1',
      JSON.stringify({
        v: 1,
        progress: { visited: { atom: ['intro'] } },
        last: { chapterId: 'atom', stepId: 'intro' },
      }),
    );
    const store = new Store(storage, makeLibrary().legacyVolume.id, false);
    expect(store.get().progress.visited).toEqual({ 'electricity/atom': ['intro'] });
    expect(store.get().last).toEqual(at('atom', 'intro'));
  });
});

async function started(start: Route, store?: Store) {
  const s = setup(start, { store });
  await s.nav.start();
  return s;
}
