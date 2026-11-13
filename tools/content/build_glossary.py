#!/usr/bin/env python3
"""Generate docs/volumes/<volume>/GLOSSARY.md — the unified course glossary — from the «Глосарій розділу» tables of all chapters.

One entry per international term. Entries of several chapters are merged when their normalised international term is
the same (parenthesised expansions are ignored: «EMF» = «EMF (electromotive force)»). The Ukrainian equivalent must
agree between chapters up to parenthesised additions — otherwise the script reports a conflict and exits 1: fix the
losing chapter, do not paper over it here. Symbols and units are merged token-wise; the definition and the place of
introduction come from the first chapter in journey order.

Usage
  build_glossary.py            write docs/volumes/<volume>/GLOSSARY.md (exit 1 on conflicts)
  build_glossary.py --check    exit 1 if the file on disk differs from what would be generated, or on conflicts
"""
import os
import re
import sys

sys.dont_write_bytecode = True  # keep the worktree clean (no __pycache__)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import chapters as C  # noqa: E402

HEADER = ['International', 'Українською', 'Позначення', 'Одиниця', 'Визначення']
# Parenthesised qualifiers that distinguish two different terms (kept in the key).
QUALIFIERS = ('(у ДБЖ)', '(PV module)')


def norm_key(term):
    t = term
    keep = ''
    for q in QUALIFIERS:
        if q in t:
            keep = ' ' + q
            t = t.replace(q, '')
    t = re.sub(r'\([^)]*\)', '', t).lower().replace('’', "'")
    t = re.sub(r"[^a-z0-9а-яіїєґ+/&' -]", '', t)
    return re.sub(r'\s+', ' ', t).strip() + keep.lower()


def base_ua(ua):
    """Ukrainian equivalent without parenthesised additions, for conflict detection."""
    u = re.sub(r'\([^)]*\)', '', ua).lower().replace(' ', ' ')
    return re.sub(r'\s+', ' ', u).strip(' .;,')


def tokens(cell):
    if cell.strip() in ('', '—', '-', '–'):
        return []
    return [t.strip() for t in re.split(r',\s+|\s+/\s+|;\s+', cell) if t.strip()]


def merge_tokens(cells):
    out = []
    for c in cells:
        for t in tokens(c):
            if t not in out:
                out.append(t)
    return ', '.join(out) if out else '—'


def chapter_entries(cid):
    lines = C.section_lines(C.read(cid), 'Глосарій розділу')
    rows = [l for l in lines if l.lstrip().startswith('|')]
    if not rows or C.split_table_row(rows[0]) != HEADER:
        raise SystemExit('%s: «Глосарій розділу» must start with the table header %s' % (cid, ' | '.join(HEADER)))
    out = []
    for r in rows[2:]:
        cells = C.split_table_row(r)
        if len(cells) != 5:
            raise SystemExit('%s: glossary row with %d cells: %s' % (cid, len(cells), r[:80]))
        out.append(cells)
    return out


def introduced_in(cid, term, ua):
    """`chapter/step` of the first step of chapter `cid` whose text mentions the term (international, else Ukrainian)."""
    text = C.read(cid)
    lines = text.split('\n')
    needles = [re.sub(r'\s*\([^)]*\)', '', term).strip().lower().replace('’', "'")]
    u = base_ua(ua)
    if u:
        needles.append(u.split(',')[0].strip())
    for needle in needles:
        if len(needle) < 2:
            continue
        rx = re.compile(r'(?<![A-Za-zА-Яа-яіїєґ])' + re.escape(needle), re.I)
        for s in C.steps(text):
            block = '\n'.join(lines[s['start']:s['end']]).lower().replace('’', "'").replace(' ', ' ')
            if rx.search(block):
                return '`%s/%s`' % (cid, s['id'])
    return '`%s`' % cid


def collect():
    groups, order = {}, []
    for cid in C.CHAPTER_IDS:
        for cells in chapter_entries(cid):
            k = norm_key(cells[0])
            if k not in groups:
                groups[k] = []
                order.append(k)
            groups[k].append((cid, cells))
    entries, conflicts = [], []
    for k in order:
        items = groups[k]
        bases = {}
        for cid, cells in items:
            bases.setdefault(base_ua(cells[1]), []).append(cid)
        if len(bases) > 1:
            conflicts.append('«%s»: %s' % (items[0][1][0], '; '.join('%s — %s' % (b, ', '.join(c)) for b, c in bases.items())))
        first_cid, first = items[0]
        term = max((cells[0] for _, cells in items), key=len)
        ua = max((cells[1] for _, cells in items if base_ua(cells[1]) == base_ua(first[1])), key=len)
        entries.append(dict(term=term, ua=ua, symbol=merge_tokens([c[2] for _, c in items]),
                            unit=merge_tokens([c[3] for _, c in items]), definition=first[4],
                            intro=introduced_in(first_cid, first[0], first[1]),
                            also=[cid for cid, _ in items[1:]]))
    entries.sort(key=lambda e: (re.sub(r'[^a-z0-9а-яіїєґ]+', ' ', e['term'].lower()).strip(), e['term']))
    return entries, conflicts, sum(len(v) for v in groups.values())


def render(entries, total_rows):
    out = ['# GLOSSARY — єдиний глосарій тому «%s» (згенеровано)' % C.META['title'], '',
           '> Файл генерує `tools/content/build_glossary.py` з таблиць «Глосарій розділу» всіх документів',
           '> `docs/volumes/%s/chapters/<id>.md` — **не редагувати вручну**: правте глосарій розділу й перегенеруйте.' % C.VOLUME,
           '> Правило термінів (CURRICULUM, DECISIONS §3): міжнародний термін — перший, український відповідник — поруч;',
           '> позначення й одиниці — міжнародні. Визначення й місце введення взято з першого за порядком подорожі розділу.',
           '',
           'Термінів: **%d** (з %d рядків глосаріїв %d розділів).' % (len(entries), total_rows, len(C.CHAPTER_IDS)), '',
           '| International | Українською | Позначення | Одиниця | Визначення | Вводиться (розділ/крок) | Також у розділах |',
           '|---|---|---|---|---|---|---|']
    for e in entries:
        out.append('| %s | %s | %s | %s | %s | %s | %s |' % (
            e['term'], e['ua'], e['symbol'], e['unit'], e['definition'], e['intro'],
            ', '.join('`%s`' % c for c in e['also']) if e['also'] else '—'))
    out.append('')
    return '\n'.join(out)


def main():
    entries, conflicts, total = collect()
    for c in conflicts:
        print('GLOSSARY CONFLICT', c)
    text = render(entries, total)
    out = C.GLOSSARY_PATH
    if '--check' in sys.argv:
        old = open(out, encoding='utf-8').read() if os.path.exists(out) else ''
        if old != text:
            print('build_glossary: %s is stale — run tools/content/build_glossary.py --volume %s' % (C.rel(out), C.VOLUME))
            return 1
        print('build_glossary: %s is up to date (%d terms, %d conflict(s))' % (C.rel(out), len(entries), len(conflicts)))
        return 1 if conflicts else 0
    with open(out, 'w', encoding='utf-8') as f:
        f.write(text)
    print('build_glossary: wrote %s — %d terms from %d rows, %d conflict(s)' % (C.rel(out), len(entries), total, len(conflicts)))
    return 1 if conflicts else 0


if __name__ == '__main__':
    sys.exit(C.run_volumes(main))
