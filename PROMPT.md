# CNSW Font Forge: three original bitmap typefaces, a glyph editor, and installable font files

ConsciousNode SoftWorks, MIT. Xinu rules: one self-contained HTML file for the app, zero dependencies, fully offline, strict CSP (no network, no CDNs, no external fonts or assets). Every block of code you lift from an attached file carries a provenance comment (source file and line range) and is listed in `LIFTS.md`.

You are building **typefaces from scratch** plus the **tooling and instruments** around them. A person will judge how the letters look; your job is to draw them with care and to build tools that prove the files are correct.

## Attached

- `spiralos-legacy-8x8.txt`: the font SpiralOS ships today. **Reference for the byte format only**: 96 glyphs (ASCII 32..127), 8 bytes per glyph, row 0 first, bit 7 (`0x80`) = leftmost pixel. Do **not** copy, trace or adapt its glyphs. It is also the input to the do-not-copy check (Test 9).
- `tritos-legacy-8x8.txt`: the font TritOS ships today (64 glyphs, ASCII 32..95). Same use: format context and the do-not-copy check only.

## The three typefaces

All three cover **96 codes: ASCII 32..127**. Code 127 (DEL) gets a small visible symbol of your own design; it is omitted from the TrueType files (Test 7).

### 1. ConsciousNode Sans (SpiralOS system and UI font)
- Cell **8 × 8** pixels, 1-bit. Columns 0..6 are for ink; column 7 is always empty (letter spacing). Rows 0..7; row 7 is only for descenders (g j p q y and similar punctuation).
- Byte format identical to the attached SpiralOS file: 768 bytes, so it is a drop-in replacement.
- Style: a clean sans-serif, comfortable to read at 1× on a 320 × 200 screen. Full upper and lower case with real descenders.

### 2. CNSW Serif (SpiralOS documents)
- Cell **8 × 16** pixels, 1-bit, same bit order (16 bytes per glyph, row 0 first): 1,536 bytes.
- Style: a book-face serif. Use the extra height for real serifs, ascenders and descenders.
- Declare your own metrics (see Metrics below) and keep column 7 empty for spacing, as in Sans.

### 3. Times New Thesuramos (TritOS, balanced ternary)
- Cell **9 × 9 trits**. Each trit is −1, 0 or +1:
  - **+1 = ink.** Ink lives in rows 0..7 and columns 0..7 (an 8 × 8 ink area). Column 7 and row 7 follow the same spacing/descender convention as Sans, but here column 7 *may* hold ink if the design needs it.
  - **−1 = shadow, generated, never hand-placed:** a trit is −1 exactly when it is not ink and the trit one step up-left of it (row − 1, column − 1) is ink. Row 8 and column 8 exist to hold the shadow.
  - **0 = background.**
- Style: a small serif face (a tiny Times-like), upper and lower case.
- **Storage:** one glyph row of 9 trits is exactly one balanced tryte: `value = Σ t[c] · 3^(8 − c)` for c = 0..8 (column 0 most significant), range −9,841..+9,841. A glyph is 9 trytes (row 0 first), and the font is 864 trytes. Emit it as Triton assembler lines, one glyph per line: `.tryte #v0,#v1,…,#v8  ; 65 'A'`.

## What to build

1. **`cnsw-font-forge.html`** (single file):
   - Shows each font as a specimen sheet: the full glyph grid at 1×, 2× and 4×, plus pangram lines and the confusable lineup `O0 Il1| S5 B8 Z2 rn m`.
   - **Glyph editor:** pick font and glyph, click a cell to toggle ink (Sans/Serif: on/off; Times New Thesuramos: ink on/off, with the shadow regenerated automatically). Live preview of the glyph in running text. Undo.
   - **Import/export** of the source of truth (`cnsw-fonts.json`) as a file download/upload. No browser storage is required.
   - **Export buttons** for every derived format below.
   - All text in the page UI is DOM text. The page must never call `fillText`, `strokeText` or `measureText`.
2. **`fonts/cnsw-fonts.json`**: the single source of truth. For each font: name, cell size, declared metrics, and 96 glyphs as rows of strings (`"..##..."` for binary; `"+"/"0"/"-"` characters for trits).
3. **Derived formats**, all generated from the JSON by code in the page *and* by a Node CLI (`tools/build-fonts.js`) that shares that code:
   - `fonts/consciousnode-sans-8x8.hex` (768 bytes as hex, same layout as the attached SpiralOS file) and `fonts/cnsw-serif-8x16.hex` (1,536 bytes);
   - `fonts/times-new-thesuramos-9x9.tryte.asm` (96 lines as above);
   - **TrueType** `.ttf` for: `ConsciousNode Sans`, `CNSW Serif`, `Times New Thesuramos` (ink only), and `Times New Thesuramos Shadow` (shadow trits only, same metrics, so the two layer exactly);
   - **WOFF 1.0** `.woff` for the same four, compressed with the browser's built-in `CompressionStream('deflate')` (Node: `zlib`). **No WOFF2**: it needs a Brotli encoder, which is out of scope.
4. **TrueType writer, written from scratch:**
   - Tables `head`, `hhea`, `maxp`, `OS/2`, `hmtx`, `cmap` (format 4, codes 32..126), `loca`, `glyf`, `name`, `post`, with correct table checksums and `checkSumAdjustment`.
   - Each glyph's outline is the **traced boundary of its lit pixels**: merge pixels into polygons, so there are no overlapping squares and no zero-area contours. Use TrueType winding (outer contours clockwise, holes counter-clockwise).
   - Glyph 0 is `.notdef` (an empty box outline); `post` table format 3.
   - Monospaced. Advance = cell width. One pixel = 128 font units: unitsPerEm = 1024 for the 8-row fonts, 2048 for Serif, 1152 for the 9-row Thesuramos fonts. Ascent and descent come from your declared baseline.
   - `name` table: family names as above, plus `© 2026 ConsciousNode SoftWorks` and `MIT License`.
   - **Fixed timestamps** in `head` (created = modified = 2026-11-13 00:00 UTC), so builds are byte-reproducible.
5. **An independent TrueType reader** (`tools/ttf-read.js`, a separate labeled block in the page) that shares **no code** with the writer. It parses the tables, verifies checksums, and rasterizes each glyph's contours with a point-in-polygon test at every pixel center.
6. **Tests** (`tests/*.js` plus `tests/run-all.js`, Node; browser tests use Playwright with headless Chromium), and **docs**: `FONTS.md` (every format, byte by byte), `REPORT.md`, `LIFTS.md`, `LICENSE` (MIT).

## Metrics (declared, then measured)

Each font declares in the JSON: `baselineRow` (the lowest row of a capital letter), `capTopRow`, `xTopRow` (top of x-height letters), and `descenderRow` (lowest row of g/p/y). The tests measure every glyph against these declarations. There is no target for how the letters should look. Kham's eye judges that, and nothing in code or docs should claim a design is good.

## Forbidden

- **Deriving any glyph from an existing font in any way:** no rendering a system or web font to a canvas and thresholding it; no tracing; no copying from the attached legacy fonts or from any font you know (IBM VGA, CP437, font8x8, Terminus, Spleen, Unifont, Tom Thumb, etc.). Draw every glyph yourself.
- **No embedded precomputed outputs:** every `.hex`, `.asm`, `.ttf` and `.woff` must be produced from `cnsw-fonts.json` by the shipped code. A test rebuilds them and compares.
- **No hand-placed shadow trits.**
- **No external libraries or tools** in the app or the build (no opentype.js, fontTools, FontForge, potrace). Tests may use Playwright only.
- **No special-casing glyphs or files inside tests** to make a check pass.
- **Verbatim:** "If a requirement can't be met, or conflicts with another, say so in REPORT.md and leave it failing. Never change emulator or VM accessors, I/O, consoles, test harnesses, or the auditor's scripts to make a check pass. An emulator must never read or write a guest's private memory."
- Do not predict, rank or praise the designs anywhere in code, docs or UI.

## Tests (numbered; each prints PASS/FAIL with numbers)

1. **Coverage and bounds:**
   - every font has exactly 96 glyphs of the declared size;
   - Sans and Serif never ink column 7;
   - Sans inks row 7 only on glyphs listed as descenders in the JSON;
   - Times New Thesuramos ink stays in rows/columns 0..7.
2. **Declared metrics:**
   - every capital A–Z touches `capTopRow` and `baselineRow` and stays between them;
   - the x-height letters `a c e m n o r s u v w x z` sit between `xTopRow` and `baselineRow` and touch both;
   - b d f h k l t rise above `xTopRow`;
   - g j p q y reach below `baselineRow`;
   - digits sit inside the cap band.
   
   Print a per-glyph table of failures.
3. **Distinctness:**
   - no two glyphs in a font are identical;
   - the Hamming distance (in pixels) between each confusable pair `O/0, I/l, l/1, I/1, l/|, S/5, B/8, Z/2, o/0, u/v, n/h, c/e` is ≥ 3. Print every pair's distance.
   
   **Positive control:** copy `O` into `0` in a scratch copy, and the test must fail.
4. **Shadow rule:**
   - every Times New Thesuramos −1 trit matches the generation rule exactly, and no trit violates it.
   
   **Positive control:** flip one shadow trit, and the test must fail.
5. **Format round trips:**
   - JSON → `.hex` → JSON and JSON → `.asm` → JSON are lossless for every glyph;
   - the tryte formula is cross-checked by a second, independently written decoder.
6. **Rebuild = shipped:** `tools/build-fonts.js` rebuilt from the JSON gives byte-identical `.hex`, `.asm`, `.ttf` and `.woff` files, and two consecutive builds are byte-identical (reproducibility).
7. **TrueType correctness via the independent reader:**
   - all table checksums and `checkSumAdjustment` are valid;
   - `cmap` maps exactly 32..126;
   - glyph count, advances and metrics match the JSON;
   - every glyph rasterized at pixel centers **equals its bitmap with 0 differing pixels**, in all four TTFs and their WOFF versions after decompression;
   - contours are closed, non-self-intersecting, and have the correct winding.
   
   **Positive controls:** flip one pixel in the JSON *after* building the TTF, and the comparison must fail. Reverse one contour, and the winding check must fail.
8. **Browser:**
   - the Forge loads in headless Chromium with 0 page errors, and the four `.woff` fonts load through `FontFace`;
   - drive the editor with real clicks: toggle 3 pixels in `A`, export the JSON, and those exact 3 changes (and only those) appear in it. Re-import restores the original.
   
   Also **measure and report** (not pass/fail) how closely Chromium's rendering of each TTF at native pixel size matches the bitmaps. Browsers may antialias, so report the numbers honestly.
9. **Not copied:**
   - for every glyph of Sans, Serif (top 8 rows and full) and Times New Thesuramos ink, compute the Hamming distance to the same code in both attached legacy fonts;
   - list every glyph that is identical or within 2 pixels. Only space, `.`, `,`, `-`, `_`, `:`, `'` and `|` may be identical; any other identical glyph fails.
   
   **Positive control:** paste one legacy glyph into a scratch copy, and the test must fail.
10. **Static scan:**
    - the HTML has a strict CSP meta tag, and no `fetch`, `XMLHttpRequest`, `WebSocket`, `import(`, external `src`/`href`, `localStorage`, `fillText`, `strokeText` or `measureText`;
    - every inline block carries a provenance or authorship label.

## Report

`REPORT.md` covers what you built, every test with its printed numbers (copied from `tests/run-all.js` output, never typed), anything you could not do, and anything you looked at besides the attachments. Do not describe anything as working unless a test exercises it. Include specimen-sheet screenshots of the three fonts at 4× from the browser test.

Package the result as a zip of the whole repo tree, including test logs.
