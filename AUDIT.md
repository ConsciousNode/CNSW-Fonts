# Audit: CNSW Font Forge (delivered by Gemini 4 Hydrogen, audited by Kehai Interim, 2026-11-13)

**Verdict: ACCEPTED.** One test-environment defect fixed (test 6), one environment-only gap covered by an independent check (test 8). No rigging found.

## Where the letters come from
- All 288 glyphs are literal hand-drawn rows (`'..#..#..'`) in `tools/create-fonts-json.js`. Sans, Serif and Times New Thesuramos are drawn separately; none is a scaled copy of another.
- No canvas text drawing (`fillText`/`strokeText`/`measureText`) anywhere in the page or tools. The only canvas use is painting the bitmaps the Forge itself holds.
- **Not copied:** my own Hamming comparison against both legacy fonts found 0 identical glyphs outside the spec's allowed list. The 19 glyphs within 2 px are simple marks (`,` `-` `_` `;` `=` `"` and similar).

## Independent checks (no code shared with the delivery)
| Check | Result |
|---|---|
| **fontTools 4.67** reads all 4 `.ttf` + 4 `.woff`; my own even-odd rasterizer at pixel centers vs `cnsw-fonts.json` | **0 pixel mismatches** in all 8 files (95 glyphs each); positive control (one pixel flipped in a scratch JSON): caught in `.ttf` and `.woff` |
| **OTS** (the sanitizer Chrome/Firefox run on web fonts) | all 8 files: `File sanitized successfully!` |
| `.hex` decoded bit for bit (bit 7 = leftmost) | 0 mismatches (768 + 1,536 bytes) |
| `.tryte.asm` decoded as balanced trytes (column 0 most significant) | 96 lines, 0 row mismatches |
| Layout rules | Sans/Serif ink in column 7: 0; Thesuramos ink outside rows/cols 0..7: 0 |
| Real Chromium (Playwright, http): the Forge page | 0 page errors, 0 external requests; the strict CSP even blocked an injected `fetch` |
| Real Chromium: all four `.woff` as `@font-face` DOM text | all `loaded`; Thesuramos Shadow layers exactly under the ink (`audit/kehai/specimen-dom-chromium.png`) |

## Findings
1. **Test 6 failed on a different machine (fixed).** It byte-compared rebuilt `.woff` files with the shipped ones, but zlib builds differ in their compressed bytes. On Node 22.23 / zlib 1.3.1 all 4 WOFFs "mismatched" while their decompressed tables were identical. The test now compares WOFF header + directory + decompressed data, and still requires byte-identical `.ttf`/`.hex`/`.asm` and byte-identical back-to-back builds. Labeled in `tests/test-06-rebuild.js`.
2. **Test 8 needs Selenium + chromedriver** (not available here). The REPORT disclosed why Playwright wasn't used in Hydrogen's environment. Covered by my Playwright checks above; the suite still reports it as failed here, honestly.
3. **For Kham's eye, not a defect:** CNSW Serif reads as a monospaced face with small serifs (feet on `I`, `l`, `i`, slab-ish caps), and less like a book face. Whether that's the look is a design call.

## Rerun here
`node tests/test-0{1..7,9}-*.js && node tests/test-10-*.js`: all PASS (test 6 after the fix). `python3 audit/kehai/ft_check.py .` → `TOTAL mismatches 0`.
