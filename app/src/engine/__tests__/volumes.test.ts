// The volumes that exist in the repository obey the rules of docs/VOLUMES.md: every `src/volumes/<id>/` is a
// well-formed volume, its built chapters are the ones its `volume.json` plans, and the library config points at
// a real published volume. (The volume model itself is tested in nav.test.ts.)
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bindChapter, type ChapterManifest } from '../chapter';
import { Registry } from '../registry';
import { defineVolume, isDevVolumeId, type VolumeIdentity, type VolumeManifest } from '../volume';

const VOLUMES = import.meta.glob<{ default: VolumeManifest }>('../../volumes/*/volume.ts', { eager: true });
const IDENTITIES = import.meta.glob<{ default: VolumeIdentity }>('../../volumes/*/volume.json', {
  eager: true,
});
const CHAPTERS = import.meta.glob<{ default: ChapterManifest }>('../../volumes/*/chapters/*/index.ts', {
  eager: true,
});
const app = (path: string): string => fileURLToPath(new URL(`../../../${path}`, import.meta.url));
const json = <T>(path: string): T => JSON.parse(readFileSync(app(path), 'utf8')) as T;

const dirOf = (path: string): string => /volumes\/([^/]+)\//.exec(path)![1]!;
const volumes = Object.entries(VOLUMES).map(([path, mod]) => ({ dir: dirOf(path), manifest: mod.default }));
const chaptersOf = (volume: string): ChapterManifest[] =>
  Object.entries(CHAPTERS)
    .filter(([path]) => dirOf(path) === volume)
    .map(([, mod]) => bindChapter(mod.default, volume));

describe('volumes in the repository', () => {
  it('has the volumes this test knows about', () => {
    expect(volumes.map((v) => v.dir).sort()).toEqual(['_demo', '_dev', 'electricity']);
    expect(Object.keys(IDENTITIES)).toHaveLength(volumes.length);
  });

  it.each(volumes)('$dir is a well-formed volume', ({ dir, manifest }) => {
    expect(manifest.id).toBe(dir);
    // dev volumes: directory starting with `_`, status `dev` — and nothing else may be `dev`
    expect(manifest.status === 'dev').toBe(isDevVolumeId(dir));
    expect(existsSync(app(`src/volumes/${dir}/chapters.ts`))).toBe(true);
    expect(manifest.title.length).toBeGreaterThan(0);
    expect(manifest.headline === manifest.title || manifest.headline === manifest.subtitle).toBe(true);
    const { axis } = manifest.journey;
    expect(axis.format(axis.min)).not.toBe(axis.format(axis.max));
    expect(axis.origin).toBeGreaterThanOrEqual(axis.min);
    expect(axis.origin).toBeLessThanOrEqual(axis.max);
  });

  it.each(volumes)(
    '$dir: the built chapters register and agree with the plan in volume.json',
    ({ dir, manifest }) => {
      const built = chaptersOf(dir);
      // throws on a duplicate id or a group the volume does not have
      const registry = new Registry(manifest, built, { includeDev: true });
      expect(registry.chapters).toHaveLength(built.length);
      for (const chapter of built) {
        expect(chapter.axisValue).toBeGreaterThanOrEqual(manifest.journey.axis.min);
        expect(chapter.axisValue).toBeLessThanOrEqual(manifest.journey.axis.max);
        if (manifest.journey.planned.length === 0) continue; // the sandbox pseudo-volume plans nothing
        const planned = manifest.journey.planned.find((p) => p.id === chapter.id);
        expect(planned, `${dir}/${chapter.id} is not in volume.json → journey`).toBeDefined();
        expect(chapter.group).toBe(planned!.group);
        expect(chapter.parent).toBe(planned!.parent);
      }
    },
  );

  it('published volumes have their alias in tsconfig.json; dev volumes have none', () => {
    const paths = json<{ compilerOptions: { paths: Record<string, string[]> } }>('tsconfig.json')
      .compilerOptions.paths;
    for (const { dir } of volumes) {
      if (isDevVolumeId(dir)) expect(paths[`@${dir}/*`]).toBeUndefined();
      else expect(paths[`@${dir}/*`]).toEqual([`./src/volumes/${dir}/*`]);
    }
  });

  it('library.json names a published default volume whose chapters do not shadow a volume id', () => {
    const config = json<{ title: string | null; defaultVolume: string }>('src/volumes/library.json');
    const def = volumes.find((v) => v.dir === config.defaultVolume);
    expect(def?.manifest.status).toBe('published');
    // `#/a/b` reads as volume/chapter when `a` is a volume: a default-volume chapter must not have such an id
    const ids = new Set(volumes.map((v) => v.dir));
    const planned = def!.manifest.journey.planned.map((c) => c.id);
    expect(planned.filter((id) => ids.has(id))).toEqual([]);
  });

  it('volume 1 keeps its names in volume.json only: the home headline is the subtitle', () => {
    const el = volumes.find((v) => v.dir === 'electricity')!.manifest;
    const identity = json<VolumeIdentity>('src/volumes/electricity/volume.json');
    expect(el.title).toBe(identity.title);
    expect(el.headline).toBe(identity.subtitle);
    expect(el.journey.axis.range).toBe('10⁻¹⁸ m … 10⁶ m'); // plain spaces, as the home chip always had
    expect(el.journey.groups.map((g) => g.id)).toEqual(['micro', 'em', 'plants', 'grid', 'home', 'labs']);
  });
});

describe('defineVolume', () => {
  const identity: VolumeIdentity = {
    id: 'radio',
    title: 'Радіо',
    subtitle: 'Від іскри до супутника',
    order: 2,
    accent: 'violet',
    status: 'draft',
    axis: { label: 'Частота', unit: 'Hz' },
    groups: [{ id: 'basics', label: 'Основи' }],
    journey: [{ id: 'wave', group: 'basics' }],
  };
  const spec = {
    journey: {
      axis: {
        min: 0,
        max: 12,
        origin: 4,
        tick: 1,
        majorEvery: 3,
        format: (v: number) => `10^${v} Hz`,
        ascending: 'in' as const,
      },
    },
    theme: { sky: 'studio' as const, mood: 'studio' as const },
  };

  it('fills the defaults', () => {
    const v = defineVolume(identity, spec);
    expect(v.headline).toBe('Радіо');
    expect(v.listed).toBe(true);
    expect(v.emblem).toBe('book');
    expect(v.theme.accent).toBe('violet');
    expect(v.glossary.scope).toBe('volume');
    expect(v.journey.axis.hint).toBe('Частота');
    expect(v.journey.axis.range).toBe('10^0 Hz … 10^12 Hz');
    expect(v.journey.groups[0]).toEqual({
      id: 'basics',
      label: 'Основи',
      short: 'Основи',
      emblem: 'generic',
    });
    expect(v.journey.layout.dx).toBeGreaterThan(0);
  });

  it('rejects malformed identities', () => {
    const bad =
      (patch: Partial<VolumeIdentity>): (() => VolumeManifest) =>
      () =>
        defineVolume({ ...identity, ...patch }, spec);
    expect(bad({ id: 'bad id' })).toThrow(/invalid volume id/);
    expect(bad({ status: 'live' })).toThrow(/status/);
    expect(bad({ status: 'dev' })).toThrow(/dev volume/);
    expect(bad({ id: '_radio' })).toThrow(/dev volume/);
    expect(bad({ accent: 'mauve' })).toThrow(/accent/);
    expect(bad({ groups: [] })).toThrow(/at least one group/);
    expect(bad({ journey: [{ id: 'wave', group: 'nope' }] })).toThrow(/unknown group/);
    expect(bad({ journey: [{ id: 'wave', group: 'basics', parent: 'nope' }] })).toThrow(/unknown parent/);
    expect(bad({ headline: 'tagline' })).toThrow(/headline/);
    expect(() =>
      defineVolume(identity, { ...spec, journey: { axis: { ...spec.journey.axis, max: 0 } } }),
    ).toThrow(/axis/);
  });
});
