/**
 * Auto-discovery of volumes and chapters (ARCHITECTURE §2–3): a volume registers itself by having
 * `src/volumes/<id>/volume.ts`, a chapter by having `src/volumes/<volume>/chapters/<id>/index.ts`.
 * There is no shared registry file for builders to edit.
 *
 * What loads when:
 *  - manifests of published / draft volumes: eager (tiny, in the entry chunk);
 *  - manifests of dev volumes (`_…`): lazy, requested only with `?debug`;
 *  - chapter manifests: one lazy chunk per volume — `src/volumes/<id>/chapters.ts` globs them eagerly and is
 *    itself imported lazily here (chunk `volume-<id>`), when the volume is first needed (`Library.load`).
 */
import config from '../volumes/library.json';
import { bindChapter, type ChapterManifest } from './chapter';
import type { LibraryConfig, VolumeSource } from './library';
import { isDevVolumeId, type VolumeManifest } from './volume';

type VolumeModule = { default?: VolumeManifest };
type ChapterModule = { default?: ChapterManifest };

const VOLUMES = import.meta.glob<VolumeModule>(['../volumes/*/volume.ts', '!../volumes/_*/volume.ts'], {
  eager: true,
});
const DEV_VOLUMES = import.meta.glob<VolumeModule>('../volumes/_*/volume.ts');
const CHAPTERS = import.meta.glob<{ default?: Record<string, ChapterModule> }>('../volumes/*/chapters.ts');

export const LIBRARY_CONFIG: LibraryConfig = config;

const volumeDir = (path: string): string | undefined => /volumes\/([^/]+)\/volume\.ts$/.exec(path)?.[1];

function checkedVolume(path: string, mod: VolumeModule): VolumeManifest | null {
  const manifest = mod.default;
  if (!manifest || typeof manifest.id !== 'string') {
    console.error(`[volumes] ${path}: must \`export default defineVolume(identity, { … })\``);
    return null;
  }
  if (manifest.id !== volumeDir(path)) {
    console.error(`[volumes] ${path}: volume id '${manifest.id}' must equal its directory name`);
    return null;
  }
  return manifest;
}

/** Loader of the chapter manifests of one volume: every `chapters/<id>/index.ts` below it, bound to it. */
function chapterLoader(volumeId: string): () => Promise<ChapterManifest[]> {
  const load = CHAPTERS[`../volumes/${volumeId}/chapters.ts`];
  return async () => {
    if (!load) {
      console.error(`[volumes] src/volumes/${volumeId}/chapters.ts is missing (copy it from another volume)`);
      return [];
    }
    const mods = (await load()).default ?? {};
    const manifests: ChapterManifest[] = [];
    Object.entries(mods).forEach(([path, mod]) => {
      const dir = /chapters\/([^/]+)\/index\.ts$/.exec(path)?.[1];
      const manifest = mod.default;
      if (!manifest || typeof manifest.id !== 'string') {
        console.error(`[chapters] ${path}: must \`export default defineChapter({ … })\``);
      } else if (manifest.id !== dir) {
        console.error(
          `[chapters] ${path}: manifest id '${manifest.id}' must equal its directory name '${dir}'`,
        );
      } else {
        manifests.push(bindChapter(manifest, volumeId));
      }
    });
    return manifests;
  };
}

/**
 * The volumes of this session. Published volumes always; draft and dev volumes only with `includeDev`
 * (`?debug`) — without it a dev volume's code is never requested.
 */
export async function discoverVolumes(opts: { includeDev: boolean }): Promise<VolumeSource[]> {
  const manifests: VolumeManifest[] = [];
  for (const [path, mod] of Object.entries(VOLUMES)) {
    const m = checkedVolume(path, mod);
    if (m && (m.status === 'published' || opts.includeDev)) manifests.push(m);
  }
  if (opts.includeDev) {
    const paths = Object.keys(DEV_VOLUMES);
    const mods = await Promise.all(paths.map((p) => DEV_VOLUMES[p]!()));
    paths.forEach((path, i) => {
      const m = checkedVolume(path, mods[i]!);
      if (m && isDevVolumeId(m.id)) manifests.push(m);
    });
  }
  return manifests.map((manifest) => ({ manifest, chapters: chapterLoader(manifest.id) }));
}
