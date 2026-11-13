#!/usr/bin/env python3
"""Run every consistency check on the chapter design documents. Exit 0 only if all are green.

  1. structure   H1 = file id, header fields (Група / the volume's axis field, e.g. Масштаб / Кроків), «Кроків: N» equals the number of steps,
                 required sections present and in order, every step has «Текст панелі» and «Інтерактив»
  2. panel       every panel page ≤ 450 characters (plain text, without Markdown markup and delimiting «…»)
  3. script      no word mixing Latin and Cyrillic letters; no Cyrillic look-alike capitals standing alone in formulas
  4. units       no Cyrillic unit symbols after a number («220 В», «50 Гц», «5 кВт», «°С» with Cyrillic С)
  5. quotes      no straight quotes / apostrophes in Ukrainian copy; no legacy micro sign µ
  6. rulings     regression guard for DECISIONS terminology (banned variants, incl. §55 PV string, §56 spellings)
  7. xref        tools/content/xref_check.py
  8. typography  tools/content/typography.py --check (documents are normalised, script is idempotent)
  9. generated   INDEX.md and GLOSSARY.md regenerate without diff; no glossary conflicts
 10. export      docs/volumes/<volume>/chapters/_export/<id>.json regenerate without diff, satisfy tools/content/export.schema.json and cover every panel
                 page, term, hotspot, fact, quiz item … of their documents (round-trip check, counts reported)
 11. runtime     app/src/volumes/<volume>/content/generated/<id>.json and <id>.manifest.json (tools/content/export_runtime.py) are up to date with the export
 11a. terms      tools/content/terms_check.py: DECISIONS §54–§56 on the on-screen fields of the export — no
                 «English — українська» pairs, Latin words only from tools/content/terms_allowlist.tsv, every kept
                 abbreviation explained in Ukrainian at its first mention in a chapter
 12. fonts       app/scripts/font-coverage.mjs: every character of the on-screen copy has a glyph in the font atlas
 13. oracles     tools/ref-models/C6-labs/{home,battery,thermal}_model.py --check (control points of the labs)

Usage: doccheck.py [--quiet]
"""
import os
import re
import subprocess
import sys

sys.dont_write_bytecode = True  # keep the worktree clean (no __pycache__)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import chapters as C  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
PANEL_LIMIT = 450
CYR = 'А-Яа-яіїєґІЇЄҐ'
SPAN_RE = re.compile(r'`[^`\n]*`')
PANEL_HEAD = re.compile(r'^- \*\*Текст панелі[^*]*:\*\*\s*(.*)$')
FIELD = re.compile(r'^- \*\*[^*]+:?\*\*')
ITEM = re.compile(r'^(\s+)(?:[-*]|\d+\.)\s+(.*)$')
PAGE_LABEL = re.compile(r'^\*\*(?:\[\d+\]|[СC]\d+\.?|\d+\.?)\*\*\s*')
CYR_UNITS = (r'кВт·год|кВт|МВт|ГВт|Вт|кВ|МВ|мВ|В|кА|мА|А|кГц|МГц|Гц|кОм|МОм|Ом|кДж|МДж|Дж|Кл|мкФ|Ф|мГн|Гн|Тл|Вб|'
             r'кПа|МПа|Па|кг|км|см|мм|мкм|нм|м²|м³|м/с|мс|мкс|хв|м|с|т|г')
CYR_UNIT_RE = re.compile(r'(?<![' + CYR + r'A-Za-z,.\d])\d+(?:,\d+)?[  ](?:' + CYR_UNITS + r')(?![' + CYR + r'’\'-])')
# legacy vector-group notation «Y/Yн-0», quoted next to the IEC form Yyn0
ALLOWED_MIXED = {'Yн'}
LOOKALIKE_RE = re.compile(r'(?<![' + CYR + r'’A-Za-z])[АВСЕНКМОРТХ](?![' + CYR + r'’A-Za-z])')

# DECISIONS regression guard: (ruling, regex, optional regex that makes a hit legitimate)
BANNED = [
    ('§4', r'[Рр]озподільч', None),
    ('§4/§40', r'[Мм]аслян\w+ (?:трансформатор|вимикач|поршень)|трансформаторн\w+ масл', None),
    ('§15', r'зон\w+ збіднення', None),
    ('§20', r'відпайк', r'розм\.'),
    ('§22', r'дн[оа]м? частоти|дно \(nadir\)', None),
    ('§22/§34', r'мережоутворювальн|мережеутворювальн', None),
    ('§25', r'рядн\w+ інвертор|УЗІП', None),
    ('§26', r'підігрівач', None),
    ('§27', r'паливн\w+ елемент', None),
    ('§30', r'розжарюванн', None),
    ('§30', r'холост', r'\(холост'),
    ('§32', 'µ', None),
    ('§34', r'крив\w+-качк', None),
    ('§37', r'блоков\w+ (?:підвищувальн\w+ )?трансформатор', None),
    ('§40', r'амплітуд\w+ припливу', None),
    ('E1', r'синхроскоп|падіння напруги(?! через)', None),
    # PV string: «ланцюжок модулів», «(стрінг)» only in the first-mention parentheses; «стрінговий інвертор» stays
    ('§55', r'(?<![(\w])[Сс]трінг(?!ов)', None),
    ('§56', r'Феранті|перетворювач\w* джерела напруги|Роутер \+ ONT|роутер\s*\+\s*ONT|LED-освітлен|EV-зарядк', None),
]


def plain(s):
    s = re.sub(r'[*_`]', '', s)
    return re.sub(r'\s+', ' ', s).strip()


def panel_pages(lines, a, b):
    """[(line_no, plain_text)] — pages of the «Текст панелі» block of one step (lines a..b)."""
    pages = []
    i = a
    while i < b:
        m = PANEL_HEAD.match(lines[i])
        if not m:
            i += 1
            continue
        inline = m.group(1).strip()
        j = i + 1
        cur = None
        base_indent = None
        while j < b and not FIELD.match(lines[j]) and not lines[j].startswith('#'):
            it = ITEM.match(lines[j])
            if it and (base_indent is None or len(it.group(1)) <= base_indent):
                base_indent = len(it.group(1))
                cur = [j + 1, it.group(2)]
                pages.append(cur)
            elif cur is not None and lines[j].strip():
                cur[1] += ' ' + lines[j].strip()
            elif cur is None and lines[j].strip():
                inline += ' ' + lines[j].strip()
            j += 1
        if inline and not pages:
            pages.append([i + 1, inline])
        i = j
    out = []
    for ln, txt in pages:
        txt = PAGE_LABEL.sub('', txt.strip())
        txt = plain(txt)
        if txt.startswith('«') and txt.endswith('»'):
            txt = txt[1:-1].strip()
        out.append((ln, txt))
    return out


def check_document(cid, problems, stats):
    text = C.read(cid)
    lines = text.split('\n')

    def bad(kind, line, msg):
        problems.append('%-10s %s:%s: %s' % (kind, cid, line, msg))

    # 1. structure
    try:
        hid, title, hdr = C.header(text)
    except ValueError as e:
        bad('structure', 1, str(e))
        return
    if hid != cid:
        bad('structure', 1, 'H1 id `%s` differs from the file name' % hid)
    # the axis field is named by the volume (volume.json → axis.label): «Масштаб» for electricity
    for field in ('**Група:**', '**%s:**' % C.AXIS_LABEL, '**Кроків:**'):
        if field not in hdr:
            bad('structure', 2, 'header field %s is missing' % field)
    steps = C.steps(text)
    m = re.search(r'\*\*Кроків:\*\*\s*(\d+)', hdr)
    if m and int(m.group(1)) != len(steps):
        bad('structure', 2, 'header says %s steps, document has %d' % (m.group(1), len(steps)))
    titles = [t for t, _, _ in C.split_sections(text)]
    pos = -1
    for req in C.REQUIRED_SECTIONS:
        idx = next((i for i, t in enumerate(titles) if t.startswith(req)), None)
        if idx is None:
            bad('structure', '-', 'required section «%s» is missing' % req)
        elif idx < pos:
            bad('structure', '-', 'section «%s» is out of order' % req)
        else:
            pos = idx
    for s in steps:
        block = '\n'.join(lines[s['start']:s['end']])
        for field in ('**Текст панелі', '**Інтерактив'):
            if field not in block:
                bad('structure', s['start'] + 1, 'step `%s` has no %s** field' % (s['id'], field))
        # 2. panel pages
        pages = panel_pages(lines, s['start'], s['end'])
        stats['pages'] += len(pages)
        for ln, txt in pages:
            stats['max_page'] = max(stats['max_page'], len(txt))
            if len(txt) > PANEL_LIMIT:
                bad('panel', ln, 'page of step `%s` has %d characters (> %d)' % (s['id'], len(txt), PANEL_LIMIT))
    # 3–6. line checks outside fenced code
    fence = False
    for i, line in enumerate(lines, 1):
        if C.FENCE_RE.match(line):
            fence = not fence
            continue
        if fence:
            continue
        nocode = SPAN_RE.sub(lambda mm: ' ' * len(mm.group(0)), line)
        for w in re.findall(r"[A-Za-z" + CYR + r"’']+", line):
            if w not in ALLOWED_MIXED and re.search(r'[A-Za-z]', w) and re.search(r'[' + CYR + r']', w):
                bad('script', i, 'mixed-script word «%s»' % w)
        for span in SPAN_RE.findall(line):
            if re.search(r'[=·/^√]', span) and not re.search(r'[' + CYR + r']{2}', span):
                for mm in LOOKALIKE_RE.finditer(span):
                    bad('script', i, 'Cyrillic look-alike «%s» in formula %s' % (mm.group(0), span[:40]))
            if re.search(r"[" + CYR + r"]'[" + CYR + r"]", span):
                bad('quotes', i, 'straight apostrophe in %s' % span[:40])
        if '°С' in line:
            bad('units', i, '«°С» with Cyrillic С')
        for mm in CYR_UNIT_RE.finditer(line):
            bad('units', i, 'Cyrillic unit symbol: «%s»' % mm.group(0))
        if '"' in nocode:
            bad('quotes', i, 'straight double quote')
        if re.search(r"[A-Za-z" + CYR + r"]['ʼ][A-Za-z" + CYR + r"]", nocode):
            bad('quotes', i, 'straight apostrophe inside a word')
        for ruling, rx, ok in BANNED:
            if re.search(rx, line) and not (ok and re.search(ok, line)):
                bad('rulings', i, '%s: banned variant /%s/ — %s' % (ruling, rx[:30], re.search(rx, line).group(0)))


def run(script, *args):
    if script.endswith('.mjs'):  # node script (font atlas coverage lives with the font builder in app/scripts)
        r = subprocess.run(['node', os.path.normpath(os.path.join(HERE, script))] + list(args),
                           capture_output=True, text=True)
        return r.returncode, (r.stdout + r.stderr).strip().split('\n')
    cmd = [sys.executable, os.path.normpath(os.path.join(HERE, script))] + list(args)
    r = subprocess.run(cmd, capture_output=True, text=True)
    out = (r.stdout + r.stderr).strip().split('\n')
    return r.returncode, out


def main():
    quiet = '--quiet' in sys.argv
    problems = []
    stats = dict(pages=0, max_page=0)
    for cid in C.CHAPTER_IDS:
        check_document(cid, problems, stats)
    kinds = ['structure', 'panel', 'script', 'units', 'quotes', 'rulings']
    counts = {k: sum(1 for p in problems if p.startswith(k)) for k in kinds}
    if not quiet:
        for p in problems:
            print(p)
    print('doccheck: %d chapter documents, %d steps, %d panel pages (longest %d characters, limit %d)'
          % (len(C.CHAPTER_IDS), sum(len(v) for v in C.all_step_ids().values()), stats['pages'], stats['max_page'], PANEL_LIMIT))
    failed = 0
    for k in kinds:
        print('  %-11s %s' % (k, 'ok' if not counts[k] else 'FAIL (%d)' % counts[k]))
        failed += bool(counts[k])
    vol = ['--volume', C.VOLUME]
    checks = [('xref', 'xref_check.py', vol), ('typography', 'typography.py', ['--check'] + vol),
              ('index', 'build_index.py', ['--check'] + vol), ('glossary', 'build_glossary.py', ['--check'] + vol),
              ('export', 'export_content.py', ['--check', '--quiet'] + vol),
              ('runtime', 'export_runtime.py', ['--check'] + vol),
              ('terms', 'terms_check.py', vol),
              ('fonts', '../../app/scripts/font-coverage.mjs', vol)]
    # volume-specific checks (reference models …): volume.json → docs.checks = [[name, path from the repo root, args…]]
    checks += [(c[0], os.path.relpath(os.path.join(C.ROOT, c[1]), HERE), c[2:]) for c in C.META.get('docs', {}).get('checks', [])]
    for name, script, args in checks:
        rc, out = run(script, *args)
        print('  %-11s %s — %s' % (name, 'ok' if rc == 0 else 'FAIL', out[-1]))
        if name == 'export' and rc == 0:
            rc2, counts = run(script, '--check', *vol)
            print('              ' + counts[-2][:160] + ('…' if len(counts[-2]) > 160 else ''))
        if rc != 0:
            failed += 1
            if not quiet:
                for line in out[:-1][:40]:
                    print('      ' + line)
    print('doccheck[%s]: %s' % (C.VOLUME, 'ALL GREEN' if not failed else '%d check group(s) FAILED' % failed))
    return 1 if failed else 0


def main_all():
    code = C.run_volumes(main, default_all=True)
    print('doccheck: %s' % ('ALL GREEN' if code == 0 else 'FAILED'))
    return code


if __name__ == '__main__':
    sys.exit(main_all())
