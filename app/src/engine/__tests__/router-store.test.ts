import { describe, expect, it } from 'vitest';
import { Router, formatHash, parseHash, type LocationHost } from '../router';
import { DEFAULT_SETTINGS, Store, migrateV1, type StorageLike } from '../store';

function fakeHost(hash = ''): LocationHost & { fire(): void; replaced: string[] } {
  const listeners = new Set<() => void>();
  const host = {
    location: { hash },
    replaced: [] as string[],
    history: {
      replaceState(_d: unknown, _u: string, url?: string | null) {
        host.replaced.push(String(url));
        host.location.hash = String(url);
      },
    },
    addEventListener(_t: 'hashchange', fn: () => void) {
      listeners.add(fn);
    },
    removeEventListener(_t: 'hashchange', fn: () => void) {
      listeners.delete(fn);
    },
    fire() {
      for (const fn of listeners) fn();
    },
  };
  return host;
}

const isVolume = (id: string): boolean => id === 'electricity' || id === 'radio';
const r = (volumeId: string | null, chapterId: string | null, stepId: string | null) => ({
  volumeId,
  chapterId,
  stepId,
});

describe('router', () => {
  it('parses and formats full deep links: #/<volume>/<chapter>/<step>', () => {
    expect(parseHash('#/electricity/atom/nucleus', isVolume)).toEqual(r('electricity', 'atom', 'nucleus'));
    expect(parseHash('#/electricity/plant-wind', isVolume)).toEqual(r('electricity', 'plant-wind', null));
    expect(parseHash('#/radio', isVolume)).toEqual(r('radio', null, null));
    expect(parseHash('#electricity/atom/quarks/', isVolume)).toEqual(r('electricity', 'atom', 'quarks'));
    expect(parseHash('#/_dev/_sandbox-micro/atom?x=1', isVolume)).toEqual(
      r('_dev', '_sandbox-micro', 'atom'),
    );
    expect(parseHash('#/electricity/atom/bad step', isVolume)).toEqual(r('electricity', 'atom', null));
    // three segments are always volume/chapter/step, known volume or not (navigation rejects unknown ones)
    expect(parseHash('#/nosuch/atom/quarks', isVolume)).toEqual(r('nosuch', 'atom', 'quarks'));
    expect(formatHash(r('electricity', 'atom', 'nucleus'))).toBe('#/electricity/atom/nucleus');
    expect(formatHash(r('electricity', 'atom', null))).toBe('#/electricity/atom');
    expect(formatHash(r('electricity', null, null))).toBe('#/electricity');
    expect(formatHash(r(null, null, null))).toBe('#/');
  });

  it('parses links from before the library of volumes as chapter[/step] without a volume', () => {
    expect(parseHash('#/atom/nucleus', isVolume)).toEqual(r(null, 'atom', 'nucleus'));
    expect(parseHash('#/plant-wind', isVolume)).toEqual(r(null, 'plant-wind', null));
    expect(parseHash('#/_sandbox-micro/atom?x=1', isVolume)).toEqual(r(null, '_sandbox-micro', 'atom'));
    expect(parseHash('#/atom/bad step', isVolume)).toEqual(r(null, 'atom', null));
    expect(parseHash('', isVolume)).toEqual(r(null, null, null));
    expect(parseHash('#/<script>/x', isVolume)).toEqual(r(null, null, null));
    expect(parseHash('#/atom/nucleus')).toEqual(r(null, 'atom', 'nucleus')); // no volume test at all
  });

  it('push sets the hash without echoing a change event; user changes do fire', () => {
    const host = fakeHost('#/electricity/atom/intro');
    const router = new Router(host, isVolume);
    const seen: string[] = [];
    router.onChange((x) => seen.push(`${x.volumeId}/${x.chapterId}/${x.stepId}`));
    router.push(r('electricity', 'atom', 'nucleus'));
    expect(host.location.hash).toBe('#/electricity/atom/nucleus');
    host.fire(); // the browser's hashchange for our own push
    expect(seen).toEqual([]);
    host.location.hash = '#/electricity/grid/balance'; // back/forward or typed by the user
    host.fire();
    host.location.hash = '#/grid/inertia'; // an old two-part link
    host.fire();
    expect(seen).toEqual(['electricity/grid/balance', 'null/grid/inertia']);
    router.replace(r('electricity', 'grid', 'inertia'));
    expect(host.replaced).toEqual(['#/electricity/grid/inertia']);
    host.fire();
    expect(seen).toHaveLength(2);
    router.dispose();
  });
});

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

describe('store', () => {
  it('notifies selector subscribers only when their value changes', () => {
    const store = new Store(null);
    const steps: (string | null)[] = [];
    const off = store.subscribe(
      (s) => s.stepId,
      (v) => steps.push(v),
    );
    store.set({ chapterId: 'atom', stepId: 'intro' });
    store.set({ chapterId: 'atom', stepId: 'intro' }); // same value → no notification
    store.updateSettings({ volume: 0.3 }); // unrelated slice
    store.set({ stepId: 'nucleus' });
    off();
    store.set({ stepId: 'quarks' });
    expect(steps).toEqual(['intro', 'nucleus']);
  });

  it('supports set() from inside a listener without losing updates', () => {
    const store = new Store(null);
    const seen: string[] = [];
    store.subscribe(
      (s) => s.chapterId,
      (c) => {
        if (c === 'a') store.set({ stepId: 'first' });
      },
    );
    store.subscribe(
      (s) => s.stepId,
      (v) => seen.push(String(v)),
    );
    store.set({ chapterId: 'a' });
    expect(seen).toEqual(['first']);
  });

  it('persists settings, progress and last positions — and survives corrupt storage', () => {
    const storage = memoryStorage();
    const a = new Store(storage);
    const nucleus = { volumeId: 'electricity', chapterId: 'atom', stepId: 'nucleus' };
    a.updateSettings({ quality: 'low', textScale: 1.2 });
    a.markVisited({ ...nucleus, stepId: 'intro' });
    a.markVisited({ ...nucleus, stepId: 'intro' }); // idempotent
    a.markVisited(nucleus);
    a.markVisited({ volumeId: 'radio', chapterId: 'atom', stepId: 'clock' }); // same chapter id, other volume
    a.settle(nucleus);
    a.settle({ volumeId: 'radio', chapterId: 'atom', stepId: 'clock' });
    a.set({ chapterId: 'atom' });
    const b = new Store(storage);
    expect(b.get().settings.quality).toBe('low');
    expect(b.get().settings.textScale).toBe(1.2);
    expect(b.get().settings.audio).toBe(DEFAULT_SETTINGS.audio); // defaults fill missing keys
    expect(b.get().progress.visited).toEqual({
      'electricity/atom': ['intro', 'nucleus'],
      'radio/atom': ['clock'],
    });
    expect(b.get().last).toEqual({ volumeId: 'radio', chapterId: 'atom', stepId: 'clock' });
    expect(b.get().lastIn.electricity).toEqual(nucleus); // each volume remembers its own last position
    expect(b.get().chapterId).toBeNull(); // runtime state is not persisted
    const broken = new Store(memoryStorage({ 'electricity:v2': '{not json' }));
    expect(broken.get().settings).toEqual(DEFAULT_SETTINGS);
  });

  it('migrates data saved before the library of volumes (electricity:v1) into the default volume', () => {
    const v1 = {
      v: 1,
      settings: { quality: 'medium', volume: 0.4 },
      progress: { visited: { atom: ['dive-in', 'quarks'], 'plant-wind': ['hook'] } },
      last: { chapterId: 'plant-wind', stepId: 'hook' },
    };
    const storage = memoryStorage({ 'electricity:v1': JSON.stringify(v1) });
    const store = new Store(storage, 'electricity');
    const s = store.get();
    expect(s.settings.quality).toBe('medium');
    expect(s.settings.volume).toBe(0.4);
    expect(s.progress.visited).toEqual({
      'electricity/atom': ['dive-in', 'quarks'],
      'electricity/plant-wind': ['hook'],
    });
    expect(s.last).toEqual({ volumeId: 'electricity', chapterId: 'plant-wind', stepId: 'hook' });
    expect(s.lastIn).toEqual({ electricity: s.last });
    // written under the new key at once; the old record is left as it was
    expect(JSON.parse(storage.data['electricity:v2']!).v).toBe(2);
    expect(JSON.parse(storage.data['electricity:v1']!)).toEqual(v1);
    // once v2 exists the old record is never read again
    storage.data['electricity:v1'] = JSON.stringify({
      ...v1,
      last: { chapterId: 'atom', stepId: 'dive-in' },
    });
    expect(new Store(storage).get().last?.chapterId).toBe('plant-wind');
    // tolerant of odd old data
    expect(
      migrateV1({ v: 1, progress: { visited: { atom: 'x' as unknown as string[] } }, last: null }, 'e'),
    ).toEqual({
      v: 2,
      settings: {},
      progress: { visited: {} },
      last: null,
      lastIn: {},
    });
  });
});
