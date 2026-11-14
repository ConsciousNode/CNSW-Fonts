'use strict';
const fs = require('fs');
const path = require('path');

const ALLOWED_IDENTICAL = new Set([' ', '.', ',', '-', '_', ':', "'", '|']);

function parseLegacy(filePath) {
  const map = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^(\d+)\s+([0-9a-fA-F]{16})/);
    if (!m) continue;
    const code = Number(m[1]);
    const hex = m[2];
    const rows = [];
    for (let r = 0; r < 8; r++) {
      const byte = parseInt(hex.slice(r * 2, r * 2 + 2), 16);
      let s = '';
      for (let c = 0; c < 8; c++) s += (byte & (0x80 >> c)) ? '#' : '.';
      rows.push(s);
    }
    map[code] = rows;
  }
  return map;
}

function hamming8(rowsA, rowsB, inkChar) {
  let d = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((rowsA[r][c] === inkChar) !== (rowsB[r][c] === '#')) d++;
    }
  }
  return d;
}

function hammingFull16(rows16, rows8) {
  let d = 0;
  for (let r = 0; r < 16; r++) {
    for (let c = 0; c < 8; c++) {
      const a = rows16[r][c] === '#';
      const b = r < 8 ? rows8[r][c] === '#' : false;
      if (a !== b) d++;
    }
  }
  return d;
}

function checkNotCopied(data, legSpiral, legTrit) {
  const identicalDisallowed = [];
  const nearMatches = [];

  for (const id of ['sans', 'serif', 'thesuramos']) {
    const f = data.fonts[id];
    const ink = f.type === 'ternary' ? '+' : '#';
    for (let code = 32; code <= 127; code++) {
      const ch = String.fromCharCode(code);
      const g = f.glyphs[String(code)];
      for (const [lname, leg] of [['spiralos', legSpiral], ['tritos', legTrit]]) {
        if (!leg[code]) continue;
        const dTop = hamming8(g, leg[code], ink);
        const dFull = id === 'serif' ? hammingFull16(g, leg[code]) : dTop;
        const d = Math.min(dTop, dFull);
        if (d === 0 && !ALLOWED_IDENTICAL.has(ch)) {
          identicalDisallowed.push(`${id}/${lname} ${code} '${ch}'`);
        } else if (d <= 2 && code !== 32) {
          nearMatches.push(`${id}/${lname} ${code} '${ch}' (d=${d})`);
        }
      }
    }
  }
  return { identicalDisallowed, nearMatches };
}

function run() {
  const rootDir = path.join(__dirname, '..');
  const data = JSON.parse(fs.readFileSync(path.join(rootDir, 'fonts', 'cnsw-fonts.json'), 'utf8'));
  const legSpiral = parseLegacy(path.join(rootDir, 'attached', 'spiralos-legacy-8x8.txt'));
  const legTrit = parseLegacy(path.join(rootDir, 'attached', 'tritos-legacy-8x8.txt'));

  const res = checkNotCopied(data, legSpiral, legTrit);

  // Positive control: paste one legacy glyph ('A', 65) into a scratch copy
  const scratch = JSON.parse(JSON.stringify(data));
  scratch.fonts.sans.glyphs['65'] = legSpiral[65].slice();
  const ctrl = checkNotCopied(scratch, legSpiral, legTrit);
  const ctrlCaught = ctrl.identicalDisallowed.length > 0;

  const pass = res.identicalDisallowed.length === 0 && ctrlCaught;
  console.log(`Test 9 (Not Copied): ${pass ? 'PASS' : 'FAIL'} — disallowed_identical=${res.identicalDisallowed.length}, within_2px=${res.nearMatches.length}, positive_control_caught=${ctrlCaught}`);
  if (res.nearMatches.length > 0) {
    console.log('  Within <=2px:', res.nearMatches.join('; '));
  }
  return pass;
}

if (require.main === module) process.exit(run() ? 0 : 1);
module.exports = { run };
