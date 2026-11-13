"""The simple reading level («Просто / Докладно», docs/briefs/L-simple-level.md §3) — parser of the per-step
`- **Просто:**` block and of the builder part `[Сцена: …]` of a detailed misconception.

Block format (inside a step, after «Хибні уявлення», before «Перехід»; sub-fields at the first sub-indent, their
list items one level deeper, deeper lines continue the current item):

    - **Просто:**
      - **Назва:** <shorter title — optional>
      - **Текст:**
        - **[1]** <page 1>
      - **Слова:**
        - **<слово>** — <one-sentence explanation>
      - **Цікаво:**
        - <fact>
      - **Підказки:**
        - `<hotspot id>`: <plain sentence>
      - **Хибне уявлення:** «<myth>» → <explanation>
      - **Примітки:** <builder / reviewer guidance, never shown>

Imported by export_content.py (export + round-trip) and simple_check.py (doccheck group `simple`).
"""
import re

SIMPLE_LABEL = 'Просто'
SIMPLE_QUIZ_SECTION = 'Простий квіз'
SUB_KEYS = {'Назва': 'title', 'Текст': 'panel', 'Слова': 'words', 'Цікаво': 'facts', 'Підказки': 'hotspots',
            'Хибне уявлення': 'misconception', 'Примітки': 'notes'}
TOP_FIELD_RE = re.compile(r'^- \*\*')
ITEM_RE = re.compile(r'^(\s+)(?:[-*]|\d+\.)\s+(.*)$')
SUB_FIELD_RE = re.compile(r'^\*\*([^*]+?):\*\*\s?(.*)$')
PAGE_LABEL_RE = re.compile(r'^\*\*\[\d+\]\*\*\s*')
WORD_RE = re.compile(r'^\*\*([^*]+?)\*\*\s*(?:—|–|:)\s*(.*)$')
HOTSPOT_RE = re.compile(r'^`([^`]+)`\s*:\s*(.*)$')
SCENE_OPEN = '[Сцена:'


def squash(s):
    return re.sub(r'[ \t\r\n]+', ' ', s).strip()


def block_lines(lines, a, b):
    """(first, end) 0-based line range of the `- **Просто:**` field of the step lines a..b, or None."""
    for i in range(a + 1, b):
        if re.match(r'^- \*\*' + SIMPLE_LABEL + r':\*\*', lines[i]):
            j = i + 1
            while j < b and not TOP_FIELD_RE.match(lines[j]) and not lines[j].startswith('#') \
                    and lines[j].strip() != '---':
                j += 1
            return i, j
    return None


def sub_fields(lines, first, end, where):
    """[(key, inline text, [items], line)] of the block. Raises SystemExit on an unknown sub-field."""
    out, sub_indent, item_indent = [], None, None
    head = re.sub(r'^- \*\*' + SIMPLE_LABEL + r':\*\*', '', lines[first]).strip()
    if head:
        raise SystemExit('%s: text after «%s:» on line %d — put it in a sub-field' % (where, SIMPLE_LABEL, first + 1))
    for i in range(first + 1, end):
        line = lines[i]
        if not line.strip():
            continue
        m = ITEM_RE.match(line)
        ind = len(m.group(1)) if m else None
        if m and (sub_indent is None or ind <= sub_indent):
            sub_indent = ind
            f = SUB_FIELD_RE.match(m.group(2))
            if not f or f.group(1).strip() not in SUB_KEYS:
                raise SystemExit('%s: unknown «%s» sub-field on line %d: %s'
                                 % (where, SIMPLE_LABEL, i + 1, m.group(2)[:40]))
            out.append([SUB_KEYS[f.group(1).strip()], [f.group(2)], [], i + 1])
            item_indent = None
        elif not out:
            raise SystemExit('%s: line %d of «%s» is outside a sub-field' % (where, i + 1, SIMPLE_LABEL))
        elif m and (item_indent is None or ind <= item_indent):
            item_indent = ind
            out[-1][2].append([m.group(2)])
        elif out[-1][2]:
            out[-1][2][-1].append(line.strip())
        else:
            out[-1][1].append(line.strip())
    return [(k, squash(' '.join(inl)), [squash(' '.join(it)) for it in items], ln) for k, inl, items, ln in out]


def parse_simple(lines, a, b, where):
    """The step's simple layer as exported (`_export`), or None when the step has no `Просто` block.
    {title, panel[], words[{word, text}], facts[], hotspots[{id, text}], misconception {myth, correction} | None,
    notes}. Copy strings follow the conventions of the detailed fields (delimiting «…» stripped, quotes levelled)."""
    import export_content as X  # lazy: export_content imports this module
    rng = block_lines(lines, a, b)
    if rng is None:
        return None
    out = dict(title=None, panel=[], words=[], facts=[], hotspots=[], misconception=None, notes=None)
    seen = set()
    for key, inline, items, ln in sub_fields(lines, rng[0], rng[1], where):
        if key in seen:
            raise SystemExit('%s: «%s» sub-field repeated on line %d' % (where, SIMPLE_LABEL, ln))
        seen.add(key)
        chunks = ([inline] if inline else []) + items
        if key == 'title':
            out['title'] = X.unwrap(inline)[0] if inline else None
        elif key == 'panel':
            out['panel'] = X.parse_pages(dict(inline=inline, items=items))
        elif key == 'words':
            for c in chunks:
                m = WORD_RE.match(c)
                if not m:
                    raise SystemExit('%s: «Слова» item on line %d is not «**слово** — пояснення»' % (where, ln))
                out['words'].append(dict(word=m.group(1).strip(), text=X.delimited(m.group(2).strip())[0]))
        elif key == 'facts':
            out['facts'] = [X.delimited(c)[0] for c in chunks]
        elif key == 'hotspots':
            for c in chunks:
                m = HOTSPOT_RE.match(c)
                if not m:
                    raise SystemExit('%s: «Підказки» item on line %d is not «`id`: текст»' % (where, ln))
                out['hotspots'].append(dict(id=m.group(1).strip(), text=X.delimited(m.group(2).strip())[0]))
        elif key == 'misconception':
            ms = X.parse_misconceptions(dict(inline=squash(' '.join(chunks)), items=[]))
            if not ms or ms[0]['myth'] is None:
                raise SystemExit('%s: «Хибне уявлення» on line %d is not «міф» → пояснення' % (where, ln))
            out['misconception'] = dict(myth=ms[0]['myth'], correction=ms[0]['correction'])
        elif key == 'notes':
            out['notes'] = squash(' '.join(chunks)) or None
    return out


def doc_signature_text(lines, a, b):
    """The raw text of the step's `Просто` block without its labels (for the round-trip comparison)."""
    rng = block_lines(lines, a, b)
    if rng is None:
        return ''
    body = []
    for line in lines[rng[0] + 1:rng[1]]:
        m = ITEM_RE.match(line)
        t = m.group(2) if m else line
        t = re.sub(r'^\*\*(?:' + '|'.join(SUB_KEYS) + r'):\*\*', '', t.strip())
        body.append(PAGE_LABEL_RE.sub('', t.strip()))
    return ' '.join(body)


def export_signature_text(s):
    """Every exported string of a simple layer, in the order of doc_signature_text."""
    parts = [s['title'] or ''] + s['panel']
    parts += [w['word'] + ' ' + w['text'] for w in s['words']] + s['facts']
    parts += [h['id'] + ' ' + h['text'] for h in s['hotspots']]
    if s['misconception']:
        parts += [s['misconception']['myth'], s['misconception']['correction']]
    return ' '.join(parts + [s['notes'] or ''])


def split_scene(correction):
    """(learner part, scene) of a detailed misconception correction `… . [Сцена: …]`; scene None when absent.
    The `[Сцена: …]` part must close the item (a problem string is returned as third element otherwise)."""
    k = correction.find(SCENE_OPEN)
    if k < 0:
        return correction, None, None
    depth, end = 0, -1
    for i in range(k, len(correction)):
        depth += correction[i] == '['
        depth -= correction[i] == ']'
        if depth == 0:
            end = i
            break
    if end < 0:
        return correction, None, 'unclosed «%s …»' % SCENE_OPEN
    if correction[end + 1:].strip(' .;'):
        return correction, None, '«%s …]» must close the misconception' % SCENE_OPEN
    return correction[:k].strip(), correction[k + len(SCENE_OPEN):end].strip(), None
