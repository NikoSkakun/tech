#!/usr/bin/env python3
"""doccheck group `simple` — the simple reading level («Просто / Докладно», docs/briefs/L-simple-level.md).

Checks the exports (`_export/<id>.json`, kept current by the `export` group) and the documents:

  errors   a chapter that has a simple layer (a «Просто» block in any step or a «Простий квіз») has it in every
           step and has a «Простий квіз» after «Міні-квіз» with exactly 3 questions, each with one correct
           option; 1–2 simple pages per step, each ≤ 250 characters of plain text; no sentence of simple copy longer
           than 18 words; no formula signs in simple copy (=, ≈, ×10, superscripts, code spans, √, ^, symbol
           arithmetic such as «U·I» or «q/t»); every hotspot id of «Підказки» exists in the step; a detailed
           misconception with a «[Сцена: …]» part is well formed and its learner part has no stage words
  warnings sentences of simple copy longer than 12 words; «Слова» outside 1–4, «Цікаво» outside 1–2; step hotspots
           without a simple sentence (the card falls back to the detailed text); stage words (кадр, кнопка,
           хотспот, перемикач, вкладка, камера, анімація) in a detailed misconception not yet split with «[Сцена: …]»

Chapters without a simple layer pass (the layer is rolled out chapter by chapter).
Usage: simple_check.py [--volume <id> | --all] [--verbose]   (warnings are listed with --verbose, else counted)
"""
import json
import os
import re
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import chapters as C  # noqa: E402
import export_content as X  # noqa: E402
import export_runtime as R  # noqa: E402
import simple_layer as SL  # noqa: E402
import terms_check  # noqa: E402

PAGE_MAX = 250
PAGES = (1, 2)
WORDS = (1, 4)
FACTS = (1, 2)
SENTENCE_WARN = 12
SENTENCE_MAX = 18
QUIZ_LEN = 3
FORMULA_RES = [
    (re.compile(r'[=≈]'), 'equals sign'),
    (re.compile(r'×\s?10'), 'power of ten'),
    (re.compile(r'[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿ]'), 'superscript'),
    (re.compile(r'`'), 'code span'),
    (re.compile(r'[√^]'), 'formula sign'),
    (re.compile(r'(?<![\w’])[A-Za-zА-Яа-яΑ-Ωα-ω]\s?[·×/]\s?[A-Za-zА-Яа-яΑ-Ωα-ω](?![\w’])'), 'symbol arithmetic'),
]
STAGE_RE = re.compile(r'(?<![\w’])(?:кадр|кнопк|кнопок|хотспот|перемикач|вкладк|вкладок|камер|анімац)\w*', re.I)
SENTENCE_RE = re.compile(r'(?<=[.!?…])\s+')
WORD_RE = re.compile(r'[0-9A-Za-zА-Яа-яіїєґІЇЄҐ’\'-]*[0-9A-Za-zА-Яа-яіїєґІЇЄҐ][0-9A-Za-zА-Яа-яіїєґІЇЄҐ’\'-]*')


def plain(text):
    """On-screen plain text: mini-markup removed (what the page length counts)."""
    return R.plain(text)


def sentences(text):
    """[(n words, sentence)] of a plain text."""
    out = []
    for s in SENTENCE_RE.split(plain(text)):
        if s.strip():
            out.append((len(WORD_RE.findall(s)), s.strip()))
    return out


def has_simple(d):
    return any(s.get('simple') for s in d['steps']) or 'simpleQuiz' in d


def check_misconceptions(cid, d, err, warn):
    """Detailed misconceptions (every chapter): the `[Сцена: …]` split and stage words in the learner part."""
    for s in d['steps']:
        for i, m in enumerate(s.get('misconceptions') or []):
            where = '%s.misconception[%d]' % (s['id'], i)
            if SL.SCENE_OPEN in m['correction']:
                err('%s: %s' % (where, SL.split_scene(m['correction'])[2] or 'malformed «[Сцена: …]»'))
                continue
            learner = (m['myth'] or '') + ' ' + m['correction']
            hit = STAGE_RE.search(learner)
            if hit:
                (err if 'scene' in m else warn)('%s: stage word «%s» in the learner part%s'
                                                % (where, hit.group(0), '' if 'scene' in m else ' (not yet split)'))


def check_quiz(cid, d, err):
    text = C.read(cid)
    titles = [t for t, _, _ in C.split_sections(text)]
    mini = next((i for i, t in enumerate(titles) if t.startswith('Міні-квіз')), None)
    simple = next((i for i, t in enumerate(titles) if t.startswith(SL.SIMPLE_QUIZ_SECTION)), None)
    if simple is None:
        err('no «## %s» section' % SL.SIMPLE_QUIZ_SECTION)
        return
    if mini is not None and simple < mini:
        err('«## %s» must follow «## Міні-квіз»' % SL.SIMPLE_QUIZ_SECTION)
    marks = []
    X.parse_quiz(text, SL.SIMPLE_QUIZ_SECTION, marks)
    if len(d['simpleQuiz']) != QUIZ_LEN:
        err('simple quiz has %d questions (needs %d)' % (len(d['simpleQuiz']), QUIZ_LEN))
    for i, n in enumerate(marks, 1):
        if n != 1:
            err('simple quiz %d: %d options marked correct (needs exactly 1)' % (i, n))


def check_step(s, err, warn):
    x = s.get('simple')
    sid = s['id']
    if not x:
        err('step `%s` has no «%s» block' % (sid, SL.SIMPLE_LABEL))
        return
    if not PAGES[0] <= len(x['panel']) <= PAGES[1]:
        err('step `%s`: %d simple pages (needs %d–%d)' % (sid, len(x['panel']), PAGES[0], PAGES[1]))
    for i, p in enumerate(x['panel'], 1):
        if len(plain(p)) > PAGE_MAX:
            err('step `%s`: simple page %d has %d characters (> %d)' % (sid, i, len(plain(p)), PAGE_MAX))
    if not WORDS[0] <= len(x['words']) <= WORDS[1]:
        warn('step `%s`: %d «Слова» (aim %d–%d)' % (sid, len(x['words']), WORDS[0], WORDS[1]))
    if not FACTS[0] <= len(x['facts']) <= FACTS[1]:
        warn('step `%s`: %d «Цікаво» facts (aim %d–%d)' % (sid, len(x['facts']), FACTS[0], FACTS[1]))
    ids = [h.get('id') for h in s.get('hotspots') or []]  # explicit `{#id}` of the document (hotspot_ids.py)
    for h in x['hotspots']:
        if h['id'] not in ids:
            err('step `%s`: «Підказки» id `%s` is not a hotspot of the step (%s)'
                % (sid, h['id'], ', '.join(i for i in ids if i) or 'none'))
    missing = [i for i in ids if i and i not in {h['id'] for h in x['hotspots']}]
    if missing:
        warn('step `%s`: hotspots without a simple sentence: %s' % (sid, ', '.join(missing)))


def check_copy(d, err, warn):
    """Formula signs and sentence length over every on-screen simple string."""
    for path, text, kind in terms_check.onscreen_simple(d):
        for rx, what in FORMULA_RES:
            m = rx.search(text)
            if m:
                err('%s: %s «%s» in simple copy' % (path, what, m.group(0)))
        if kind == 'name':
            continue
        for n, sent in sentences(text):
            if n > SENTENCE_MAX:
                err('%s: sentence of %d words (> %d): «%s»' % (path, n, SENTENCE_MAX, sent[:60]))
            elif n > SENTENCE_WARN:
                warn('%s: sentence of %d words (aim ≤ %d): «%s»' % (path, n, SENTENCE_WARN, sent[:60]))


def main():
    verbose = '--verbose' in sys.argv
    errors, warnings, layered = [], [], 0
    for cid in C.CHAPTER_IDS:
        with open(os.path.join(C.EXPORT_DIR, cid + '.json'), encoding='utf-8') as f:
            d = json.load(f)

        def err(msg, cid=cid):
            errors.append('error  %s: %s' % (cid, msg))

        def warn(msg, cid=cid):
            warnings.append('warn   %s: %s' % (cid, msg))

        check_misconceptions(cid, d, err, warn)
        if not has_simple(d):
            continue
        layered += 1
        check_quiz(cid, d, err)
        for s in d['steps']:
            check_step(s, err, warn)
        check_copy(d, err, warn)
    for line in errors + (warnings if verbose else []):
        print(line)
    print('simple_check: %d chapters, %d with a simple layer, %d error(s), %d warning(s)%s'
          % (len(C.CHAPTER_IDS), layered, len(errors), len(warnings),
             '' if verbose or not warnings else ' (--verbose lists them)'))
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(C.run_volumes(main))
