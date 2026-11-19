/**
 * DEV TOOL (the owner, 2026-11-19: «додай dev перемикач щоб перша глава показувалась ще сама оригінальна;
 * перемикач на різні версії — поточна, сьогоднішня до правок і сама найперша»): a switch on `click` that opens a
 * frozen build of an earlier version of this chapter. The builds live beside the live one in `v/<id>/` and are
 * listed in `v/versions.json` (`tools/versions/build.sh`, run by the orchestrator at deploy). The switch is there
 * only when that manifest is: the public build and the dev server have none, so they show nothing.
 * Remove it in one place: `DEV_VERSIONS`.
 */
import type { ControlSpec } from '@/hud/step-ui-types';

/** The one switch of the dev tool: false removes the version switch from `click` (and its manifest request). */
export const DEV_VERSIONS = true;

/** Where every version opens: this chapter's first step. */
const START = '#/circuit/prologue/click';
/** The live build's id in the manifest. */
const CURRENT = 'current';

export interface DevVersion {
  id: string;
  label: string;
}

/**
 * The manifest's list, or null when it is not one: a missing file comes back as the app's own index.html from
 * nginx's SPA fallback, as a 404 elsewhere. A version id is a path segment, so only `[a-z0-9-]` passes.
 */
export function parseVersions(json: unknown): DevVersion[] | null {
  const list = (json as { versions?: unknown } | null)?.versions;
  if (!Array.isArray(list)) return null;
  const versions = list.flatMap((v: unknown): DevVersion[] => {
    const { id, label } = (v ?? {}) as { id?: unknown; label?: unknown };
    return typeof id === 'string' && /^[a-z0-9-]+$/.test(id) && typeof label === 'string' && label.length > 0
      ? [{ id, label }]
      : [];
  });
  return versions.some((v) => v.id !== CURRENT) ? versions : null;
}

/** The address of a version's first step, relative to the live build's own location. */
export function versionHref(id: string, base: string): string {
  return new URL(id === CURRENT ? START : `v/${id}/${START}`, base).href;
}

async function loadVersions(): Promise<DevVersion[] | null> {
  if (!DEV_VERSIONS) return null;
  try {
    const response = await fetch(new URL('v/versions.json', document.baseURI), { cache: 'no-cache' });
    return response.ok ? parseVersions(await response.json()) : null;
  } catch {
    return null; // no manifest, or not JSON
  }
}

/** Requested when the chapter's code loads, so the scene does not wait for it (a small local file). */
const ready = typeof document === 'undefined' ? Promise.resolve(null) : loadVersions();

/** The switch «dev · версія» for `click`, or nothing when there are no frozen versions to switch to. */
export async function devVersionControls(): Promise<ControlSpec[]> {
  const versions = await ready;
  if (!versions) return [];
  const items = versions.some((v) => v.id === CURRENT) ? versions : [{ id: CURRENT, label: 'поточна' }, ...versions];
  return [
    {
      type: 'segmented',
      id: 'devVersion',
      label: 'dev · версія',
      items,
      value: CURRENT,
      onChange: (id) => {
        if (id !== CURRENT) window.location.assign(versionHref(id, document.baseURI));
      },
    },
  ];
}
