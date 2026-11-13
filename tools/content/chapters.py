#!/usr/bin/env python3
"""Shared helpers for the chapter design documents of a volume (docs/volumes/<volume>/chapters/<id>.md).

The project is a library of volumes (docs/VOLUMES.md). Every tool of this directory works on ONE volume at a
time: `use_volume(id)` points the module-level names below (CHAPTER_DIR, CHAPTER_IDS, GROUP, …) at that volume,
and `run_volumes(fn)` is the common command-line entry: `--volume <id>` (default: `defaultVolume` of
app/src/volumes/library.json), or `--all` for every volume that has documents.

A volume is described by app/src/volumes/<id>/volume.json: journey order, groups, parents, axis line, extra
documents. Pure standard library; run the tools from anywhere — paths are resolved from this file.
"""
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
VOLUMES_APP = os.path.join(ROOT, 'app', 'src', 'volumes')
VOLUMES_DOCS = os.path.join(ROOT, 'docs', 'volumes')
SCHEMA_PATH = os.path.join(ROOT, 'tools', 'content', 'export.schema.json')
GLOBAL_ALLOWLIST = os.path.join(ROOT, 'tools', 'content', 'terms_allowlist.tsv')


def _json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


LIBRARY = _json(os.path.join(VOLUMES_APP, 'library.json'))
DEFAULT_VOLUME = LIBRARY['defaultVolume']


def volume_meta(vid):
    return _json(os.path.join(VOLUMES_APP, vid, 'volume.json'))


def volume_ids():
    """Volumes that have documents (docs/volumes/<id>/chapters) and a volume.json, by `order`, then id."""
    ids = [d for d in sorted(os.listdir(VOLUMES_DOCS))
           if os.path.isdir(os.path.join(VOLUMES_DOCS, d, 'chapters'))
           and os.path.exists(os.path.join(VOLUMES_APP, d, 'volume.json'))]
    return sorted(ids, key=lambda v: (volume_meta(v).get('order', 0), v))


def use_volume(vid):
    """Point the module at a volume. Tools read these names at call time, never at import time."""
    global VOLUME, META, DOCS_DIR, CHAPTER_DIR, EXPORT_DIR, GENERATED_DIR, INDEX_PATH, GLOSSARY_PATH
    global CURRICULUM_PATH, VOLUME_ALLOWLIST, JOURNEY, CHAPTER_IDS, GROUP, PARENT, GROUP_TITLE, EXTRA_DOCS, AXIS_LABEL
    META = volume_meta(vid)
    if META['id'] != vid:
        raise SystemExit('volume.json of %r declares id %r' % (vid, META['id']))
    VOLUME = vid
    DOCS_DIR = os.path.join(VOLUMES_DOCS, vid)
    CHAPTER_DIR = os.path.join(DOCS_DIR, 'chapters')
    EXPORT_DIR = os.path.join(CHAPTER_DIR, '_export')
    GENERATED_DIR = os.path.join(VOLUMES_APP, vid, 'content', 'generated')
    INDEX_PATH = os.path.join(DOCS_DIR, 'INDEX.md')
    GLOSSARY_PATH = os.path.join(DOCS_DIR, 'GLOSSARY.md')
    CURRICULUM_PATH = os.path.join(DOCS_DIR, 'CURRICULUM.md')
    VOLUME_ALLOWLIST = os.path.join(DOCS_DIR, 'terms_allowlist.tsv')
    # Journey order and manifest group of every chapter (the volume's CURRICULUM.md is the prose source).
    JOURNEY = [(c['id'], c['group']) for c in META['journey']]
    CHAPTER_IDS = [c for c, _ in JOURNEY]
    GROUP = dict(JOURNEY)
    PARENT = {c['id']: c['parent'] for c in META['journey'] if c.get('parent')}
    GROUP_TITLE = {g['id']: g.get('part', g['label']) for g in META['groups']}
    EXTRA_DOCS = list(META.get('docs', {}).get('extra', []))
    # Name of the header line that carries the chapter's place on the journey axis («Масштаб» for electricity).
    AXIS_LABEL = META['axis']['label']


_FOREIGN = {}


def foreign_steps(vid):
    """{chapter id: {step id: title}} of ANOTHER volume — the targets of `volume/chapter/step` references.

    Empty for an unknown volume or one without documents. Does not change the current volume."""
    if vid not in _FOREIGN:
        out = {}
        meta_path = os.path.join(VOLUMES_APP, vid, 'volume.json')
        if os.path.exists(meta_path):
            for c in _json(meta_path)['journey']:
                path = os.path.join(VOLUMES_DOCS, vid, 'chapters', c['id'] + '.md')
                if os.path.exists(path):
                    with open(path, encoding='utf-8') as f:
                        out[c['id']] = {s['id']: s['title'] for s in steps(f.read())}
        _FOREIGN[vid] = out
    return _FOREIGN[vid]


def full_ref(chapter, step):
    """Full step address `volume/chapter/step` of a reference as the tools carry it: `chapter` is a chapter
    of the current volume, or `volume/chapter` for a reference into another volume."""
    return '%s/%s' % (chapter if '/' in chapter else '%s/%s' % (VOLUME, chapter), step)


def rel(path):
    """Path relative to the repository root, for messages."""
    return os.path.relpath(path, ROOT)


def cli_volumes(default_all=False):
    """Volumes selected on the command line; removes `--volume <id>` / `--all` from sys.argv."""
    argv = sys.argv
    if '--all' in argv:
        argv.remove('--all')
        return volume_ids()
    if '--volume' in argv:
        i = argv.index('--volume')
        if i + 1 >= len(argv):
            raise SystemExit('--volume needs a volume id')
        vid = argv[i + 1]
        del argv[i:i + 2]
        if not os.path.exists(os.path.join(VOLUMES_APP, vid, 'volume.json')):
            raise SystemExit('unknown volume %r (no app/src/volumes/%s/volume.json)' % (vid, vid))
        return [vid]
    return volume_ids() if default_all else [DEFAULT_VOLUME]


def run_volumes(fn, default_all=False):
    """Run `fn()` once per selected volume (see `cli_volumes`); returns the worst exit code."""
    volumes = cli_volumes(default_all)
    code = 0
    for vid in volumes:
        use_volume(vid)
        if len(volumes) > 1:
            print('── volume %s' % vid)
        code = max(code, fn() or 0)
    use_volume(DEFAULT_VOLUME)
    return code


use_volume(DEFAULT_VOLUME)

REQUIRED_SECTIONS = ['Навчальні цілі', 'Наскрізна візуальна ідея', 'Кроки', 'Модель симуляції', 'Глосарій розділу',
                     'Міні-квіз', 'Примітки щодо фактів', 'Перехресні посилання']

STEP_RE = re.compile(r'^### (\d+)\. `([^`]+)` — (.+?)\s*$')
STEP_ID_RE = re.compile(r'^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$')
H1_RE = re.compile(r'^# ([a-z0-9-]+) — (.+?)\s*$')
FENCE_RE = re.compile(r'^\s*(```|~~~)')


def chapter_path(cid):
    return os.path.join(CHAPTER_DIR, cid + '.md')


def read(cid):
    with open(chapter_path(cid), encoding='utf-8') as f:
        return f.read()


def split_sections(text):
    """Return [(title, start_line, end_line)] for level-2 sections (0-based, end exclusive); fences respected."""
    lines = text.split('\n')
    out, fence = [], False
    for i, line in enumerate(lines):
        if FENCE_RE.match(line):
            fence = not fence
        if not fence and line.startswith('## '):
            out.append([line[3:].strip(), i, len(lines)])
            if len(out) > 1:
                out[-2][2] = i
    return [tuple(s) for s in out]


def section_lines(text, title_prefix):
    """Lines (without the heading) of the first level-2 section whose title starts with title_prefix."""
    lines = text.split('\n')
    for title, a, b in split_sections(text):
        if title.startswith(title_prefix):
            return lines[a + 1:b]
    return None


def header(text):
    """(id, title, header paragraph) from the H1 and the metadata paragraph below it."""
    lines = text.split('\n')
    m = H1_RE.match(lines[0])
    if not m:
        raise ValueError('bad H1: %r' % lines[0][:80])
    para = []
    for line in lines[1:]:
        if line.startswith('## '):
            break
        para.append(line)
    return m.group(1), m.group(2), '\n'.join(para)


def axis_label(text):
    """The chapter's place on the volume's journey axis, as written in the document header."""
    m = re.search(r'\*\*%s:\*\*\s*(.+?)\s*·\s*\*\*' % re.escape(AXIS_LABEL), header(text)[2].replace('\n', ' '))
    return m.group(1).strip() if m else ''


def steps(text):
    """[{n, id, title, start, end}] — steps of the «Кроки» section (line numbers 0-based, end exclusive)."""
    lines = text.split('\n')
    sec = [(t, a, b) for t, a, b in split_sections(text) if t.startswith('Кроки')]
    if not sec:
        return []
    _, a, b = sec[0]
    out = []
    for i in range(a + 1, b):
        m = STEP_RE.match(lines[i])
        if m:
            if out:
                out[-1]['end'] = i
            out.append(dict(n=int(m.group(1)), id=m.group(2), title=m.group(3), start=i, end=b))
        elif lines[i].startswith('### '):
            raise ValueError('malformed step heading: %r' % lines[i][:100])
    # a trailing horizontal rule belongs to the section, not to the last step
    return out


def all_step_ids():
    return {cid: [s['id'] for s in steps(read(cid))] for cid in CHAPTER_IDS}


def split_table_row(line):
    """Cells of a Markdown table row; pipes inside `code spans` and escaped pipes are kept."""
    s = line.strip()
    if s.startswith('|'):
        s = s[1:]
    if s.endswith('|') and not s.endswith('\\|'):
        s = s[:-1]
    cells, cur, code = [], '', False
    i = 0
    while i < len(s):
        ch = s[i]
        if ch == '`':
            code = not code
            cur += ch
        elif ch == '\\' and i + 1 < len(s) and s[i + 1] == '|':
            cur += '|'
            i += 1
        elif ch == '|' and not code:
            cells.append(cur.strip())
            cur = ''
        else:
            cur += ch
        i += 1
    cells.append(cur.strip())
    return cells
