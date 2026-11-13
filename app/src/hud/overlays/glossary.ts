/**
 * Glossary overlay of a volume: every key term, aggregated from the chapters' content — the Ukrainian name
 * (DECISIONS §54), symbol, unit, the international form as a small secondary line, the definition and a link to
 * the step that introduces it. Sorted and letter-indexed by the Ukrainian alphabet; filter by part of the
 * volume, by first letter, or just start typing (Ukrainian and international forms both match).
 *
 * Scope: the glossary belongs to its volume. When the library level is shown (more than one volume) a switch
 * widens it to the whole library — one list over all volumes, filtered by volume instead of by part.
 */
import {
  buildGlossary,
  filterGlossary,
  glossaryHeading,
  glossaryIntl,
  glossaryLetter,
  loadContents,
  recordKey,
  termName,
  UK_ALPHABET,
  type GlossaryRecord,
} from '@/content';
import { Button, Chip, Label, ScrollView, Tabs, TEXT_COLOR, UI, UiNode, rgba, type Painter } from '@/ui3d';
import { contentKey } from '@/content';
import { wantsFixture, type Journey } from '../journey';
import type { Hud, Overlay } from '../shell';
import { createModal } from './modal';

const PAGE = 24;
type Scope = 'volume' | 'library';

class SearchBox extends UiNode {
  readonly text = new Label(
    '',
    { size: UI.text.small, nowrap: true, reserve: 40, stable: true },
    { width: 'fill', height: 26 },
  );
  constructor() {
    super({ dir: 'row', align: 'center', gap: 8, width: 'fill', height: UI.hit, pad: [0, 14] });
    this.add(this.text);
  }
  set(query: string): void {
    this.text.setStyle({ color: query ? 'white' : TEXT_COLOR.mute });
    this.text.text = query ? `${query}▏` : 'Почніть друкувати, щоб знайти термін…';
  }
  override paint(p: Painter): void {
    p.rect(0, 0, this.bw, this.bh, {
      r: this.bh / 2,
      fill: rgba('bg.void', 0.75),
      border: rgba('cyan', 0.55),
      bw: 1.3,
    });
  }
}

/** Terms of one volume (with `?fixture`: completed from the volume's glossary fixture). */
async function loadRecords(journey: Journey): Promise<GlossaryRecord[]> {
  const real = buildGlossary(await loadContents(journey.chapters.filter((c) => c.real).map(contentKey)));
  const fixture = wantsFixture() ? journey.volume.fixtures?.glossary : undefined;
  if (!fixture) return real;
  const rows = await fixture();
  const volumeId = journey.volume.id;
  const have = new Set(real.map((r) => r.international));
  const extra = rows
    .filter((r) => !have.has(r[0]))
    .map((r): GlossaryRecord => ({
      international: r[0],
      ukrainian: r[1],
      symbol: r[2],
      unit: r[3],
      definition: r[4],
      volumeId,
      chapterId: r[5],
      stepId: r[6],
      alsoIn: r[7].map((c) => `${volumeId}/${c}`),
    }));
  const collator = new Intl.Collator('uk', { sensitivity: 'base' });
  const latin = (r: GlossaryRecord): number => (glossaryLetter(r) === '#' ? 1 : 0);
  return [...real, ...extra].sort(
    (a, b) => latin(a) - latin(b) || collator.compare(termName(a), termName(b)),
  );
}

/** Terms of every listed volume, in library order: a term shared by volumes appears once. */
async function loadLibraryRecords(hud: Hud): Promise<GlossaryRecord[]> {
  const library = hud.engine.library;
  const keys: string[] = [];
  for (const volume of library.listed) {
    const registry = await library.load(volume.id);
    keys.push(...registry.chapters.map(contentKey));
  }
  return buildGlossary(await loadContents(keys));
}

export function createGlossary(hud: Hud, journey: Journey): Overlay {
  const volume = journey.volume;
  const library = hud.engine.library;
  const cache: Record<Scope, GlossaryRecord[] | null> = { volume: null, library: null };
  let scope: Scope = volume.glossary.scope;
  let records: GlossaryRecord[] | null = null;
  let query = '';
  let group = 'all';
  let letter = '';
  let shown = PAGE;
  const search = new SearchBox();
  const count = new Label('', { size: UI.text.caption, color: TEXT_COLOR.mute, nowrap: true });
  const list = new ScrollView({ height: 'hug', gap: 10 });
  const letters = new UiNode({ dir: 'row', wrap: true, gap: 4, width: 'fill' });

  const row = (r: GlossaryRecord): UiNode => {
    // the chapter that introduces the term: in this volume's journey, or (library scope) in another volume
    const foreign = r.volumeId !== null && r.volumeId !== volume.id;
    const c = foreign ? library.registry(r.volumeId!)?.get(r.chapterId) : journey.get(r.chapterId);
    const real = foreign ? c !== undefined : journey.get(r.chapterId)?.real === true;
    const step = c?.steps.find((s) => s.id === r.stepId);
    const home = foreign ? `${library.get(r.volumeId!)?.title ?? r.volumeId} · ` : '';
    const where = c ? `${home}${c.title}${step ? ` · ${step.title}` : ''}` : r.chapterId;
    const link = new Button({
      label: where.length > 54 ? `${where.slice(0, 52)}…` : where,
      icon: 'link',
      variant: 'ghost',
      size: 'sm',
      alignSelf: 'start',
      tooltip: 'Перейти до кроку, де вводиться термін',
      onClick: () =>
        real
          ? hud.goto(recordKey(r), r.stepId ?? undefined)
          : hud.toast('Цей розділ ще будується.', { tone: 'warning', duration: 2.5 }),
    });
    const intl = glossaryIntl(r);
    return new UiNode({
      dir: 'col',
      gap: 2,
      width: 'fill',
      pad: [0, 0, 8, 0],
      children: [
        new Label(glossaryHeading(r), { size: UI.text.body, lineHeight: 1.3 }, { width: 'fill' }),
        intl
          ? new Label(intl, { size: UI.text.caption, color: TEXT_COLOR.mute, rich: false }, { width: 'fill' })
          : null,
        new Label(
          r.definition,
          { size: UI.text.small, color: TEXT_COLOR.dim, lineHeight: 1.36 },
          { width: 'fill' },
        ),
        link,
      ],
    });
  };

  const render = (): void => {
    list.content.clear();
    if (!records) {
      list.content.add(new Label('Завантаження термінів…', { size: UI.text.small, color: TEXT_COLOR.dim }));
      return;
    }
    // volume scope: tabs are the parts of the volume; library scope: tabs are the volumes
    const chapters =
      group === 'all' || scope === 'library'
        ? undefined
        : new Set(journey.chapters.filter((c) => c.group === group).map(contentKey));
    const hits = filterGlossary(records, {
      query,
      chapters,
      volume: scope === 'library' && group !== 'all' ? group : undefined,
      letter: letter || undefined,
    });
    count.text = `${hits.length} з ${records.length}`;
    for (const r of hits.slice(0, shown)) list.content.add(row(r));
    if (hits.length > shown) list.content.add(new Button({ label: `Показати ще ${Math.min(PAGE, hits.length - shown)}`, icon: 'chevronDown', alignSelf: 'center', onClick: () => { shown += PAGE; render(); } })); // prettier-ignore
    if (hits.length === 0)
      list.content.add(
        new Label('Нічого не знайдено. Спробуйте інше слово або зніміть фільтри.', {
          size: UI.text.small,
          color: TEXT_COLOR.dim,
        }),
      );
    search.set(query);
    hud.relayout();
  };
  const refilter = (): void => {
    shown = PAGE;
    list.scrollTo(0, true);
    render();
  };

  return createModal(hud, {
    title: 'Глосарій',
    icon: 'glossary',
    width: 920,
    fresh: true,
    build(body, arg) {
      query = typeof arg === 'string' ? arg : '';
      group = 'all';
      letter = '';
      shown = PAGE;
      records = cache[scope];
      const items =
        scope === 'library'
          ? library.listed.map((v) => ({ id: v.id, label: v.title, tooltip: v.subtitle }))
          : volume.journey.groups.map((g) => ({ id: g.id, label: g.short, tooltip: g.label }));
      // the scope switch exists only while the library level is shown (more than one volume)
      const scopes = hud.libraryLevel
        ? new Tabs({
            name: 'glossary-scope',
            items: [
              { id: 'volume', label: volume.title, tooltip: 'Терміни цього тому' },
              { id: 'library', label: 'Уся бібліотека', tooltip: 'Терміни всіх томів' },
            ],
            value: scope,
            onChange: (id) => {
              scope = id as Scope;
              hud.open('glossary', query);
            },
          })
        : null;
      const tabs = new Tabs({ items: [{ id: 'all', label: 'Усі' }, ...items], value: 'all', onChange: (id) => { group = id; refilter(); } }); // prettier-ignore
      letters.clear();
      const used = new Set((records ?? []).map(glossaryLetter));
      for (const ch of [...UK_ALPHABET, '#']) {
        if (records && !used.has(ch)) continue;
        const chip: Chip = new Chip({ text: ch, kind: 'plain', onClick: () => { letter = letter === ch ? '' : ch; refilter(); } }); // prettier-ignore
        letters.add(chip);
      }
      list.maxH = Math.max(hud.metrics.height - 470, 220);
      if (scopes) body.add(scopes);
      body.add(
        new UiNode({ dir: 'row', align: 'center', gap: 12, width: 'fill', children: [search, count] }),
        tabs,
        letters,
        list,
      );
      render();
      if (!records) {
        const wanted = scope;
        void (wanted === 'library' ? loadLibraryRecords(hud) : loadRecords(journey)).then((r) => {
          cache[wanted] = r;
          if (hud.overlay === 'glossary' && scope === wanted) hud.open('glossary', query); // rebuild with the letter index
        });
      }
    },
    key(e) {
      if (e.code === 'Backspace') query = query.slice(0, -1);
      else if (e.code === 'Escape' && query) query = '';
      else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && query.length < 32) query += e.key;
      else return false;
      refilter();
      return true;
    },
  });
}
