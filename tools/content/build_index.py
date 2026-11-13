#!/usr/bin/env python3
"""Generate docs/volumes/<volume>/INDEX.md — the step index of all chapter design documents (source for app navigation).

For each chapter in journey order: id, title, group, parent, scale label, step ids and titles, number of steps with
an interactive block and number of simulation models. Step ids must be unique within a chapter, kebab-case Latin
and stable (checked by xref_check.py / doccheck.py).

Usage
  build_index.py            write docs/volumes/<volume>/INDEX.md
  build_index.py --check    exit 1 if the file on disk differs from what would be generated
"""
import json
import os
import re
import sys

sys.dont_write_bytecode = True  # keep the worktree clean (no __pycache__)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import chapters as C  # noqa: E402

MODEL_BOLD_RE = re.compile(r'^\*\*((?:[A-ZА-ЯҐЄІЇ]{1,4}-?\d+[a-zа-я]?|§[A-ZА-ЯҐЄІЇ\d]+)\.)\s')
INTERACTIVE_RE = re.compile(r'^\s*- \*\*Інтерактив[^*]*:\*\*\s*(.*)$')


def models(text):
    """Model headings of the «Модель симуляції» section: level-3 headings, or bold `**M1. …**` paragraph leads."""
    lines = C.section_lines(text, 'Модель симуляції') or []
    h3 = [l[4:].strip() for l in lines if l.startswith('### ')]
    if h3:
        return h3
    out = []
    for l in lines:
        if MODEL_BOLD_RE.match(l):
            m = re.match(r'^\*\*(.+?)\*\*', l)
            out.append(m.group(1).rstrip('.').strip())
    return out


def interactive_steps(text):
    lines = text.split('\n')
    n = 0
    for s in C.steps(text):
        for i in range(s['start'], s['end']):
            m = INTERACTIVE_RE.match(lines[i])
            if m:
                rest = m.group(1).strip()
                nxt = lines[i + 1].strip() if i + 1 < s['end'] else ''
                if rest not in ('—', '-', 'немає', 'немає.') or nxt.startswith('- '):
                    n += 1
                break
    return n


def collect():
    data = []
    for order, cid in enumerate(C.CHAPTER_IDS, 1):
        text = C.read(cid)
        hid, title, _ = C.header(text)
        if hid != cid:
            raise SystemExit('H1 id %r does not match file name %r' % (hid, cid))
        st = C.steps(text)
        data.append(dict(order=order, id=cid, title=title, group=C.GROUP[cid], parent=C.PARENT.get(cid),
                         scale=C.axis_label(text), steps=[dict(n=s['n'], id=s['id'], title=s['title']) for s in st],
                         interactive=interactive_steps(text), models=models(text)))
    return data


def short_scale(s):
    s = re.sub(r'\s*\([^()]*(?:\([^()]*\)[^()]*)*\)', '', s)
    return re.split(r'[;→]', s)[0].strip() if len(s) > 40 else s.strip()


def render(data):
    out = ['# INDEX — розділи та кроки тому «%s» (згенеровано)' % C.META['title'], '',
           '> Файл генерує `tools/content/build_index.py` з документів `docs/volumes/%s/chapters/<id>.md` — **не редагувати вручну**.' % C.VOLUME,
           '> Порядок — порядок подорожі (CURRICULUM). Ідентифікатори кроків унікальні в межах розділу, kebab-case, латиницею',
           '> і стабільні: на них посилаються інші розділи (`chapter/step`, з іншого тому — `volume/chapter/step`; DECISIONS §12, §58) та навігація застосунку.', '',
           '## Зведення', '',
           '| № | Розділ | Назва | Група | Батьківський | %s | Кроків |' % C.AXIS_LABEL + ' З інтерактивом | Моделей |',
           '|---|---|---|---|---|---|---|---|---|']
    tot_s = tot_i = tot_m = 0
    for d in data:
        out.append('| %d | `%s` | %s | %s | %s | %s | %d | %d | %d |' % (
            d['order'], d['id'], d['title'], d['group'], '`%s`' % d['parent'] if d['parent'] else '—',
            short_scale(d['scale']), len(d['steps']), d['interactive'], len(d['models'])))
        tot_s += len(d['steps'])
        tot_i += d['interactive']
        tot_m += len(d['models'])
    out.append('| | **Разом** | %d розділів | | | | **%d** | **%d** | **%d** |' % (len(data), tot_s, tot_i, tot_m))
    out.append('')
    group = None
    for d in data:
        if d['group'] != group:
            group = d['group']
            out += ['## %s (`%s`)' % (C.GROUP_TITLE[group], group), '']
        out += ['### %d. `%s` — %s' % (d['order'], d['id'], d['title']), '',
                '- Група: `%s`%s · масштаб: %s' % (d['group'], ' · батьківський розділ: `%s`' % d['parent'] if d['parent'] else '',
                                                   d['scale']),
                '- Кроків: %d · з інтерактивом: %d · моделей симуляції: %d' % (len(d['steps']), d['interactive'], len(d['models'])),
                '']
        for s in d['steps']:
            out.append('%d. `%s` — %s' % (s['n'], s['id'], s['title']))
        if d['models']:
            out += ['', 'Моделі: ' + '; '.join(d['models']) + '.']
        out.append('')
    out += ['## Машинозчитуваний індекс', '', 'Один розділ на рядок (JSON-масив).', '', '```json', '[']
    rows = [json.dumps(dict(order=d['order'], id=d['id'], title=d['title'], group=d['group'], parent=d['parent'],
                            scaleLabel=short_scale(d['scale']),
                            steps=[dict(id=s['id'], title=s['title']) for s in d['steps']]), ensure_ascii=False)
            for d in data]
    out += [' ' + r + (',' if i < len(rows) - 1 else '') for i, r in enumerate(rows)]
    out += [']', '```', '']
    return '\n'.join(out)


def main():
    out = C.INDEX_PATH
    text = render(collect())
    if '--check' in sys.argv:
        old = open(out, encoding='utf-8').read() if os.path.exists(out) else ''
        if old != text:
            print('build_index: %s is stale — run tools/content/build_index.py --volume %s' % (C.rel(out), C.VOLUME))
            return 1
        print('build_index: %s is up to date' % C.rel(out))
        return 0
    with open(out, 'w', encoding='utf-8') as f:
        f.write(text)
    print('build_index: wrote %s' % C.rel(out))
    return 0


if __name__ == '__main__':
    sys.exit(C.run_volumes(main))
