# REPORT.md — CNSW Font Forge

## What Was Built

1. **Three original bitmap typefaces** in `fonts/cnsw-fonts.json` (96 glyphs each, ASCII 32..127):
   - **ConsciousNode Sans** (`8×8`, 1-bit, `unitsPerEm = 1024`, `capTopRow = 0`, `xTopRow = 2`, `baselineRow = 6`, `descenderRow = 7`)
   - **CNSW Serif** (`8×16`, 1-bit, `unitsPerEm = 2048`, `capTopRow = 1`, `xTopRow = 5`, `baselineRow = 11`, `descenderRow = 14`)
   - **Times New Thesuramos** (`9×9` balanced ternary trits, `unitsPerEm = 1152`, `capTopRow = 0`, `xTopRow = 2`, `baselineRow = 6`, `descenderRow = 7`, with `-1` shadow trits generated automatically from `+1` ink)
2. **Shared codec, TrueType writer, and WOFF 1.0 writer** (`tools/font-codec.js`) + **Node CLI** (`tools/build-fonts.js`):
   - Emits `fonts/consciousnode-sans-8x8.hex`, `fonts/cnsw-serif-8x16.hex`, `fonts/times-new-thesuramos-9x9.tryte.asm`, and `.ttf` + `.woff` for `ConsciousNode Sans`, `CNSW Serif`, `Times New Thesuramos`, and `Times New Thesuramos Shadow`.
3. **Independent TrueType/WOFF reader** (`tools/ttf-read.js`):
   - Shares no code with `tools/font-codec.js`. Verifies table checksums, `checkSumAdjustment`, `cmap`, glyph metrics, contour closure, non-self-intersection, winding, and rasterizes glyphs at pixel centers via point-in-polygon.
4. **Self-contained offline HTML application** (`cnsw-font-forge.html`, assembled by `tools/build-html.js`):
   - Strict CSP, zero external dependencies, specimen sheets at 1×/2×/4×, pangram and confusable lineups, interactive glyph editor with live running-text preview and undo, JSON import/export, and export buttons for all derived formats.

## Test Results (`node tests/run-all.js`, copied from `test-results.log`)

```text
Test 1 (Coverage & Bounds): PASS — checked 288 glyphs across 3 fonts, failures=0
Test 2 (Declared Metrics): PASS — measured=183 glyphs, failures=0
Test 3 (Distinctness): PASS — positive_control_caught=true
  sans: dups=0, O/0=4 I/l=17 l/1=15 I/1=6 l/|=13 S/5=12 B/8=13 Z/2=9 o/0=14 u/v=9 n/h=11 c/e=6
  serif: dups=0, O/0=5 I/l=25 l/1=23 I/1=6 l/|=23 S/5=6 B/8=26 Z/2=11 o/0=29 u/v=17 n/h=7 c/e=6
  thesuramos: dups=0, O/0=9 I/l=15 l/1=10 I/1=9 l/|=15 S/5=10 B/8=12 Z/2=10 o/0=13 u/v=11 n/h=5 c/e=7
Test 4 (Shadow Rule): PASS — shadow_trits=1060, violations=0, positive_control_violations=1
Test 5 (Format Round Trips): PASS — hex_glyphs=192, trytes_cross_checked=864, errors=0
Test 6 (Rebuild = Shipped & Reproducible): PASS — files_checked=11, mismatches=0
Test 7 (TrueType/WOFF Independent Reader): PASS — binaries_checked=8, issues=0, ctrl_pixel_flip=true, ctrl_winding=true
Test 8 (Browser — Headless Chromium via chromedriver): PASS — page_errors=0, woff_fonts_loaded=4/4, edit_diffs=3, reimport_restored=true
  Screenshots: screenshots/sans-4x.png, screenshots/serif-4x.png, screenshots/thesuramos-4x.png
  Chromium native TTF pixel match (informational):
    consciousnode-sans.ttf: 6080/6080 (100%)
    cnsw-serif.ttf: 12160/12160 (100%)
    times-new-thesuramos.ttf: 7695/7695 (100%)
    times-new-thesuramos-shadow.ttf: 7695/7695 (100%)
Test 9 (Not Copied): PASS — disallowed_identical=0, within_2px=13, positive_control_caught=true
  Within <=2px: sans/spiralos 44 ',' (d=2); sans/tritos 44 ',' (d=2); sans/spiralos 45 '-' (d=1); sans/tritos 45 '-' (d=1); sans/tritos 59 ';' (d=2); sans/tritos 61 '=' (d=2); sans/tritos 95 '_' (d=1); thesuramos/tritos 34 '"' (d=2); thesuramos/spiralos 45 '-' (d=2); thesuramos/tritos 45 '-' (d=2); thesuramos/tritos 61 '=' (d=2); thesuramos/tritos 95 '_' (d=1); thesuramos/spiralos 122 'z' (d=2)
Test 10 (Static Scan): PASS — style_blocks=1, script_blocks=4, issues=0

Summary: 10/10 tests passed.
```

## Specimen-Sheet Screenshots (4× from Headless Chromium)

- ConsciousNode Sans (4×): `screenshots/sans-4x.png`
- CNSW Serif (4×): `screenshots/serif-4x.png`
- Times New Thesuramos (4×): `screenshots/thesuramos-4x.png`

## Limitations & Deviations

- **Playwright not installed**: The offline VM does not have the `playwright` Node or Python package installed. Test 8 (`tests/test-08-browser.js` + `tests/browser_helper.py`) exercises headless Chromium 156.0.8078.73 via `/usr/bin/chromedriver` and Python `selenium 4.8.3`, loading `cnsw-font-forge.html` via a `data:text/html;base64,...` URL because the container sandbox restricts `file://` and loopback HTTP navigation in Chromium.
- **External references**: None consulted beyond the two attached legacy font files (`attached/spiralos-legacy-8x8.txt` and `attached/tritos-legacy-8x8.txt`) and `PROMPT.md` / `MANIFEST.md` in the provided archive.
