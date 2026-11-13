/**
 * The volume contract (DECISIONS §58, docs/VOLUMES.md): the library is a set of volumes, a volume is a set of
 * chapters with its own journey map. A volume lives in `src/volumes/<id>/`:
 *
 *   volume.json   identity and journey order — plain data, also read by vite.config.ts, tools/content, tools/qa
 *   volume.ts     `export default defineVolume(identity, { journey, theme, … })` — the manifest (tiny, no three.js)
 *
 * Platform code never names a volume: manifests are discovered (`discover.ts`) and kept in the `Library`.
 */
import { ACCENT, type AccentName } from '@/style/palette';
import type { ChapterTheme } from './chapter';

/**
 * `published` — listed in production. `draft` — a volume in the making: bundled, but registered only with
 * `?debug`. `dev` — development-only (demo, sandboxes): its directory starts with `_`, its manifest is lazy
 * and registered only with `?debug`.
 */
export type VolumeStatus = 'published' | 'draft' | 'dev';

/** Shape of `volume.json` (the fields the app reads; the document pipeline reads `docs` as well). */
export interface VolumeIdentity {
  readonly id: string;
  /** Short name of the volume: library cards, header, glossary scope («Електроенергія»). */
  readonly title: string;
  /** The volume's own line («Від електрона до розетки»). */
  readonly subtitle: string;
  /** Which of the two is the big line on the volume's home screen (default `title`). */
  readonly headline?: string;
  /** Small caps line above the headline on the home screen. */
  readonly kicker?: string;
  /** One or two sentences under the headline. */
  readonly lead?: string;
  /** Position in the library. */
  readonly order: number;
  /** Accent token of the volume (library card, emblem). */
  readonly accent: string;
  /** Icon of the volume's emblem on the library screen (a `@/ui3d` icon name; default `book`). */
  readonly emblem?: string;
  readonly status: string;
  /** False keeps a registered volume off the library screen (the sandbox pseudo-volume). Default true. */
  readonly listed?: boolean;
  readonly axis: {
    readonly label: string;
    readonly unit: string;
    readonly hint?: string;
    readonly range?: string;
  };
  /** Parts of the volume, in order. `label` is the short on-screen name. */
  readonly groups: readonly { readonly id: string; readonly label: string; readonly short?: string }[];
  /** Planned chapters in journey order (built or not) — the document pipeline's source of truth. */
  readonly journey: readonly { readonly id: string; readonly group: string; readonly parent?: string }[];
}

/** The axis of a volume's journey map — electricity: scale in metres; another volume: frequency, time, level… */
export interface JourneyAxis {
  /** Name of the quantity («Масштаб»). */
  readonly label: string;
  /** Unit symbol (`m`, `Hz`; empty for a dimensionless axis). */
  readonly unit: string;
  /** Tooltip of a chapter's axis chip («Характерний масштаб розділу»). */
  readonly hint: string;
  /** The whole span of the journey as one label for the home screen (`10⁻¹⁸ m … 10⁶ m`). */
  readonly range: string;
  /** Ruler range, in axis values (a chapter's `axisValue` uses the same numbers). */
  readonly min: number;
  readonly max: number;
  /** Axis value drawn at map height 0. */
  readonly origin: number;
  /** Distance between ruler ticks, in axis values, and how often a tick is long and labelled. */
  readonly tick: number;
  readonly majorEvery: number;
  /** Ruler label of an axis value (`10⁻¹⁰ m`). */
  format(value: number): string;
  /**
   * What the chapter transition does when the axis value grows: electricity zooms **out** when the scale
   * grows. `in` suits axes where "more" means "closer" (level of detail).
   */
  readonly ascending: 'out' | 'in';
}

export interface JourneyGroup {
  readonly id: string;
  /** Ukrainian name (header kicker, map card). */
  readonly label: string;
  /** Name for narrow places (glossary tabs); the label when `volume.json` gives no `short`. */
  readonly short: string;
  /** Generic journey-map emblem of the group's chapters until they ship their own (`@/hud` emblem names). */
  readonly emblem: string;
}

/** Geometry hints of the journey map, in map units (defaults: `DEFAULT_MAP_LAYOUT`). */
export interface JourneyLayout {
  /** Horizontal distance between main-path nodes. */
  readonly dx: number;
  /** Height per unit of the axis. */
  readonly dy: number;
  /** Depth meander amplitude. */
  readonly dz: number;
  readonly rootRadius: number;
  readonly childRadius: number;
  /** Horizontal spacing of satellites under their hub. */
  readonly orbit: number;
}

export const DEFAULT_MAP_LAYOUT: JourneyLayout = {
  dx: 196,
  dy: 34,
  dz: 110,
  rootRadius: 46,
  childRadius: 27,
  orbit: 152,
};

/** A chapter of a journey fixture (`?fixture`): what the map and the spine need before the chapter exists. */
export interface FixtureChapter {
  readonly id: string;
  readonly title: string;
  readonly group: string;
  readonly parent: string | null;
  readonly axisLabel: string;
  readonly axisValue: number;
  readonly accent: AccentName;
  readonly steps: readonly { readonly id: string; readonly title: string }[];
}

/** Glossary fixture row: international, ukrainian, symbol, unit, definition, chapterId, stepId, alsoIn. */
export type FixtureGlossaryRow = readonly [
  string,
  string,
  string | null,
  string | null,
  string,
  string,
  string | null,
  readonly string[],
];

/** Optional development data of a volume, loaded only with `?fixture`. */
export interface VolumeFixtures {
  /** Every planned chapter of the volume, so the map and the spine can be exercised at full size. */
  readonly journey?: () => Promise<readonly FixtureChapter[]>;
  readonly glossary?: () => Promise<readonly FixtureGlossaryRow[]>;
}

export interface VolumeManifest {
  /** URL-safe id; equals the directory name under `src/volumes/`. */
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  /** The big line of the volume's home screen (the title or the subtitle, see `VolumeIdentity.headline`). */
  readonly headline: string;
  readonly kicker: string;
  readonly lead: string;
  readonly order: number;
  readonly accent: AccentName;
  /** Icon name of the volume's emblem on the library screen. */
  readonly emblem: string;
  readonly status: VolumeStatus;
  /** Shown on the library screen (when registered). */
  readonly listed: boolean;
  readonly journey: {
    readonly axis: JourneyAxis;
    readonly groups: readonly JourneyGroup[];
    readonly layout: JourneyLayout;
    /** Planned chapters in journey order (ids only — built chapters register themselves). */
    readonly planned: readonly { readonly id: string; readonly group: string; readonly parent?: string }[];
  };
  /** What the glossary shows when opened inside this volume: its own terms, or the whole library's. */
  readonly glossary: { readonly scope: 'volume' | 'library' };
  /** Default environment of the volume: the look of its chapters unless a chapter chooses otherwise. */
  readonly theme: ChapterTheme;
  readonly fixtures?: VolumeFixtures;
}

/** What `volume.ts` adds to the identity of `volume.json`. */
export interface VolumeSpec {
  readonly journey: {
    /** `label` and `unit` come from `volume.json`. */
    readonly axis: Omit<JourneyAxis, 'label' | 'unit' | 'hint' | 'range'>;
    /** Emblem of each group (`@/hud` emblem names); groups without an entry use the generic emblem. */
    readonly emblems?: Readonly<Record<string, string>>;
    readonly layout?: Partial<JourneyLayout>;
  };
  readonly glossary?: { readonly scope: 'volume' | 'library' };
  /** Default environment; `accent` defaults to the volume accent. */
  readonly theme: Omit<ChapterTheme, 'accent'> & { readonly accent?: AccentName };
  readonly fixtures?: VolumeFixtures;
}

const ID = /^[A-Za-z0-9_][A-Za-z0-9_-]*$/;
const STATUSES: readonly string[] = ['published', 'draft', 'dev'];

/** Is this the id of a development-only volume (directory name starting with `_`)? */
export function isDevVolumeId(id: string): boolean {
  return id.startsWith('_');
}

/** Declare a volume: `export default defineVolume(identity, { … })`. Validates eagerly, like `defineChapter`. */
export function defineVolume(identity: VolumeIdentity, spec: VolumeSpec): VolumeManifest {
  const fail = (msg: string): never => {
    throw new Error(`defineVolume(${identity.id}): ${msg}`);
  };
  if (!ID.test(identity.id)) fail(`invalid volume id '${identity.id}'`);
  if (!STATUSES.includes(identity.status)) fail(`status must be one of ${STATUSES.join(' | ')}`);
  const status = identity.status as VolumeStatus;
  if (isDevVolumeId(identity.id) !== (status === 'dev'))
    fail(`a dev volume has status 'dev' and a directory name starting with '_' (and only a dev volume)`);
  if (!(identity.accent in ACCENT)) fail(`unknown accent '${identity.accent}'`);
  const accent = identity.accent as AccentName;
  if (identity.groups.length === 0) fail('a volume needs at least one group');
  const groupIds = new Set(identity.groups.map((g) => g.id));
  if (groupIds.size !== identity.groups.length) fail('duplicate group id');
  const planned = new Set<string>();
  for (const c of identity.journey) {
    if (!ID.test(c.id)) fail(`invalid chapter id '${c.id}' in journey`);
    if (planned.has(c.id)) fail(`chapter '${c.id}' is listed twice in journey`);
    if (!groupIds.has(c.group)) fail(`chapter '${c.id}': unknown group '${c.group}'`);
    planned.add(c.id);
  }
  for (const c of identity.journey)
    if (c.parent !== undefined && !planned.has(c.parent))
      fail(`chapter '${c.id}': unknown parent '${c.parent}'`);
  const axis = spec.journey.axis;
  if (!(axis.max > axis.min) || !(axis.tick > 0) || !(axis.majorEvery >= 1))
    fail('journey axis needs max > min, tick > 0, majorEvery ≥ 1');
  if (identity.headline !== undefined && identity.headline !== 'title' && identity.headline !== 'subtitle')
    fail(`headline must be 'title' or 'subtitle'`);
  return {
    id: identity.id,
    title: identity.title,
    subtitle: identity.subtitle,
    headline: identity.headline === 'subtitle' ? identity.subtitle : identity.title,
    kicker: identity.kicker ?? '',
    lead: identity.lead ?? '',
    order: identity.order,
    accent,
    emblem: identity.emblem ?? 'book',
    status,
    listed: identity.listed ?? true,
    journey: {
      axis: {
        ...axis,
        label: identity.axis.label,
        unit: identity.axis.unit,
        hint: identity.axis.hint ?? identity.axis.label,
        range: identity.axis.range ?? `${axis.format(axis.min)} … ${axis.format(axis.max)}`,
      },
      groups: identity.groups.map((g) => ({
        id: g.id,
        label: g.label,
        short: g.short ?? g.label,
        emblem: spec.journey.emblems?.[g.id] ?? 'generic',
      })),
      layout: { ...DEFAULT_MAP_LAYOUT, ...spec.journey.layout },
      planned: identity.journey,
    },
    glossary: spec.glossary ?? { scope: 'volume' },
    theme: { ...spec.theme, accent: spec.theme.accent ?? accent },
    fixtures: spec.fixtures,
  };
}

/** Short on-screen name of a group of the volume (empty for an unknown group). */
export function groupLabel(volume: VolumeManifest, group: string): string {
  return volume.journey.groups.find((g) => g.id === group)?.label ?? '';
}
