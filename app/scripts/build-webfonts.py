"""Subsetter of the DOM interface's web fonts (called by build-webfonts.mjs, which passes the job as JSON on
stdin: faces, code points, the glyphs to synthesise, output directory).

Characters none of the fonts has are composed into each text face the same way the SDF atlas builder does
(build-fonts.mjs `synthGlyph` / `dcSymbol`): a super- / subscript copy of a glyph using the font's own script
geometry, a plain copy, or the DC symbol drawn from the bars of '='. So both renderers show the same glyphs.
"""
import json
import sys

from fontTools import subset
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._g_l_y_f import Glyph, GlyphComponent

FEATURES = ['kern', 'liga', 'calt', 'locl', 'tnum', 'lnum', 'case', 'sups', 'subs', 'mark', 'mkmk', 'ccmp']


def add_glyph(font, cp, name, glyph, advance):
    font['glyf'][name] = glyph
    order = font.getGlyphOrder()
    if name not in order:
        font.setGlyphOrder(order + [name])
    font['hmtx'][name] = (int(round(advance)), 0)
    for table in font['cmap'].tables:
        if table.isUnicode():
            table.cmap[cp] = name


def bbox(font, name):
    g = font['glyf'][name]
    g.recalcBounds(font['glyf'])
    return g.xMin, g.yMin, g.xMax, g.yMax


def script_geometry(font, cmap, kind):
    """Scale and baseline offset (font units) of the font's own super / subscripts (ⁿ vs n, ₀ vs 0)."""
    small, big = (0x207F, 0x6E) if kind == 'sup' else (0x2080, 0x30)
    upm = font['head'].unitsPerEm
    if small not in cmap or big not in cmap:
        return 0.62, (0.4 if kind == 'sup' else -0.16) * upm
    a, b = bbox(font, cmap[small]), bbox(font, cmap[big])
    scale = (a[3] - a[1]) / (b[3] - b[1])
    return scale, a[1] - b[1] * scale


def synthesise(font, synth, dc):
    cmap = font.getBestCmap()
    upm = font['head'].unitsPerEm
    for cp_str, parts in synth.items():
        cp = int(cp_str)
        if cp in cmap or any(c not in cmap for c, _ in parts):
            continue
        glyph = Glyph()
        glyph.numberOfContours = -1
        glyph.components = []
        pen = 0.0
        for c, kind in parts:
            scale, dy = (1.0, 0.0) if kind == 'same' else script_geometry(font, cmap, kind)
            pad = 0 if kind == 'same' else 0.03 * upm
            comp = GlyphComponent()
            comp.glyphName = cmap[c]
            comp.x, comp.y = int(round(pen + pad)), int(round(dy))
            comp.flags = 0x4  # ROUND_XY_TO_GRID
            if scale != 1.0:
                comp.transform = [[scale, 0], [0, scale]]
            glyph.components.append(comp)
            pen += pad + font['hmtx'][cmap[c]][0] * scale + pad
        add_glyph(font, cp, f'uni{cp:04X}.synth', glyph, pen)
    if dc not in cmap and 0x3D in cmap:
        x0, y0, x1, y1 = bbox(font, cmap[0x3D])
        t = (y1 - y0) * 0.3  # bar thickness of '=' is ~30 % of its height
        gap = (x1 - x0) * 0.12
        dash = (x1 - x0 - 2 * gap) / 3
        pen = TTGlyphPen(None)
        rects = [(x0, y1 - t, x1, y1)] + [(x0 + i * (dash + gap), y0, x0 + i * (dash + gap) + dash, y0 + t) for i in range(3)]
        for a, b, c, d in rects:
            pen.moveTo((a, b)); pen.lineTo((a, d)); pen.lineTo((c, d)); pen.lineTo((c, b)); pen.closePath()
        add_glyph(font, dc, f'uni{dc:04X}.synth', pen.glyph(), font['hmtx'][cmap[0x3D]][0])


job = json.load(sys.stdin)
for name, face in job['faces'].items():
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = FEATURES
    opts.name_IDs = ['*']  # keep copyright / licence names (OFL)
    opts.notdef_outline = True
    opts.hinting = False
    font = TTFont(face['src'], recalcTimestamp=False)  # reproducible: head.modified stays the source's
    if face['synth']:
        synthesise(font, job['synth'], job['dc'])
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=job['codepoints'])
    sub.subset(font)
    subset.save_font(font, f"{job['out']}/{name}.woff2", opts)
