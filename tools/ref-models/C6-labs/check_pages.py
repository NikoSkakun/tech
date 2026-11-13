"""Check panel page lengths (<= 450 chars) in a chapter doc. Pages are numbered items «…» under '**Текст панелі:**'."""
import re
import sys

path = sys.argv[1]
text = open(path, encoding='utf-8').read()
steps = re.split(r'\n### ', text)
bad = 0
for st in steps[1:]:
    title = st.split('\n', 1)[0]
    m = re.search(r'\*\*Текст панелі:\*\*(.*?)\n- \*\*', st, re.S)
    if not m:
        print('NO PANEL TEXT:', title)
        continue
    pages = re.findall(r'«(.*?)»\s*(?=\n\s*\d\.|\Z)', m.group(1).strip() + '\n', re.S)
    for i, p in enumerate(pages, 1):
        clean = re.sub(r'\s+', ' ', p.replace('**', '').replace('`', '').replace('_', ''))
        n = len(clean)
        flag = '  <-- TOO LONG' if n > 450 else ''
        if n > 450:
            bad += 1
        print('%-40s p%d %4d%s' % (title[:40], i, n, flag))
print('pages over limit:', bad)
