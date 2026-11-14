'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildAll } = require('../tools/build-fonts');

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
    if (!bShipped.equals(b1) || !b1.equals(b2)) {
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
