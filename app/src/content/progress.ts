/**
 * Progress helpers over the store's `progress.visited` (full chapter id `volume/chapter` → ids of opened steps).
 */
import { contentKey } from './define';

export interface StepsLike {
  /** Volume of the chapter (chapter manifests and journey chapters always have it). */
  readonly volume?: string;
  readonly id: string;
  readonly steps: readonly { readonly id: string }[];
}
export type Visited = Readonly<Record<string, readonly string[]>>;

/** @param chapterKey full chapter id (`volume/chapter`). */
export function isVisited(visited: Visited, chapterKey: string, stepId: string): boolean {
  return visited[chapterKey]?.includes(stepId) ?? false;
}

/** Steps of a chapter the user has opened (stale ids of removed steps are ignored). */
export function chapterProgress(
  visited: Visited,
  chapter: StepsLike,
): { done: number; total: number; fraction: number } {
  const seen = visited[contentKey(chapter)] ?? [];
  const done = chapter.steps.reduce((n, s) => n + (seen.includes(s.id) ? 1 : 0), 0);
  const total = chapter.steps.length;
  return { done, total, fraction: total > 0 ? done / total : 0 };
}

export function journeyProgress(
  visited: Visited,
  chapters: readonly StepsLike[],
): { done: number; total: number; fraction: number } {
  let done = 0;
  let total = 0;
  for (const c of chapters) {
    const p = chapterProgress(visited, c);
    done += p.done;
    total += p.total;
  }
  return { done, total, fraction: total > 0 ? done / total : 0 };
}

/** First step of the journey that has not been opened yet (null when everything was seen). */
export function firstUnvisited(
  visited: Visited,
  chapters: readonly StepsLike[],
): { volumeId: string | null; chapterId: string; stepId: string } | null {
  for (const c of chapters)
    for (const s of c.steps)
      if (!isVisited(visited, contentKey(c), s.id))
        return { volumeId: c.volume ?? null, chapterId: c.id, stepId: s.id };
  return null;
}

/** Store patch that forgets all progress in every volume (settings are kept). */
export function clearedProgress(): {
  progress: { visited: Record<string, string[]> };
  last: null;
  lastIn: Record<string, never>;
} {
  return { progress: { visited: {} }, last: null, lastIn: {} };
}
