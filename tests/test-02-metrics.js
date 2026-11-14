'use strict';
const fs = require('fs');
const path = require('path');

function getBounds(rows, inkChar) {
  let minR = Infinity, maxR = -Infinity;
  for (let r = 0; r < rows.length; r++) {
    if (rows[r].includes(inkChar)) {
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
    }
  }
  return { minR, maxR };
}

function run() {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fonts', 'cnsw-fonts.json'), 'utf8'));
  const failures = [];
  let measured = 0;

  for (const id of ['sans', 'serif', 'thesuramos']) {
    const f = data.fonts[id];
    const ink = f.type === 'ternary' ? '+' : '#';
    const m = f.metrics;

    // Capitals A-Z
    for (let c = 65; c <= 90; c++) {
      measured++;
      const ch = String.fromCharCode(c);
      const b = getBounds(f.glyphs[String(c)], ink);
      if (b.minR !== m.capTopRow || b.maxR !== m.baselineRow) {
        failures.push({ font: id, glyph: ch, group: 'cap', minR: b.minR, maxR: b.maxR, expected: `${m.capTopRow}..${m.baselineRow}` });
      }
    }
    // x-height: a c e m n o r s u v w x z
    for (const ch of 'acemnorsuvwxz') {
      measured++;
      const b = getBounds(f.glyphs[String(ch.charCodeAt(0))], ink);
      if (b.minR !== m.xTopRow || b.maxR !== m.baselineRow) {
        failures.push({ font: id, glyph: ch, group: 'x-height', minR: b.minR, maxR: b.maxR, expected: `${m.xTopRow}..${m.baselineRow}` });
      }
    }
    // Ascenders: b d f h k l t
    for (const ch of 'bdfhklt') {
      measured++;
      const b = getBounds(f.glyphs[String(ch.charCodeAt(0))], ink);
      if (b.minR >= m.xTopRow || b.maxR > m.baselineRow) {
        failures.push({ font: id, glyph: ch, group: 'ascender', minR: b.minR, maxR: b.maxR, expected: `<${m.xTopRow}, <=${m.baselineRow}` });
      }
    }
    // Descenders: g j p q y
    for (const ch of 'gjpqy') {
      measured++;
      const b = getBounds(f.glyphs[String(ch.charCodeAt(0))], ink);
      if (b.maxR <= m.baselineRow) {
        failures.push({ font: id, glyph: ch, group: 'descender', minR: b.minR, maxR: b.maxR, expected: `>${m.baselineRow}` });
      }
    }
    // Digits 0-9
    for (let c = 48; c <= 57; c++) {
      measured++;
      const ch = String.fromCharCode(c);
      const b = getBounds(f.glyphs[String(c)], ink);
      if (b.minR < m.capTopRow || b.maxR > m.baselineRow) {
        failures.push({ font: id, glyph: ch, group: 'digit', minR: b.minR, maxR: b.maxR, expected: `${m.capTopRow}..${m.baselineRow}` });
      }
    }
  }

  const pass = failures.length === 0;
  console.log(`Test 2 (Declared Metrics): ${pass ? 'PASS' : 'FAIL'} — measured=${measured} glyphs, failures=${failures.length}`);
  if (failures.length > 0) {
    console.log('  font | glyph | group | minR..maxR | expected');
    for (const f of failures) {
      console.log(`  ${f.font} | ${f.glyph} | ${f.group} | ${f.minR}..${f.maxR} | ${f.expected}`);
    }
  }
  return pass;
}

if (require.main === module) process.exit(run() ? 0 : 1);
module.exports = { run };
