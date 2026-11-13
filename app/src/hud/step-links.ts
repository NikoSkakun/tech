/**
 * «Див. також»: the chapter's `crossReferences` as link chips in the step panel. A reference belongs to the step
 * its `where` names (`` `step-id` `` or «крок N»); references that name no step go to the last step. Chips of
 * chapters that are built jump there — in this volume or in another one; the others are inactive (dimmed, a
 * tooltip, no sound).
 */
import type { ChapterManifest } from '@/engine/api';
import { linkTarget, type ChapterContent, type CrossReference } from '@/content';
import { Chip, UiNode } from '@/ui3d';
import type { HudContext } from './context';
import { caption } from './step-sections';

/** Step index a reference belongs to (-1: none named). */
function stepOf(ref: CrossReference, manifest: ChapterManifest): number {
  for (const m of ref.where.matchAll(/`([a-z][a-z0-9-]*)`/g)) {
    const i = manifest.steps.findIndex((s) => s.id === m[1]);
    if (i >= 0) return i;
  }
  const n = /крок(?:и|у|ах)?\s+(\d+)/i.exec(ref.where);
  return n ? Math.min(Number(n[1]) - 1, manifest.steps.length - 1) : -1;
}

/** Link chips for step `index` of the chapter, or null when it has none. */
export function buildLinks(
  hud: HudContext,
  content: ChapterContent | null,
  manifest: ChapterManifest,
  index: number,
): UiNode | null {
  const last = manifest.steps.length - 1;
  const refs = (content?.crossReferences ?? []).filter((r) => {
    const i = stepOf(r, manifest);
    return i === index || (i < 0 && index === last);
  });
  const chips: Chip[] = [];
  const seen = new Set<string>();
  for (const ref of refs) {
    // `note` lists one caption per target, separated by «;»
    const notes = (ref.note ?? '').split(';').map((s) => s.trim());
    ref.targets.forEach((target, k) => {
      if (seen.has(target)) return;
      seen.add(target);
      // targets are full step addresses (`volume/chapter/step`); the volumes a chapter links to are loaded
      // together with its content (`Hud.setChapter`), so a link into another volume resolves here too
      const to = linkTarget(target);
      if (!to) return;
      const volumeId = to.volumeId ?? manifest.volume;
      const chapterId = to.chapterId;
      const built = hud.engine.library.registry(volumeId)?.get(chapterId);
      const step = built?.steps.find((s) => s.id === to.stepId);
      const label =
        (notes.length === ref.targets.length ? notes[k] : undefined) ||
        (built ? `${built.title}${step ? ` · ${step.title}` : ''}` : chapterId);
      chips.push(
        new Chip({
          name: `xref-${target}`,
          kind: 'plain',
          icon: built ? 'link' : 'lock',
          text: label.length > 60 ? `${label.slice(0, 58)}…` : label,
          maxWidth: 380,
          opacity: built ? 1 : 0.55,
          tooltip: built ? 'Перейти до пов’язаного кроку' : 'Цей розділ ще будується',
          onClick: built ? () => hud.goto(`${volumeId}/${chapterId}`, step?.id) : undefined,
        }),
      );
    });
  }
  if (chips.length === 0) return null;
  return new UiNode({
    dir: 'col',
    gap: 8,
    width: 'fill',
    children: [
      caption('Див. також'),
      new UiNode({ dir: 'row', wrap: true, gap: 8, width: 'fill', children: chips }),
    ],
  });
}
