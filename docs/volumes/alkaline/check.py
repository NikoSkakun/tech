#!/usr/bin/env python3
"""Check docs/volumes/alkaline/PATH.md against PATH-ledger.md (B-battery; ported from the water volume).

Fails (exit 1) on: a term used before the step that introduces it; a step with more than 2 new terms; a chapter
outside its budgets; a ledger/PATH mismatch; a «Докладніше»-only or excluded word in the main text; an idea that is
not one sentence; a bridge that does not lead to the next chapter's question; a PATH step missing from REUSE.md.
Usage: check.py [--root DIR] [--no-reuse] [--selftest]   (REUSE.md is optional here)
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent  # the volume documents live next to this script
BUDGET = dict(step_terms=2, chapter_steps=(4, 8), chapter_terms=6, total_steps=(20, 30), idea_words=32)
FLAGS = re.IGNORECASE | re.UNICODE
HEAD = re.compile(r'^## (Пролог|Глава \d+|Практикум)\. (.+?) — `([\w-]+)`\s*$')
PARAS = {'**Питання з життя.**': 'hook', '**Що ми вже знаємо.**': 'know', '**Місток.**': 'bridge',
         '**Нитка глави.**': 'thread', '**Нитка прологу.**': 'thread'}


def cells(line):
    """Split a markdown table row on unescaped pipes; unescape `\\|` inside cells."""
    parts = re.split(r'(?<!\\)\|', line.strip().strip('|'))
    return [p.strip().replace('\\|', '|') for p in parts]


def parse_path(text):
    chapters, cur, para, in_now = [], None, None, False
    for line in text.splitlines():
        if line.startswith('## '):
            m = HEAD.match(line)
            cur = None
            if m:
                cur = dict(kind=m.group(1).split()[0], title=m.group(2), id=m.group(3), hook='', know='',
                           bridge='', thread='', now=[], steps=[])
                chapters.append(cur)
            para, in_now = None, False
            continue
        if cur is None:
            continue
        if not line.strip():
            para = None
            continue
        if line.startswith('| `'):
            c = cells(line)
            terms = [] if c[4] in ('—', '-', '') else [t.strip() for t in c[4].split(',')]
            cur['steps'].append(dict(id=c[0].strip('`'), idea=c[1], action=c[2], takeaway=c[3], terms=terms))
            continue
        if line.startswith('**Що ми тепер знаємо.**'):
            in_now, para = True, None
            continue
        key = next((k for k in PARAS if line.startswith(k)), None)
        if key:
            para, in_now = PARAS[key], False
            cur[para] = line[len(key):].strip()
        elif in_now and re.match(r'^\d+\. ', line):
            cur['now'].append(line.split('. ', 1)[1])
        elif para:
            cur[para] += ' ' + line.strip()
    return chapters


def parse_map(text):
    """Rows of «Карта шляху»: id → (steps, terms, minutes)."""
    out = {}
    for line in text.split('## Карта шляху', 1)[1].split('\n## ', 1)[0].splitlines():
        c = cells(line) if line.startswith('|') else []
        if len(c) == 7 and c[1].startswith('`'):
            out[c[1].strip('`')] = (int(c[4]), int(c[5]), int(c[6]))
    return out


def parse_ledger(text):
    terms, extra_only, banned = [], [], []
    section = 0
    for line in text.splitlines():
        if line.startswith('## '):
            section = int(line[3])
        if not line.startswith('|') or '`' not in line:
            continue
        c = cells(line)
        if section == 1 and len(c) == 6:
            terms.append(dict(name=c[1], rx=re.compile(c[2].strip('`'), FLAGS), step=c[3].strip('`'), kind=c[4]))
        elif section == 3:
            extra_only.append((c[0], re.compile(c[1].strip('`'), FLAGS)))
        elif section == 4:
            banned.append((c[0], re.compile(c[1].strip('`'), FLAGS)))
    return terms, extra_only, banned


def parse_reuse(text):
    """Rows of the section whose heading contains «Крок за кроком»: step id → verdict."""
    rows, on = {}, False
    for line in text.splitlines():
        if line.startswith('## '):
            on = 'Крок за кроком' in line
        elif on and line.startswith('| `'):
            c = cells(line)
            rows[c[0].strip('`')] = c[2]
    return rows


def norm(s):
    return re.sub(r'[^\w ]', '', s.lower()).strip()


def check(chapters, ledger, path_map, reuse):
    terms, extra_only, banned = ledger
    err, order = [], [s['id'] for ch in chapters for s in ch['steps']]
    pos = {sid: i for i, sid in enumerate(order)}
    by_step = {}
    for t in terms:
        by_step.setdefault(t['step'], []).append(t['name'])
        if t['step'] not in pos:
            err.append(f"ledger: «{t['name']}» is introduced in unknown step {t['step']}")
    units = []  # (label, text, position on the path)
    for ci, ch in enumerate(chapters):
        steps = ch['steps']
        first, last = pos[steps[0]['id']] - 0.5, pos[steps[-1]['id']] + 0.5
        units += [(f"{ch['id']}: title", ch['title'], first), (f"{ch['id']}: hook", ch['hook'], first),
                  (f"{ch['id']}: know", ch['know'], first), (f"{ch['id']}: thread", ch['thread'], last),
                  (f"{ch['id']}: bridge", ch['bridge'], last)]
        units += [(f"{ch['id']}: now {i + 1}", t, last) for i, t in enumerate(ch['now'])]
        n_terms = 0
        for s in steps:
            for part in ('idea', 'action', 'takeaway'):
                units.append((f"{s['id']}: {part}", s[part], pos[s['id']]))
            if sorted(s['terms']) != sorted(by_step.get(s['id'], [])):
                err.append(f"{s['id']}: new terms {s['terms']} ≠ ledger {by_step.get(s['id'], [])}")
            if len(s['terms']) > BUDGET['step_terms']:
                err.append(f"{s['id']}: {len(s['terms'])} new terms (budget {BUDGET['step_terms']})")
            n_terms += len(s['terms'])
            if ch['kind'] != 'Практикум':
                ends = len(re.findall(r'[.!?…](?=\s|$)', s['idea']))
                words = len(s['idea'].split())
                if ends != 1 or words > BUDGET['idea_words']:
                    err.append(f"{s['id']}: idea is {ends} sentence(s), {words} words")
            if reuse is not None and s['id'] not in reuse:
                err.append(f"{s['id']}: no row in REUSE.md")
        lo, hi = BUDGET['chapter_steps']
        if ch['kind'] == 'Глава':
            if not lo <= len(steps) <= hi:
                err.append(f"{ch['id']}: {len(steps)} steps (budget {lo}–{hi})")
            if n_terms > BUDGET['chapter_terms']:
                err.append(f"{ch['id']}: {n_terms} new terms (budget {BUDGET['chapter_terms']})")
            if len(ch['now']) != 3 or not ch['hook'] or not ch['know'] or not ch['thread']:
                err.append(f"{ch['id']}: rhythm incomplete (hook / know / thread / three lines)")
        if ch['kind'] == 'Пролог' and n_terms:
            err.append(f"{ch['id']}: the prologue introduces {n_terms} term(s)")
        if ci + 1 < len(chapters) and norm(chapters[ci + 1]['title']) not in norm(ch['bridge']):
            err.append(f"{ch['id']}: the bridge does not contain the next question «{chapters[ci + 1]['title']}»")
        want = path_map.get(ch['id'])
        path_terms = 0 if ch['kind'] == 'Практикум' else n_terms  # a practicum label is not a path term
        if want and want[:2] != (len(steps), path_terms):
            err.append(f"{ch['id']}: map says {want[:2]}, path has {(len(steps), n_terms)}")
    for label, text, p in units:
        for t in terms:
            if t['step'] in pos and pos[t['step']] > p and t['rx'].search(text):
                err.append(f"{label}: «{t['name']}» used before {t['step']} — “{t['rx'].search(text).group(0)}”")
        for name, rx in extra_only + banned:
            if rx.search(text):
                err.append(f"{label}: «{name}» is not allowed in the main text — “{rx.search(text).group(0)}”")
    if reuse is not None:
        err += [f"REUSE.md: unknown step {sid}" for sid in reuse if sid not in pos]
        err += [f"REUSE.md: {sid}: verdict «{v}»" for sid, v in reuse.items()
                if v not in ('як є', 'переробити', 'нове')]
    lo, hi = BUDGET['total_steps']
    if not lo <= len(order) <= hi:
        err.append(f"total steps {len(order)} (budget {lo}–{hi})")
    return err


def main():
    args = sys.argv[1:]
    root = pathlib.Path(args[args.index('--root') + 1]) if '--root' in args else ROOT
    text = (root / 'PATH.md').read_text(encoding='utf-8')
    chapters, path_map = parse_path(text), parse_map(text)
    ledger = parse_ledger((root / 'PATH-ledger.md').read_text(encoding='utf-8'))
    reuse_file = root / 'REUSE.md'  # optional in this volume: the «Джерело» column of PATH.md is the reuse map
    reuse = parse_reuse(reuse_file.read_text(encoding='utf-8')) if reuse_file.exists() and '--no-reuse' not in args else None
    if '--selftest' in args:  # the checker must catch a planted early term and a planted third term
        chapters[1]['steps'][0]['idea'] = 'Реакція ' + chapters[1]['steps'][0]['idea']
        chapters[1]['steps'][5]['terms'].append('зайвий термін')  # `layers/lye` already has two
        err = check(chapters, ledger, path_map, reuse)
        ok = any('used before' in e for e in err) and any('3 new terms' in e for e in err)
        print('selftest:', 'OK — both planted faults caught' if ok else 'FAILED')
        return 0 if ok else 1
    err = check(chapters, ledger, path_map, reuse)
    steps = [s for ch in chapters for s in ch['steps']]
    path_steps = [s for ch in chapters if ch['kind'] == 'Глава' for s in ch['steps']]
    n_terms = sum(1 for t in ledger[0] if t['kind'] == 'шлях')
    words = [len(s['idea'].split()) for s in path_steps]
    print(f"chapters {len(chapters)} · steps {len(steps)} (chapter steps {len(path_steps)}) · path terms {n_terms} · "
          f"terms per chapter step {n_terms / len(path_steps):.2f} · minutes {sum(v[2] for v in path_map.values())}")
    print('per chapter (steps/terms): ' + ' · '.join(
        f"{ch['id']} {len(ch['steps'])}/{sum(len(s['terms']) for s in ch['steps'])}" for ch in chapters))
    print(f"idea length, words: mean {sum(words) / len(words):.1f}, max {max(words)}")
    if reuse is not None:
        print('reuse: ' + ' · '.join(f"{v} {list(reuse.values()).count(v)}" for v in ('як є', 'переробити', 'нове')))
    print('\n'.join(['ERRORS:'] + err) if err else 'OK: 0 errors')
    return 1 if err else 0


if __name__ == '__main__':
    sys.exit(main())
