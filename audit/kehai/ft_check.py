# Kehai's independent font audit: fontTools reads each TTF/WOFF, validates structure,
# and rasterizes every glyph outline at pixel centers (own even-odd point-in-polygon),
# comparing with the bitmap in cnsw-fonts.json. Shares no code with the delivery.
import json, sys, io
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen
root = sys.argv[1]
J = json.load(open(root + '/fonts/cnsw-fonts.json'))
fonts = J['fonts'] if 'fonts' in J else J
def keyfor(fname):
    return {'consciousnode-sans': 'sans', 'cnsw-serif': 'serif', 'times-new-thesuramos': 'thesuramos', 'times-new-thesuramos-shadow': 'thesuramos'}[fname]
def polys(glyphset, gname):
    pen = RecordingPen(); glyphset[gname].draw(pen)
    out, cur = [], []
    for op, args in pen.value:
        if op == 'moveTo': cur = [args[0]]
        elif op == 'lineTo': cur.append(args[0])
        elif op in ('qCurveTo', 'curveTo'): raise SystemExit('curve found in ' + gname)
        elif op in ('closePath', 'endPath'): out.append(cur); cur = []
    return out
def inside(px, py, ps):
    c = False
    for poly in ps:
        n = len(poly)
        for i in range(n):
            (x1, y1), (x2, y2) = poly[i], poly[(i + 1) % n]
            if (y1 > py) != (y2 > py) and px < x1 + (py - y1) * (x2 - x1) / (y2 - y1): c = not c
    return c
total_bad = 0
for base in ['consciousnode-sans', 'cnsw-serif', 'times-new-thesuramos', 'times-new-thesuramos-shadow']:
    for ext in ['ttf', 'woff']:
        f = TTFont(f'{root}/fonts/{base}.{ext}')
        upm = f['head'].unitsPerEm; asc = f['hhea'].ascent
        cmap = f.getBestCmap(); gs = f.getGlyphSet()
        k = keyfor(base); fj = fonts[k]
        glyphs = fj['glyphs']; H = len(glyphs['65']); W = len(glyphs['65'][0])
        px = 128; bad = 0
        for code in range(32, 127):
            want = glyphs[str(code)]
            ps = polys(gs, cmap[code])
            for r in range(H):
                for c in range(W):
                    ch = want[r][c]
                    on = (ch == '#') if k != 'thesuramos' else ((ch == '+') if base.endswith('thesuramos') else (ch == '-'))
                    got = inside(c * px + px / 2, asc - (r * px + px / 2), ps)
                    if got != on: bad += 1
        # structural: fontTools would have raised on bad tables; also check every glyph advance == W*128
        adv = set(f['hmtx'][g][0] for g in f.getGlyphOrder())
        print(f'{base}.{ext}: upm={upm} glyphs={len(f.getGlyphOrder())} cmap={len(cmap)} advances={sorted(adv)} pixel mismatches={bad}')
        total_bad += bad
print('TOTAL mismatches', total_bad)
