'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { buildAll } = require('../tools/build-fonts');

// [Audit fix, Kehai Interim 2026-11-13] WOFF tables are zlib-compressed, and different zlib builds
// emit different (equally valid) compressed bytes for the same input. Byte-comparing a .woff
// rebuilt on another machine therefore failed on content-identical files. WOFFs are now compared
// by header + table directory + DECOMPRESSED table data; reproducibility on one machine (b1 vs b2)
// is still byte-exact for every file.
function woffContent(buf) {
  const n = buf.readUInt16BE(12);
  const parts = [buf.slice(0, 44).toString('hex').replace(/^(.{16}).{8}/, '$1')]; // WOFF header minus its 'length' field (bytes 8..11), which depends on compression
  for (let i = 0; i < n; i++) {
    const o = 44 + i * 20;
    const tag = buf.toString('ascii', o, o + 4), off = buf.readUInt32BE(o + 4), cl = buf.readUInt32BE(o + 8), ol = buf.readUInt32BE(o + 12), cs = buf.readUInt32BE(o + 16);
    let d = buf.slice(off, off + cl); if (cl < ol) d = zlib.inflateSync(d);
    parts.push(tag + ':' + ol + ':' + cs + ':' + d.toString('hex'));
  }
  return parts.join('|');
}
function sameContent(f, a, b) { return f.endsWith('.woff') ? woffContent(a) === woffContent(b) : a.equals(b); }

const DERIVED_FILES = [
  'consciousnode-sans-8x8.hex',
  'cnsw-serif-8x16.hex',
  'times-new-thesuramos-9x9.tryte.asm',
  'consciousnode-sans.ttf',
  'consciousnode-sans.woff',
  'cnsw-serif.ttf',
  'cnsw-serif.woff',
  'times-new-thesuramos.ttf',
  'times-new-thesuramos.woff',
  'times-new-thesuramos-shadow.ttf',
  'times-new-thesuramos-shadow.woff',
];

async function run() {
  const rootDir = path.join(__dirname, '..');
  const jsonPath = path.join(rootDir, 'fonts', 'cnsw-fonts.json');
  const shippedDir = path.join(rootDir, 'fonts');
  const tmp1 = fs.mkdtempSync(path.join(os.tmpdir(), 'cnsw-b1-'));
  const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'cnsw-b2-'));

  await buildAll(jsonPath, tmp1);
  await buildAll(jsonPath, tmp2);

  let mismatches = 0;
  for (const f of DERIVED_FILES) {
    const bShipped = fs.readFileSync(path.join(shippedDir, f));
    const b1 = fs.readFileSync(path.join(tmp1, f));
    const b2 = fs.readFileSync(path.join(tmp2, f));
    if (!sameContent(f, bShipped, b1) || !b1.equals(b2)) {
      mismatches++;
      console.log('  Mismatch in', f);
    }
  }

  fs.rmSync(tmp1, { recursive: true, force: true });
  fs.rmSync(tmp2, { recursive: true, force: true });

  const pass = mismatches === 0;
  console.log(`Test 6 (Rebuild = Shipped & Reproducible): ${pass ? 'PASS' : 'FAIL'} — files_checked=${DERIVED_FILES.length}, mismatches=${mismatches}`);
  return pass;
}

if (require.main === module) run().then((ok) => process.exit(ok ? 0 : 1));
module.exports = { run };
