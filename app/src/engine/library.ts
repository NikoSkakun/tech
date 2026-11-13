/**
 * The library: the registered volumes and, per volume, a lazily loaded chapter `Registry` (pure logic,
 * unit-tested — discovery lives in `discover.ts`). Volume manifests are tiny and known at boot; a volume's
 * chapter manifests arrive in one chunk when the volume is first needed.
 */
import type { ChapterManifest } from './chapter';
import { Registry, type RegistryOptions } from './registry';
import type { Position } from './store';
import type { VolumeManifest } from './volume';

/** A registered volume: its manifest and the loader of its (bound) chapter manifests. */
export interface VolumeSource {
  readonly manifest: VolumeManifest;
  chapters(): Promise<readonly ChapterManifest[]>;
}

/** `src/volumes/library.json`. */
export interface LibraryConfig {
  /** Umbrella name of the library; null = the default volume's headline (while the library is one volume). */
  readonly title: string | null;
  readonly defaultVolume: string;
}

/** A chapter reference as callers write it: `chapter` or `volume/chapter`. */
export interface ChapterRef {
  readonly volumeId: string | null;
  readonly chapterId: string;
}

export function parseChapterRef(ref: string): ChapterRef | null {
  const parts = ref.split('/');
  if (parts.length === 1 && parts[0]) return { volumeId: null, chapterId: parts[0] };
  if (parts.length === 2 && parts[0] && parts[1]) return { volumeId: parts[0], chapterId: parts[1] };
  return null;
}

export class Library {
  /** Registered volumes in library order. */
  readonly volumes: readonly VolumeManifest[];
  readonly defaultVolume: VolumeManifest;
  /** Umbrella title (config, or the default volume's headline). */
  readonly title: string;
  /** More than one published volume: the library level is part of normal navigation. */
  readonly multi: boolean;
  private readonly sources = new Map<string, VolumeSource>();
  private readonly registries = new Map<string, Registry>();
  private readonly loading = new Map<string, Promise<Registry>>();

  constructor(
    sources: readonly VolumeSource[],
    config: LibraryConfig,
    private readonly opts: RegistryOptions = {},
  ) {
    for (const s of sources) {
      if (this.sources.has(s.manifest.id)) throw new Error(`Library: duplicate volume id '${s.manifest.id}'`);
      this.sources.set(s.manifest.id, s);
    }
    this.volumes = sources
      .map((s) => s.manifest)
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    const def = this.sources.get(config.defaultVolume)?.manifest;
    if (!def) throw new Error(`Library: default volume '${config.defaultVolume}' is not registered`);
    this.defaultVolume = def;
    this.title = config.title ?? def.headline;
    this.multi = this.volumes.filter((v) => v.status === 'published').length > 1;
  }

  get(id: string): VolumeManifest | undefined {
    return this.sources.get(id)?.manifest;
  }

  has(id: string): boolean {
    return this.sources.has(id);
  }

  /** Volumes shown on the library screen. */
  get listed(): readonly VolumeManifest[] {
    return this.volumes.filter((v) => v.listed);
  }

  /**
   * Is the library level shown while the user is inside this volume (volume name in the header, the way back
   * to the library, the glossary scope switch)? Yes once there is more than one published volume — and always
   * inside a listed unpublished volume (the demo volume), so the chrome can be developed before a second
   * volume ships. A single published volume looks exactly like a stand-alone course, and so does an unlisted
   * volume (the sandboxes, where the platform's HUD is tested as production shows it).
   */
  showsLibrary(volumeId: string): boolean {
    const volume = this.get(volumeId);
    return this.multi || (volume !== undefined && volume.status !== 'published' && volume.listed);
  }

  /** Chapter registry of a volume, if it has been loaded. */
  registry(volumeId: string): Registry | undefined {
    return this.registries.get(volumeId);
  }

  /** Load (once) the chapter manifests of a volume. Rejects for an unknown volume. */
  load(volumeId: string): Promise<Registry> {
    let hit = this.loading.get(volumeId);
    if (!hit) {
      const source = this.sources.get(volumeId);
      if (!source) return Promise.reject(new Error(`Library: unknown volume '${volumeId}'`));
      hit = source.chapters().then((chapters) => {
        const registry = new Registry(source.manifest, chapters, this.opts);
        this.registries.set(volumeId, registry);
        if (volumeId === this.defaultVolume.id) this.checkLegacyLinks(registry);
        return registry;
      });
      this.loading.set(volumeId, hit);
    }
    return hit;
  }

  loadAll(): Promise<Registry[]> {
    return Promise.all(this.volumes.map((v) => this.load(v.id)));
  }

  /**
   * A two-part link `#/a/b` reads as `volume/chapter` when `a` is a volume id, else as the legacy
   * `chapter/step` of the default volume — so a default-volume chapter must not share its id with a volume.
   */
  private checkLegacyLinks(registry: Registry): void {
    for (const m of registry.chapters)
      if (this.has(m.id))
        console.error(
          `[library] chapter '${registry.volumeId}/${m.id}' has the id of a volume: short links to it are ambiguous`,
        );
  }

  /** Volumes to search for a short chapter id: the caller's volume, the default one, then the others. */
  private searchOrder(from: string | null | undefined): string[] {
    const order = [from, this.defaultVolume.id, ...this.volumes.map((v) => v.id)];
    return [...new Set(order.filter((id): id is string => !!id && this.has(id)))];
  }

  /** Manifest of `chapter` / `volume/chapter` among the volumes loaded so far (short ids: see `searchOrder`). */
  chapter(ref: string, from?: string | null): ChapterManifest | undefined {
    const r = parseChapterRef(ref);
    if (!r) return undefined;
    if (r.volumeId) return this.registries.get(r.volumeId)?.get(r.chapterId);
    for (const id of this.searchOrder(from)) {
      const hit = this.registries.get(id)?.get(r.chapterId);
      if (hit) return hit;
    }
    return undefined;
  }

  /**
   * Turn a possibly partial address into a valid position, loading volumes as needed.
   * `volumeId: null` is a short / legacy address: the chapter is looked up in the caller's volume (`from`),
   * then the default volume, then the other volumes. Unknown volume or chapter → null; missing or unknown
   * step → the chapter's first step.
   */
  async resolve(
    address: { volumeId: string | null; chapterId: string | null; stepId?: string | null },
    from?: string | null,
  ): Promise<Position | null> {
    if (!address.chapterId) return null;
    const candidates = address.volumeId
      ? this.has(address.volumeId)
        ? [address.volumeId]
        : []
      : this.searchOrder(from);
    for (const id of candidates) {
      const registry = this.registries.get(id) ?? (await this.load(id).catch(() => null));
      const pos = registry?.resolve(address.chapterId, address.stepId ?? null);
      if (pos) return pos;
    }
    return null;
  }

  /**
   * Same as `resolve` without loading anything — for the synchronous path of navigation. Returns `undefined`
   * when the answer depends on a volume that is not loaded yet (the caller then awaits `resolve`).
   */
  resolveLoaded(
    address: { volumeId: string | null; chapterId: string | null; stepId?: string | null },
    from?: string | null,
  ): Position | null | undefined {
    if (!address.chapterId) return null;
    if (address.volumeId && !this.has(address.volumeId)) return null;
    const candidates = address.volumeId ? [address.volumeId] : this.searchOrder(from);
    for (const id of candidates) {
      const registry = this.registries.get(id);
      if (!registry) return undefined;
      const pos = registry.resolve(address.chapterId, address.stepId ?? null);
      if (pos) return pos;
    }
    return null;
  }

  /**
   * Zoom direction of a chapter transition: inside a volume the registry decides (journey axis); between
   * volumes a later volume is entered zooming in, an earlier one zooming out.
   */
  zoomDirection(from: { volumeId: string; chapterId: string } | null, to: Position): 1 | -1 {
    if (!from) return 1;
    if (from.volumeId === to.volumeId)
      return this.registries.get(to.volumeId)?.zoomDirection(from.chapterId, to.chapterId) ?? 1;
    const a = this.get(from.volumeId);
    const b = this.get(to.volumeId);
    return a && b && this.volumes.indexOf(b) < this.volumes.indexOf(a) ? -1 : 1;
  }
}
