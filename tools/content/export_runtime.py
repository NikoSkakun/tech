#!/usr/bin/env python3
"""Runtime content: the on-screen subset of every chapter export, shaped for `defineContent()` (`@/content`).

  docs/volumes/<volume>/chapters/_export/<id>.json  →  app/src/volumes/<volume>/content/generated/<id>.json            (content.ts imports it)
                                    app/src/volumes/<volume>/content/generated/<id>.manifest.json   (index.ts imports it)

A chapter's `content.ts` then is

    import raw from '@<volume>/content/generated/<id>.json';
    export default defineContent(raw, { labels: { … } });

Kept (on-screen copy, see docs/CONTENT_EXPORT.md): chapter `title`, `group`, `learningGoals`; per step
`id`, `title`, `panel` pages, `terms` (international / ukrainian / symbol / unit / definition), `formulas.items`,
`facts.items` (text, source), `hotspots` (name, international, ukrainian, text), `misconceptions` (myth,
correction — the HUD shows them); chapter `glossary`, `quiz`, `crossReferences`.
M3 additions: terms and glossary rows carry a display `name` (DECISIONS §54: the Ukrainian form, with the
international abbreviation in parentheses where it is kept) and the international form as `intl`; hotspots carry
the same display name as `title` (their `name` is the pair as written, which chapters still bind by), `intl` and
an `id` (explicit in the document, `{#id}` after the name — C7, tools/content/hotspot_ids.py); a fact written as a Markdown table also carries `table: {head,
rows[, note]}`; each step gets `labels` — the UI labels quoted «…» in its «Інтерактив» items. The manifest file
holds title, subtitle (= first step title), scale label, group, parent, order and step ids / titles / blurbs
(first sentence of the step's first page).
L1 additions (simple reading level, docs/briefs/L-simple-level.md §4): a step with a «Просто» block carries
`simple {title?, panel[], words[{word, text}]?, facts[]?, hotspots[{id, text}]?, misconception?}`; the chapter
carries `simpleQuiz[]` when it has a «Простий квіз». Misconception `scene` and simple `notes` are builder guidance.
Dropped (builder guidance or redundant): `see`, `interaction`, `transition`, `links`, `n`, `termsNote`,
`hotspotsNote`, hotspot `note` / `tail`, `facts.note`, `formulas.raw`, term `raw` and misconception `raw` (the
parsed fields carry the same text), `visualIdea`, `accentMood`, `notes`, `models`, `source`, labels of the
document header. Empty lists and null optional fields are omitted to keep chapter chunks lean.

Usage:
  export_runtime.py            regenerate all files
  export_runtime.py --check    exit 1 if a file is missing, stale or extra (doccheck runs this)
"""
import json
import os
import re
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import chapters as C  # noqa: E402



def pick(obj, required=(), optional=()):
    """Copy `required` keys as they are (null included) and `optional` keys only when they carry a value."""
    out = {k: obj.get(k) for k in required}
    for k in optional:
        v = obj.get(k)
        if v is not None and v != [] and v != '':
            out[k] = v
    return out


# ---------------------------------------------------------------- display names (DECISIONS §54)

ABBR_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9+/\-]{0,11}$")
PAREN_TAIL_RE = re.compile(r"^(.*\S)\s*\(([^()]+)\)$")
CYR_ABBR_RE = re.compile(r"^[А-ЯІЇЄҐ][А-ЯІЇЄҐA-Z0-9\-]{1,9}$")


def is_abbr(token):
    """An abbreviation: a short token with at least two capitals and no more lower-case than upper-case letters
    (BMS, MPPT, HVDC, USB-PD, DoD, GaN, I-V); ordinary words (Rotor, Wind) are not."""
    token = token.strip()
    if not ABBR_RE.match(token):
        return False
    upper = sum(ch.isupper() for ch in token)
    lower = sum(ch.islower() for ch in token)
    return upper >= 2 and lower <= upper


def abbreviation(intl):
    """The abbreviation an international form carries: `BMS`, `BMS (battery management system)` or
    `Battery management system (BMS)` → `BMS`; otherwise None."""
    if not intl:
        return None
    intl = intl.strip()
    if is_abbr(intl):
        return intl
    m = PAREN_TAIL_RE.match(intl)
    if m:
        head, inner = m.group(1).strip(), m.group(2).strip()
        if is_abbr(head):
            return head
        if is_abbr(inner):
            return inner
    return None


# international abbreviations with an established Ukrainian one (§54c): the Ukrainian abbreviation is shown instead
UKR_ABBR = {'EMF': 'ЕРС', 'RCD': 'ПЗВ', 'NPP': 'АЕС', 'TPP': 'ТЕС', 'HPP': 'ГЕС', 'PSPP': 'ГАЕС', 'PSH': 'ГАЕС',
            'WPP': 'ВЕС', 'SPP': 'СЕС', 'OHL': 'ЛЕП', 'VVER': 'ВВЕР', 'SC': 'КЗ'}


# names of laws are Ukrainian only (§54d)
NO_ABBR = {'KCL', 'KVL'}
CYR_TOKEN_RE = re.compile(r'(?<![А-Яа-яІіЇїЄєҐґ’\'])[А-ЯІЇЄҐ]{2,}(?![а-яіїєґ’\'])')


def display_name(intl, ukr):
    """What the app shows for a term / glossary row / hotspot (§54): the Ukrainian form, plus the international
    abbreviation in parentheses when there is one and the Ukrainian form carries neither it nor an abbreviation of
    its own («система керування батареєю (BMS)», but «вітрова електростанція (ВЕС)» stays as it is, and EMF
    becomes «електрорушійна сила (ЕРС)»)."""
    ukr = (ukr or '').strip()
    intl = (intl or '').strip()
    if not ukr:
        return intl
    abbr = abbreviation(intl)
    if not abbr or abbr in ukr:
        return ukr
    # an own Ukrainian abbreviation anywhere in the form («оператор системи розподілу (ОСР)», «СІП, …») wins
    if CYR_TOKEN_RE.search(ukr) or abbr.upper() in NO_ABBR:
        return ukr
    own = UKR_ABBR.get(abbr.upper())
    if own:
        return ukr if own in ukr else '%s (%s)' % (ukr, own)
    return '%s (%s)' % (ukr, abbr)


def named(obj, out):
    """Add `name` (display) and `intl` (secondary) to a picked term / glossary row / hotspot."""
    name = display_name(obj.get('international'), obj.get('ukrainian'))
    if name:
        out['name'] = name
    intl = (obj.get('international') or '').strip()
    if intl and intl != name and intl not in name:
        out['intl'] = intl
    return out


SEP_CELL_RE = re.compile(r'^:?-{3,}:?$')
QUOTE_RE = re.compile(r'«([^«»]{1,60})»')


def fact_table(text):
    """A «Цифри і факти» item written as a Markdown table (the export joins its lines with spaces) →
    {head, rows[, note]}; None when the text is not a table."""
    t = text.strip()
    if not t.startswith('|') or '---' not in t:
        return None
    tokens = t.split('|')
    i = 1
    while i < len(tokens) and not SEP_CELL_RE.match(tokens[i].strip()):
        i += 1
    if i >= len(tokens):
        return None
    # the separator row starts one boundary token after the header: header = tokens[1 : 1 + n]
    n = i - 2
    if n < 1 or any(not SEP_CELL_RE.match(c.strip()) for c in tokens[i:i + n]):
        return None
    head = [c.strip() for c in tokens[1:1 + n]]
    rows, k = [], i + n + 1
    while k + n <= len(tokens) - 1:
        cells = [c.strip() for c in tokens[k:k + n]]
        rows.append(cells)
        k += n + 1
    tail = '|'.join(tokens[k:]).strip() if k < len(tokens) else ''
    if not rows:
        return None
    out = {'head': head, 'rows': rows}
    if tail:
        out['note'] = tail
    return out


def runtime_fact(f):
    out = pick(f, ('text',), ('source',))
    table = fact_table(f.get('text') or '')
    if table:
        out['table'] = table
    return out


CAPTIONS_RE = re.compile(r'^\*\*Підписи:?\*\*:?')
# a «Підписи» item lists on-screen captions explicitly (C8): long warnings and plate texts are allowed there
CAPTION_QUOTE_RE = re.compile(r'«([^«»]{1,240})»')


def ui_labels(s):
    """UI labels the document quotes «…» in the step's «Інтерактив» items, in order, without duplicates.
    Quotes of ordinary items are taken up to 60 characters (longer quotes are prose); the item «Підписи» —
    always the last item of the field, so the indexes of the labels before it never shift — lists captions of
    any length."""
    seen = []
    for item in (s.get('interaction') or {}).get('items') or []:
        text = item.get('text') or ''
        rx = CAPTION_QUOTE_RE if CAPTIONS_RE.match(text) else QUOTE_RE
        for m in rx.finditer(text):
            label = m.group(1).strip()
            if label and label not in seen:
                seen.append(label)
    return seen


def runtime_term(t):
    return named(t, pick(t, ('international', 'ukrainian'), ('symbol', 'unit', 'definition')))


def runtime_hotspot(h):
    """`name` stays the pair as written (chapters bind cards by it); the display name (§54) is `title`."""
    out = pick(h, ('name', 'text'), ('international', 'ukrainian'))
    hid = h.get('id')  # explicit in the document (`{#id}`), never derived from the name (hotspot_ids.py)
    display = named(h, {})
    out['title'] = display.get('name') or h.get('name')
    if display.get('intl'):
        out['intl'] = display['intl']
    if hid:
        out = {'id': hid, **out}
    return out


def runtime_step(s):
    step = {'id': s['id'], 'title': s['title'], 'panel': list(s['panel'])}
    terms = [runtime_term(t) for t in s.get('terms') or []]
    if terms:
        step['terms'] = terms
    formulas = (s.get('formulas') or {}).get('items') or []
    if formulas:
        step['formulas'] = {'items': list(formulas)}
    facts = [runtime_fact(f) for f in (s.get('facts') or {}).get('items') or []]
    if facts:
        step['facts'] = {'items': facts}
    hotspots = [runtime_hotspot(h) for h in s.get('hotspots') or []]
    if hotspots:
        step['hotspots'] = hotspots
    myths = [pick(m, ('myth', 'correction')) for m in s.get('misconceptions') or []]
    if myths:
        step['misconceptions'] = myths
    labels = ui_labels(s)
    if labels:
        step['labels'] = labels
    if s.get('simple'):
        step['simple'] = runtime_simple(s['simple'])
    return step


def runtime_simple(x):
    """The simple reading level (docs/briefs/L-simple-level.md §4): empty parts and the builder `notes` dropped,
    hotspot texts as `[{id, text}]` (an id-keyed object would make TypeScript infer per-chapter literal key
    unions from the JSON that are not assignable to a record type)."""
    out = {}
    if x.get('title'):
        out['title'] = x['title']
    out['panel'] = list(x['panel'])
    if x['words']:
        out['words'] = [{'word': w['word'], 'text': w['text']} for w in x['words']]
    if x['facts']:
        out['facts'] = list(x['facts'])
    if x['hotspots']:
        out['hotspots'] = [{'id': h['id'], 'text': h['text']} for h in x['hotspots']]
    if x.get('misconception'):
        out['misconception'] = pick(x['misconception'], ('myth', 'correction'))
    return out


def runtime(doc):
    out = pick(doc, ('volume', 'id', 'title', 'group'), ('learningGoals',))
    out['steps'] = [runtime_step(s) for s in doc['steps']]
    out['glossary'] = [named(g, pick(g, ('international', 'ukrainian', 'definition'), ('symbol', 'unit')))
                       for g in doc.get('glossary') or []]
    out['quiz'] = [pick(q, ('question', 'options', 'correct'), ('explanation',)) for q in doc.get('quiz') or []]
    if doc.get('simpleQuiz'):
        out['simpleQuiz'] = [pick(q, ('question', 'options', 'correct'), ('explanation',)) for q in doc['simpleQuiz']]
    out['crossReferences'] = [pick(x, ('where', 'targets'), ('note',)) for x in doc.get('crossReferences') or []]
    return out


MARKUP_RE = re.compile(r'\*\*|(?<![\w])_|_(?![\w])|`|\{[a-z.]+:|\}')
SENTENCE_END_RE = re.compile(r'(?<=[.!?…])\s+(?=[«„(—–\-A-ZА-ЯІЇЄҐ0-9])')
BLURB_MAX = 140
BLURB_MIN = 12  # characters: shorter openers are time stamps or exclamations


def plain(text):
    """Mini-markup removed (`**term**`, `_emphasis_`, `` `formula` ``, `{token:text}`), whitespace collapsed."""
    return re.sub(r'\s+', ' ', MARKUP_RE.sub('', text)).strip()


def blurb(step):
    """One-line teaser of a step: the first sentence of its first panel page (two when the first is shorter than
    BLURB_MIN), at most ~140 characters."""
    pages = step.get('panel') or []
    if not pages:
        return ''
    parts = SENTENCE_END_RE.split(plain(pages[0]))
    first = parts[0]
    # a time stamp or a one-word opener («1831 рік.») says nothing on its own: take the next sentence too
    if len(first) < BLURB_MIN and len(parts) > 1:
        first = first + ' ' + parts[1]
    if len(first) <= BLURB_MAX:
        return first
    cut = first[:BLURB_MAX].rsplit(' ', 1)[0].rstrip(',;:—– ')
    return cut + '…'


def manifest(doc):
    """Tiny eager data for the chapter manifest (`index.ts`), so it never imports the whole content file."""
    steps = doc['steps']
    return {
        'volume': doc['volume'],
        'id': doc['id'],
        'title': doc['title'],
        # the documents have no subtitle: the first step's title is the default teaser (override in index.ts)
        'subtitle': steps[0]['title'] if steps else '',
        'axisLabel': doc.get('axisLabel') or '',
        'group': doc['group'],
        'parent': doc.get('parent'),
        'order': doc.get('order'),
        'steps': [{'id': st['id'], 'title': st['title'], 'blurb': blurb(st)} for st in steps],
    }


def render(data):
    return json.dumps(data, ensure_ascii=False, indent=1) + '\n'


def main():
    check = '--check' in sys.argv
    out_dir = C.GENERATED_DIR
    expected = {}
    for cid in C.CHAPTER_IDS:
        with open(os.path.join(C.EXPORT_DIR, cid + '.json'), encoding='utf-8') as f:
            doc = json.load(f)
        expected[cid + '.json'] = render(runtime(doc))
        expected[cid + '.manifest.json'] = render(manifest(doc))
    problems = []
    on_disk = set(os.listdir(out_dir)) if os.path.isdir(out_dir) else set()
    for name in sorted(on_disk - set(expected)):
        if name.endswith('.json'):
            problems.append('extra file %s (no such chapter)' % name)
    size = 0
    written = 0
    for name, text in expected.items():
        path = os.path.join(out_dir, name)
        size += len(text.encode('utf-8'))
        current = open(path, encoding='utf-8').read() if os.path.exists(path) else None
        if current == text:
            continue
        if check:
            problems.append('%s %s' % ('stale' if current is not None else 'missing', name))
        else:
            os.makedirs(out_dir, exist_ok=True)
            with open(path, 'w', encoding='utf-8') as f:
                f.write(text)
            written += 1
    for p in problems:
        print('  ' + p)
    if check and problems:
        print('runtime content: %d problem(s) — run tools/content/export_runtime.py --volume %s' % (len(problems), C.VOLUME))
        return 1
    print('runtime content: %d chapters (+ manifests) up to date in %s (%d kB%s)'
          % (len(expected) // 2, C.rel(out_dir), round(size / 1024), ', %d written' % written if written else ''))
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(C.run_volumes(main))
