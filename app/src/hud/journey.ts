/**
 * Journey model of ONE volume: its chapters in journey order with their parent / child structure — the data
 * the spine and the Journey Map are drawn from. Built from the volume's registered chapter manifests, or
 * (dev, `?fixture`) from the volume's fixture (`VolumeManifest.fixtures.journey`) so both views can be
 * exercised at full scale before the real chapters exist.
 */
import type { ChapterManifest, Engine, FixtureChapter, VolumeManifest } from '@/engine/api';
import type { AccentName } from '@/style';

export interface JourneyStep {
  readonly id: string;
  readonly title: string;
}

export interface JourneyChapter {
  /** Volume of the chapter (progress is keyed by `volume/id`). */
  readonly volume: string;
  readonly id: string;
  readonly title: string;
  readonly group: string;
  readonly parent: string | null;
  readonly axisLabel: string;
  /** Value on the volume's journey axis — the node's height on the map's ruler. */
  readonly axisValue: number;
  readonly accent: AccentName;
  readonly steps: readonly JourneyStep[];
  /** False for fixture entries that have no chapter behind them (they cannot be opened). */
  readonly real: boolean;
  /** Journey-map emblem loader of real chapters. */
  readonly emblem?: ChapterManifest['emblem'];
}

export interface Journey {
  /** The volume this journey belongs to (axis, groups, layout hints, names). */
  readonly volume: VolumeManifest;
  /** All chapters in journey order (parents followed by their children). */
  readonly chapters: readonly JourneyChapter[];
  /** Main-path chapters. */
  readonly roots: readonly JourneyChapter[];
  childrenOf(id: string): readonly JourneyChapter[];
  get(id: string): JourneyChapter | undefined;
  readonly stepCount: number;
  /** True when built from the fixture. */
  readonly fixture: boolean;
}

function build(volume: VolumeManifest, chapters: readonly JourneyChapter[], fixture: boolean): Journey {
  const ids = new Set(chapters.map((c) => c.id));
  const roots = chapters.filter((c) => !c.parent || !ids.has(c.parent));
  const kids = new Map<string, JourneyChapter[]>();
  for (const c of chapters) {
    if (c.parent && ids.has(c.parent)) kids.set(c.parent, [...(kids.get(c.parent) ?? []), c]);
  }
  const byId = new Map(chapters.map((c) => [c.id, c]));
  return {
    volume,
    chapters,
    roots,
    childrenOf: (id) => kids.get(id) ?? [],
    get: (id) => byId.get(id),
    stepCount: chapters.reduce((n, c) => n + c.steps.length, 0),
    fixture,
  };
}

export function journeyFromManifests(volume: VolumeManifest, manifests: readonly ChapterManifest[]): Journey {
  return build(
    volume,
    manifests.map((m) => ({
      volume: volume.id,
      id: m.id,
      title: m.title,
      group: m.group,
      parent: m.parent ?? null,
      axisLabel: m.axisLabel,
      axisValue: m.axisValue,
      accent: m.theme.accent,
      steps: m.steps.map((s) => ({ id: s.id, title: s.title })),
      real: true,
      emblem: m.emblem,
    })),
    false,
  );
}

/** True when the page was opened with `?fixture` (development aid; ignored in production builds without it). */
export function wantsFixture(): boolean {
  return new URLSearchParams(window.location.search).has('fixture');
}

/**
 * The journey of a volume: its registered chapters, or its fixture when asked for with `?fixture` (and the
 * volume has one). Real chapters with the same id replace their fixture entries, so finished chapters are
 * reachable from the full-scale map.
 */
export async function loadJourney(engine: Engine, volume: VolumeManifest): Promise<Journey> {
  const registry = await engine.library.load(volume.id);
  const real = journeyFromManifests(volume, registry.chapters);
  const fixture = wantsFixture() ? volume.fixtures?.journey : undefined;
  if (!fixture) return real;
  const planned: readonly FixtureChapter[] = await fixture();
  return build(
    volume,
    planned.map((f) => real.get(f.id) ?? { ...f, volume: volume.id, real: false }),
    true,
  );
}
