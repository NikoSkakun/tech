/**
 * The expandable sections under a step's text: key terms (chips that open their definition), formulas,
 * «Цифри і факти», misconceptions. One section is open at a time, so the panel stays compact. At the simple reading
 * level (a `LeveledStep` from `./level`) the chips read «Слова» and «Цікаво»; the selector already left out formulas.
 */
import {
  LEVEL_LABELS,
  termIntl,
  termName,
  type Fact,
  type LevelLabels,
  type ReadingLevel,
  type StepContent,
  type Term,
} from '@/content';
import {
  Button,
  Card,
  Chip,
  FormulaBlock,
  Label,
  Table,
  TEXT_COLOR,
  UI,
  UiNode,
  conceal,
  reveal,
  type IconName,
} from '@/ui3d';
import type { HudContext } from './context';

interface Section {
  id: string;
  button: Button;
  body: UiNode;
}

function termCard(hud: HudContext, term: Term, labels: LevelLabels): UiNode {
  const intl = termIntl(term);
  const tail = [term.symbol, term.unit].filter((v): v is string => !!v && v !== '—').join(', ');
  return new Card({
    width: 'fill',
    kicker: labels.term,
    title: termName(term),
    body: `${tail ? `\`${tail}\` — ` : ''}${term.definition ?? ''}`,
    extra: [
      ...(intl
        ? [new Label(intl, { size: UI.text.caption, color: TEXT_COLOR.mute, rich: false }, { width: 'fill' })]
        : []),
      ...(labels.glossary
        ? [
            new Button({
              label: 'Відкрити глосарій',
              icon: 'glossary',
              variant: 'ghost',
              size: 'sm',
              alignSelf: 'start',
              onClick: () => hud.open('glossary', termName(term)),
            }),
          ]
        : []),
    ],
  });
}

/**
 * A fact chip, or a real table when the document wrote the fact as a Markdown table. Tables wider than four
 * columns do not fit the 420 px-eq panel: each row becomes a small key–value card instead.
 */
function factNode(f: Fact): UiNode {
  if (!f.table) return new Chip({ kind: 'fact', text: f.text, maxWidth: 360, width: 'fill' });
  const { head, rows } = f.table;
  const note = f.table.note ?? f.source;
  const body: UiNode[] =
    head.length <= 4
      ? [new Table({ head, rows })]
      : rows.map(
          (r) =>
            new UiNode({
              dir: 'col',
              gap: 2,
              width: 'fill',
              children: [
                new Label(
                  r[0] ?? '',
                  { font: 'bodyBold', size: UI.text.small, color: 'yellow' },
                  { width: 'fill' },
                ),
                new Table({ rows: head.slice(1).map((h, j) => [h, r[j + 1] ?? '']), size: UI.text.caption }),
              ],
            }),
        );
  return new UiNode({
    dir: 'col',
    gap: 8,
    width: 'fill',
    children: [
      ...body,
      note ? new Label(note, { size: UI.text.caption, color: TEXT_COLOR.mute }, { width: 'fill' }) : null,
    ],
  });
}

/** Build the accordion for a step. Returns null when the step has nothing to put in it. */
export function buildSections(hud: HudContext, step: StepContent & { level?: ReadingLevel }): UiNode | null {
  const labels = LEVEL_LABELS[step.level ?? 'detailed'];
  const sections: Section[] = [];
  const bar = new UiNode({ dir: 'row', wrap: true, gap: 8, width: 'fill' });
  const bodies = new UiNode({ dir: 'col', width: 'fill' });
  let open: Section | null = null;
  const toggle = (s: Section): void => {
    const next = open === s ? null : s;
    if (open) {
      open.button.selected = false;
      conceal(open.body, { dy: 6, scale: 1 });
    }
    open = next;
    if (next) {
      next.button.selected = true;
      reveal(next.body, { dy: 8, scale: 1 });
    }
    hud.relayout();
  };
  const add = (id: string, label: string, icon: IconName, body: UiNode): void => {
    body.visible = false;
    body.opacity = 0;
    const section: Section = {
      id,
      body,
      button: new Button({ name: `section-${id}`, label, icon, size: 'sm', onClick: () => toggle(section) }),
    };
    sections.push(section);
    bar.add(section.button);
    bodies.add(body);
  };

  const terms = step.terms ?? [];
  if (terms.length > 0) {
    const slot = new UiNode({ dir: 'col', width: 'fill' });
    const chips = new UiNode({ dir: 'row', wrap: true, gap: 8, width: 'fill' });
    let shown: Term | null = null;
    for (const t of terms) {
      chips.add(
        new Chip({
          kind: 'term',
          text: termName(t),
          tooltip: 'Показати визначення',
          onClick: () => {
            slot.clear();
            shown = shown === t ? null : t;
            if (shown) slot.add(termCard(hud, t, labels));
            hud.relayout();
          },
        }),
      );
    }
    add(
      'terms',
      `${labels.terms} · ${terms.length}`,
      'book',
      new UiNode({ dir: 'col', gap: 10, width: 'fill', children: [chips, slot] }),
    );
  }

  const formulas = step.formulas?.items ?? [];
  if (formulas.length > 0) {
    add(
      'formulas',
      `Формули · ${formulas.length}`,
      'chart',
      new UiNode({
        dir: 'col',
        gap: 8,
        width: 'fill',
        children: formulas.map(
          (f) => new FormulaBlock({ formula: f, size: f.length > 34 ? UI.text.small : UI.text.h3 }),
        ),
      }),
    );
  }

  const facts = step.facts?.items ?? [];
  if (facts.length > 0) {
    add(
      'facts',
      `${labels.facts} · ${facts.length}`,
      'lightning',
      new UiNode({
        dir: 'col',
        gap: 8,
        width: 'fill',
        children: facts.map(factNode),
      }),
    );
  }

  const myths = (step.misconceptions ?? []).filter((m) => m.correction);
  if (myths.length > 0) {
    add(
      'myths',
      myths.length > 1 ? `Хибні уявлення · ${myths.length}` : 'Хибне уявлення',
      'warning',
      new UiNode({
        dir: 'col',
        gap: 8,
        width: 'fill',
        children: myths.map(
          (m) =>
            new Card({
              width: 'fill',
              accent: 'amber',
              kicker: 'Хибне уявлення',
              icon: 'warning',
              title: m.myth ? `«${m.myth.replace(/^[«"]|[»"]$/g, '')}»` : undefined,
              body: m.correction,
            }),
        ),
      }),
    );
  }

  if (sections.length === 0) return null;
  return new UiNode({ dir: 'col', gap: 10, width: 'fill', children: [bar, bodies] });
}

/** Small caption used above groups inside the panel. */
export function caption(text: string): Label {
  return new Label(text.toUpperCase(), {
    font: 'bodyBold',
    size: UI.text.caption,
    color: TEXT_COLOR.mute,
    letterSpacing: 0.08,
    nowrap: true,
  });
}
