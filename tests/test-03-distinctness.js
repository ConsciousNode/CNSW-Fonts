'use strict';
const fs = require('fs');
const path = require('path');

const PAIRS = [
  ['O', '0'], ['I', 'l'], ['l', '1'], ['I', '1'],
  ['l', '|'], ['S', '5'], ['B', '8'], ['Z', '2'],
  ['o', '0'], ['u', 'v'], ['n', 'h'], ['c', 'e'],
];

function hamming(a, b, inkChar) {
  let d = 0;
  for (let r = 0; r < a.length; r++) {
    for (let c = 0; c < a[r].length; c++) {
      if ((a[r][c] === inkChar) !== (b[r][c] === inkChar)) d++;
    }
  }
  return d;
}

function checkFont(font) {
  const ink = font.type === 'ternary' ? '+' : '#';
  const seen = new Map();
  const dups = [];
  for (let c = 32; c <= 127; c++) {
    const key = font.glyphs[String(c)].join('\n');
    if (seen.has(key)) dups.push([seen.get(key), c]);
    seen.set(key, c);
  }
  const pairResults = PAIRS.map(([a, b]) => {
    const d = hamming(font.glyphs[String(a.charCodeAt(0))], font.glyphs[String(b.charCodeAt(0))], ink);
    return { pair: `${a}/${b}`, dist: d };
  });
  const badPairs = pairResults.filter((p) => p.dist < 3);
  return { dups, pairResults, ok: dups.length === 0 && badPairs.length === 0 };
}

function run() {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fonts', 'cnsw-fonts.json'), 'utf8'));
  let allOk = true;
  const summary = [];
  for (const id of ['sans', 'serif', 'thesuramos']) {
    const res = checkFont(data.fonts[id]);
    if (!res.ok) allOk = false;
    summary.push(`${id}: dups=${res.dups.length}, ` + res.pairResults.map((p) => `${p.pair}=${p.dist}`).join(' '));
  }

  // Positive control: copy 'O' into '0' in a scratch copy
  const scratch = JSON.parse(JSON.stringify(data.fonts.sans));
  scratch.glyphs['48'] = scratch.glyphs['79'].slice();
  const ctrlRes = checkFont(scratch);
  const ctrlCaught = !ctrlRes.ok;
  if (!ctrlCaught) allOk = false;

  console.log(`Test 3 (Distinctness): ${allOk ? 'PASS' : 'FAIL'} — positive_control_caught=${ctrlCaught}`);
  for (const line of summary) console.log('  ' + line);
  return allOk;
}

if (require.main === module) process.exit(run() ? 0 : 1);
module.exports = { run };
