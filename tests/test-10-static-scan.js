'use strict';
const fs = require('fs');
const path = require('path');

function run() {
  const htmlPath = path.join(__dirname, '..', 'cnsw-font-forge.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const issues = [];

  const hasCsp = /<meta\s+http-equiv=["']Content-Security-Policy["']\s+content=["'][^"']*default-src\s+'none'[^"']*["']/i.test(html);
  if (!hasCsp) issues.push('Missing strict Content-Security-Policy meta tag');

  const forbidden = [
    ['fetch', /\bfetch\s*\(/],
    ['XMLHttpRequest', /\bXMLHttpRequest\b/],
    ['WebSocket', /\bWebSocket\b/],
    ['import(', /\bimport\s*\(/],
    ['external src/href', /\b(?:src|href)\s*=\s*["']https?:/i],
    ['localStorage', /\blocalStorage\b/],
    ['fillText', /\bfillText\s*\(/],
    ['strokeText', /\bstrokeText\s*\(/],
    ['measureText', /\bmeasureText\s*\(/],
  ];

  // Scan outside the JSON data block
  const withoutJson = html.replace(/<script id="cnsw-initial-fonts"[\s\S]*?<\/script>/, '');
  for (const [label, re] of forbidden) {
    if (re.test(withoutJson)) {
      issues.push(`Forbidden token found: ${label}`);
    }
  }

  // Check every <style> and <script> inline block has a provenance/authorship label
  const styleBlocks = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
  for (let i = 0; i < styleBlocks.length; i++) {
    if (!/(Authorship|Provenance):/i.test(styleBlocks[i])) {
      issues.push(`Style block ${i} missing provenance/authorship label`);
    }
  }
  const scriptRe = /(<script[^>]*>)([\s\S]*?)<\/script>/gi;
  let m;
  let scriptIdx = 0;
  while ((m = scriptRe.exec(html)) !== null) {
    const full = m[0];
    const startIdx = m.index;
    const preceding = html.slice(Math.max(0, startIdx - 140), startIdx);
    const hasLabel = /(Authorship|Provenance):/i.test(full.slice(0, 260)) || /(Authorship|Provenance):/i.test(preceding);
    if (!hasLabel) {
      issues.push(`Script block ${scriptIdx} missing provenance/authorship label`);
    }
    scriptIdx++;
  }

  const pass = issues.length === 0;
  console.log(`Test 10 (Static Scan): ${pass ? 'PASS' : 'FAIL'} — style_blocks=${styleBlocks.length}, script_blocks=${scriptIdx}, issues=${issues.length}`);
  if (!pass) issues.forEach((x) => console.log('  ', x));
  return pass;
}

if (require.main === module) process.exit(run() ? 0 : 1);
module.exports = { run };
