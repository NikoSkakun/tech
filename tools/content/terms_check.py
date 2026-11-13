#!/usr/bin/env python3
"""Term rule check (DECISIONS §54–§56) on the on-screen fields of the content export.

Reads docs/volumes/<volume>/chapters/_export/<id>.json (on-screen fields per docs/CONTENT_EXPORT.md) and fails on
  1. pair      an emphasised «English — українська» pair (`**Wind turbine — вітрова турбіна**`, `**Betz limit** —
               межа Беца`) — the withdrawn "international first" order (§54 a);
  2. latin     a Latin-script word that is not in the allowlist tools/content/terms_allowlist.tsv (kept
               abbreviations, proper names, device markings) — text inside `code spans` (symbols, units,
               formulas), SI/unit symbols after a number and single letters used as symbols are exempt;
  3. intro     a kept abbreviation (allowlist kind `abbr`) used in a chapter before its Ukrainian explanation:
               its first on-screen mention in the chapter (reading order: chapter title, goals, then step by
               step — title, panel pages, terms, facts, hotspots, misconceptions, labels — then quiz and
               glossary) must sit in parentheses right after the Ukrainian explanation the allowlist gives,
               «українське пояснення (ABBR)» (§54 b–c).

Usage
  terms_check.py                 check all chapters, exit 1 on any problem
  terms_check.py <id> …          check only these chapters
  terms_check.py --list-latin    print every Latin word on screen with its count (for curating the allowlist)
  terms_check.py --abbr-table    print the kept abbreviations: explanation used, chapters (Markdown table)
"""
import json
import os
import re
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import chapters as C  # noqa: E402

CYR = 'А-Яа-яіїєґІЇЄҐ’'


def onscreen(d):
    """[(path, text, kind)] — on-screen strings of one export in reading order (step by step, quiz and glossary last).

    kind: 'title' (chapter / step titles), 'goal', 'panel', 'copy' (definitions, facts, hotspot texts,
    misconceptions, quiz, glossary definitions), 'name' (Ukrainian names of terms, hotspots and glossary rows — the
    app adds «(ABBR)» itself, §54 g), 'label' (UI control labels quoted in «Інтерактив»), 'symbol' («Позначення»)."""
    out = [('title', d['title'], 'title')]
    out += [('goal[%d]' % i, g, 'goal') for i, g in enumerate(d.get('learningGoals') or [])]
    for s in d['steps']:
        sid = s['id']
        out.append(('%s.title' % sid, s['title'], 'title'))
        out += [('%s.panel[%d]' % (sid, i), p, 'panel') for i, p in enumerate(s.get('panel') or [])]
        for t in s.get('terms') or []:
            name = t.get('ukrainian') or t.get('international')
            out.append(('%s.term «%s»' % (sid, name), t.get('ukrainian') or '', 'name'))
            out.append(('%s.term «%s» definition' % (sid, name), t.get('definition') or '', 'copy'))
            out.append(('%s.term «%s» symbol' % (sid, name), t.get('symbol') or '', 'symbol'))
        for f in (s.get('facts') or {}).get('items') or []:
            out.append(('%s.fact' % sid, f['text'], 'copy'))
        for h in s.get('hotspots') or []:
            name = h.get('ukrainian') or h.get('name')
            out.append(('%s.hotspot «%s»' % (sid, name), h.get('ukrainian') or '', 'name'))
            out.append(('%s.hotspot «%s» text' % (sid, name), h.get('text') or '', 'copy'))
        for m in s.get('misconceptions') or []:
            out.append(('%s.misconception' % sid, m.get('myth') or '', 'copy'))
            out.append(('%s.misconception correction' % sid, m.get('correction') or '', 'copy'))
        for it in (s.get('interaction') or {}).get('items') or []:
            for c in it.get('controls') or []:
                out.append(('%s.control' % sid, c.get('label') or '', 'label'))
    for i, q in enumerate(d.get('quiz') or []):
        out.append(('quiz[%d]' % i, q['question'], 'copy'))
        out += [('quiz[%d].option' % i, o, 'copy') for o in q['options']]
        out.append(('quiz[%d].explanation' % i, q.get('explanation') or '', 'copy'))
    for g in d.get('glossary') or []:
        out.append(('glossary «%s»' % g['ukrainian'], g['ukrainian'], 'name'))
        out.append(('glossary «%s» definition' % g['ukrainian'], g.get('definition') or '', 'copy'))
        out.append(('glossary «%s» symbol' % g['ukrainian'], g.get('symbol') or '', 'symbol'))
    return [x for x in out if x[1]]


def onscreen_simple(d):
    """[(path, text, kind)] of the simple reading layer (docs/briefs/L-simple-level.md) in reading order; [] when the
    chapter has none. Steps without a simple block show their detailed copy (already in onscreen())."""
    out = []
    for s in d['steps']:
        x = s.get('simple')
        if not x:
            continue
        sid = s['id'] + '.simple'
        out.append((sid + '.title', x.get('title') or '', 'title'))
        out += [('%s.panel[%d]' % (sid, i), p, 'panel') for i, p in enumerate(x['panel'])]
        for w in x['words']:
            out.append(('%s.word «%s»' % (sid, w['word']), w['word'], 'name'))
            out.append(('%s.word «%s» text' % (sid, w['word']), w['text'], 'copy'))
        out += [('%s.fact' % sid, f, 'copy') for f in x['facts']]
        out += [('%s.hotspot `%s`' % (sid, h['id']), h['text'], 'copy') for h in x['hotspots']]
        if x.get('misconception'):
            out.append((sid + '.misconception', x['misconception']['myth'], 'copy'))
            out.append((sid + '.misconception correction', x['misconception']['correction'], 'copy'))
    for i, q in enumerate(d.get('simpleQuiz') or []):
        out.append(('simpleQuiz[%d]' % i, q['question'], 'copy'))
        out += [('simpleQuiz[%d].option' % i, o, 'copy') for o in q['options']]
        out.append(('simpleQuiz[%d].explanation' % i, q.get('explanation') or '', 'copy'))
    return [x for x in out if x[1]]


def load(cid):
    with open(os.path.join(C.EXPORT_DIR, cid + '.json'), encoding='utf-8') as f:
        return json.load(f)


# ---------------------------------------------------------------- Latin words
CODE_RE = re.compile(r'`[^`]*`')
# a Latin «word»: letters/digits with inner . - / + & (USB-PD, TN-C-S, p.u., IEC 60364, P&O); sub/superscripts glue on
WORD_RE = re.compile(r'[A-Za-zÀ-ÖØ-öø-ɏ][A-Za-z0-9À-ÖØ-öø-ɏ]*(?:[-+&/.][A-Za-z0-9À-ÖØ-öø-ɏ]+)*[₀-₉ₓ⁰-⁹⁻⁺¹²³]*')
FORMULA_CHARS = re.compile(r'[₀-₉ₓ⁰⁴-⁹⁻⁺_]')  # chemical formulas, indexed symbols (CO₂, GWP₁₀₀, NOₓ)
ROMAN_RE = re.compile(r'[IVX]+')
# parts of compound units besides UNITS: g CO₂-eq/kWh, MWd/kgU, mg/Nm³, imp/kWh, ng TEQ/m³, MeV/c²
UNIT_PARTS = {'eq', 'kgU', 'MWd', 'Nm', 'imp', 'TEQ', 'c', 'kAh', 'EJ', 'atm', 'ft', 'ha', 'fm', 'nC'}
# SI and customary unit symbols, kept international (DECISIONS §54 f); exempt wherever they stand
UNITS = set("""V mV kV MV A mA kA μA W mW kW MW GW TW Wh kWh MWh GWh TWh mAh Ah Hz kHz MHz GHz Ω kΩ MΩ mΩ J kJ MJ GJ
eV keV MeV GeV TeV C F μF mF nF pF H mH μH T mT μT Wb Pa kPa MPa GPa bar K s ms μs ns min h m mm cm km μm nm pm
kg g mg t Mt Gt l L ml var kvar Mvar Gvar VA kVA MVA GVA kWp MWp GWp Wp lm lx dB rpm mol ppm ppb Bq Sv mSv μSv Gy
cd sr rad p.u. p.u mHz kvarh ng""".split())


def latin_words(text):
    """[(word, start)] — Latin words outside code spans that are not units, single-letter symbols or formulas."""
    text = CODE_RE.sub(lambda m: ' ' * len(m.group(0)), text)
    out = []
    for m in WORD_RE.finditer(text):
        w = m.group(0).rstrip('.')
        if m.start() and re.match(r'[A-Za-z0-9_À-ÖØ-öø-ɏ]', text[m.start() - 1]):
            continue
        if w in UNITS or len(w.rstrip('¹²³')) == 1 or FORMULA_CHARS.search(w) or ROMAN_RE.fullmatch(w):
            continue
        parts = [p.rstrip('¹²³') for p in re.split(r'[/·]', w)]
        if all(p in UNITS or p in UNIT_PARTS or re.fullmatch(r'\d*', p) for p in parts):
            continue
        if re.fullmatch(r'[A-Za-zØ]\d+', w):  # P91, C16, B10: grades, breaker ratings, coordinates
            continue
        out.append((w, m.start()))
    return out


def inventory(ids):
    """{word: {chapter: count}} over on-screen strings (symbol cells excluded: they are symbols by definition)."""
    inv = {}
    for cid in ids:
        for _, text, kind in onscreen(load(cid)) + onscreen_simple(load(cid)):
            if kind == 'symbol':
                continue
            for w, _ in latin_words(text):
                inv.setdefault(w, {}).setdefault(cid, 0)
                inv[w][cid] += 1
    return inv


# ---------------------------------------------------------------- allowlist
KINDS = {'abbr', 'mark', 'name', 'symbol'}


def load_allowlist(paths=None):
    """{word: (kind, [explanation alternatives], reason)} from the TSV `word<TAB>kind<TAB>explanation<TAB>reason`.

    Default: the global list (tools/content/terms_allowlist.tsv) plus the current volume's optional additions
    (docs/volumes/<volume>/terms_allowlist.tsv). A word may be listed only once across both."""
    if paths is None:
        paths = [C.GLOBAL_ALLOWLIST] + ([C.VOLUME_ALLOWLIST] if os.path.exists(C.VOLUME_ALLOWLIST) else [])
    elif isinstance(paths, str):
        paths = [paths]
    out, problems = {}, []
    for path in paths:
        with open(path, encoding='utf-8') as f:
            _read_allowlist(f, C.rel(path) if len(paths) > 1 else 'allowlist', out, problems)
    return out, problems


def _read_allowlist(f, name, out, problems):
    for n, line in enumerate(f, 1):
        if not line.strip() or line.startswith('#'):
            continue
        cells = line.rstrip('\n').split('\t')
        if len(cells) != 4 or cells[1] not in KINDS or not cells[3].strip():
            problems.append('%s:%d: expected word, kind (%s), explanation, reason' % (name, n, '/'.join(sorted(KINDS))))
            continue
        word, kind, expl, reason = cells
        if word in out:
            problems.append('%s:%d: duplicate entry %s' % (name, n, word))
        if kind == 'abbr' and not expl.strip():
            problems.append('%s:%d: abbreviation %s has no Ukrainian explanation' % (name, n, word))
        out[word] = (kind, [e.strip() for e in expl.split('|') if e.strip() and e.strip() != '—'], reason)


def parts_of(word):
    """Ways to read a compound token: itself, its «/» parts, its «-» parts (TOPCon/HJT, Si-IGBT, V2H/V2G)."""
    yield [word]
    if '/' in word:
        yield word.split('/')
    if '-' in word:
        yield re.split(r'[-/]', word)


def allowed(word, allow):
    def ok(p):
        return not p or p in allow or p in UNITS or len(p) == 1 or re.fullmatch(r'\d+|[A-Za-z]?\d+', p) \
            or ROMAN_RE.fullmatch(p)
    return any(all(ok(p) for p in ps) for ps in parts_of(word))


def mentions(word, abbr):
    return any(abbr in ps for ps in parts_of(word))


# ---------------------------------------------------------------- checks
LETTERS = 'A-Za-z' + CYR
PAIR_RES = [
    re.compile(r'\*\*([A-Za-z][A-Za-z0-9 ’\'()/.-]*?)\*\*\s*[—–]\s*\**[' + CYR + ']'),  # **Betz limit** — межа
    re.compile(r'\*\*([A-Za-z][A-Za-z0-9 ’\'()/.-]*?)\s+[—–]\s+[' + CYR + r'][^*]*\*\*'),  # **Wind turbine — вітрова**
    re.compile(r'^([A-Z][A-Za-z0-9 ’\'()/.-]*?)\s+[—–]\s+[' + CYR + ']'),  # Wind turbine — вітрова (string start)
]


def strip_markup(s):
    return re.sub(r'[*_]', '', s)


def stems(s):
    """Comparison keys of the words of an explanation: first three letters, lower case (Ukrainian declension
    changes the fourth letter often enough: «рівень» / «рівня»)."""
    return [w[:3].lower() for w in re.findall('[' + LETTERS + ']+', s) if len(w) >= 3]


def explanation_before(text, pos):
    """(ok, explanation shown) for an abbreviation at `pos`: it must sit inside «( … )» right after Cyrillic text."""
    before = text[:pos]
    i = before.rfind('(')
    if i < 0 or ')' in before[i:]:
        return False, ''
    head = strip_markup(CODE_RE.sub(' ', before[:i])).rstrip()
    inside = strip_markup(before[i + 1:]).strip(' ;—–')
    if not re.search('[' + CYR + '»]', head[-12:]) and not re.search('[' + CYR + ']{3}', inside):
        return False, ''
    clause = re.split(r'[.;:!?«(—–]\s', head)[-1]
    words = clause.split()[-6:]
    return True, ' '.join(words) + (' (' + inside + ' …)' if inside else '')


def stems_in_order(want, window):
    keys, k = stems(window), 0
    for s in want:
        while k < len(keys) and keys[k] != s:
            k += 1
        if k == len(keys):
            return False
        k += 1
    return True


def check_chapter(cid, allow, problems, table, strings=None):
    """`strings`: the on-screen strings of one reading layer (default: the detailed layer, onscreen()); the first
    mention of an abbreviation is looked for within that layer, since a reader sees only one of them."""
    seen = set()
    for path, text, kind in (onscreen(load(cid)) if strings is None else strings):
        if kind == 'symbol':
            continue
        bare = CODE_RE.sub(lambda m: ' ' * len(m.group(0)), text)
        for rx in PAIR_RES:
            for m in rx.finditer(bare):
                ws = re.findall(r'[A-Za-z][A-Za-z0-9-]*', m.group(1))
                # symbols in bold before a dash («**Q** — витрата», «**U-235** — …») are fine; English words are not
                if any(len(w) > 1 and (w[0].islower() and w not in UNITS or not allowed(w, allow)) for w in ws):
                    problems.append('pair   %s: %s: «%s»' % (cid, path, m.group(0)[:60]))
        for w, pos in latin_words(text):
            if not allowed(w, allow):
                problems.append('latin  %s: %s: «%s» is not in the allowlist' % (cid, path, w))
            if kind not in ('goal', 'panel', 'copy'):
                continue
            # a whole token listed as a mark or symbol (DC/AC ratio, CCS/ISO, true-RMS) is not a mention of its parts
            cand = [w] if w in allow else sorted(set(sum(parts_of(w), [])))
            # «тип AC», «типи: **AC** — …» name a device type printed on the case (ПЗВ типу AC), not the abbreviation
            if re.search(r'тип\w*:?\s*\**$', text[max(0, pos - 15):pos], re.I):
                continue
            for abbr in [a for a in cand if allow.get(a, ('',))[0] == 'abbr']:
                if abbr in seen:
                    continue
                seen.add(abbr)
                ok, shown = explanation_before(text, pos)
                want = allow[abbr][1]
                if ok and want:
                    i = text[:pos].rfind('(')
                    window = strip_markup(text[max(0, i - 120):pos])
                    hit = [e for e in want if stems_in_order(stems(e), window)]
                    ok = bool(hit)
                    if ok:  # show the explanation from its first matching word on («… трекер точки … (MPPT)»)
                        first = stems(hit[0])[0]
                        ws = re.findall(r'\S+', window)
                        k = max([j for j, x in enumerate(ws) if first in stems(x)] or [0])
                        shown = ' '.join(ws[k:]).rstrip(' (') + ' (…)'
                table.setdefault(abbr, []).append((cid, shown if ok else '— (no explanation: %s)' % path))
                if not ok:
                    problems.append('intro  %s: %s: first mention of %s needs «%s (%s)»' % (
                        cid, path, abbr, want[0] if want else 'українське пояснення', abbr))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    ids = args or C.CHAPTER_IDS
    allow, problems = load_allowlist()
    if '--list-latin' in sys.argv:
        inv = inventory(ids)
        for w in sorted(inv, key=lambda x: (-sum(inv[x].values()), x)):
            if not allowed(w, allow):
                print('%s\t%d\t%s' % (w, sum(inv[w].values()), ','.join(sorted(inv[w]))))
        return 0
    table = {}
    for cid in ids:
        check_chapter(cid, allow, problems, table)
        check_chapter(cid, allow, problems, table, onscreen_simple(load(cid)))
    if '--abbr-table' in sys.argv:
        print('| Скорочення | Українське пояснення в документах (перша згадка в розділі) | Розділи |')
        print('|---|---|---|')
        for abbr in sorted(table, key=str.lower):
            forms, key = {}, {}  # forms that differ only by case endings count as one
            for cid, shown in table[abbr]:
                k = ' '.join(stems(shown))
                key.setdefault(k, shown)
                forms.setdefault(key[k], []).append(cid)
            expl = '<br>'.join('«%s» — %s' % (f, ', '.join('`%s`' % c for c in cs)) if len(forms) > 1 else '«%s»' % f
                               for f, cs in forms.items())
            print('| %s | %s | %s |' % (abbr, expl, ', '.join('`%s`' % c for c, _ in table[abbr])))
        return 0
    unused = [w for w in allow if not any(mentions(x, w) for x in inventory(ids))] if not args else []
    for p in problems:
        print(p)
    for w in unused:
        print('note   allowlist entry %s is not used on screen any more' % w)
    print('terms_check: %d chapters, %d allowlisted words (%d kept abbreviations), %d problem(s)'
          % (len(ids), len(allow), sum(1 for v in allow.values() if v[0] == 'abbr'), len(problems)))
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(C.run_volumes(main))
