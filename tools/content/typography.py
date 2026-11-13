#!/usr/bin/env python3
"""Typography normalisation of the chapter design documents (DECISIONS §18, §23, §32). Idempotent.

Rules
  A. Everywhere outside fenced code blocks:
     1. apostrophe inside a word: ' ʼ ` ´ between letters → ’ (U+2019)  (Ukrainian «з’єднання», English «Ohm’s»);
     2. micro sign µ (U+00B5) → Greek μ (U+03BC);
     3. three dots → …; spaced hyphen between words → em dash; hyphen-minus before a number after a space/bracket → −;
     4. straight "…" and English “…” double quotes → «…» (or „…“ when nested).
  B. In on-screen copy only — every section except «Модель симуляції» and «Примітки щодо фактів»
     (the coder-facing specification stays grep-friendly with plain spaces):
     5. non-breaking space (U+00A0) between a number and its unit / % / ° / грн / хв / млн …, also inside inline
        formulas (`U = 230 V`);
     6. non-breaking space in thousands groups (27 000, 1 000 000);
     7. nested quotes: «… „inner“ …» — applied literally, also inside the «…» that delimit a panel page or a
        hotspot text (a builder that strips those delimiters promotes „…“ back to «…»).
  C. In «Модель симуляції» and «Примітки щодо фактів»: U+00A0 → plain space (uniform across documents).

Never touched: fenced code blocks; code spans without a space (step ids, `chapter/step` references, palette tokens,
identifiers); Markdown structure (headings, table pipes and separator rows, list markers).

Usage
  typography.py [--write] [--verbose] [docs/volumes/<volume>/chapters/<id>.md …]     default: all chapter documents + _shared-house.md
  typography.py --check                                             exit 1 if any document would change
"""
import os
import re
import sys

sys.dont_write_bytecode = True  # keep the worktree clean (no __pycache__)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import chapters as C  # noqa: E402

NBSP = ' '
CYR = 'А-Яа-яіїєґІЇЄҐ'
LET = 'A-Za-z' + CYR
NUM = '0-9⁰¹²³⁴⁵⁶⁷⁸⁹½'
OFFSCREEN = ('Модель симуляції', 'Примітки щодо фактів')

# SI symbols with the prefixes that actually occur (an explicit list: «2 PV», «3 EV», «2 GT», «тип 2 B10» are not units)
SI = (r'[μmkMGT]?Wh|[kMG]?Wp|[μmkMGT]?W|[kMG]?VAh|[kMG]?VA|[kMG]?varh|[kMG]?var|[μmkM]?V|[mk]?Ah|[μmk]?A|[mkMG]?Hz|'
      r'[mkMGTE]?J|[hkMG]?Pa|[kM]?N|[μmkMG]?Ω|[pnμm]?F|[nμm]?H|[nμm]?T|m?Wb|[μm]?S|[nμmk]?C|m?K|[mkMGT]?eV|'
      r'[nμmk]?g|[fpnμmcdk]?m|[fpnμm]?s|m?l|m?L|[kMG]?t|lm|lx|cd|[μm]?mol|[kMGT]?Bq|[μm]?Sv|Gy|m?bar|dB|Nm³')
UNIT = (r'(?:%|‰|°C|°F|°|' + SI + r'|min|h|ha|rad|rpm|ppm|pp|p\.u\.|imp|год|хв|грн|коп|'
        r'діб|доби|доба|млн|млрд|трлн|тис\.|р\.|рр\.|п\. ?п\.)')
# the unit token must not run into further letters (so «5 min» matches, «5 minutes» and «3 LED» do not);
# `_` (MW_el), digits/superscripts, «/», «·» and punctuation may follow
NUM_UNIT = re.compile(r'(?<=[' + NUM + r']) (?=' + UNIT + r'(?![' + LET + r']))')
THOUSANDS = re.compile(r'(?<![\w,.' + NBSP + r'])(\d{1,3}(?:[ ' + NBSP + r']\d{3})+)(?![\d])')
APOS = re.compile(r"(?<=[" + LET + r"])['ʼ`´](?=[" + LET + r"])")
CODE_APOS = re.compile(r"(?<=[" + CYR + r"])['ʼ´](?=[" + CYR + r"])|(?<=[A-Za-z])'(?=s\b)")
SPAN_SPLIT = re.compile(r'(`[^`\n]*`)')
ITEM_START = re.compile(r'^\s*(?:[-*+]|\d+\.)\s')


def fix_thousands(s):
    def rep(m):
        return m.group(1).replace(' ', NBSP)
    return THOUSANDS.sub(rep, s)


def text_rules(seg, onscreen):
    """Rules for prose (outside code spans)."""
    seg = seg.replace('µ', 'μ')
    seg = APOS.sub('’', seg)
    seg = seg.replace('...', '…')
    seg = re.sub(r'(?<=[^\s|]) - (?=[^\s|-])', ' — ', seg)
    seg = re.sub(r'(?<=[\s(«„=≈<>])-(?=\d)', '−', seg)
    if onscreen:
        seg = NUM_UNIT.sub(NBSP, seg)
        seg = fix_thousands(seg)
    else:
        seg = seg.replace(NBSP, ' ')
    return seg


def code_rules(span, onscreen):
    """Rules for an inline code span (an on-screen formula or term line). Spans without spaces are never touched."""
    if ' ' not in span and NBSP not in span:
        return span
    inner = span[1:-1].replace('µ', 'μ')
    inner = CODE_APOS.sub('’', inner)
    if onscreen:
        inner = NUM_UNIT.sub(NBSP, inner)
        inner = fix_thousands(inner)
    else:
        inner = inner.replace(NBSP, ' ')
    return '`' + inner + '`'


def is_structural(line):
    s = line.strip()
    return s.startswith('#') or bool(re.fullmatch(r'\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?', s)) or s == '---'


def line_rules(line, onscreen):
    if is_structural(line) and not line.lstrip().startswith('#'):
        return line
    parts = SPAN_SPLIT.split(line)
    for i, p in enumerate(parts):
        parts[i] = code_rules(p, onscreen) if i % 2 else text_rules(p, onscreen)
    return ''.join(parts)


def blocks(lines, lo, hi):
    """Yield (start, end) of text blocks: a list item with its continuation lines, a paragraph, or a single table row."""
    i = lo
    while i < hi:
        line = lines[i]
        if not line.strip() or line.lstrip().startswith('|') or line.startswith('#'):
            yield i, i + 1
            i += 1
            continue
        j = i + 1
        while j < hi and lines[j].strip() and not ITEM_START.match(lines[j]) and not lines[j].lstrip().startswith('|') \
                and not lines[j].startswith('#') and not C.FENCE_RE.match(lines[j]):
            j += 1
        yield i, j
        i = j


def fix_quotes(block):
    """Straight quotes → guillemets; quotes nested inside «…» → „…“ (DECISIONS §18, applied literally: the «…» that
    delimit a panel page or a hotspot text count as the outer level; a builder that strips those delimiters promotes
    „…“ back to «…»). Returns the block unchanged if its quotes are unbalanced."""
    spans = []

    def mask(m):
        spans.append(m.group(0))
        return '\x00%d\x00' % (len(spans) - 1)
    s = SPAN_SPLIT.sub(mask, block)
    out, stack, changed = [], [], False   # stack entries: '«' kept, 'N' converted to „…“, '„' already nested, '"'
    for ch in s:
        if ch == '«':
            if stack:
                stack.append('N')
                out.append('„')
                changed = True
            else:
                stack.append('«')
                out.append(ch)
        elif ch == '»':
            if not stack or stack[-1] not in ('«', 'N'):
                return block, False
            if stack.pop() == 'N':
                out.append('“')
                changed = True
            else:
                out.append(ch)
        elif ch == '„':
            stack.append('„')
            out.append(ch)
        elif ch == '“':
            if stack and stack[-1] == '„':
                stack.pop()
                out.append(ch)
            else:                           # English-style opening quote “…”
                out.append('„' if stack else '«')
                stack.append('E')
                changed = True
        elif ch == '”':
            if not stack or stack[-1] != 'E':
                return block, False
            stack.pop()
            out.append('“' if stack else '»')
            changed = True
        elif ch == '"':
            if stack and stack[-1] == '"':
                stack.pop()
                out.append('“' if stack else '»')
            else:
                out.append('„' if stack else '«')
                stack.append('"')
            changed = True
        else:
            out.append(ch)
    if stack:
        return block, False
    res = re.sub(r'\x00(\d+)\x00', lambda m: spans[int(m.group(1))], ''.join(out))
    return res, changed


def process(text, stats=None):
    lines = text.split('\n')
    n = len(lines)
    fenced = [False] * n
    f = False
    for i, line in enumerate(lines):
        if C.FENCE_RE.match(line):
            fenced[i] = True
            f = not f
        else:
            fenced[i] = f
    onscreen = [True] * n
    for title, a, b in C.split_sections(text):
        if title.startswith(OFFSCREEN):
            for i in range(a, b):
                onscreen[i] = False
    for i in range(n):
        if not fenced[i]:
            new = line_rules(lines[i], onscreen[i])
            if stats is not None and new != lines[i]:
                stats['lines'] = stats.get('lines', 0) + 1
            lines[i] = new
    # nested quotes, block-wise, on-screen sections only
    i = 0
    while i < n:
        if fenced[i]:
            i += 1
            continue
        j = i
        while j < n and not fenced[j] and onscreen[j] == onscreen[i]:
            j += 1
        if onscreen[i]:
            for a, b in list(blocks(lines, i, j)):
                block = '\n'.join(lines[a:b])
                if '«' in block or '"' in block or '“' in block:
                    new, changed = fix_quotes(block)
                    if changed and new != block:
                        lines[a:b] = new.split('\n')
                        if stats is not None:
                            stats['quotes'] = stats.get('quotes', 0) + 1
                            stats.setdefault('quote_samples', []).append(new[:160].replace('\n', ' '))
                    elif not changed and new == block and stats is not None:
                        # report unbalanced quotes once (for manual review)
                        if block.count('«') != block.count('»'):
                            stats.setdefault('unbalanced', []).append('%d: %s' % (a + 1, block[:110].replace('\n', ' ')))
        i = j
    return '\n'.join(lines)


def targets(argv):
    files = [a for a in argv if not a.startswith('--')]
    if files:
        return [os.path.abspath(f) for f in files]
    return [C.chapter_path(c) for c in C.CHAPTER_IDS + C.EXTRA_DOCS]


def main():
    write = '--write' in sys.argv
    check = '--check' in sys.argv
    verbose = '--verbose' in sys.argv
    dirty = 0
    for path in targets(sys.argv[1:]):
        with open(path, encoding='utf-8') as fh:
            src = fh.read()
        stats = {}
        dst = process(src, stats)
        if process(dst) != dst:
            print('typography: NOT IDEMPOTENT on', os.path.basename(path))
            return 2
        if dst != src:
            dirty += 1
            if not check or verbose:
                print('%-22s lines changed: %-4d nested-quote blocks: %d' % (os.path.basename(path), stats.get('lines', 0),
                                                                             stats.get('quotes', 0)))
            if verbose:
                for smp in stats.get('quote_samples', []):
                    print('     Q', smp)
            if write:
                with open(path, 'w', encoding='utf-8') as fh:
                    fh.write(dst)
        if verbose:
            for u in stats.get('unbalanced', []):
                print('     UNBALANCED', os.path.basename(path), u)
    if check:
        print('typography: %d document(s) need normalisation' % dirty if dirty else 'typography: all documents are normalised')
        return 1 if dirty else 0
    print('typography: %d document(s) %s' % (dirty, 'rewritten' if write else 'would change (use --write)'))
    return 0


if __name__ == '__main__':
    sys.exit(C.run_volumes(main))
