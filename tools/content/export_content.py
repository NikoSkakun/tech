#!/usr/bin/env python3
"""Export every chapter design document to machine-readable JSON: docs/volumes/<volume>/chapters/_export/<chapter-id>.json.

Builders take all on-screen Ukrainian text from these files and never retype or hand-copy it (DECISIONS §43, §49).
The export is generated — never edit it by hand; change the chapter document and re-run this script.

What the export does to the text
  * the «…» that merely delimit a panel page, a hotspot text, a fact or a misconception are stripped, and the quotes
    that were nested inside them („…“) are promoted back to first-level «…» (deeper levels stay „…“);
  * mini-markup is preserved: **term**, _emphasis_, `formula`; U+00A0 and ’ are preserved;
  * line wraps of the Markdown source are joined with a single space.

Usage
  export_content.py            write docs/volumes/<volume>/chapters/_export/<id>.json for all chapters
  export_content.py --check    exit 1 if a file on disk is stale, violates schema.json, or the round-trip /
                               coverage check fails (every panel page, term, hotspot, fact, quiz item … of the
                               document is present in its export); prints the counts
"""
import json
import os
import re
import sys

sys.dont_write_bytecode = True  # keep the worktree clean (no __pycache__)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import chapters as C  # noqa: E402
import typography as T  # noqa: E402
import build_index  # noqa: E402
import xref_check  # noqa: E402
import simple_layer as SL  # noqa: E402
import hotspot_ids as H  # noqa: E402

SCHEMA_VERSION = 2  # v2: `volume`, full-id cross-reference targets, axisLabel / axisRaw (DECISIONS §58)
CYR_RE = re.compile(r'[А-Яа-яіїєґІЇЄҐ]')
FIELD_RE = re.compile(r'^- \*\*([^*]+?)\*\*\s?(.*)$')
SUB_RE = re.compile(r'^(\s{2,})(?:[-*]|\d+\.)\s+(.*)$')
PAGE_LABEL_RE = re.compile(r'^\*\*(?:\[\d+\]|[СC]\d+\.?|\d+\.?)\*\*\s*')
HEAD_RE = re.compile(r'(`[^`\n]+`|\*\*[^*\n]+\*\*)\s?:(?=\s|$)')
REF_RE = re.compile(r'`([a-z][a-z0-9-]*/[a-z0-9-]+)`')
FIELD_KEYS = {
    'Бачимо': 'see', 'Текст панелі': 'panel', 'Терміни': 'terms', 'Формули': 'formulas', 'Цифри і факти': 'facts',
    'Інтерактив': 'interaction', 'Hotspots': 'hotspots', 'Хибні уявлення': 'misconceptions', 'Перехід': 'transition',
    'Зв’язки': 'links', SL.SIMPLE_LABEL: 'simple',
}


# ---------------------------------------------------------------------------------------------------- text helpers
def squash(s):
    """Join wrapped lines; ordinary whitespace collapses, U+00A0 is preserved."""
    return re.sub(r'[ \t\r\n]+', ' ', s).strip()


def promote_quotes(s):
    """Re-level the quotes of a string whose delimiting «…» were removed: first level «…», nested „…“."""
    flat = s.replace('„', '«').replace('“', '»')
    out, changed = T.fix_quotes(flat)
    if out.count('«') != out.count('»'):     # unbalanced after flattening: keep the original characters
        return s
    return out


def matching_close(s, start=0):
    """Index of the » that closes the « at s[start] (code spans ignored), or -1."""
    depth = 0
    code = False
    for i in range(start, len(s)):
        ch = s[i]
        if ch == '`':
            code = not code
        elif code:
            continue
        elif ch in '«„':
            depth += 1
        elif ch in '»“':
            depth -= 1
            if depth == 0:
                return i if ch == '»' else -1
    return -1


def unwrap(s):
    """('inner text with promoted quotes', 'tail after the closing »') if s starts with a delimiting «…»,
    else (s, None)."""
    s = s.strip()
    if s.startswith('«'):
        j = matching_close(s)
        if j > 0:
            return promote_quotes(s[1:j].strip()), s[j + 1:].strip()
    return s, None


def clean_tail(tail):
    """Source / remark after a delimited fact: strip wrapping punctuation and parentheses."""
    t = tail.strip().strip('.;, ')
    if t.startswith('('):
        depth = 0
        for i, ch in enumerate(t):
            depth += ch == '('
            depth -= ch == ')'
            if depth == 0:
                if i == len(t) - 1:
                    t = t[1:-1].strip()
                break
    return t or None


def split_label(label):
    """'Цифри і факти (модель §M2):' → ('Цифри і факти', 'модель §M2')."""
    label = label.strip().rstrip(':').strip()
    m = re.match(r'^(.*?)\s*\((.*)\)$', label, re.S)
    if m and m.group(1) in FIELD_KEYS:
        return m.group(1), m.group(2).strip()
    return label, None


def depth0_spans(s):
    """Mask of positions that are outside «…» / „…“ quotes (True = depth 0)."""
    mask, depth, code = [], 0, False
    for ch in s:
        if ch == '`':
            code = not code
        if not code and ch in '«„':
            mask.append(depth == 0)
            depth += 1
            continue
        if not code and ch in '»“':
            depth = max(0, depth - 1)
            mask.append(depth == 0)
            continue
        mask.append(depth == 0)
    return mask


# ------------------------------------------------------------------------------------------------- field splitting
def step_fields(lines, a, b):
    """[(label, note, inline_text, [sub items])] of one step. Sub items are the list entries at the first
    sub-indent; deeper lines are continuation of the current item."""
    fields = []
    cur = None
    for i in range(a + 1, b):
        line = lines[i]
        m = FIELD_RE.match(line)
        if m:
            label, note = split_label(m.group(1))
            cur = dict(label=label, note=note, inline=[m.group(2)], items=[], base=None, line=i + 1)
            fields.append(cur)
            continue
        if cur is None or not line.strip() or line.strip() == '---':
            continue
        sm = SUB_RE.match(line)
        if sm and (cur['base'] is None or len(sm.group(1)) <= cur['base']):
            cur['base'] = len(sm.group(1))
            cur['items'].append([sm.group(2)])
        elif cur['items']:
            cur['items'][-1].append(line.strip())
        else:
            cur['inline'].append(line.strip())
    for f in fields:
        f['inline'] = squash(' '.join(f['inline']))
        f['items'] = [squash(' '.join(it)) for it in f['items']]
    return fields


def chunks(field):
    return ([field['inline']] if field['inline'] else []) + field['items']


# ------------------------------------------------------------------------------------------------------ item parsers
def parse_pages(field):
    pages = []
    for raw in chunks(field):
        txt = PAGE_LABEL_RE.sub('', raw).strip()
        inner, tail = unwrap(txt)
        if tail is not None and tail.strip(' .') == '':
            pages.append(inner)
        else:
            pages.append(txt)
    return pages


def split_top(s, sep):
    """Split on `sep` outside parentheses and brackets."""
    out, depth, cur, i = [], 0, '', 0
    while i < len(s):
        if s[i] in '([':
            depth += 1
        elif s[i] in ')]':
            depth = max(0, depth - 1)
        if depth == 0 and s.startswith(sep, i):
            out.append(cur)
            cur = ''
            i += len(sep)
            continue
        cur += s[i]
        i += 1
    out.append(cur)
    return out


def parse_term_head(head):
    """`International — український — symbol [unit]` → dict."""
    raw = head.strip('`').strip()
    parts = [p.strip() for p in split_top(raw, ' — ')]
    out = dict(international=None, ukrainian=None, symbol=None, unit=None, raw=raw)
    if len(parts) == 1:
        out['ukrainian' if CYR_RE.search(raw) else 'international'] = raw
        return out
    # «SPD — surge protection device — ПЗІП, …»: the Latin expansion belongs to the international name
    k = 1
    while k < len(parts) - 1 and not CYR_RE.search(parts[k]):
        k += 1
    out['international'] = ' — '.join(parts[:k])
    out['ukrainian'] = parts[k]
    rest = ' — '.join(parts[k + 1:]) if len(parts) > k + 1 else None
    if rest:
        m = re.match(r'^(.*?)\s*\[([^\]]+)\]$', rest)
        if m:
            out['symbol'], out['unit'] = (m.group(1).strip(' ,') or None), m.group(2).strip()
        else:
            out['symbol'] = rest
    else:
        m = re.match(r'^(.*?)(?:,\s*([^,\[\]]{1,14}))?\s*\[([^\]]+)\]$', out['ukrainian'])
        if m:
            out['ukrainian'] = m.group(1).strip()
            out['symbol'] = m.group(2).strip() if m.group(2) else None
            out['unit'] = m.group(3).strip()
    return out


# explicit hotspot id after the name: `- **Кільце** {#ring}: «…»` (CONTENT_EXPORT.md «Hotspot ids»); the capture is
# loose so that a malformed id reaches the check (HOTSPOT_ID_OK) with a clear message instead of leaking into the note
HOTSPOT_ID_RE = re.compile(r'\s*\{#([^{}\s]*)\}')
REMARK_RE = re.compile(r'^\s*((?:\((?:[^()]|\([^()]*\))*\)|[^:«»`;.()]{1,80}))?\s*:(?=\s|$)')


def delimited(body):
    """(text, tail): strip the delimiting «…» of a quoted copy string. The quotes count as delimiters only if nothing
    but punctuation or a parenthesised remark follows them; otherwise the body is returned verbatim (tail None)."""
    inner, tail = unwrap(body)
    if tail is None:
        return body.strip(), None
    t = tail.strip()
    if t.strip('.;, ') == '' or t.startswith('('):
        return inner, (t.strip('.;, ') or None)
    return body.strip(), None


def split_headed(text, mode):
    """Split a chunk into (head, note, body, id) pieces; text before the first head is returned with head None.
    terms:    a head is a `code span` containing « — » (if the chunk has none, every code span is a head);
    hotspots: a head is a `code span` containing « — », or a `code span` / **bold** label followed — directly or
              after a short remark such as «(мініатюра на столі)» — by a colon. Only outside «…» quotes.
              The explicit id `{#id}` right after the head (before the remark) is returned as `id`."""
    mask = depth0_spans(text)
    heads = []                             # (start, end of head, end of head incl. id, remark and colon, note, id)
    for m in re.finditer(r'`[^`\n]+`|\*\*[^*\n]+\*\*', text):
        if not mask[m.start()]:
            continue
        code = m.group(0).startswith('`')
        dash = ' — ' in m.group(0)
        if mode == 'terms':
            if code and dash:
                heads.append((m.start(), m.end(), m.end(), None, None))
            continue
        hid = HOTSPOT_ID_RE.match(text, m.end())
        after = hid.end() if hid else m.end()
        r = REMARK_RE.match(text[after:])
        if r and (not heads or m.start() >= heads[-1][2]):
            heads.append((m.start(), m.end(), after + r.end(), (r.group(1) or '').strip() or None,
                          hid and hid.group(1)))
        elif code and dash and (not heads or m.start() >= heads[-1][2]):
            heads.append((m.start(), m.end(), after, None, hid and hid.group(1)))
    if mode == 'terms' and not heads:
        heads = [(m.start(), m.end(), m.end(), None, None) for m in re.finditer(r'`[^`\n]+`', text) if mask[m.start()]]
    if not heads:
        return [(None, None, text.strip(), None)]
    out = []
    lead = text[:heads[0][0]].strip()
    if lead:
        out.append((None, None, lead, None))
    for n, (st, e, e2, note, hid) in enumerate(heads):
        nxt = heads[n + 1][0] if n + 1 < len(heads) else len(text)
        out.append((text[st:e].strip(), note, text[e2:nxt].strip(), hid))
    return out


def parse_terms(field):
    """([terms], note): the note is free text of the field that is not a term («— (повторення)», lead-ins)."""
    terms, notes = [], []
    for chunk in chunks(field):
        for head, _, body, _ in split_headed(chunk, 'terms'):
            body = re.sub(r'^[:;,]\s*', '', body).strip()
            body = re.sub(r'\s*[;,]$', '', body).strip()
            if head is None:
                if body and terms:
                    terms[-1]['definition'] = squash((terms[-1]['definition'] or '') + ' ' + body)
                elif body:
                    notes.append(body)
                continue
            t = parse_term_head(head)
            t['definition'] = body if body.strip('.;,: ') else None
            terms.append(t)
    return terms, (squash(' '.join(notes)) or None)


def parse_hotspots(field):
    """([hotspots], note). Hotspot: name (international / Ukrainian parts), note (builder remark between the name
    and the colon), text (on-screen copy, delimiters stripped), tail (remark after the quoted copy)."""
    spots, notes = [], []
    for chunk in chunks(field):
        for head, note, body, hid in split_headed(chunk, 'hotspots'):
            body = re.sub(r'^[:;,]\s*', '', body).strip()
            body = re.sub(r'\s*;$', '', body).strip()
            if head is None:
                if body and spots:
                    spots[-1]['tail'] = squash((spots[-1]['tail'] or '') + ' ' + body)
                elif body:
                    notes.append(body)
                continue
            name = head.strip('`*').strip()
            intl = ukr = None
            if ' — ' in name:
                intl, ukr = [x.strip() for x in name.split(' — ', 1)]
            elif CYR_RE.search(name):
                ukr = name
            else:
                intl = name
            if body.strip('.;, ') == '':
                body = ''
            text, tail = delimited(body) if body else ('', None)
            spots.append(dict(id=hid, name=name, international=intl, ukrainian=ukr, note=note, text=text, tail=tail))
    return spots, (squash(' '.join(notes)) or None)


def parse_facts(field):
    items = []
    for chunk in chunks(field):
        text, tail = delimited(chunk)
        items.append(dict(text=text, source=clean_tail(tail) if tail else None))
    return items


def parse_misconceptions(field):
    out = []
    for chunk in chunks(field):
        myth, tail = unwrap(chunk)
        if tail is not None and tail.startswith('→'):
            out.append(dict(myth=myth, correction=tail[1:].strip(), raw=chunk))
        elif '→' in chunk:
            left, right = chunk.split('→', 1)
            inner, t2 = unwrap(left.strip())
            out.append(dict(myth=inner if t2 == '' else left.strip(), correction=right.strip(), raw=chunk))
        else:
            out.append(dict(myth=None, correction=chunk, raw=chunk))
    for m in out:  # `… [Сцена: …]` closes the item: builder guidance, never shown (key only when present)
        learner, scene, problem = SL.split_scene(m['correction'])
        if scene is not None and not problem:
            m['correction'] = learner
            m['scene'] = scene
    return out


CONTROL_KW = [
    ('slider', r'[Сс]лайдер\w*|[Пп]овзун\w*|[Рр]учк[аи]'), ('stepper', r'[Сс]тепер\w*'),
    ('toggle', r'[Пп]еремикач\w*|[Тт]умблер\w*'), ('segmented', r'[Сс]егмент\w*|[Вв]кладк\w+'),
    ('button', r'[Кк]нопк\w+'), ('drag', r'[Пп]еретяг\w+|\bdrag\b'),
]
CONTROL_RE = re.compile('|'.join('(?P<%s>%s)' % (k, rx) for k, rx in CONTROL_KW))
NUM = r'[+−-]?\d+(?:[.,]\d+)?(?:×10[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)?'
RANGE_RE = re.compile(r'(?P<lo>' + NUM + r')(?:[  ]?(?P<ulo>[A-Za-zμΩ°%][^\s…,;()]*))?[  ]?…[  ]?(?P<hi>' + NUM +
                      r')(?:[  ]?(?P<unit>[A-Za-zμΩ°%][^\s,;()]*))?')
STEP_RE = re.compile(r'крок[  ](' + NUM + r')')
DEFAULT_RE = re.compile(r'типово[ \u00a0](?:—[ \u00a0])?(.+?)(?=;|\)|\(|,\s|\s→|$)')
LABEL_RE = re.compile(r'«([^«»]+)»|\*\*«?([^*«»]+)»?\*\*|`([^`]+)`')


def to_number(s):
    if s is None or '×' in s:
        return None
    try:
        return float(s.replace('−', '-').replace('+', '').replace(',', '.'))
    except ValueError:
        return None


def parse_controls(text):
    """Best-effort extraction of UI controls from an interaction item (type, label, range, step, unit, default)."""
    found = list(CONTROL_RE.finditer(text))
    out = []
    for n, m in enumerate(found):
        seg_end = found[n + 1].start() if n + 1 < len(found) else len(text)
        arrow = text.find('→', m.end(), seg_end)
        seg = text[m.end():arrow if arrow >= 0 else seg_end]
        ctype = m.lastgroup
        lab = LABEL_RE.search(seg[:90])
        if lab and lab.start() > 30:          # a label must follow the control word closely
            lab = None
        label = next((g for g in lab.groups() if g), None) if lab else None
        ctl = dict(type=ctype, label=label.strip() if label else None, min=None, max=None, step=None, unit=None,
                   default=None)
        if ctype in ('slider', 'stepper'):
            r = RANGE_RE.search(seg)
            if r:
                ctl['min'], ctl['max'] = to_number(r.group('lo')), to_number(r.group('hi'))
                ctl['unit'] = r.group('unit') or r.group('ulo')
            st = STEP_RE.search(seg)
            if st:
                ctl['step'] = to_number(st.group(1))
        d = DEFAULT_RE.search(seg)
        if d:
            ctl['default'] = d.group(1).strip()
        if ctype in ('slider', 'stepper') and ctl['min'] is None and ctl['label'] is None:
            continue                    # a mere mention («слайдер змінює…»), not a control definition
        out.append(ctl)
    return out


def parse_interaction(field):
    items = [dict(text=c, controls=parse_controls(c)) for c in chunks(field)]
    return dict(note=field['note'], items=items)


# --------------------------------------------------------------------------------------------------------- chapter
def parse_step(lines, s):
    step = dict(n=s['n'], id=s['id'], title=s['title'], see=None, panel=[], terms=[], termsNote=None, formulas=None,
                facts=None, interaction=None, hotspots=[], hotspotsNote=None, misconceptions=[], transition=None,
                links=None)
    for f in step_fields(lines, s['start'], s['end']):
        key = FIELD_KEYS.get(f['label'])
        if key is None:
            raise SystemExit('%s: unknown step field «%s» (line %d)' % (s['id'], f['label'], f['line']))
        whole = squash(' '.join(chunks(f)))
        if key == 'see':
            step['see'] = whole
        elif key == 'panel':
            step['panel'] = parse_pages(f)
        elif key == 'terms':
            step['terms'], step['termsNote'] = parse_terms(f)
        elif key == 'formulas':
            step['formulas'] = dict(items=[x[1:-1] for x in re.findall(r'`[^`\n]+`', whole)], raw=whole)
        elif key == 'facts':
            step['facts'] = dict(note=f['note'], items=parse_facts(f))
        elif key == 'interaction':
            step['interaction'] = parse_interaction(f)
        elif key == 'hotspots':
            step['hotspots'], step['hotspotsNote'] = parse_hotspots(f)
        elif key == 'misconceptions':
            step['misconceptions'] = parse_misconceptions(f)
        elif key == 'transition':
            step['transition'] = dict(note=f['note'], text=whole)
        elif key == 'links':
            step['links'] = whole
        elif key == 'simple':  # the simple reading level; the key exists only in steps that have the block
            step['simple'] = SL.parse_simple(lines, s['start'], s['end'], s['id'])
    return step


def parse_goals(text):
    goals = []
    for line in C.section_lines(text, 'Навчальні цілі') or []:
        m = re.match(r'^\d+\.\s+(.*)$', line)
        if m:
            goals.append([m.group(1)])
        elif line.strip() and goals and line.startswith(' '):
            goals[-1].append(line.strip())
    return [squash(' '.join(g)) for g in goals]


QUIZ_Q_RE = re.compile(r'^(\d+)\.\s+\*\*(.+?)\*\*\s*(.*)$')
OPTION_LETTERS = 'абвгґд'


def split_options(body):
    """Locate «а) … б) … в) …» markers in order; returns ([option texts], rest after the options)."""
    pos = []
    start = 0
    for letter in OPTION_LETTERS:
        m = re.compile(r'(?:(?<=^)|(?<=[\s;·]))' + letter + r'\)\s').search(body, start)
        if not m:
            break
        pos.append((m.start(), m.end()))
        start = m.end()
    if len(pos) < 2:
        return [], body
    end = len(body)
    for marker in ('_Пояснення:_', '**Правильно'):
        k = body.find(marker, pos[-1][1])
        if k >= 0:
            end = min(end, k)
    opts = []
    for n, (a, b) in enumerate(pos):
        nxt = pos[n + 1][0] if n + 1 < len(pos) else end
        opts.append(body[b:nxt])
    return opts, body[end:]


def parse_quiz(text, section='Міні-квіз', marks=None):
    """Quiz items of a section («Міні-квіз», «Простий квіз»). `marks`, if a list, receives the number of options
    marked correct per item (the export keeps the first; simple_check requires exactly one)."""
    items = []
    for line in C.section_lines(text, section) or []:
        m = QUIZ_Q_RE.match(line)
        if m:
            items.append(dict(n=int(m.group(1)), question=m.group(2).strip(), body=[m.group(3)]))
        elif line.strip() and items and line.startswith(' '):
            items[-1]['body'].append(line.strip())
    out = []
    for it in items:
        body = squash(' '.join(it['body']))
        opts, rest = split_options(body)
        correct = None
        clean = []
        n_marked = 0
        for i, o in enumerate(opts):
            o = o.strip()
            o = re.sub(r'\s*[;·]\s*$', '', o)
            o = re.sub(r'\s*—\s*$', '', o).strip()
            marked = '✔' in o
            o = o.replace('✔', '').strip()
            o = re.sub(r'\s*[;.]\s*$', '', o).strip()
            if o.startswith('**') and o.endswith('**') and o.count('**') == 2:
                marked = True
                o = o[2:-2].strip()
            elif o.startswith('**') and o.count('**') == 2 and re.search(r'\*\*[.;]?$', o):
                marked = True
                o = re.sub(r'\*\*[.;]?$', '', o[2:]).strip()
            if marked and correct is None:
                correct = i
            n_marked += marked
            clean.append(o.strip())
        rest = rest.strip()
        m = re.match(r'^\*\*Правильно:\s*([' + OPTION_LETTERS + r'])\.?\*\*\s*(.*)$', rest, re.S)
        explanation = None
        if m:
            correct = OPTION_LETTERS.index(m.group(1))
            n_marked = max(n_marked, 1)
            explanation = m.group(2).strip() or None
        else:
            m = re.match(r'^(?:—\s*)?_Пояснення:_\s*(.*)$', rest, re.S)
            if m:
                explanation = m.group(1).strip() or None
            elif rest:
                explanation = rest
        out.append(dict(question=it['question'], options=clean, correct=correct, explanation=explanation))
        if marks is not None:
            marks.append(n_marked)
    return out


def parse_glossary(text):
    rows = [l for l in (C.section_lines(text, 'Глосарій розділу') or []) if l.lstrip().startswith('|')]
    out = []
    for r in rows[2:]:
        c = C.split_table_row(r)
        out.append(dict(international=c[0], ukrainian=c[1], symbol=None if c[2] in ('—', '') else c[2],
                        unit=None if c[3] in ('—', '') else c[3], definition=c[4]))
    return out


def parse_xrefs(text):
    out = []
    for line in C.section_lines(text, 'Перехресні посилання') or []:
        if not (line.lstrip().startswith('|') or line.lstrip().startswith('- ')):
            continue
        refs = [C.full_ref(ch, st) for ch, st in xref_check.refs_in_line(line)]
        if not refs:
            continue
        if line.lstrip().startswith('|'):
            cells = C.split_table_row(line)
            where, note = cells[0], (cells[2] if len(cells) > 2 else None)
        else:
            where, _, tail = line.lstrip('- ').partition('→')
            where, note = where.strip(), None
        out.append(dict(where=where, targets=refs, note=note))
    return out


def parse_models(text):
    out = []
    for title in build_index.models(text):
        m = re.match(r'^(§\s?[A-Za-zА-Яа-яІЇЄҐ\d]+|[A-ZА-ЯҐЄІЇ]{1,4}-?\d+[a-zа-я]?)\.?\s+(.*)$', title)
        out.append(dict(id=m.group(1) if m else None, title=(m.group(2) if m else title).strip().rstrip('.')))
    return out


def parse_chapter(cid):
    text = C.read(cid)
    lines = text.split('\n')
    hid, title, hdr = C.header(text)
    flat = squash(hdr.replace('\n', ' '))
    group = re.search(r'\*\*Група:\*\*\s*(.+?)\s*·\s*\*\*', flat)
    mood = re.search(r'\*\*Акцентний колір/настрій:\*\*\s*(.+?)(?=\s*>\s|$)', flat)
    notes = []
    para = []
    for line in hdr.split('\n') + ['']:
        if line.startswith('>'):
            para.append(line.lstrip('> ').strip())
        elif para:
            notes.append(squash(' '.join(para)))
            para = []
    mood_text = None
    if mood:
        mood_lines = []
        take = False
        for line in hdr.split('\n'):
            if '**Акцентний колір/настрій:**' in line:
                take = True
                line = line.split('**Акцентний колір/настрій:**', 1)[1]
            if take:
                if line.startswith('>') or not line.strip():
                    break
                mood_lines.append(line)
        mood_text = squash(' '.join(mood_lines))
    steps = [parse_step(lines, s) for s in C.steps(text)]
    vis = C.section_lines(text, 'Наскрізна візуальна ідея') or []
    data = dict(
        schemaVersion=SCHEMA_VERSION, volume=C.VOLUME, id=cid, title=title, order=C.CHAPTER_IDS.index(cid) + 1, group=C.GROUP[cid],
        parent=C.PARENT.get(cid), groupLabel=group.group(1) if group else None,
        axisLabel=build_index.short_scale(C.axis_label(text)), axisRaw=C.axis_label(text), accentMood=mood_text,
        notes=notes, learningGoals=parse_goals(text),
        visualIdea='\n'.join(vis).strip().rstrip('-').strip(),
        steps=steps, models=parse_models(text), glossary=parse_glossary(text), quiz=parse_quiz(text),
        crossReferences=parse_xrefs(text), source=dict(document='%s' % C.rel(C.chapter_path(cid)), generator='tools/content/export_content.py'))
    if C.section_lines(text, SL.SIMPLE_QUIZ_SECTION) is not None:  # key only when the section exists
        source = data.pop('source')
        data['simpleQuiz'] = parse_quiz(text, SL.SIMPLE_QUIZ_SECTION)
        data['source'] = source
    return data


def render(data):
    return json.dumps(data, ensure_ascii=False, indent=1) + '\n'


# ----------------------------------------------------------------------------------------- schema (subset validator)
def validate(node, schema, root, path='$'):
    """Minimal JSON Schema validator for the subset used by schema.json (type, enum, required, properties,
    additionalProperties, items, minItems, minimum, minLength, pattern, $ref to #/$defs). Returns a list of error
    strings."""
    if '$ref' in schema:
        return validate(node, root['$defs'][schema['$ref'].split('/')[-1]], root, path)
    errs = []
    types = schema.get('type')
    if types:
        types = types if isinstance(types, list) else [types]
        ok = False
        for t in types:
            ok = ok or (t == 'null' and node is None) or (t == 'string' and isinstance(node, str)) or \
                (t == 'integer' and isinstance(node, int) and not isinstance(node, bool)) or \
                (t == 'number' and isinstance(node, (int, float)) and not isinstance(node, bool)) or \
                (t == 'boolean' and isinstance(node, bool)) or (t == 'array' and isinstance(node, list)) or \
                (t == 'object' and isinstance(node, dict))
        if not ok:
            return ['%s: expected %s, got %s' % (path, '/'.join(types), type(node).__name__)]
    if 'enum' in schema and node not in schema['enum']:
        errs.append('%s: %r not in enum' % (path, node))
    if isinstance(node, (int, float)) and not isinstance(node, bool) and 'minimum' in schema and node < schema['minimum']:
        errs.append('%s: %r < minimum' % (path, node))
    if isinstance(node, str) and 'minLength' in schema and len(node) < schema['minLength']:
        errs.append('%s: string shorter than %d' % (path, schema['minLength']))
    if isinstance(node, str) and 'pattern' in schema and not re.search(schema['pattern'], node):
        errs.append('%s: %r does not match %s' % (path, node, schema['pattern']))
    if isinstance(node, dict):
        for req in schema.get('required', []):
            if req not in node:
                errs.append('%s: missing property %s' % (path, req))
        props = schema.get('properties', {})
        for k, v in node.items():
            if k in props:
                errs += validate(v, props[k], root, path + '.' + k)
            elif schema.get('additionalProperties') is False:
                errs.append('%s: unexpected property %s' % (path, k))
    if isinstance(node, list):
        if len(node) < schema.get('minItems', 0):
            errs.append('%s: fewer than %d items' % (path, schema['minItems']))
        if 'items' in schema:
            for i, v in enumerate(node):
                errs += validate(v, schema['items'], root, '%s[%d]' % (path, i))
    return errs


# --------------------------------------------------------------------------------------- round-trip / coverage check
def sig(s):
    """Alphanumeric signature of a text: everything that is not a letter or digit is dropped."""
    return re.sub(r'[\W_]+', '', s or '', flags=re.UNICODE)


def doc_field_sig(field, drop_page_labels=False):
    parts = []
    for c in chunks(field):
        parts.append(PAGE_LABEL_RE.sub('', c) if drop_page_labels else c)
    return sig(' '.join(parts))


def quiz_coverage(text, section, items, name, bad, counts):
    """Independent count of the numbered questions of a quiz section; text round-trip; structure of every item."""
    quiz_lines = C.section_lines(text, section) or []
    n_q = sum(1 for l in quiz_lines if re.match(r'^\d+\.\s+\*\*', l))
    if n_q != len(items):
        bad('%s: %d questions in the document, %d in the export' % (name, n_q, len(items)))
    doc_quiz = ' '.join(l for l in quiz_lines if l.strip())
    doc_quiz = re.sub(r'(?:(?<=^)|(?<=[\s;·]))[' + OPTION_LETTERS + r']\)\s', ' ', doc_quiz)
    doc_quiz = re.sub(r'\*\*Правильно:\s*[' + OPTION_LETTERS + r']\.?\*\*', ' ', doc_quiz)
    doc_quiz = re.sub(r'_Пояснення:_', ' ', doc_quiz)
    doc_quiz = re.sub(r'(?m)(?:^|\s)\d+\.\s+\*\*', ' **', doc_quiz)
    exp_quiz = ' '.join(q['question'] + ' ' + ' '.join(q['options']) + ' ' + (q['explanation'] or '') for q in items)
    if sig(doc_quiz) != sig(exp_quiz):
        bad('%s: text is not fully covered by the export (%d vs %d signature characters)'
            % (name, len(sig(doc_quiz)), len(sig(exp_quiz))))
    for i, q in enumerate(items, 1):
        if len(q['options']) < 2:
            bad('%s %d: fewer than two options parsed' % (name, i))
        if q['correct'] is None or not (0 <= q['correct'] < len(q['options'])):
            bad('%s %d: no correct option marked' % (name, i))
    counts['%s items' % name] += len(items)
    counts['%s items without explanation' % name] += sum(1 for q in items if not q['explanation'])


def simple_coverage(lines, s, simple, bad, counts):
    """Round-trip of a step's `Просто` block: every letter and digit of the block (labels aside) is exported;
    independent page count (the `**[n]**` labels of the block)."""
    where = 'step `%s` simple layer' % s['id']
    doc = SL.doc_signature_text(lines, s['start'], s['end'])
    if sig(doc) != sig(SL.export_signature_text(simple)):
        bad('%s: not fully covered by the export (%d vs %d signature characters)'
            % (where, len(sig(doc)), len(sig(SL.export_signature_text(simple)))))
    first, end = SL.block_lines(lines, s['start'], s['end'])
    n_pages = sum(1 for l in lines[first:end] if re.match(r'^\s+[-*]\s+\*\*\[\d+\]\*\*', l))
    if n_pages and n_pages != len(simple['panel']):
        bad('%s: %d pages in the document, %d in the export' % (where, n_pages, len(simple['panel'])))
    counts['steps with a simple layer'] += 1
    counts['simple panel pages'] += len(simple['panel'])


def coverage(cid, data, problems, counts):
    text = C.read(cid)
    lines = text.split('\n')

    def bad(msg):
        problems.append('%s: %s' % (cid, msg))

    doc_steps = C.steps(text)
    if [s['id'] for s in doc_steps] != [s['id'] for s in data['steps']]:
        bad('step ids differ from the document')
        return
    for s, e in zip(doc_steps, data['steps']):
        where = 'step `%s`' % s['id']
        fields = {FIELD_KEYS[f['label']]: f for f in step_fields(lines, s['start'], s['end'])}
        # independent page count: the list entries below «Текст панелі» as doccheck sees them
        import doccheck
        pages_doc = doccheck.panel_pages(lines, s['start'], s['end'])
        if len(pages_doc) != len(e['panel']):
            bad('%s: %d panel pages in the document, %d in the export' % (where, len(pages_doc), len(e['panel'])))
        for (ln, plain_doc), page in zip(pages_doc, e['panel']):
            if sig(plain_doc) != sig(page):
                bad('%s: panel page at line %d differs from the export' % (where, ln))
            if page.startswith('«') and page.endswith('»') and matching_close(page) == len(page) - 1:
                bad('%s: panel page at line %d still carries its «…» delimiters' % (where, ln))
            if REF_RE.search(page):
                counts['panel pages with a chapter/step code span'] += 1
        counts['panel pages'] += len(e['panel'])

        def same(key, export_text):
            f = fields.get(key)
            a = doc_field_sig(f) if f else ''
            if a != sig(export_text):
                bad('%s: field «%s» is not fully covered by the export (%d vs %d signature characters)'
                    % (where, key, len(a), len(sig(export_text))))

        same('see', e['see'])
        same('terms', (e['termsNote'] or '') + ' ' + ' '.join((t['raw'] or '') + ' ' + (t['definition'] or '') for t in e['terms']))
        same('formulas', e['formulas']['raw'] if e['formulas'] else '')
        same('facts', ' '.join(i['text'] + ' ' + (i['source'] or '') for i in e['facts']['items']) if e['facts'] else '')
        same('interaction', ' '.join(i['text'] for i in e['interaction']['items']) if e['interaction'] else '')
        same('hotspots', (e['hotspotsNote'] or '') + ' ' + ' '.join(
            h['name'] + ' ' + (h['id'] or '') + ' ' + (h['note'] or '') + ' ' + h['text'] + ' ' + (h['tail'] or '')
            for h in e['hotspots']))
        for msg in H.step_problems(e):
            bad('%s: %s' % (where, msg))
        same('misconceptions', ' '.join(m['raw'] for m in e['misconceptions']))
        same('transition', e['transition']['text'] if e['transition'] else '')
        same('links', e['links'] or '')
        for m in e['misconceptions']:
            raw = m['raw'].replace(SL.SCENE_OPEN, ' ', 1) if 'scene' in m else m['raw']
            if sig((m['myth'] or '') + m['correction'] + (m.get('scene') or '')) != sig(raw):
                bad('%s: misconception split loses text' % where)
            if 'scene' in m:
                counts['misconceptions with a [Сцена: …] part'] += 1
        if 'simple' in e:
            simple_coverage(lines, s, e['simple'], bad, counts)
        elif SL.block_lines(lines, s['start'], s['end']):
            bad('%s: «%s» block not exported' % (where, SL.SIMPLE_LABEL))
        if not e['panel']:
            bad('%s: no panel pages' % where)
        if e['see'] is None:
            bad('%s: no «Бачимо» text' % where)
        counts['terms'] += len(e['terms'])
        counts['terms without international name'] += sum(1 for t in e['terms'] if not t['international'])
        counts['hotspots'] += len(e['hotspots'])
        counts['hotspots without text (name only)'] += sum(1 for h in e['hotspots'] if not h['text'])
        counts['facts'] += len(e['facts']['items']) if e['facts'] else 0
        counts['formulas'] += len(e['formulas']['items']) if e['formulas'] else 0
        counts['interaction items'] += len(e['interaction']['items']) if e['interaction'] else 0
        counts['parsed controls'] += sum(len(i['controls']) for i in e['interaction']['items']) if e['interaction'] else 0
        counts['misconceptions'] += len(e['misconceptions'])
        counts['misconceptions without a myth/correction split'] += sum(1 for m in e['misconceptions'] if m['myth'] is None)
    quiz_coverage(text, 'Міні-квіз', data['quiz'], 'quiz', bad, counts)
    if 'simpleQuiz' in data:
        quiz_coverage(text, SL.SIMPLE_QUIZ_SECTION, data['simpleQuiz'], 'simple quiz', bad, counts)
    # glossary, goals, cross-references, models
    import build_glossary
    if len(build_glossary.chapter_entries(cid)) != len(data['glossary']):
        bad('glossary: row count differs')
    counts['glossary rows'] += len(data['glossary'])
    goals_doc = sum(1 for l in (C.section_lines(text, 'Навчальні цілі') or []) if re.match(r'^\d+\.\s', l))
    if goals_doc != len(data['learningGoals']) or not data['learningGoals']:
        bad('learning goals: %d in the document, %d in the export' % (goals_doc, len(data['learningGoals'])))
    counts['learning goals'] += len(data['learningGoals'])
    have = {t for x in data['crossReferences'] for t in x['targets']}
    if have != {C.full_ref(ch, st) for ch, st in xref_check.section_refs(text)}:
        bad('cross-references differ from the «Перехресні посилання» section')
    counts['cross-reference targets'] += sum(len(x['targets']) for x in data['crossReferences'])
    if len(data['models']) != len(build_index.models(text)):
        bad('models: count differs')
    counts['simulation models'] += len(data['models'])
    if not data['accentMood'] or not data['axisLabel'] or not data['groupLabel']:
        bad('header: group / axis («%s») / accent line missing' % C.AXIS_LABEL)


def main():
    import collections
    check = '--check' in sys.argv
    out_dir = C.EXPORT_DIR
    os.makedirs(out_dir, exist_ok=True)
    problems = []
    counts = collections.Counter()
    schema = json.load(open(C.SCHEMA_PATH, encoding='utf-8')) if os.path.exists(C.SCHEMA_PATH) else None
    if schema is None:
        problems.append('tools/content/export.schema.json is missing')
    stale = 0
    issued = set()
    for cid in C.CHAPTER_IDS:
        data = parse_chapter(cid)
        issued |= H.current(cid, data)
        text = render(data)
        path = os.path.join(out_dir, cid + '.json')
        if check:
            old = open(path, encoding='utf-8').read() if os.path.exists(path) else ''
            if old != text:
                stale += 1
                problems.append('%s: _export/%s.json is stale — run tools/content/export_content.py --volume %s' % (cid, cid, C.VOLUME))
        else:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(text)
        if schema is not None:
            for err in validate(json.loads(text), schema, schema)[:5]:
                problems.append('%s: schema: %s' % (cid, err))
        coverage(cid, data, problems, counts)
    # hotspot ids: a registered id that is gone is an error; new ids are registered (hotspot_ids.py)
    registry = H.read_registry()
    problems += H.registry_problems(registry, issued, set(C.CHAPTER_IDS))
    reg_text = H.render_registry(registry | issued)
    reg_path = H.registry_path()
    if check:
        if not os.path.exists(reg_path) or open(reg_path, encoding='utf-8').read() != reg_text:
            problems.append('_export/%s is stale — run tools/content/export_content.py --volume %s'
                            % (H.REGISTRY_NAME, C.VOLUME))
    else:
        with open(reg_path, 'w', encoding='utf-8') as f:
            f.write(reg_text)
    counts['hotspot ids'] += len(issued)
    extra =sorted(f for f in os.listdir(out_dir) if f.endswith('.json') and f[:-5] not in C.GROUP)
    for f in extra:
        problems.append('_export/%s does not belong to any chapter' % f)
    for p in problems[:60]:
        print('EXPORT', p)
    if '--quiet' not in sys.argv:
        print('export_content: ' + '; '.join('%s %d' % (k, v) for k, v in counts.items()))
    print('export_content: %d chapters %s, %d problem(s)' % (len(C.CHAPTER_IDS), 'checked' if check else 'written', len(problems)))
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(C.run_volumes(main))
