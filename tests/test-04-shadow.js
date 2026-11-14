'use strict';
const fs = require('fs');
const path = require('path');

function checkShadow(font) {
  let violations = 0;
  let shadowCount = 0;
  for (let code = 32; code <= 127; code++) {
    const rows = font.glyphs[String(code)];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const ch = rows[r][c];
        if (ch === '+') continue;
        const upLeftInk = r > 0 && c > 0 && rows[r - 1][c - 1] === '+';
        const expected = upLeftInk ? '-' : '0';
        if (ch === '-') shadowCount++;
        if (ch !== expected) violations++;
      }
    }
  }
  return { violations, shadowCount };
}

function run() {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fonts', 'cnsw-fonts.json'), 'utf8'));
  const thes = data.fonts.thesuramos;
  const res = checkShadow(thes);

  // Positive control: flip one shadow trit in a scratch copy
  const scratch = JSON.parse(JSON.stringify(thes));
  const row0 = scratch.glyphs['65'][1].split('');
  row0[8] = row0[8] === '-' ? '0' : '-';
  scratch.glyphs['65'][1] = row0.join('');
  const ctrl = checkShadow(scratch);
  const ctrlCaught = ctrl.violations > 0;

  const pass = res.violations === 0 && ctrlCaught;
  console.log(`Test 4 (Shadow Rule): ${pass ? 'PASS' : 'FAIL'} — shadow_trits=${res.shadowCount}, violations=${res.violations}, positive_control_violations=${ctrl.violations}`);
  return pass;
}

if (require.main === module) process.exit(run() ? 0 : 1);
module.exports = { run };
