# LIFTS.md — Provenance & Lifted Code Registry

No code or glyph data was lifted from `attached/spiralos-legacy-8x8.txt` or `attached/tritos-legacy-8x8.txt`. Both attached files were used strictly as format references (ASCII 32..127 / 32..95, row 0 first, MSB `0x80` = leftmost pixel) and as inputs to Test 9 (`tests/test-09-not-copied.js`).

All source files, typefaces, codecs, TrueType/WOFF writers, and the independent TrueType reader in this repository were authored from scratch for ConsciousNode SoftWorks under the MIT License:

- `tools/create-fonts-json.js` — Original glyph definitions for ConsciousNode Sans, CNSW Serif, and Times New Thesuramos.
- `tools/font-codec.js` — Shared hex, balanced-tryte, TrueType (`.ttf`), and WOFF 1.0 (`.woff`) encoder.
- `tools/ttf-read.js` — Independent TrueType (`.ttf`) and WOFF 1.0 (`.woff`) parser, contour validator, and point-in-polygon rasterizer.
- `tools/build-fonts.js` — Node CLI invoking `tools/font-codec.js`.
- `tools/build-html.js` — Assembler for the self-contained `cnsw-font-forge.html` application.
- `cnsw-font-forge.html` — Single-file offline Font Forge UI (every `<style>` and `<script>` block carries an inline `Authorship:` label).
- `tests/test-01-coverage.js` through `tests/test-10-static-scan.js`, `tests/browser_helper.py`, `tests/run-all.js` — Automated verification suite.
