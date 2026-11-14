"""Hotspot ids: explicit, stable, unique within a step (docs/CONTENT_EXPORT.md «Hotspot ids», brief C7-hotspot-ids).

Every hotspot of a chapter document carries its id after the name: `- **Кільце** {#ring}: «…»`. The id is written
once and never derived from the name, so renaming a hotspot keeps it. Checks (run by export_content.py, hence by
doccheck group `export`):
  * every hotspot has an id; it is a lowercase ASCII slug (`a-z`, `0-9`, single hyphens);
  * no two hotspots of one step share an id; no `{#` is left in the name, remark or copy (a malformed id);
  * no id that was ever exported has changed or disappeared. The baseline is the registry
    docs/volumes/<volume>/chapters/_export/_hotspot-ids.tsv — every (chapter, step, id) any previous export issued.
    export_content.py adds new ids to it and never removes one: a changed id therefore shows up as a registered id
    that is gone. If a hotspot was removed or moved on purpose, delete its line from the registry by hand.
"""
import os
import re

import chapters as C

ID_OK = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
REGISTRY_NAME = '_hotspot-ids.tsv'
HEADER = ('# Hotspot ids issued by tools/content/export_content.py (tools/content/hotspot_ids.py). An id never changes:\n'
          '# a line whose id is gone from its step fails doccheck. Delete a line only for a hotspot removed on purpose.\n'
          '# chapter\tstep\tid\n')


def registry_path():
    return os.path.join(C.EXPORT_DIR, REGISTRY_NAME)


def read_registry(path=None):
    """Set of (chapter, step, id); empty when the file does not exist yet."""
    path = path or registry_path()
    if not os.path.exists(path):
        return set()
    out = set()
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.rstrip('\n')
            if line and not line.startswith('#'):
                out.add(tuple(line.split('\t')))
    return out


def render_registry(entries):
    return HEADER + ''.join('\t'.join(e) + '\n' for e in sorted(entries))


def step_problems(step):
    """Messages for the hotspot ids of one exported step: missing, malformed, duplicate, `{#` left in the text."""
    out, seen = [], set()
    for h in step['hotspots']:
        hid, name = h['id'], h['name']
        if any('{#' in (h.get(k) or '') for k in ('name', 'note', 'text', 'tail')):
            out.append('hotspot «%s»: malformed `{#id}` (write it right after the name: `**Name** {#some-id}:`)' % name)
        if not hid:
            out.append('hotspot «%s» has no id — write `{#english-slug}` right after its name' % name)
        elif not ID_OK.match(hid):
            out.append('hotspot «%s»: id `%s` is not a lowercase ASCII slug' % (name, hid))
        elif hid in seen:
            out.append('hotspot id `%s` is used twice in the step' % hid)
        seen.add(hid)
    if '{#' in (step.get('hotspotsNote') or ''):
        out.append('«Hotspots» field: `{#…}` outside a hotspot head')
    return out


def current(cid, data):
    """(chapter, step, id) of the well-formed ids a fresh export issues (the ones the registry may learn)."""
    return {(cid, s['id'], h['id']) for s in data['steps'] for h in s['hotspots'] if h['id'] and ID_OK.match(h['id'])}


def registry_problems(registry, issued, chapter_ids):
    """Registered ids of these chapters that the fresh export no longer issues (changed or removed)."""
    gone = sorted(e for e in registry if e[0] in chapter_ids and e not in issued)
    return ['%s/%s: hotspot id `%s` is registered in %s but gone — ids never change: restore `{#%s}`; if the hotspot '
            'was removed or moved on purpose, delete that line from the registry' % (e[0], e[1], e[2], REGISTRY_NAME, e[2])
            for e in gone]
