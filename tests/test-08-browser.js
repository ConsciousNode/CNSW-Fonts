'use strict';
const { execFileSync } = require('child_process');
const path = require('path');

function run() {
  const helper = path.join(__dirname, 'browser_helper.py');
  const out = execFileSync('python3', [helper], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  const rep = JSON.parse(out.trim());

  const expectedLoaded = [
    'ConsciousNode Sans',
    'CNSW Serif',
    'Times New Thesuramos',
    'Times New Thesuramos Shadow',
  ];
  const allFontsLoaded = expectedLoaded.every((n) => rep.loadedFonts.includes(n));
  const expectedDiffs = [['sans', 65, 0, 0], ['sans', 65, 0, 1], ['sans', 65, 6, 2]];
  const diffsMatch = JSON.stringify(rep.editDiffs) === JSON.stringify(expectedDiffs);
  const noErrors = rep.pageErrors.length === 0;

  const pass = noErrors && allFontsLoaded && diffsMatch && rep.reimportRestored;
  console.log(`Test 8 (Browser — Headless Chromium via chromedriver): ${pass ? 'PASS' : 'FAIL'} — page_errors=${rep.pageErrors.length}, woff_fonts_loaded=${rep.loadedFonts.length}/4, edit_diffs=${rep.editDiffs.length}, reimport_restored=${rep.reimportRestored}`);
  console.log('  Screenshots:', rep.screenshots.join(', '));
  console.log('  Chromium native TTF pixel match (informational):');
  for (const [f, m] of Object.entries(rep.ttfNativeMatch)) {
    console.log(`    ${f}: ${m.matched}/${m.total} (${m.pct}%)`);
  }
  return pass;
}

if (require.main === module) process.exit(run() ? 0 : 1);
module.exports = { run };
