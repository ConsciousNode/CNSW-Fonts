'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const reader = require('../tools/ttf-read');

async function verifyFontBinary(buf, isWoff, font, mode) {
  const sfnt = isWoff
    ? await reader.decompressWoffToSfnt(buf, (b) => new Uint8Array(zlib.inflateSync(Buffer.from(b))))
    : buf;
  const parsed = reader.parseSfnt(sfnt);
  const issues = [];

  if (parsed.checksumErrors.length > 0) issues.push(...parsed.checksumErrors);
  if (!parsed.checkSumAdjustmentValid) issues.push('Invalid checkSumAdjustment');
  if (parsed.maxp.numGlyphs !== 96) issues.push(`numGlyphs=${parsed.maxp.numGlyphs} != 96`);
  if (parsed.head.unitsPerEm !== font.unitsPerEm) issues.push(`unitsPerEm=${parsed.head.unitsPerEm} != ${font.unitsPerEm}`);

  const expectedAscent = (font.metrics.baselineRow + 1) * font.pixelUnits;
  const expectedDescent = -((font.height - 1 - font.metrics.baselineRow) * font.pixelUnits);
  if (parsed.hhea.ascent !== expectedAscent) issues.push(`ascent=${parsed.hhea.ascent} != ${expectedAscent}`);
  if (parsed.hhea.descent !== expectedDescent) issues.push(`descent=${parsed.hhea.descent} != ${expectedDescent}`);

  const expectedAdv = font.width * font.pixelUnits;
  for (let g = 0; g < parsed.advances.length; g++) {
    if (parsed.advances[g] !== expectedAdv) {
      issues.push(`glyph ${g} advance=${parsed.advances[g]} != ${expectedAdv}`);
      break;
    }
  }

  // cmap must map exactly 32..126
  const mappedCodes = Array.from(parsed.cmapMap.keys()).sort((a, b) => a - b);
  if (mappedCodes.length !== 95 || mappedCodes[0] !== 32 || mappedCodes[mappedCodes.length - 1] !== 126) {
    issues.push(`cmap count=${mappedCodes.length}`);
  }

  let pixelDiffs = 0;
  let contourErrs = 0;
  for (let code = 32; code <= 126; code++) {
    const gid = parsed.cmapMap.get(code);
    const g = parsed.glyphs[gid];
    const cIssues = reader.validateContours(g.contours);
    if (cIssues.length > 0) contourErrs += cIssues.length;

    const rast = reader.rasterizeGlyph(g.contours, font.width, font.height, font.pixelUnits, font.metrics.baselineRow);
    const orig = font.glyphs[String(code)];
    const target = mode === 'shadow' ? '-' : (font.type === 'ternary' ? '+' : '#');
    for (let r = 0; r < font.height; r++) {
      for (let c = 0; c < font.width; c++) {
        if ((rast[r][c] === '#') !== (orig[r][c] === target)) pixelDiffs++;
      }
    }
  }
  if (contourErrs > 0) issues.push(`contourErrs=${contourErrs}`);
  if (pixelDiffs > 0) issues.push(`pixelDiffs=${pixelDiffs}`);

  return { issues, pixelDiffs, contourErrs, parsed };
}

async function run() {
  const rootDir = path.join(__dirname, '..');
  const data = JSON.parse(fs.readFileSync(path.join(rootDir, 'fonts', 'cnsw-fonts.json'), 'utf8'));
  const targets = [
    { slug: 'consciousnode-sans', font: data.fonts.sans, mode: 'ink' },
    { slug: 'cnsw-serif', font: data.fonts.serif, mode: 'ink' },
    { slug: 'times-new-thesuramos', font: data.fonts.thesuramos, mode: 'ink' },
    { slug: 'times-new-thesuramos-shadow', font: data.fonts.thesuramos, mode: 'shadow' },
  ];

  let totalIssues = 0;
  for (const t of targets) {
    const ttf = new Uint8Array(fs.readFileSync(path.join(rootDir, 'fonts', `${t.slug}.ttf`)));
    const woff = new Uint8Array(fs.readFileSync(path.join(rootDir, 'fonts', `${t.slug}.woff`)));
    const rTtf = await verifyFontBinary(ttf, false, t.font, t.mode);
    const rWoff = await verifyFontBinary(woff, true, t.font, t.mode);
    if (rTtf.issues.length || rWoff.issues.length) {
      totalIssues += rTtf.issues.length + rWoff.issues.length;
      console.log('  FAIL', t.slug, rTtf.issues, rWoff.issues);
    }
  }

  // Positive control 1: flip one pixel in JSON after building TTF -> comparison must fail
  const scratchFont = JSON.parse(JSON.stringify(data.fonts.sans));
  const row0 = scratchFont.glyphs['65'][0].split('');
  row0[0] = row0[0] === '#' ? '.' : '#';
  scratchFont.glyphs['65'][0] = row0.join('');
  const sansTtf = new Uint8Array(fs.readFileSync(path.join(rootDir, 'fonts', 'consciousnode-sans.ttf')));
  const ctrl1 = await verifyFontBinary(sansTtf, false, scratchFont, 'ink');
  const ctrl1Caught = ctrl1.pixelDiffs > 0;

  // Positive control 2: reverse one contour -> winding check must fail
  const parsedSans = reader.parseSfnt(sansTtf);
  const gidA = parsedSans.cmapMap.get(65);
  const reversedContours = parsedSans.glyphs[gidA].contours.map((c, idx) => (idx === 0 ? c.slice().reverse() : c));
  const ctrl2Issues = reader.validateContours(reversedContours);
  const ctrl2Caught = ctrl2Issues.length > 0;

  const pass = totalIssues === 0 && ctrl1Caught && ctrl2Caught;
  console.log(`Test 7 (TrueType/WOFF Independent Reader): ${pass ? 'PASS' : 'FAIL'} — binaries_checked=8, issues=${totalIssues}, ctrl_pixel_flip=${ctrl1Caught}, ctrl_winding=${ctrl2Caught}`);
  return pass;
}

if (require.main === module) run().then((ok) => process.exit(ok ? 0 : 1));
module.exports = { run };
