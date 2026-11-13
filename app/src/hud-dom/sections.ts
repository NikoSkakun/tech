/**
 * DOM version of the sections under the step text (`hud/step-sections.ts`): «Терміни», «Формули»,
 * «Цифри і факти», «Хибне уявлення» — section buttons (`aria-expanded`), one body open at a time.
 */
import { termIntl, termName, type Fact, type StepContent, type Term } from '@/content';
import type { IconName } from '@/ui3d';
import { h } from './dom';
import { icon } from './icons';
import { richEl } from './rich';

let uid = 0;

function termCard(term: Term, openGlossary: (name: string) => void): HTMLElement {
  const intl = termIntl(term);
  const tail = [term.symbol, term.unit].filter((v): v is string => !!v && v !== '—').join(', ');
  return h(
    'div.kd.card.term-card',
    null,
    h('div.kicker', null, 'Термін'),
    h('div.card-title', null, termName(term)),
    richEl('p', 'card-body', `${tail ? `\`${tail}\` — ` : ''}${term.definition ?? ''}`),
    intl ? h('div.intl', { lang: 'en' }, intl) : null,
    btn('Відкрити глосарій', 'glossary', 'ghost sm', () => openGlossary(termName(term))),
  );
}

function factNode(f: Fact): HTMLElement {
  if (!f.table) return h('div.chip.fact.multi', null, icon('lightning'), richEl('span', 'chip-text', f.text));
  const { head, rows } = f.table;
  const note = f.table.note ?? f.source;
  const table = h(
    'table.kd-table',
    null,
    h('thead', null, h('tr', null, ...head.map((c) => richEl('th', '', c)))),
    h('tbody', null, ...rows.map((r) => h('tr', null, ...r.map((c) => richEl('td', '', c))))),
  );
  return h('div.fact-table', null, h('div.table-wrap', null, table), note ? richEl('p', 'note', note) : null);
}

/** A pill button (`variant`: '' secondary, 'primary', 'ghost', + 'sm'). */
export function btn(label: string, ic: IconName | null, variant: string, onClick: () => void): HTMLButtonElement {
  const b = h(`button.btn${variant ? `.${variant.split(' ').join('.')}` : ''}`, { type: 'button' });
  if (ic) b.append(icon(ic));
  b.append(h('span', null, label));
  b.addEventListener('click', onClick);
  return b;
}

/** Build the section bar and bodies for a step, or null when it has none. */
export function buildDomSections(step: StepContent, openGlossary: (name: string) => void): HTMLElement | null {
  const bar = h('div.sec-bar', { role: 'group', 'aria-label': 'Розділи кроку' });
  const bodies = h('div.sec-bodies');
  const buttons: HTMLButtonElement[] = [];
  const add = (id: string, label: string, ic: IconName, body: HTMLElement): void => {
    const bodyId = `sec-${++uid}`;
    body.id = bodyId;
    body.hidden = true;
    body.classList.add('sec-body');
    const b = btn(label, ic, 'sm', () => {
      const open = b.getAttribute('aria-expanded') === 'true';
      for (const other of buttons) other.setAttribute('aria-expanded', 'false');
      for (const el of bodies.children) (el as HTMLElement).hidden = true;
      b.setAttribute('aria-expanded', String(!open));
      body.hidden = open;
    });
    b.dataset.ui = `section-${id}`;
    b.setAttribute('aria-expanded', 'false');
    b.setAttribute('aria-controls', bodyId);
    buttons.push(b);
    bar.append(b);
    bodies.append(body);
  };

  const terms = step.terms ?? [];
  if (terms.length > 0) {
    const slot = h('div.term-slot');
    let shown: Term | null = null;
    const chips = terms.map((t) => {
      const c = h('button.chip.term', { type: 'button', title: 'Показати визначення' }, icon('book'), termName(t));
      c.addEventListener('click', () => {
        shown = shown === t ? null : t;
        slot.replaceChildren(...(shown ? [termCard(t, openGlossary)] : []));
      });
      return c;
    });
    add('terms', `Терміни · ${terms.length}`, 'book', h('div.sec-col', null, h('div.chips', null, ...chips), slot));
  }
  const formulas = step.formulas?.items ?? [];
  if (formulas.length > 0)
    add(
      'formulas',
      `Формули · ${formulas.length}`,
      'chart',
      h('div.sec-col', null, ...formulas.map((f) => richEl('div', `formula${f.length > 34 ? ' long' : ''}`, `\`${f}\``))),
    );
  const facts = step.facts?.items ?? [];
  if (facts.length > 0)
    add('facts', `Цифри і факти · ${facts.length}`, 'lightning', h('div.sec-col', null, ...facts.map(factNode)));
  const myths = (step.misconceptions ?? []).filter((m) => m.correction);
  if (myths.length > 0)
    add(
      'myths',
      myths.length > 1 ? `Хибні уявлення · ${myths.length}` : 'Хибне уявлення',
      'warning',
      h(
        'div.sec-col',
        null,
        ...myths.map((m) =>
          h(
            'div.kd.card.myth',
            null,
            h('div.kicker', null, icon('warning'), 'Хибне уявлення'),
            m.myth ? h('div.card-title', null, `«${m.myth.replace(/^[«"]|[»"]$/g, '')}»`) : null,
            richEl('p', 'card-body', m.correction ?? ''),
          ),
        ),
      ),
    );
  if (buttons.length === 0) return null;
  return h('div.sections', null, bar, bodies);
}
