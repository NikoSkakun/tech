/**
 * Lazy access to chapter content. Every `src/volumes/<volume>/chapters/<id>/content.ts` that default-exports
 * `defineContent(…)` is discovered here (no registry to edit) and loaded on demand as its own chunk — the HUD
 * needs the current chapter's text, the glossary needs a whole volume's (or the whole library's).
 * Chapters are addressed by their content key `volume/chapter` (`contentKey`).
 */
import type { ChapterContent } from './types';

const modules = import.meta.glob<{ default?: unknown }>('../volumes/*/chapters/*/content.ts');
const cache = new Map<string, Promise<ChapterContent | null>>();
const pathOf = (key: string): string => {
  const [volume = '', chapter = ''] = key.split('/');
  return `../volumes/${volume}/chapters/${chapter}/content.ts`;
};

function isContent(v: unknown): v is ChapterContent {
  return (
    typeof v === 'object' &&
    v !== null &&
    Array.isArray((v as ChapterContent).steps) &&
    typeof (v as ChapterContent).id === 'string'
  );
}

/** Content keys (`volume/chapter`) of the chapters that ship a `content.ts` — of one volume, or of all. */
export function contentIds(volumeId?: string): string[] {
  return Object.keys(modules)
    .map((p) => /volumes\/([^/]+)\/chapters\/([^/]+)\/content\.ts$/.exec(p))
    .filter((m): m is RegExpExecArray => m !== null && (volumeId === undefined || m[1] === volumeId))
    .map((m) => `${m[1]}/${m[2]}`);
}

/**
 * Content of a chapter (`key` = `volume/chapter`), or null if it has none in the expected shape. Never
 * rejects. The volume is taken from the key when the content does not state it.
 */
export function loadContent(key: string): Promise<ChapterContent | null> {
  let hit = cache.get(key);
  if (!hit) {
    const load = modules[pathOf(key)];
    hit = load
      ? load().then(
          (m) =>
            isContent(m.default) ? { ...m.default, volume: m.default.volume ?? key.split('/')[0] } : null,
          (error: unknown) => {
            console.error(`[content] cannot load content of '${key}':`, error);
            return null;
          },
        )
      : Promise.resolve(null);
    cache.set(key, hit);
  }
  return hit;
}

/** Content of several chapters (missing ones are skipped), in the order given. */
export async function loadContents(keys: readonly string[]): Promise<ChapterContent[]> {
  const all = await Promise.all(keys.map(loadContent));
  return all.filter((c): c is ChapterContent => c !== null);
}
