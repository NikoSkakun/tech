/**
 * Chapter registry of ONE volume: ordering across its chapters, parent/child groups, linear step order (pure
 * logic, unit-tested). The volumes themselves are kept by the `Library` (`library.ts`); discovery
 * (`import.meta.glob`) lives in `discover.ts` so this module stays testable in Node.
 */
import type { ChapterManifest } from './chapter';
import type { Position } from './store';
import type { VolumeManifest } from './volume';

/** The part of a volume manifest the registry needs. */
export type RegistryVolume = Pick<VolumeManifest, 'id'> & {
  readonly journey: Pick<VolumeManifest['journey'], 'axis' | 'groups'>;
};

export interface RegistryOptions {
  /** Include `dev: true` chapters (the `?debug` flag). */
  includeDev?: boolean;
}

export class Registry {
  /** Visible chapters in journey order: parents first, each followed by its children (depth-first). */
  readonly chapters: readonly ChapterManifest[];
  private readonly byId = new Map<string, ChapterManifest>();
  private readonly childMap = new Map<string, ChapterManifest[]>();
  private readonly linear: Position[] = [];
  private readonly linearIndex = new Map<string, number>();

  readonly volumeId: string;

  /** @param manifests the chapters of `volume` (bound to it: `manifest.volume === volume.id`). */
  constructor(
    readonly volume: RegistryVolume,
    manifests: readonly ChapterManifest[],
    opts: RegistryOptions = {},
  ) {
    this.volumeId = volume.id;
    const ids = new Set<string>();
    const groups = new Set(volume.journey.groups.map((g) => g.id));
    for (const m of manifests) {
      if (m.volume !== volume.id)
        throw new Error(`Registry(${volume.id}): chapter '${m.id}' is bound to volume '${m.volume}'`);
      if (ids.has(m.id)) throw new Error(`Registry(${volume.id}): duplicate chapter id '${m.id}'`);
      if (!groups.has(m.group))
        throw new Error(`Registry(${volume.id}): chapter '${m.id}' has unknown group '${m.group}'`);
      ids.add(m.id);
    }
    let visible = manifests.filter((m) => opts.includeDev || !m.dev);
    // Until real chapters exist a build would be empty: fall back to the dev chapters rather than to nothing.
    if (visible.length === 0) visible = [...manifests];
    const visibleIds = new Set(visible.map((m) => m.id));
    const byOrder = (a: ChapterManifest, b: ChapterManifest): number =>
      a.order - b.order || a.id.localeCompare(b.id);
    const roots: ChapterManifest[] = [];
    for (const m of visible) {
      this.byId.set(m.id, m);
      if (m.parent && visibleIds.has(m.parent) && m.parent !== m.id) {
        const list = this.childMap.get(m.parent) ?? [];
        list.push(m);
        this.childMap.set(m.parent, list);
      } else {
        roots.push(m);
      }
    }
    for (const list of this.childMap.values()) list.sort(byOrder);
    roots.sort(byOrder);
    const ordered: ChapterManifest[] = [];
    const visit = (m: ChapterManifest, depth: number): void => {
      if (depth > 8) throw new Error(`Registry: parent cycle at chapter '${m.id}'`);
      ordered.push(m);
      for (const child of this.childMap.get(m.id) ?? []) visit(child, depth + 1);
    };
    for (const r of roots) visit(r, 0);
    this.chapters = ordered;
    for (const m of ordered) {
      for (const s of m.steps) {
        this.linearIndex.set(`${m.id}/${s.id}`, this.linear.length);
        this.linear.push({ volumeId: volume.id, chapterId: m.id, stepId: s.id });
      }
    }
  }

  get(id: string): ChapterManifest | undefined {
    return this.byId.get(id);
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  childrenOf(id: string): readonly ChapterManifest[] {
    return this.childMap.get(id) ?? [];
  }

  parentOf(id: string): ChapterManifest | undefined {
    const parent = this.byId.get(id)?.parent;
    return parent ? this.byId.get(parent) : undefined;
  }

  /** First chapter of the journey. */
  get first(): ChapterManifest {
    const m = this.chapters[0];
    if (!m) throw new Error('Registry: no chapters registered');
    return m;
  }

  /**
   * Turn a possibly partial / invalid route into a valid position:
   * unknown chapter → null; missing or unknown step → the chapter's first step.
   */
  resolve(chapterId: string | null, stepId: string | null): Position | null {
    if (!chapterId) return null;
    const m = this.byId.get(chapterId);
    if (!m) return null;
    const step = m.steps.find((s) => s.id === stepId) ?? m.steps[0]!;
    return { volumeId: this.volumeId, chapterId: m.id, stepId: step.id };
  }

  stepIndex(pos: Position): number {
    return this.byId.get(pos.chapterId)?.steps.findIndex((s) => s.id === pos.stepId) ?? -1;
  }

  /** Next step in journey order (crossing chapter boundaries), or null at the very end. */
  next(pos: Position): Position | null {
    const i = this.linearIndex.get(`${pos.chapterId}/${pos.stepId}`);
    return i === undefined ? null : (this.linear[i + 1] ?? null);
  }

  prev(pos: Position): Position | null {
    const i = this.linearIndex.get(`${pos.chapterId}/${pos.stepId}`);
    return i === undefined || i === 0 ? null : (this.linear[i - 1] ?? null);
  }

  /** Total number of steps on the journey and the 0-based index of `pos` among them. */
  journeyProgress(pos: Position): { index: number; total: number } {
    return { index: this.linearIndex.get(`${pos.chapterId}/${pos.stepId}`) ?? -1, total: this.linear.length };
  }

  /**
   * Zoom direction of the transition between two chapters of the volume: −1 = zoom out, +1 = zoom in.
   * It follows the journey axis (electricity: zoom out when moving up in scale — `axis.ascending`);
   * equal axis values fall back to journey order.
   */
  zoomDirection(fromId: string | null, toId: string): 1 | -1 {
    const to = this.byId.get(toId);
    const from = fromId ? this.byId.get(fromId) : undefined;
    if (!from || !to) return 1;
    if (to.axisValue !== from.axisValue) {
      const out = this.volume.journey.axis.ascending === 'out';
      return to.axisValue > from.axisValue === out ? -1 : 1;
    }
    return this.chapters.indexOf(to) >= this.chapters.indexOf(from) ? 1 : -1;
  }
}
