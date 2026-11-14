'use strict';
const fs = require('fs');
const path = require('path');

function run() {
  const jsonPath = path.join(__dirname, '..', 'fonts', 'cnsw-fonts.json');
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const failures = [];
  let checkedGlyphs = 0;

  for (const id of ['sans', 'serif', 'thesuramos']) {
    const f = data.fonts[id];
    const keys = Object.keys(f.glyphs);
    if (keys.length !== 96) {
      failures.push(`${id}: expected 96 glyphs, got ${keys.length}`);
    }
    for (let code = 32; code <= 127; code++) {
      const rows = f.glyphs[String(code)];
      checkedGlyphs++;
      if (!Array.isArray(rows) || rows.length !== f.height) {
        failures.push(`${id} code ${code}: expected ${f.height} rows`);
        continue;
      }
      for (let r = 0; r < f.height; r++) {
        if (rows[r].length !== f.width) {
          failures.push(`${id} code ${code} row ${r}: expected width ${f.width}`);
        }
        if (f.type === 'binary') {
          if (rows[r][7] !== '.') {
            failures.push(`${id} code ${code} row ${r}: column 7 inked`);
          }
          if (id === 'sans' && r === 7 && rows[r].includes('#')) {
            const ch = String.fromCharCode(code);
            if (!f.descenders.includes(ch)) {
              failures.push(`sans code ${code} ('${ch}'): row 7 inked but not in descenders`);
            }
          }
        } else {
          for (let c = 0; c < f.width; c++) {
            if ((r === 8 || c === 8) && rows[r][c] === '+') {
              failures.push(`thesuramos code ${code} (${r},${c}): ink outside 0..7`);
            }
          }
        }
      }
    }
  }

  const pass = failures.length === 0;
  console.log(`Test 1 (Coverage & Bounds): ${pass ? 'PASS' : 'FAIL'} — checked ${checkedGlyphs} glyphs across 3 fonts, failures=${failures.length}`);
  if (!pass) failures.forEach((x) => console.log('  ', x));
  return pass;
}

if (require.main === module) process.exit(run() ? 0 : 1);
module.exports = { run };
