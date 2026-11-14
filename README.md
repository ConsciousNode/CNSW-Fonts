# CNSW Fonts

**The typefaces of ConsciousNode SoftWorks.** Three pixel fonts, drawn by hand for the studio's own computers, plus the Font Forge that edits them and builds every format from one source file.

| Font | Grid | Made for |
|---|---|---|
| **ConsciousNode Sans** | 8 × 8, 1-bit | SpiralOS's system font (a drop-in replacement for its old 8×8 font) |
| **CNSW Serif** | 8 × 16, 1-bit | SpiralOS documents |
| **Times New Thesuramos** | 9 × 9 trits | TritOS on the balanced-ternary Triton. Each pixel is a trit: **+1** ink, **0** background, **−1** a shadow cast one step down-right. One 9-trit glyph row is exactly one tryte. |

**Open it:** [the Pages site](https://consciousnode.github.io/CNSW-Fonts/) (Forge, specimen, downloads), or `cnsw-font-forge.html` offline.

## Install them on your computer
The `.ttf` files in `fonts/` are real TrueType fonts. They pass fontTools and OTS (the sanitizer Chrome and Firefox use).
- **Windows:** right-click the `.ttf` → *Install*.
- **Mac:** double-click → *Install Font*.
- **Linux:** copy them into `~/.local/share/fonts/`.

They're pixel fonts, so they're crispest at their native size and whole multiples: 8, 16, 24, 32… px for Sans and Thesuramos, 16, 32… for Serif.
**The Thesuramos shadow:** put the same text in *Times New Thesuramos Shadow* on a layer underneath, in a darker color. Both fonts share the same metrics, so they line up exactly.

## Things to try (no experience needed)
1. **Edit a letter.** Open the Forge, pick ConsciousNode Sans → `A`, and click a few squares. The live preview under the editor changes as you click. That's all a bitmap font is: a grid of on/off squares per letter.
2. **Watch the shadow appear on its own.** Switch the editor to Times New Thesuramos and turn on one ink square. A shadow trit appears down-right of it by itself. The shadow isn't drawn; it's computed from the ink, which is why the tests can check every shadow trit exactly.
3. **Make your own version.** After editing, type your font's names (and your own copyright line) into *Your font's names*, press *Export 4 .ttf*, and install your files. You've made a font, and it carries your name, so it never clashes with the CNSW fonts on the same computer.
4. **Spot the look-alikes.** The specimen has a line of `O0 Il1| S5 B8`. Each pair must differ by at least 3 pixels (test 3 measures it). Find the pixels that tell `I` and `l` apart.
5. **Count in trits.** In `fonts/times-new-thesuramos-9x9.tryte.asm`, each number is one row of a letter. Turn one into trits by repeatedly taking the remainder by 3, treating 2 as −1 and carrying 1. You get the row's 9 trits back.

## How it's made and checked
- **Source of truth:** `fonts/cnsw-fonts.json`. `tools/build-fonts.js` builds the SpiralOS `.hex`, the TritOS `.tryte.asm`, and the `.ttf`/`.woff` files from it. The TrueType writer is written from scratch, and a separate reader (`tools/ttf-read.js`) checks its output.
- **Tests:** `node tests/run-all.js` (10 suites, with positive controls; test 8 needs Selenium + chromedriver).
- **Delivery and audit:** built by Gemini 4 Hydrogen from Kehai Interim's spec (`PROMPT.md`, with Kham). Audited by Kehai: [`AUDIT.md`](AUDIT.md). Accepted. The audit fixed one test that broke on machines with a different zlib, and checked everything independently with fontTools, OTS and real Chromium.

MIT License · ConsciousNode SoftWorks
