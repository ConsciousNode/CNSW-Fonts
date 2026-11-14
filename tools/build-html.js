#!/usr/bin/env node
'use strict';

// Authorship: ConsciousNode SoftWorks (MIT License) — tools/build-html.js
// Assembles self-contained cnsw-font-forge.html from source JSON, font-codec.js, and ttf-read.js.

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const jsonText = fs.readFileSync(path.join(rootDir, 'fonts', 'cnsw-fonts.json'), 'utf8').trim();
const codecJs = fs.readFileSync(path.join(rootDir, 'tools', 'font-codec.js'), 'utf8').trim();
const readerJs = fs.readFileSync(path.join(rootDir, 'tools', 'ttf-read.js'), 'utf8').trim();

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src blob: data:;">
<title>CNSW Font Forge</title>
<style>
/* Authorship: ConsciousNode SoftWorks (MIT License) — Forge UI stylesheet */
:root {
  --bg: #0f1216;
  --panel: #171c23;
  --border: #2a323d;
  --text: #e6edf3;
  --muted: #8b949e;
  --accent: #58a6ff;
  --ink: #f0f6fc;
  --shadow: #6e7681;
  --cell-bg: #0b0e12;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 20px;
  background: var(--bg);
  color: var(--text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.45;
}
h1, h2, h3 { margin: 0 0 10px 0; font-weight: 600; }
h1 { font-size: 18px; }
h2 { font-size: 15px; border-bottom: 1px solid var(--border); padding-bottom: 6px; margin-top: 20px; }
h3 { font-size: 13px; color: var(--muted); }
.topbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  background: var(--panel);
  border: 1px solid var(--border);
  padding: 12px 14px;
  border-radius: 6px;
  margin-bottom: 16px;
}
.btn-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
button, .file-label {
  background: #21262d;
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 5px 10px;
  font: inherit;
  cursor: pointer;
}
button:hover, .file-label:hover { border-color: var(--accent); }
button:disabled { opacity: 0.45; cursor: not-allowed; }
select, input[type="text"] {
  background: #0d1117;
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 5px 8px;
  font: inherit;
}
.layout {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 16px;
  align-items: start;
}
@media (max-width: 980px) {
  .layout { grid-template-columns: 1fr; }
}
.panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 14px;
}
.editor-grid {
  display: inline-grid;
  gap: 2px;
  background: var(--border);
  padding: 2px;
  border-radius: 4px;
  margin: 10px 0;
}
.cell-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 2px;
  background: var(--cell-bg);
  color: var(--muted);
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cell-btn.ink { background: var(--ink); color: #0f1216; font-weight: 700; }
.cell-btn.shadow { background: var(--shadow); color: #0f1216; }
.cell-btn.readonly { cursor: default; opacity: 0.75; }
.cell-btn.guide-col { outline: 1px dashed #3b4452; }
.glyph-picker {
  display: grid;
  grid-template-columns: repeat(16, 1fr);
  gap: 3px;
  margin-top: 8px;
}
.glyph-pick-btn {
  padding: 3px 0;
  font-size: 11px;
  text-align: center;
}
.glyph-pick-btn.active {
  border-color: var(--accent);
  background: #1f334d;
}
.specimen-card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 14px;
  margin-bottom: 16px;
}
.scale-block { margin: 10px 0; }
canvas.pixel-canvas {
  display: block;
  image-rendering: pixelated;
  background: #0b0e12;
  border: 1px solid var(--border);
  margin-top: 4px;
}
.status-line { color: var(--muted); font-size: 12px; margin-top: 6px; }
.hidden-input { display: none; }
</style>
</head>
<body>

<div class="topbar">
  <div>
    <h1>CNSW Font Forge</h1>
    <div class="status-line" id="status-line">Ready.</div>
  </div>
  <div class="btn-row">
    <label class="file-label">Import JSON <input type="file" id="import-json" accept=".json" class="hidden-input"></label>
    <button id="export-json">Export cnsw-fonts.json</button>
    <button id="export-sans-hex">Sans .hex</button>
    <button id="export-serif-hex">Serif .hex</button>
    <button id="export-thes-asm">Thesuramos .tryte.asm</button>
    <button id="export-all-ttf">Export 4 .ttf</button>
    <button id="export-all-woff">Export 4 .woff</button>
    <button id="verify-reader">Verify via Independent Reader</button>
  </div>
</div>

<!-- [Kehai 2026-11-14] Name your fonts: exported .ttf/.woff carry these names, so a font you make is yours, not "ConsciousNode Sans". -->
<div class="panel" id="naming-panel" style="margin:0 16px 12px">
  <h2>Your font's names (used by Export .ttf / .woff)</h2>
  <div class="btn-row" style="flex-wrap:wrap;gap:8px">
    <label>8x8 font <input id="name-sans" value="ConsciousNode Sans" size="22"></label>
    <label>8x16 font <input id="name-serif" value="CNSW Serif" size="18"></label>
    <label>9x9 trit font <input id="name-thes" value="Times New Thesuramos" size="22"></label>
    <label>Copyright <input id="name-copyright" value="© 2026 ConsciousNode SoftWorks" size="30"></label>
    <label>License <input id="name-license" value="MIT License" size="14"></label>
  </div>
  <div class="status-line">Made your own font? Give it your own name before exporting, so it never clashes with the CNSW fonts on the same computer. The shadow companion is named "&lt;9x9 name&gt; Shadow".</div>
</div>

<div class="layout">
  <div class="panel">
    <h2>Glyph Editor</h2>
    <div class="btn-row">
      <select id="editor-font">
        <option value="sans">ConsciousNode Sans (8x8)</option>
        <option value="serif">CNSW Serif (8x16)</option>
        <option value="thesuramos">Times New Thesuramos (9x9)</option>
      </select>
      <button id="editor-undo" disabled>Undo</button>
    </div>
    <div class="status-line" id="editor-glyph-info">Code 65 ('A')</div>
    <div id="editor-grid" class="editor-grid"></div>
    <h3>Live Running Text Preview (2x)</h3>
    <input type="text" id="live-text-input" value="Sphinx of black quartz, judge my vow! O0 Il1| S5 B8 Z2" style="width:100%; margin-bottom:6px;">
    <canvas id="live-preview-canvas" class="pixel-canvas"></canvas>
    <h3>Glyph Picker (ASCII 32..127)</h3>
    <div id="glyph-picker" class="glyph-picker"></div>
  </div>

  <div id="specimens-container"></div>
</div>

<!-- Authorship: ConsciousNode SoftWorks (MIT License) — Embedded initial cnsw-fonts.json -->
<script id="cnsw-initial-fonts" type="application/json">
${jsonText}
</script>

<!-- Authorship: ConsciousNode SoftWorks (MIT License) — Shared font codecs & TrueType/WOFF writer (tools/font-codec.js) -->
<script>
${codecJs}
</script>

<!-- Authorship: ConsciousNode SoftWorks (MIT License) — Independent TrueType/WOFF reader (tools/ttf-read.js) -->
<script>
${readerJs}
</script>

<!-- Authorship: ConsciousNode SoftWorks (MIT License) — CNSW Font Forge UI controller -->
<script>
(function () {
  'use strict';

  const codec = window.CNSWFontCodec;
  const reader = window.CNSWTtfRead;

  let fontData = JSON.parse(document.getElementById('cnsw-initial-fonts').textContent);
  let currentFontId = 'sans';
  let currentCode = 65;
  const undoStack = [];

  const statusEl = document.getElementById('status-line');
  const fontSelect = document.getElementById('editor-font');
  const undoBtn = document.getElementById('editor-undo');
  const glyphInfoEl = document.getElementById('editor-glyph-info');
  const gridEl = document.getElementById('editor-grid');
  const pickerEl = document.getElementById('glyph-picker');
  const liveInput = document.getElementById('live-text-input');
  const liveCanvas = document.getElementById('live-preview-canvas');
  const specimensEl = document.getElementById('specimens-container');

  function setStatus(msg) {
    statusEl.textContent = msg;
  }

  async function browserDeflate(u8) {
    const cs = new CompressionStream('deflate');
    const writer = cs.writable.getWriter();
    writer.write(u8);
    writer.close();
    const buf = await new Response(cs.readable).arrayBuffer();
    return new Uint8Array(buf);
  }

  async function browserInflate(u8) {
    const ds = new DecompressionStream('deflate');
    const writer = ds.writable.getWriter();
    writer.write(u8);
    writer.close();
    const buf = await new Response(ds.readable).arrayBuffer();
    return new Uint8Array(buf);
  }

  function downloadBytes(filename, bytes, mime) {
    const blob = new Blob([bytes], { type: mime || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function drawGlyphOnCtx(ctx, font, code, x0, y0, scale) {
    const rows = font.glyphs[String(code)] || font.glyphs['32'];
    for (let r = 0; r < font.height; r++) {
      const row = rows[r];
      for (let c = 0; c < font.width; c++) {
        const ch = row[c];
        if (ch === '#' || ch === '+') {
          ctx.fillStyle = '#f0f6fc';
          ctx.fillRect(x0 + c * scale, y0 + r * scale, scale, scale);
        } else if (ch === '-') {
          ctx.fillStyle = '#6e7681';
          ctx.fillRect(x0 + c * scale, y0 + r * scale, scale, scale);
        }
      }
    }
  }

  function renderTextToCanvas(canvas, font, text, scale) {
    const cols = Math.max(1, text.length);
    canvas.width = cols * font.width * scale + 8;
    canvas.height = font.height * scale + 8;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0b0e12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      const validCode = code >= 32 && code <= 127 ? code : 32;
      drawGlyphOnCtx(ctx, font, validCode, 4 + i * font.width * scale, 4, scale);
    }
  }

  function renderSpecimenGrid(canvas, font, scale) {
    const cols = 16;
    const rows = 6; // 96 glyphs
    const pad = 2;
    const cellW = font.width * scale + pad;
    const cellH = font.height * scale + pad;
    canvas.width = cols * cellW + pad;
    canvas.height = rows * cellH + pad;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0b0e12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < 96; i++) {
      const gx = i % cols;
      const gy = Math.floor(i / cols);
      drawGlyphOnCtx(ctx, font, 32 + i, pad + gx * cellW, pad + gy * cellH, scale);
    }
  }

  function renderSpecimens() {
    specimensEl.innerHTML = '';
    const order = ['sans', 'serif', 'thesuramos'];
    for (const id of order) {
      const font = fontData.fonts[id];
      const card = document.createElement('div');
      card.className = 'specimen-card';
      card.setAttribute('data-font-card', id);

      const h2 = document.createElement('h2');
      h2.textContent = font.name + ' (' + font.width + 'x' + font.height + ', ' + font.type + ')';
      card.appendChild(h2);

      const mInfo = document.createElement('div');
      mInfo.className = 'status-line';
      const m = font.metrics;
      mInfo.textContent = 'Metrics: capTopRow=' + m.capTopRow + ', xTopRow=' + m.xTopRow + ', baselineRow=' + m.baselineRow + ', descenderRow=' + m.descenderRow;
      card.appendChild(mInfo);

      for (const scale of [1, 2, 4]) {
        const blk = document.createElement('div');
        blk.className = 'scale-block';
        const lbl = document.createElement('h3');
        lbl.textContent = 'Full Glyph Grid (' + scale + 'x)';
        blk.appendChild(lbl);
        const cv = document.createElement('canvas');
        cv.className = 'pixel-canvas';
        cv.setAttribute('data-specimen', id + '-' + scale + 'x');
        renderSpecimenGrid(cv, font, scale);
        blk.appendChild(cv);
        card.appendChild(blk);
      }

      const pBlk = document.createElement('div');
      pBlk.className = 'scale-block';
      const pLbl = document.createElement('h3');
      pLbl.textContent = 'Pangram & Confusables (2x)';
      pBlk.appendChild(pLbl);
      const pCv = document.createElement('canvas');
      pCv.className = 'pixel-canvas';
      renderTextToCanvas(pCv, font, 'The quick brown fox jumps over a lazy dog. 0123456789', 2);
      pBlk.appendChild(pCv);

      const cCv = document.createElement('canvas');
      cCv.className = 'pixel-canvas';
      renderTextToCanvas(cCv, font, 'O0 Il1| S5 B8 Z2 rn m  !?@#$%&*+-=/:;.,', 2);
      pBlk.appendChild(cCv);
      card.appendChild(pBlk);

      specimensEl.appendChild(card);
    }
  }

  function renderPicker() {
    pickerEl.innerHTML = '';
    for (let code = 32; code <= 127; code++) {
      const btn = document.createElement('button');
      btn.className = 'glyph-pick-btn' + (code === currentCode ? ' active' : '');
      btn.textContent = code === 32 ? 'SP' : (code === 127 ? 'DEL' : String.fromCharCode(code));
      btn.title = 'ASCII ' + code;
      btn.setAttribute('data-pick-code', String(code));
      btn.addEventListener('click', () => {
        currentCode = code;
        renderEditor();
        renderPicker();
      });
      pickerEl.appendChild(btn);
    }
  }

  function renderEditor() {
    const font = fontData.fonts[currentFontId];
    const rows = font.glyphs[String(currentCode)];
    const label = currentCode === 127 ? 'DEL' : String.fromCharCode(currentCode);
    glyphInfoEl.textContent = font.name + ' — Code ' + currentCode + " ('" + label + "')";

    gridEl.style.gridTemplateColumns = 'repeat(' + font.width + ', 28px)';
    gridEl.innerHTML = '';
    for (let r = 0; r < font.height; r++) {
      for (let c = 0; c < font.width; c++) {
        const ch = rows[r][c];
        const btn = document.createElement('button');
        btn.className = 'cell-btn';
        btn.setAttribute('data-row', String(r));
        btn.setAttribute('data-col', String(c));
        if (ch === '#' || ch === '+') {
          btn.classList.add('ink');
          btn.textContent = ch;
        } else if (ch === '-') {
          btn.classList.add('shadow');
          btn.textContent = '-';
        }
        const isTernaryShadowZone = font.type === 'ternary' && (r === 8 || c === 8);
        if (isTernaryShadowZone) {
          btn.classList.add('readonly');
          btn.disabled = true;
        } else {
          btn.addEventListener('click', () => toggleCell(r, c));
        }
        gridEl.appendChild(btn);
      }
    }
    undoBtn.disabled = undoStack.length === 0;
    renderTextToCanvas(liveCanvas, font, liveInput.value, 2);
  }

  function toggleCell(r, c) {
    const font = fontData.fonts[currentFontId];
    const key = String(currentCode);
    const prevRows = font.glyphs[key].slice();
    undoStack.push({ fontId: currentFontId, code: currentCode, rows: prevRows });

    if (font.type === 'binary') {
      const row = prevRows[r].split('');
      row[c] = row[c] === '#' ? '.' : '#';
      prevRows[r] = row.join('');
      font.glyphs[key] = prevRows;
    } else {
      const row = prevRows[r].split('');
      row[c] = row[c] === '+' ? '0' : '+';
      prevRows[r] = row.join('');
      font.glyphs[key] = codec.applyShadowRule(prevRows);
    }
    renderEditor();
    renderSpecimens();
  }

  undoBtn.addEventListener('click', () => {
    if (undoStack.length === 0) return;
    const item = undoStack.pop();
    fontData.fonts[item.fontId].glyphs[String(item.code)] = item.rows;
    currentFontId = item.fontId;
    currentCode = item.code;
    fontSelect.value = currentFontId;
    renderEditor();
    renderPicker();
    renderSpecimens();
  });

  fontSelect.addEventListener('change', () => {
    currentFontId = fontSelect.value;
    renderEditor();
    renderPicker();
  });

  liveInput.addEventListener('input', () => {
    renderTextToCanvas(liveCanvas, fontData.fonts[currentFontId], liveInput.value, 2);
  });

  document.getElementById('export-json').addEventListener('click', () => {
    const text = JSON.stringify(fontData, null, 2) + String.fromCharCode(10);
    downloadBytes('cnsw-fonts.json', new TextEncoder().encode(text), 'application/json');
    setStatus('Exported cnsw-fonts.json');
  });

  document.getElementById('import-json').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const text = await file.text();
    fontData = JSON.parse(text);
    undoStack.length = 0;
    renderEditor();
    renderPicker();
    renderSpecimens();
    setStatus('Imported ' + file.name);
    e.target.value = '';
  });

  document.getElementById('export-sans-hex').addEventListener('click', () => {
    const hex = codec.encodeHex(fontData.fonts.sans);
    downloadBytes('consciousnode-sans-8x8.hex', new TextEncoder().encode(hex), 'text/plain');
    setStatus('Exported consciousnode-sans-8x8.hex');
  });

  document.getElementById('export-serif-hex').addEventListener('click', () => {
    const hex = codec.encodeHex(fontData.fonts.serif);
    downloadBytes('cnsw-serif-8x16.hex', new TextEncoder().encode(hex), 'text/plain');
    setStatus('Exported cnsw-serif-8x16.hex');
  });

  document.getElementById('export-thes-asm').addEventListener('click', () => {
    const asm = codec.encodeTryteAsm(fontData.fonts.thesuramos);
    downloadBytes('times-new-thesuramos-9x9.tryte.asm', new TextEncoder().encode(asm), 'text/plain');
    setStatus('Exported times-new-thesuramos-9x9.tryte.asm');
  });

  // [Kehai 2026-11-14] names come from the "Your font's names" panel (defaults = the CNSW names).
  function nameOf(id, fallback) {
    const el = document.getElementById(id);
    const v = el ? el.value.replace(/[^\x20-\x7E\u00A9]/g, '').trim().slice(0, 48) : '';
    return v || fallback;
  }
  function slugOf(name) { return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'font'; }
  function getTargets() {
    const sans = nameOf('name-sans', 'ConsciousNode Sans');
    const serif = nameOf('name-serif', 'CNSW Serif');
    const thes = nameOf('name-thes', 'Times New Thesuramos');
    const copyright = nameOf('name-copyright', '© 2026 ConsciousNode SoftWorks');
    const license = nameOf('name-license', 'MIT License');
    const official = sans === 'ConsciousNode Sans' && serif === 'CNSW Serif' && thes === 'Times New Thesuramos';
    const extra = { copyright, license, idPrefix: official ? 'CNSW' : slugOf(sans).slice(0, 12).toUpperCase() };
    return [
      { font: fontData.fonts.sans, slug: slugOf(sans), opts: Object.assign({ mode: 'ink', familyName: sans }, extra) },
      { font: fontData.fonts.serif, slug: slugOf(serif), opts: Object.assign({ mode: 'ink', familyName: serif }, extra) },
      { font: fontData.fonts.thesuramos, slug: slugOf(thes), opts: Object.assign({ mode: 'ink', familyName: thes }, extra) },
      { font: fontData.fonts.thesuramos, slug: slugOf(thes + ' shadow'), opts: Object.assign({ mode: 'shadow', familyName: thes + ' Shadow' }, extra) },
    ];
  }

  document.getElementById('export-all-ttf').addEventListener('click', () => {
    for (const t of getTargets()) {
      const ttf = codec.buildTTF(t.font, t.opts);
      downloadBytes(t.slug + '.ttf', ttf, 'font/ttf');
    }
    setStatus('Exported 4 .ttf files');
  });

  document.getElementById('export-all-woff').addEventListener('click', async () => {
    for (const t of getTargets()) {
      const ttf = codec.buildTTF(t.font, t.opts);
      const woff = await codec.buildWOFF(ttf, browserDeflate);
      downloadBytes(t.slug + '.woff', woff, 'font/woff');
    }
    setStatus('Exported 4 .woff files');
  });

  async function loadWoffFaces() {
    const loaded = [];
    for (const t of getTargets()) {
      const ttf = codec.buildTTF(t.font, t.opts);
      const woff = await codec.buildWOFF(ttf, browserDeflate);
      const face = new FontFace(t.opts.familyName, woff);
      await face.load();
      document.fonts.add(face);
      loaded.push(t.opts.familyName);
    }
    return loaded;
  }

  document.getElementById('verify-reader').addEventListener('click', async () => {
    const results = [];
    for (const t of getTargets()) {
      const ttf = codec.buildTTF(t.font, t.opts);
      const woff = await codec.buildWOFF(ttf, browserDeflate);
      const sfnt = await reader.decompressWoffToSfnt(woff, browserInflate);
      const parsed = reader.parseSfnt(sfnt);
      let diff = 0;
      for (let code = 32; code <= 126; code++) {
        const gid = parsed.cmapMap.get(code);
        const rast = reader.rasterizeGlyph(parsed.glyphs[gid].contours, t.font.width, t.font.height, t.font.pixelUnits, t.font.metrics.baselineRow);
        const orig = t.font.glyphs[String(code)];
        const target = t.opts.mode === 'shadow' ? '-' : (t.font.type === 'ternary' ? '+' : '#');
        for (let r = 0; r < t.font.height; r++) {
          for (let c = 0; c < t.font.width; c++) {
            if ((rast[r][c] === '#') !== (orig[r][c] === target)) diff++;
          }
        }
      }
      results.push(t.slug + ': ' + (parsed.checkSumAdjustmentValid && diff === 0 ? 'OK' : 'FAIL(' + diff + ')'));
    }
    setStatus('Independent reader check: ' + results.join(', '));
  });

  // Expose minimal test hooks on window for automated browser verification
  window.CNSWForge = {
    getJsonString: () => JSON.stringify(fontData, null, 2) + String.fromCharCode(10),
    importJsonString: (s) => {
      fontData = JSON.parse(s);
      undoStack.length = 0;
      renderEditor();
      renderPicker();
      renderSpecimens();
    },
    loadWoffFaces,
    buildWoffBytes: async () => {
      const out = {};
      for (const t of getTargets()) {
        const ttf = codec.buildTTF(t.font, t.opts);
        out[t.slug] = Array.from(await codec.buildWOFF(ttf, browserDeflate));
      }
      return out;
    },
  };

  renderEditor();
  renderPicker();
  renderSpecimens();
  loadWoffFaces()
    .then((names) => setStatus('Loaded WOFF FontFaces: ' + names.join(', ')))
    .catch((err) => setStatus('FontFace load error: ' + err.message));
})();
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(rootDir, 'cnsw-font-forge.html'), html, 'utf8');
console.log('Wrote cnsw-font-forge.html (' + html.length + ' bytes)');
