#!/usr/bin/env python3
"""On-screen copy hygiene of the chapter exports (doccheck group `copy`, C8). Rules and why they are errors or
warnings:

  xref       error — a cross-reference code span (`chapter/step`, `volume/chapter/step`) inside on-screen copy
             (panel pages, terms, formulas, facts and their sources, hotspot texts, glossary, quiz, goals, the
             simple layer). The HUD draws a code span as a formula, so the learner sees a yellow `atom/nucleus`;
             links belong in «Перехресні посилання» (rendered as «Див. також» chips) and the text names the
             chapter in words («розділ „Атом“»). Misconceptions included (C9's rewrite removed the last ones).
  note       error — a builder note in a title or a panel page: «(хаб)», «(пілот)», «(чернетка)», TODO / TBD /
             FIXME, «??». Titles go to the screen and the chapter manifest verbatim.
  captions   error — an «Інтерактив» item «Підписи» that is not the last item of the field. Chapters read
             `steps[].labels` by position; captions added at the end never shift the earlier indexes.
  backticks  warning — a code span with Ukrainian words and no formula signs in «Бачимо» / «Інтерактив»
             (`Буре · Кам’яне · Антрацит`): a caption written as code is not exported to `steps[].labels`, so the
             chapter retypes it. Quote it «…» (in «Підписи» when the item is not the last). A warning, because
             many such spans name scene parts for the builder and are rightly not copy.

Usage: copy_check.py [--volume <id> | --all] [--verbose]
"""
import json
import os
import re
import sys

sys.dont_write_bytecode = True  # keep the worktree clean (no __pycache__)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import chapters as C  # noqa: E402
import export_runtime as R  # noqa: E402

XREF_RE = re.compile(r'`((?:[a-z_][a-z0-9_-]*/)?[a-z][a-z0-9-]*/[a-z][a-z0-9-]*)`')
NOTE_RE = re.compile(r'\((?:хаб|пілот|чернетка|draft|wip|todo|tbd)\)|\b(?:TODO|TBD|FIXME|XXX)\b|\?\?', re.I)
SPAN_RE = re.compile(r'`([^`\n]+)`')
CYR_WORD_RE = re.compile(r'[А-Яа-яІіЇїЄєҐґ’]{3,}')
FORMULA_RE = re.compile(r'[=≈<>≤≥^_√×±∝→←↔∑∫Δ]|\d\s*[·/]|[·/]\s*\d|\w[·/]\w|\b(?:sin|cos|exp|log|ln)\b')
CAPTIONS_RE = re.compile(r'^\*\*Підписи:?\*\*')


def strings(node, path):
    """(path, text) of every string of an on-screen runtime node; ids, labels and links are not copy."""
    if isinstance(node, dict):
        for k, v in node.items():
            if k not in ('id', 'volume', 'group', 'labels', 'crossReferences', 'name', 'intl', 'correct'):
                yield from strings(v, path + [k])
    elif isinstance(node, list):
        for v in node:
            yield from strings(v, path)
    elif isinstance(node, str):
        yield '.'.join(path), node


def check_chapter(cid, doc, err, warn):
    rt = R.runtime(doc)
    for where, node in [('', {k: v for k, v in rt.items() if k != 'steps'})] + \
            [('`%s` ' % s['id'], s) for s in rt['steps']]:
        for path, text in strings(node, []):
            for m in XREF_RE.finditer(text):
                msg = '%s%s: cross-reference `%s` inside on-screen copy — name the chapter in words, keep the ' \
                      'link in «Перехресні посилання»' % (where, path, m.group(1))
                err(msg)
    titles = [('title', doc['title'])] + [('`%s` title' % s['id'], s['title']) for s in doc['steps']]
    titles += [('`%s` simple title' % s['id'], s['simple']['title']) for s in doc['steps']
               if s.get('simple') and s['simple'].get('title')]
    titles += [('`%s` panel' % s['id'], p) for s in doc['steps'] for p in s['panel']]
    for where, text in titles:
        m = NOTE_RE.search(text or '')
        if m:
            err('%s: builder note «%s» in on-screen text' % (where, m.group(0)))
    for s in doc['steps']:
        items = (s.get('interaction') or {}).get('items') or []
        for k, it in enumerate(items):
            if CAPTIONS_RE.match(it['text']) and k != len(items) - 1:
                err('`%s` «Інтерактив»: the item «Підписи» must be the last one (label indexes)' % s['id'])
        exported = set(R.ui_labels(s))  # a span that is also quoted (e.g. in «Підписи») reaches the screen
        for field, text in [('Бачимо', s.get('see') or '')] + [('Інтерактив', it['text']) for it in items]:
            for m in SPAN_RE.finditer(text):
                span = m.group(1)
                if CYR_WORD_RE.search(span) and not FORMULA_RE.search(span) and span not in exported:
                    warn('`%s` «%s»: caption in backticks is not exported — `%s`' % (s['id'], field, span[:60]))


def main():
    verbose = '--verbose' in sys.argv
    errors, warnings = [], []
    for cid in C.CHAPTER_IDS:
        with open(os.path.join(C.EXPORT_DIR, cid + '.json'), encoding='utf-8') as f:
            doc = json.load(f)
        check_chapter(cid, doc, lambda m, c=cid: errors.append('error  %s: %s' % (c, m)),
                      lambda m, c=cid: warnings.append('warn   %s: %s' % (c, m)))
    for line in errors + (warnings if verbose else []):
        print(line)
    print('copy_check: %d chapters, %d error(s), %d warning(s)%s'
          % (len(C.CHAPTER_IDS), len(errors), len(warnings),
             '' if verbose or not warnings else ' (--verbose lists them)'))
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(C.run_volumes(main))
