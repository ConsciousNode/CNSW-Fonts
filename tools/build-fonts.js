#!/usr/bin/env node
'use strict';

// Authorship: ConsciousNode SoftWorks (MIT License) — tools/build-fonts.js
// Builds all derived formats from fonts/cnsw-fonts.json using tools/font-codec.js.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const codec = require('./font-codec');

function deflateRawNode(u8) {
  return zlib.deflateSync(Buffer.from(u8), { level: 9 });
}

async function buildAll(jsonPath, outDir) {
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  fs.mkdirSync(outDir, { recursive: true });

  const sans = data.fonts.sans;
  const serif = data.fonts.serif;
  const thes = data.fonts.thesuramos;

  // 1. Hex files
  fs.writeFileSync(path.join(outDir, 'consciousnode-sans-8x8.hex'), codec.encodeHex(sans), 'utf8');
  fs.writeFileSync(path.join(outDir, 'cnsw-serif-8x16.hex'), codec.encodeHex(serif), 'utf8');

  // 2. Triton assembler file
  fs.writeFileSync(path.join(outDir, 'times-new-thesuramos-9x9.tryte.asm'), codec.encodeTryteAsm(thes), 'utf8');

  // 3. TTF and WOFF 1.0
  const targets = [
    { font: sans, slug: 'consciousnode-sans', opts: { mode: 'ink', familyName: 'ConsciousNode Sans' } },
    { font: serif, slug: 'cnsw-serif', opts: { mode: 'ink', familyName: 'CNSW Serif' } },
    { font: thes, slug: 'times-new-thesuramos', opts: { mode: 'ink', familyName: 'Times New Thesuramos' } },
    { font: thes, slug: 'times-new-thesuramos-shadow', opts: { mode: 'shadow', familyName: 'Times New Thesuramos Shadow' } },
  ];

  for (const t of targets) {
    const ttf = codec.buildTTF(t.font, t.opts);
    const woff = await codec.buildWOFF(ttf, deflateRawNode);
    fs.writeFileSync(path.join(outDir, `${t.slug}.ttf`), ttf);
    fs.writeFileSync(path.join(outDir, `${t.slug}.woff`), woff);
  }
}

if (require.main === module) {
  const rootDir = path.join(__dirname, '..');
  const jsonPath = process.argv[2] || path.join(rootDir, 'fonts', 'cnsw-fonts.json');
  const outDir = process.argv[3] || path.join(rootDir, 'fonts');
  buildAll(jsonPath, outDir)
    .then(() => {
      console.log('Built all derived font files in', outDir);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { buildAll };
