#!/usr/bin/env python3
"""Cross-reference integrity of the chapter design documents (DECISIONS §12, §39).

Checks
  1. step ids: unique within a chapter, kebab-case Latin, numbered 1..N without gaps;
  2. every `chapter/step` reference (a code span of exactly that shape, anywhere in docs/volumes/<volume>/chapters/*.md,
     including _shared-house.md) points to an existing step;
  3. every chapter document ends with the section «## Перехресні посилання»;
  4. that section lists every cross-chapter `chapter/step` reference used in the body of the document;
  5. that section is a table `| Де в розділі | Куди веде | Тема цілі |` and every «Тема цілі» cell equals the
     current titles of the targets in «Куди веде» (joined with «; ») — the column is generated, never typed.

Usage
  xref_check.py            check, exit 1 on any problem
  xref_check.py --write    create missing «Перехресні посилання» sections, append rows for references that the
                           body uses but the section does not list, convert list-form sections to the table and
                           regenerate every «Тема цілі» cell from the targets' current step titles (idempotent),
                           then check
  xref_check.py --list     print all references as  source-chapter<TAB>location<TAB>target
"""
import os
import re
import sys

sys.dont_write_bytecode = True  # keep the worktree clean (no __pycache__)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import chapters as C  # noqa: E402

XREF_TITLE = 'Перехресні посилання'
SPAN_RE = re.compile(r'`([^`\n]+)`')
REF_RE = re.compile(r'^([a-z][a-z0-9-]*)/([A-Za-z0-9._-]+)$')
# `volume/chapter/step`: a reference into another volume (or, spelled out, into this one)
REF3_RE = re.compile(r'^([a-z_][a-z0-9_-]*)/([a-z][a-z0-9-]*)/([A-Za-z0-9._-]+)$')
TABLE_HEAD = ['| Де в розділі | Куди веде | Тема цілі |', '|---|---|---|']
NO_REFS = '| — | — | у тексті розділу немає посилань на кроки інших розділів |'


def theme(targets, titles):
    """Generated «Тема цілі» cell: current titles of the `chapter/step` targets, in order."""
    return '; '.join(titles.get(t, '?') for t in targets)


def table_rows(lines, a, b):
    """[(line_index, cells, [(chapter, step)])] — body rows of the xref table between lines a..b."""
    out = []
    for i in range(a, b):
        s = lines[i].strip()
        if not s.startswith('|') or s in TABLE_HEAD or re.match(r'^\|[-|\s:]+\|$', s):
            continue
        cells = C.split_table_row(s)
        targets = list(refs_in_line(cells[1])) if len(cells) > 1 else []
        out.append((i, cells, targets))
    return out


def list_to_table(lines, a, b, cid, titles):
    """Rows for a list-form section («- Крок N → `ch/st` (note), …»); the hand notes give way to the titles."""
    step_id = {s['n']: s['id'] for s in C.steps('\n'.join(lines))}
    rows = []
    for line in lines[a + 1:b]:
        m = re.match(r'^-\s+(.+?)\s+→\s+(.*)$', line.strip())
        if not m:
            continue
        loc = m.group(1)
        k = re.match(r'^Крок (\d+)$', loc)
        if k and int(k.group(1)) in step_id:
            loc = 'крок %s `%s`' % (k.group(1), step_id[int(k.group(1))])
        tg = [t for t in dict.fromkeys(refs_in_line(m.group(2))) if t[0] != cid]
        if tg:
            rows.append('| %s | %s | %s |' % (loc, ', '.join('`%s/%s`' % t for t in tg), theme(tg, titles)))
    return rows


def refresh_section(text, cid, titles):
    """Text with the xref section as a table whose «Тема цілі» cells are regenerated."""
    sec = xref_section(text)
    if sec is None:
        return text
    lines = text.split('\n')
    a, b = sec
    if not table_rows(lines, a, b) and not any(l.strip() == NO_REFS for l in lines[a:b]):
        intro = [l for l in lines[a + 1:b] if l.strip() and not l.lstrip().startswith('-')]
        rows = list_to_table(lines, a, b, cid, titles) or [NO_REFS]
        body = [''] + intro + ([''] if intro else []) + TABLE_HEAD + rows + ['']
        lines = lines[:a + 1] + body + lines[b:]
        a, b = xref_section('\n'.join(lines))
    for i, cells, targets in table_rows(lines, a, b):
        if targets and len(cells) >= 3 and cells[2] != theme(targets, titles):
            lines[i] = '| ' + ' | '.join(cells[:2] + [theme(targets, titles)] + cells[3:]) + ' |'
    return '\n'.join(lines)


def refs_in_line(line):
    for sp in SPAN_RE.findall(line):
        m = REF_RE.match(sp)
        if m and m.group(1) in C.GROUP:
            yield m.group(1), m.group(2)
            continue
        m = REF3_RE.match(sp)
        if not m:
            continue
        vol, ch, st = m.groups()
        if vol == C.VOLUME and ch in C.GROUP:
            yield ch, st  # own volume written in full
        elif vol != C.VOLUME and ch in C.foreign_steps(vol):
            yield '%s/%s' % (vol, ch), st


def locate(text):
    """Map every line number to a location label («крок N `id`» or a section title)."""
    lines = text.split('\n')
    label = ['вступ'] * len(lines)
    for title, a, b in C.split_sections(text):
        for i in range(a, b):
            label[i] = '«%s»' % re.sub(r'\s*\(.*\)$', '', title)
    for s in C.steps(text):
        for i in range(s['start'], s['end']):
            label[i] = 'крок %d `%s`' % (s['n'], s['id'])
    return label


def xref_section(text):
    """(start, end) line range of the «Перехресні посилання» section (any heading level), or None."""
    lines = text.split('\n')
    start = None
    for i, line in enumerate(lines):
        if re.match(r'^#{2,3} ' + XREF_TITLE, line):
            start = i
        elif start is not None and line.startswith('## '):
            return start, i
    return (start, len(lines)) if start is not None else None


def body_refs(cid, text):
    """[(location, target_chapter, target_step, line_no)] outside the xref section, in document order."""
    lines = text.split('\n')
    label = locate(text)
    sec = xref_section(text)
    out = []
    for i, line in enumerate(lines):
        if sec and sec[0] <= i < sec[1]:
            continue
        for ch, st in refs_in_line(line):
            out.append((label[i], ch, st, i + 1))
    return out


def section_refs(text):
    sec = xref_section(text)
    if not sec:
        return set()
    out = set()
    for line in text.split('\n')[sec[0]:sec[1]]:
        out.update(refs_in_line(line))
    return out


def group_rows(refs, titles, own):
    """[(location, [targets], [titles])] for cross-chapter refs, grouped by location, order of first appearance."""
    rows, index = [], {}
    for loc, ch, st, _ in refs:
        if ch == own:
            continue
        if loc not in index:
            index[loc] = len(rows)
            rows.append((loc, [], []))
        tgt = '`%s/%s`' % (ch, st)
        if tgt not in rows[index[loc]][1]:
            rows[index[loc]][1].append(tgt)
            rows[index[loc]][2].append(titles.get((ch, st), '?'))
    return rows


def write_sections(titles):
    changed = []
    for cid in C.CHAPTER_IDS:
        original = C.read(cid)
        text = refresh_section(original, cid, titles)
        refs = [r for r in body_refs(cid, text) if r[1] != cid]
        sec = xref_section(text)
        if sec is None:
            rows = group_rows(refs, titles, cid)
            block = ['## ' + XREF_TITLE, '',
                     'Усі посилання цього розділу на кроки інших розділів (`chapter/step`, DECISIONS §12, §39); будівники',
                     'перетворюють їх на переходи в застосунку. Цілісність перевіряє `tools/content/xref_check.py`.', '',
                     '| Де в розділі | Куди веде | Тема цілі |', '|---|---|---|']
            for loc, tgts, tt in rows:
                block.append('| %s | %s | %s |' % (loc, ', '.join(tgts), '; '.join(tt)))
            if not rows:
                block.append('| — | — | у тексті розділу немає посилань на кроки інших розділів |')
            new = text.rstrip('\n') + '\n\n' + '\n'.join(block) + '\n'
        else:
            lines = text.split('\n')
            a, b = sec
            have = section_refs(text)
            missing = [r for r in refs if (r[1], r[2]) not in have]
            body = lines[a + 1:b]
            while body and not body[-1].strip():
                body.pop()
            is_table = any(l.lstrip().startswith('|') for l in body)
            add = []
            for loc, tgts, tt in group_rows(missing, titles, cid):
                if is_table:
                    add.append('| %s | %s | %s |' % (loc, ', '.join(tgts), '; '.join(tt)))
                else:
                    add.append('- %s → %s (%s).' % (loc[0].upper() + loc[1:], ', '.join(tgts), '; '.join(tt)))
            heading = '## ' + XREF_TITLE
            new_lines = lines[:a] + [heading] + body + add
            rest = lines[b:]
            if rest and any(l.strip() for l in rest):
                # the section must be the last one: move the following sections in front of it
                new_lines = lines[:a] + rest + ([''] if rest[-1].strip() else []) + [heading] + body + add
            new = '\n'.join(new_lines).rstrip('\n') + '\n'
        if new != original:
            with open(C.chapter_path(cid), 'w', encoding='utf-8') as f:
                f.write(new)
            changed.append(cid)
    return changed


def check():
    problems = []
    ids = {}
    titles = {}
    for cid in C.CHAPTER_IDS:
        text = C.read(cid)
        st = C.steps(text)
        ids[cid] = [s['id'] for s in st]
        for s in st:
            titles[(cid, s['id'])] = s['title']
            if not C.STEP_ID_RE.match(s['id']):
                problems.append('%s: step id `%s` is not kebab-case Latin' % (cid, s['id']))
        if len(set(ids[cid])) != len(ids[cid]):
            problems.append('%s: duplicate step ids' % cid)
        if [s['n'] for s in st] != list(range(1, len(st) + 1)):
            problems.append('%s: steps are not numbered 1..N' % cid)
    nrefs = 0
    stale = []
    known = dict(ids)  # + chapters of other volumes that this volume's documents refer to
    for cid in C.CHAPTER_IDS + C.EXTRA_DOCS:
        path = C.chapter_path(cid)
        if not os.path.exists(path):
            continue
        with open(path, encoding='utf-8') as f:
            text = f.read()
        for i, line in enumerate(text.split('\n'), 1):
            for ch, st in refs_in_line(line):
                nrefs += 1
                if '/' in ch and ch not in known:
                    vol, _, other = ch.partition('/')
                    known[ch] = list(C.foreign_steps(vol)[other])
                    for sid, title in C.foreign_steps(vol)[other].items():
                        titles[(ch, sid)] = title
                if st not in known[ch]:
                    problems.append('%s:%d: dangling reference `%s/%s`' % (cid, i, ch, st))
        if cid in C.EXTRA_DOCS:
            continue
        secs = C.split_sections(text)
        if not secs or secs[-1][0] != XREF_TITLE:
            problems.append('%s: the last section is not «## %s»' % (cid, XREF_TITLE))
            continue
        have = section_refs(text)
        for loc, ch, st, ln in body_refs(cid, text):
            if ch != cid and (ch, st) not in have:
                problems.append('%s:%d: `%s/%s` (%s) is not listed in «%s»' % (cid, ln, ch, st, loc, XREF_TITLE))
        stale.append((cid, text))
    for cid, text in stale:  # titles of all chapters are known only now
        lines = text.split('\n')
        a, b = xref_section(text)
        rows = table_rows(lines, a, b)
        if not rows:
            problems.append('%s: «%s» is not a table %s' % (cid, XREF_TITLE, TABLE_HEAD[0]))
        for i, cells, targets in rows:
            if targets and (len(cells) < 3 or cells[2] != theme(targets, titles)):
                problems.append('%s:%d: stale «Тема цілі» (run xref_check.py --write): «%s» ≠ «%s»'
                                % (cid, i + 1, (cells[2] if len(cells) > 2 else '')[:60], theme(targets, titles)[:60]))
    return problems, nrefs, ids, titles


def main():
    if '--list' in sys.argv:
        for cid in C.CHAPTER_IDS:
            for loc, ch, st, _ in body_refs(cid, C.read(cid)):
                print('%s\t%s\t%s/%s' % (cid, loc, ch, st))
        return 0
    if '--write' in sys.argv:
        _, _, _, titles = check()
        changed = write_sections(titles)
        print('xref_check --write: updated %d document(s)%s' % (len(changed), ': ' + ', '.join(changed) if changed else ''))
    problems, nrefs, ids, _ = check()
    for p in problems:
        print('XREF', p)
    print('xref_check: %d chapters, %d steps, %d chapter/step references, %d problem(s)'
          % (len(ids), sum(len(v) for v in ids.values()), nrefs, len(problems)))
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(C.run_volumes(main))
