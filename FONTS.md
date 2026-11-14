# FONTS.md — File Formats (Byte-by-Byte Specification)

## 1. Source of Truth: `fonts/cnsw-fonts.json`

JSON object with top-level `version` (`1`), `author`, `license`, and `fonts` containing three keys:

- `sans` (`ConsciousNode Sans`): `type: "binary"`, `width: 8`, `height: 8`, `unitsPerEm: 1024`, `pixelUnits: 128`, `metrics: { capTopRow: 0, xTopRow: 2, baselineRow: 6, descenderRow: 7 }`, `descenders: ["g","j","p","q","y",",",";"]`.
- `serif` (`CNSW Serif`): `type: "binary"`, `width: 8`, `height: 16`, `unitsPerEm: 2048`, `pixelUnits: 128`, `metrics: { capTopRow: 1, xTopRow: 5, baselineRow: 11, descenderRow: 14 }`, `descenders: ["g","j","p","q","y",",",";","_"]`.
- `thesuramos` (`Times New Thesuramos`): `type: "ternary"`, `width: 9`, `height: 9`, `unitsPerEm: 1152`, `pixelUnits: 128`, `metrics: { capTopRow: 0, xTopRow: 2, baselineRow: 6, descenderRow: 7 }`, `descenders: ["g","j","p","q","y",",",";"]`.

Each font's `glyphs` map has 96 string keys `"32"`..`"127"`.
- Binary rows use `"."` (0) and `"#"` (1).
- Ternary rows use `"0"` (0, background), `"+"` (+1, ink in rows/cols 0..7), and `"-"` (-1, shadow, generated where not ink and `(row - 1, col - 1)` is ink).

## 2. Hex Bitmaps: `.hex`

- `fonts/consciousnode-sans-8x8.hex`: 96 lines (`<code_dec> <16_hex_chars>`), 8 bytes per glyph = **768 bytes** total glyph data.
- `fonts/cnsw-serif-8x16.hex`: 96 lines (`<code_dec> <32_hex_chars>`), 16 bytes per glyph = **1,536 bytes** total glyph data.
- Byte order: row 0 first; within each row byte, bit 7 (`0x80`) is column 0 (leftmost pixel) down to bit 0 (`0x01`) for column 7.

## 3. Balanced Ternary Assembler: `fonts/times-new-thesuramos-9x9.tryte.asm`

- 96 lines, one per glyph ASCII 32..127:
  `.tryte #v0,#v1,#v2,#v3,#v4,#v5,#v6,#v7,#v8  ; <code> '<char>'`
- Each row of 9 trits `t[0..8]` (`+1`, `0`, `-1`) encodes one balanced tryte in `[-9841, +9841]`:
  `value = sum_{c=0..8} t[c] * 3^(8 - c)` (column 0 most significant).
- 9 trytes per glyph (row 0 first) × 96 glyphs = **864 trytes**.

## 4. TrueType (`.ttf`, SFNT 1.0)

Generated for four faces:
1. `fonts/consciousnode-sans.ttf` (`ConsciousNode Sans`, `unitsPerEm = 1024`, `advanceWidth = 1024`, `ascent = 896`, `descent = -128`)
2. `fonts/cnsw-serif.ttf` (`CNSW Serif`, `unitsPerEm = 2048`, `advanceWidth = 1024`, `ascent = 1536`, `descent = -512`)
3. `fonts/times-new-thesuramos.ttf` (`Times New Thesuramos`, ink `+1` only, `unitsPerEm = 1152`, `advanceWidth = 1152`, `ascent = 896`, `descent = -256`)
4. `fonts/times-new-thesuramos-shadow.ttf` (`Times New Thesuramos Shadow`, shadow `-1` only, `unitsPerEm = 1152`, `advanceWidth = 1152`, `ascent = 896`, `descent = -256`)

SFNT structure (big-endian):
- **Offset Table** (12 bytes): `sfntVersion = 0x00010000`, `numTables = 10`, `searchRange = 128`, `entrySelector = 3`, `rangeShift = 32`.
- **Table Directory** (10 × 16 bytes, sorted by tag): `OS/2`, `cmap`, `glyf`, `head`, `hhea`, `hmtx`, `loca`, `maxp`, `name`, `post`. Each table padded to 4-byte boundary; checksum = 32-bit unsigned word sum.
- `head` (54 bytes): `magicNumber = 0x5F0F3CF5`, `flags = 0x000B`, `created = modified = 2026-11-13 00:00:00 UTC` (Mac epoch seconds), `indexToLocFormat = 1` (32-bit `loca` offsets), `checkSumAdjustment = (0xB1B0AFBA - wholeFileSum) mod 2^32`.
- `hhea` (36 bytes): `ascent`, `descent`, `lineGap = 0`, `advanceWidthMax = cellWidth * 128`, `numberOfHMetrics = 96`.
- `maxp` (32 bytes): `version = 0x00010000`, `numGlyphs = 96` (glyph 0 = `.notdef`, glyphs 1..95 = ASCII 32..126; DEL 127 omitted).
- `OS/2` (96 bytes, version 4): `achVendID = "CNSW"`, `usFirstCharIndex = 32`, `usLastCharIndex = 126`, `sTypoAscender`, `sTypoDescender`, `usWinAscent`, `usWinDescent`, `sxHeight`, `sCapHeight`.
- `hmtx` (96 × 4 bytes): `advanceWidth` (`u16`) + `lsb` (`i16`) per glyph.
- `cmap`: 2 encoding records (`(0, 3)` and `(3, 1)`) pointing to a single Format 4 subtable (32 bytes) with 2 segments (`32..126` with `idDelta = -31`, and `0xFFFF..0xFFFF` with `idDelta = 1`).
- `loca` (97 × 4 bytes): 32-bit byte offsets into `glyf`.
- `glyf`: simple glyph records (`numberOfContours >= 0` or empty for space). Lit pixels are merged into closed, non-self-intersecting orthogonal polygons with TrueType winding (clockwise outer contours, counter-clockwise holes); all points on-curve (`flag = 0x01`) with 16-bit delta coordinates.
- `name`: Windows Unicode BMP (`platformID = 3`, `encodingID = 1`, `languageID = 0x0409`) strings including copyright `© 2026 ConsciousNode SoftWorks` and license `MIT License`.
- `post` (32 bytes): Format 3.0 (`0x00030000`), `isFixedPitch = 1`.

## 5. WOFF 1.0 (`.woff`)

- **WOFF Header** (44 bytes): `signature = 0x774F4646` (`wOFF`), `flavor = 0x00010000`, `length`, `numTables = 10`, `totalSfntSize`, `majorVersion = 1`, `minorVersion = 0`.
- **Table Directory** (10 × 20 bytes): `tag`, `offset`, `compLength`, `origLength`, `origChecksum`.
- **Table Data**: each SFNT table compressed with zlib deflate (`CompressionStream('deflate')` in browser, `zlib.deflateSync` in Node) if smaller than `origLength`, else stored raw, padded to 4-byte boundaries.
