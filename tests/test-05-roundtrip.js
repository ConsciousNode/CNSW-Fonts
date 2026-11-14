'use strict';
const fs = require('fs');
const path = require('path');
const codec = require('../tools/font-codec');

// Second, independently written balanced-tryte decoder using explicit powers of 3
function independentDecodeTryte(val) {
  const powers = [6561, 2187, 729, 243, 81, 27, 9, 3, 1];
  let rem = val;
  let out = '';
  for (let i = 0; i < 9; i++) {
    const p = powers[i];
    const half = (p - 1) / 2;
    let t = 0;
    if (rem > half) t = 1;
    else if (rem < -half) t = -1;
    rem -= t * p;
    out += t === 1 ? '+' : (t === -1 ? '-' : '0');
  }
  if (rem !== 0) throw new Error(`Tryte ${val} did not decode cleanly`);
  return out;
}

function run() {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fonts', 'cnsw-fonts.json'), 'utf8'));
  let errors = 0;

  for (const id of ['sans', 'serif']) {
    const f = data.fonts[id];
    const hex = codec.encodeHex(f);
    const decoded = codec.decodeHex(hex, f.width, f.height);
    for (let code = 32; code <= 127; code++) {
      if (f.glyphs[String(code)].join('\n') !== decoded[String(code)].join('\n')) {
        errors++;
      }
    }
  }

  const thes = data.fonts.thesuramos;
  const asm = codec.encodeTryteAsm(thes);
  const decodedAsm = codec.decodeTryteAsm(asm);
  let trytesChecked = 0;
  for (let code = 32; code <= 127; code++) {
    const orig = thes.glyphs[String(code)];
    const dec = decodedAsm[String(code)];
    if (orig.join('\n') !== dec.join('\n')) errors++;
    for (let r = 0; r < 9; r++) {
      trytesChecked++;
      const val = codec.rowToTryte(orig[r]);
      if (independentDecodeTryte(val) !== orig[r]) errors++;
    }
  }

  const pass = errors === 0;
  console.log(`Test 5 (Format Round Trips): ${pass ? 'PASS' : 'FAIL'} — hex_glyphs=192, trytes_cross_checked=${trytesChecked}, errors=${errors}`);
  return pass;
}

if (require.main === module) process.exit(run() ? 0 : 1);
module.exports = { run };
