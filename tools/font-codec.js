// Authorship: ConsciousNode SoftWorks (MIT License) — tools/font-codec.js
// Shared font codecs, balanced-ternary tryte encoder/decoder, TrueType (.ttf) writer,
// and WOFF 1.0 writer. Works in both Node.js and browser environments.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CNSWFontCodec = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Fixed timestamp: 2026-11-13 00:00:00 UTC in seconds since 1904-01-01 00:00:00 UTC
  const MAC_EPOCH_OFFSET_SEC = 2082844800; // seconds from 1904-01-01 to 1970-01-01
  const FIXED_UNIX_SEC = Math.floor(Date.UTC(2026, 10, 13, 0, 0, 0) / 1000);
  const FIXED_MAC_SEC = FIXED_UNIX_SEC + MAC_EPOCH_OFFSET_SEC;

  function applyShadowRule(rows) {
    const h = rows.length;
    const w = rows[0].length;
    const out = [];
    for (let r = 0; r < h; r++) {
      let line = '';
      for (let c = 0; c < w; c++) {
        const isInk = r < 8 && c < 8 && rows[r][c] === '+';
        if (isInk) {
          line += '+';
        } else {
          const upLeftInk = r > 0 && c > 0 && rows[r - 1][c - 1] === '+';
          line += upLeftInk ? '-' : '0';
        }
      }
      out.push(line);
    }
    return out;
  }

  function encodeHex(font) {
    const lines = [];
    for (let code = 32; code <= 127; code++) {
      const rows = font.glyphs[String(code)];
      let hex = '';
      for (let r = 0; r < font.height; r++) {
        let byte = 0;
        const row = rows[r];
        for (let c = 0; c < 8; c++) {
          if (row[c] === '#') byte |= (0x80 >> c);
        }
        hex += byte.toString(16).padStart(2, '0');
      }
      lines.push(code + ' ' + hex);
    }
    return lines.join('\n') + '\n';
  }

  function decodeHex(hexText, width, height) {
    const glyphs = {};
    const lines = hexText.split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const m = line.match(/^(\d+)\s+([0-9a-fA-F]+)$/);
      if (!m) continue;
      const code = Number(m[1]);
      const hex = m[2];
      const rows = [];
      for (let r = 0; r < height; r++) {
        const byte = parseInt(hex.slice(r * 2, r * 2 + 2), 16);
        let row = '';
        for (let c = 0; c < width; c++) {
          row += (byte & (0x80 >> c)) ? '#' : '.';
        }
        rows.push(row);
      }
      glyphs[String(code)] = rows;
    }
    return glyphs;
  }

  function rowToTryte(rowStr) {
    let val = 0;
    for (let c = 0; c < 9; c++) {
      const ch = rowStr[c];
      const t = ch === '+' ? 1 : (ch === '-' ? -1 : 0);
      val = val * 3 + t;
    }
    return val;
  }

  function tryteToRow(val) {
    const trits = new Array(9);
    let n = val;
    for (let c = 8; c >= 0; c--) {
      let rem = ((n % 3) + 3) % 3;
      if (rem === 2) rem = -1;
      trits[c] = rem;
      n = (n - rem) / 3;
    }
    return trits.map((t) => (t === 1 ? '+' : t === -1 ? '-' : '0')).join('');
  }

  function encodeTryteAsm(font) {
    const lines = [];
    for (let code = 32; code <= 127; code++) {
      const rows = font.glyphs[String(code)];
      const vals = rows.map((r) => '#' + rowToTryte(r));
      const chLabel = code === 127 ? 'DEL' : (code === 32 ? ' ' : String.fromCharCode(code));
      lines.push(`.tryte ${vals.join(',')}  ; ${code} '${chLabel}'`);
    }
    return lines.join('\n') + '\n';
  }

  function decodeTryteAsm(asmText) {
    const glyphs = {};
    const lines = asmText.split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith(';')) continue;
      const m = line.match(/^\.tryte\s+([^;]+);\s*(\d+)/);
      if (!m) continue;
      const code = Number(m[2]);
      const vals = m[1].split(',').map((s) => Number(s.trim().replace(/^#/, '')));
      glyphs[String(code)] = vals.map(tryteToRow);
    }
    return glyphs;
  }

  // Extract binary 2D boolean grid from a font glyph for a given mode:
  // mode = 'ink' (default: '#' or '+') or 'shadow' ('-')
  function glyphToBoolGrid(rows, mode) {
    const h = rows.length;
    const w = rows[0].length;
    const target = mode === 'shadow' ? '-' : (rows[0].includes('+') || rows[0].includes('-') || rows.some(r => r.includes('+')) ? '+' : '#');
    const grid = [];
    for (let r = 0; r < h; r++) {
      const row = new Array(w);
      for (let c = 0; c < w; c++) {
        row[c] = rows[r][c] === target;
      }
      grid.push(row);
    }
    return grid;
  }

  // Trace merged pixel-boundary contours in TrueType Y-up coordinates.
  // Outer contours: clockwise (negative shoelace area in Y-up).
  // Hole contours: counter-clockwise (positive shoelace area in Y-up).
  function traceBitmapContours(boolGrid, width, height, pixelUnits, baselineRow) {
    const yTop = (baselineRow + 1) * pixelUnits;
    const isLit = (r, c) => r >= 0 && r < height && c >= 0 && c < width && boolGrid[r][c];

    // Directed boundary edges in grid coordinates (gx, gy), gy downward (0..height).
    // Lit pixel is always on the RIGHT of the directed edge.
    const edges = [];
    const outMap = new Map();

    function addEdge(x1, y1, x2, y2, dir) {
      const idx = edges.length;
      edges.push({ x1, y1, x2, y2, dir, used: false });
      const key = x1 + ',' + y1;
      let list = outMap.get(key);
      if (!list) {
        list = [];
        outMap.set(key, list);
      }
      list.push(idx);
    }

    // Directions: 0=Right(+x), 1=Down(+gy), 2=Left(-x), 3=Up(-gy)
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        if (!boolGrid[r][c]) continue;
        if (!isLit(r - 1, c)) addEdge(c, r, c + 1, r, 0);         // top edge -> Right
        if (!isLit(r, c + 1)) addEdge(c + 1, r, c + 1, r + 1, 1); // right edge -> Down
        if (!isLit(r + 1, c)) addEdge(c + 1, r + 1, c, r + 1, 2); // bottom edge -> Left
        if (!isLit(r, c - 1)) addEdge(c, r + 1, c, r, 3);         // left edge -> Up
      }
    }

    // At any vertex with multiple outgoing edges (diagonal pixel touch),
    // choose the sharpest right turn: (inDir + 1) % 4, then (inDir + 0) % 4, then (inDir + 3) % 4.
    const contours = [];
    for (let i = 0; i < edges.length; i++) {
      if (edges[i].used) continue;
      const pts = [];
      let cur = edges[i];
      cur.used = true;
      pts.push([cur.x1, cur.y1]);
      const startX = cur.x1;
      const startY = cur.y1;

      while (cur.x2 !== startX || cur.y2 !== startY) {
        pts.push([cur.x2, cur.y2]);
        const key = cur.x2 + ',' + cur.y2;
        const candidates = outMap.get(key) || [];
        // Prefer sharpest right turn relative to cur.dir
        const prefOrder = [(cur.dir + 1) % 4, cur.dir, (cur.dir + 3) % 4, (cur.dir + 2) % 4];
        let nextIdx = -1;
        for (const pDir of prefOrder) {
          for (const ci of candidates) {
            if (!edges[ci].used && edges[ci].dir === pDir) {
              nextIdx = ci;
              break;
            }
          }
          if (nextIdx !== -1) break;
        }
        if (nextIdx === -1) {
          throw new Error(`Open contour at (${cur.x2}, ${cur.y2})`);
        }
        cur = edges[nextIdx];
        cur.used = true;
      }

      // Simplify collinear points
      const simplified = [];
      const n = pts.length;
      for (let j = 0; j < n; j++) {
        const prev = pts[(j - 1 + n) % n];
        const curr = pts[j];
        const next = pts[(j + 1) % n];
        const dx1 = curr[0] - prev[0];
        const dy1 = curr[1] - prev[1];
        const dx2 = next[0] - curr[0];
        const dy2 = next[1] - curr[1];
        if (dx1 * dy2 - dy1 * dx2 !== 0) {
          simplified.push([
            curr[0] * pixelUnits,
            yTop - curr[1] * pixelUnits,
          ]);
        }
      }
      if (simplified.length >= 3) {
        contours.push(simplified);
      }
    }
    return contours;
  }

  // Binary buffer builder
  class ByteWriter {
    constructor() {
      this.buf = [];
    }
    u8(v) {
      this.buf.push(v & 0xff);
    }
    u16(v) {
      this.buf.push((v >>> 8) & 0xff, v & 0xff);
    }
    i16(v) {
      this.u16(v < 0 ? v + 65536 : v);
    }
    u32(v) {
      this.buf.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
    }
    i64(sec) {
      const hi = Math.floor(sec / 4294967296);
      const lo = sec >>> 0;
      this.u32(hi >>> 0);
      this.u32(lo);
    }
    tag(s) {
      for (let i = 0; i < 4; i++) this.u8(s.charCodeAt(i));
    }
    bytes(arr) {
      for (let i = 0; i < arr.length; i++) this.buf.push(arr[i] & 0xff);
    }
    pad4() {
      while (this.buf.length % 4 !== 0) this.buf.push(0);
    }
    toUint8Array() {
      return new Uint8Array(this.buf);
    }
  }

  function calcTableChecksum(u8) {
    const paddedLen = Math.ceil(u8.length / 4) * 4;
    let sum = 0;
    for (let i = 0; i < paddedLen; i += 4) {
      const b0 = u8[i] || 0;
      const b1 = u8[i + 1] || 0;
      const b2 = u8[i + 2] || 0;
      const b3 = u8[i + 3] || 0;
      const word = ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0;
      sum = (sum + word) >>> 0;
    }
    return sum;
  }

  function encodeGlyfSimple(contours) {
    if (!contours || contours.length === 0) {
      return { bytes: new Uint8Array(0), xMin: 0, yMin: 0, xMax: 0, yMax: 0 };
    }
    let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
    const allPts = [];
    const endPtsOfContours = [];
    for (const c of contours) {
      for (const [x, y] of c) {
        if (x < xMin) xMin = x;
        if (y < yMin) yMin = y;
        if (x > xMax) xMax = x;
        if (y > yMax) yMax = y;
        allPts.push([x, y]);
      }
      endPtsOfContours.push(allPts.length - 1);
    }

    const w = new ByteWriter();
    w.i16(contours.length);
    w.i16(xMin);
    w.i16(yMin);
    w.i16(xMax);
    w.i16(yMax);
    for (const ep of endPtsOfContours) w.u16(ep);
    w.u16(0); // instructionLength = 0

    // Flags: bit 0 = onCurve (1). Use 16-bit deltas for simplicity and exactness.
    for (let i = 0; i < allPts.length; i++) {
      w.u8(0x01); // on-curve, 16-bit dx, 16-bit dy
    }
    let prevX = 0;
    for (let i = 0; i < allPts.length; i++) {
      const dx = allPts[i][0] - prevX;
      w.i16(dx);
      prevX = allPts[i][0];
    }
    let prevY = 0;
    for (let i = 0; i < allPts.length; i++) {
      const dy = allPts[i][1] - prevY;
      w.i16(dy);
      prevY = allPts[i][1];
    }
    return { bytes: w.toUint8Array(), xMin, yMin, xMax, yMax };
  }

  function buildTTF(font, options) {
    const opts = options || {};
    const mode = opts.mode || 'ink';
    const familyName = opts.familyName || font.name;
    const pixelUnits = font.pixelUnits || 128;
    const unitsPerEm = font.unitsPerEm || (font.height * pixelUnits);
    const width = font.width;
    const height = font.height;
    const advanceWidth = width * pixelUnits;
    const baselineRow = font.metrics.baselineRow;
    const ascent = (baselineRow + 1) * pixelUnits;
    const descent = -((height - 1 - baselineRow) * pixelUnits);
    const capHeight = (baselineRow + 1 - font.metrics.capTopRow) * pixelUnits;
    const xHeight = (baselineRow + 1 - font.metrics.xTopRow) * pixelUnits;

    // Build glyphs: 0 = .notdef, 1..95 = ASCII 32..126 (code 127 omitted from TTF)
    const numGlyphs = 96; // 1 (.notdef) + 95 (32..126)
    const glyphEntries = [];

    // .notdef: empty box outline (CW outer, CCW inner)
    const u = pixelUnits;
    const boxW = Math.max(2 * u, (width - 1) * u);
    const boxTop = ascent;
    const boxBot = 0;
    const notdefContours = [
      [[0, boxBot], [0, boxTop], [boxW, boxTop], [boxW, boxBot]], // CW outer
      [[u, boxBot + u], [boxW - u, boxBot + u], [boxW - u, boxTop - u], [u, boxTop - u]], // CCW hole
    ];
    glyphEntries.push(encodeGlyfSimple(notdefContours));

    let maxPoints = 8;
    let maxContours = 2;
    let globalXMin = 0, globalYMin = 0, globalXMax = boxW, globalYMax = boxTop;

    for (let code = 32; code <= 126; code++) {
      const rows = font.glyphs[String(code)];
      const boolGrid = glyphToBoolGrid(rows, mode);
      const contours = traceBitmapContours(boolGrid, width, height, pixelUnits, baselineRow);
      const encoded = encodeGlyfSimple(contours);
      glyphEntries.push(encoded);

      let ptCount = 0;
      for (const c of contours) ptCount += c.length;
      if (ptCount > maxPoints) maxPoints = ptCount;
      if (contours.length > maxContours) maxContours = contours.length;
      if (contours.length > 0) {
        if (encoded.xMin < globalXMin) globalXMin = encoded.xMin;
        if (encoded.yMin < globalYMin) globalYMin = encoded.yMin;
        if (encoded.xMax > globalXMax) globalXMax = encoded.xMax;
        if (encoded.yMax > globalYMax) globalYMax = encoded.yMax;
      }
    }

    // 1. glyf + loca (use format 1: uint32 offsets / 1)
    const glyfW = new ByteWriter();
    const locaOffsets = [];
    for (const g of glyphEntries) {
      locaOffsets.push(glyfW.buf.length);
      if (g.bytes.length > 0) {
        glyfW.bytes(g.bytes);
        glyfW.pad4();
      }
    }
    locaOffsets.push(glyfW.buf.length);
    const glyfBytes = glyfW.toUint8Array();

    const locaW = new ByteWriter();
    for (const off of locaOffsets) locaW.u32(off);
    const locaBytes = locaW.toUint8Array();

    // 2. head
    const headW = new ByteWriter();
    headW.u32(0x00010000); // majorVersion 1, minorVersion 0
    headW.u32(0x00010000); // fontRevision 1.0
    headW.u32(0); // checkSumAdjustment placeholder
    headW.u32(0x5F0F3CF5); // magicNumber
    headW.u16(0x000B); // flags: baseline at y=0, lsb at x=0, integer scaling
    headW.u16(unitsPerEm);
    headW.i64(FIXED_MAC_SEC);
    headW.i64(FIXED_MAC_SEC);
    headW.i16(globalXMin);
    headW.i16(globalYMin);
    headW.i16(globalXMax);
    headW.i16(globalYMax);
    headW.u16(0); // macStyle
    headW.u16(8); // lowestRecPPEM
    headW.i16(2); // fontDirectionHint
    headW.i16(1); // indexToLocFormat = 1 (long offsets)
    headW.i16(0); // glyphDataFormat
    const headBytes = headW.toUint8Array();

    // 3. hhea
    const hheaW = new ByteWriter();
    hheaW.u32(0x00010000);
    hheaW.i16(ascent);
    hheaW.i16(descent);
    hheaW.i16(0); // lineGap
    hheaW.u16(advanceWidth);
    hheaW.i16(globalXMin);
    hheaW.i16(advanceWidth - globalXMax);
    hheaW.i16(globalXMax);
    hheaW.i16(1); // caretSlopeRise
    hheaW.i16(0); // caretSlopeRun
    hheaW.i16(0); // caretOffset
    hheaW.i16(0); hheaW.i16(0); hheaW.i16(0); hheaW.i16(0);
    hheaW.i16(0); // metricDataFormat
    hheaW.u16(numGlyphs); // numberOfHMetrics
    const hheaBytes = hheaW.toUint8Array();

    // 4. maxp
    const maxpW = new ByteWriter();
    maxpW.u32(0x00010000);
    maxpW.u16(numGlyphs);
    maxpW.u16(maxPoints);
    maxpW.u16(maxContours);
    maxpW.u16(0); // maxCompositePoints
    maxpW.u16(0); // maxCompositeContours
    maxpW.u16(1); // maxZones
    maxpW.u16(0); // maxTwilightPoints
    maxpW.u16(0); // maxStorage
    maxpW.u16(0); // maxFunctionDefs
    maxpW.u16(0); // maxInstructionDefs
    maxpW.u16(0); // maxStackElements
    maxpW.u16(0); // maxSizeOfInstructions
    maxpW.u16(0); // maxComponentElements
    maxpW.u16(0); // maxComponentDepth
    const maxpBytes = maxpW.toUint8Array();

    // 5. OS/2 (version 4)
    const os2W = new ByteWriter();
    os2W.u16(4); // version
    os2W.i16(advanceWidth); // xAvgCharWidth
    os2W.u16(400); // usWeightClass
    os2W.u16(5); // usWidthClass
    os2W.u16(0); // fsType (Installable)
    os2W.i16(Math.round(unitsPerEm * 0.5));
    os2W.i16(Math.round(unitsPerEm * 0.5));
    os2W.i16(0);
    os2W.i16(Math.round(unitsPerEm * 0.2));
    os2W.i16(Math.round(unitsPerEm * 0.5));
    os2W.i16(Math.round(unitsPerEm * 0.5));
    os2W.i16(0);
    os2W.i16(Math.round(unitsPerEm * 0.4));
    os2W.i16(Math.round(pixelUnits * 0.5)); // yStrikeoutSize
    os2W.i16(Math.round(xHeight * 0.5)); // yStrikeoutPosition
    os2W.i16(0); // sFamilyClass
    os2W.bytes([2, 0, 5, 9, 0, 0, 0, 0, 0, 0]); // panose (monospaced)
    os2W.u32(1); // ulUnicodeRange1 (Basic Latin)
    os2W.u32(0); os2W.u32(0); os2W.u32(0);
    os2W.tag('CNSW'); // achVendID
    os2W.u16(0x0040); // fsSelection (REGULAR)
    os2W.u16(32); // usFirstCharIndex
    os2W.u16(126); // usLastCharIndex
    os2W.i16(ascent); // sTypoAscender
    os2W.i16(descent); // sTypoDescender
    os2W.i16(0); // sTypoLineGap
    os2W.u16(ascent); // usWinAscent
    os2W.u16(Math.abs(descent)); // usWinDescent
    os2W.u32(1); // ulCodePageRange1 (Latin 1)
    os2W.u32(0);
    os2W.i16(xHeight); // sxHeight
    os2W.i16(capHeight); // sCapHeight
    os2W.u16(0); // usDefaultChar
    os2W.u16(32); // usBreakChar
    os2W.u16(0); // usMaxContext
    const os2Bytes = os2W.toUint8Array();

    // 6. hmtx
    const hmtxW = new ByteWriter();
    for (let i = 0; i < numGlyphs; i++) {
      hmtxW.u16(advanceWidth);
      const g = glyphEntries[i];
      hmtxW.i16(g.bytes.length > 0 ? g.xMin : 0);
    }
    const hmtxBytes = hmtxW.toUint8Array();

    // 7. cmap (format 4, platform 3 encoding 1 and platform 0 encoding 3)
    const cmapSubW = new ByteWriter();
    // 2 segments: [32..126] with idDelta = 1 - 32 = -31, and [0xFFFF..0xFFFF] with idDelta = 1
    const segCount = 2;
    const segCountX2 = segCount * 2;
    const searchRange = 4;
    const entrySelector = 1;
    const rangeShift = 0;
    cmapSubW.u16(4); // format
    cmapSubW.u16(32); // length (14 + 4*2 + 2 = 24? Let's compute: 7*2 + 2*4*2 + 2 = 14 + 16 + 2 = 32)
    cmapSubW.u16(0); // language
    cmapSubW.u16(segCountX2);
    cmapSubW.u16(searchRange);
    cmapSubW.u16(entrySelector);
    cmapSubW.u16(rangeShift);
    cmapSubW.u16(126); cmapSubW.u16(0xFFFF); // endCode
    cmapSubW.u16(0); // reservedPad
    cmapSubW.u16(32); cmapSubW.u16(0xFFFF); // startCode
    cmapSubW.i16(1 - 32); cmapSubW.i16(1); // idDelta
    cmapSubW.u16(0); cmapSubW.u16(0); // idRangeOffset
    const cmapSubBytes = cmapSubW.toUint8Array();

    const cmapW = new ByteWriter();
    cmapW.u16(0); // version
    cmapW.u16(2); // numTables
    // Record 1: platform 0, encoding 3
    cmapW.u16(0); cmapW.u16(3); cmapW.u32(4 + 16);
    // Record 2: platform 3, encoding 1
    cmapW.u16(3); cmapW.u16(1); cmapW.u32(4 + 16);
    cmapW.bytes(cmapSubBytes);
    const cmapBytes = cmapW.toUint8Array();

    // 8. name
    const psName = familyName.replace(/[^A-Za-z0-9-]/g, '');
    const nameStrings = [
      [0, '© 2026 ConsciousNode SoftWorks'],
      [1, familyName],
      [2, 'Regular'],
      [3, `CNSW:${psName}:2026`],
      [4, familyName],
      [5, 'Version 1.0'],
      [6, psName],
      [13, 'MIT License'],
    ];
    const encodedStrings = nameStrings.map(([id, str]) => {
      const bytes = [];
      for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        bytes.push((code >>> 8) & 0xff, code & 0xff);
      }
      return { id, bytes };
    });
    const nameW = new ByteWriter();
    nameW.u16(0); // format
    nameW.u16(encodedStrings.length);
    const storageOffset = 6 + encodedStrings.length * 12;
    nameW.u16(storageOffset);
    let strOff = 0;
    for (const s of encodedStrings) {
      nameW.u16(3); // Windows
      nameW.u16(1); // Unicode BMP
      nameW.u16(0x0409); // en-US
      nameW.u16(s.id);
      nameW.u16(s.bytes.length);
      nameW.u16(strOff);
      strOff += s.bytes.length;
    }
    for (const s of encodedStrings) {
      nameW.bytes(s.bytes);
    }
    const nameBytes = nameW.toUint8Array();

    // 9. post (format 3.0)
    const postW = new ByteWriter();
    postW.u32(0x00030000); // format 3.0
    postW.u32(0); // italicAngle
    postW.i16(Math.round(-pixelUnits)); // underlinePosition
    postW.i16(Math.round(pixelUnits * 0.5)); // underlineThickness
    postW.u32(1); // isFixedPitch = 1
    postW.u32(0); postW.u32(0); postW.u32(0); postW.u32(0);
    const postBytes = postW.toUint8Array();

    // Assemble SFNT tables sorted by tag
    const tables = [
      { tag: 'OS/2', data: os2Bytes },
      { tag: 'cmap', data: cmapBytes },
      { tag: 'glyf', data: glyfBytes },
      { tag: 'head', data: headBytes },
      { tag: 'hhea', data: hheaBytes },
      { tag: 'hmtx', data: hmtxBytes },
      { tag: 'loca', data: locaBytes },
      { tag: 'maxp', data: maxpBytes },
      { tag: 'name', data: nameBytes },
      { tag: 'post', data: postBytes },
    ].sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0));

    const numTables = tables.length;
    const entrySelectorT = Math.floor(Math.log2(numTables));
    const searchRangeT = Math.pow(2, entrySelectorT) * 16;
    const rangeShiftT = numTables * 16 - searchRangeT;

    const headerSize = 12 + numTables * 16;
    let offset = headerSize;
    let headOffset = 0;
    for (const t of tables) {
      t.offset = offset;
      t.length = t.data.length;
      t.checksum = calcTableChecksum(t.data);
      if (t.tag === 'head') headOffset = offset;
      offset += Math.ceil(t.length / 4) * 4;
    }

    const sfntW = new ByteWriter();
    sfntW.u32(0x00010000);
    sfntW.u16(numTables);
    sfntW.u16(searchRangeT);
    sfntW.u16(entrySelectorT);
    sfntW.u16(rangeShiftT);
    for (const t of tables) {
      sfntW.tag(t.tag);
      sfntW.u32(t.checksum);
      sfntW.u32(t.offset);
      sfntW.u32(t.length);
    }
    for (const t of tables) {
      sfntW.bytes(t.data);
      sfntW.pad4();
    }

    const sfnt = sfntW.toUint8Array();
    const wholeSum = calcTableChecksum(sfnt);
    const adj = (0xB1B0AFBA - wholeSum) >>> 0;
    sfnt[headOffset + 8] = (adj >>> 24) & 0xff;
    sfnt[headOffset + 9] = (adj >>> 16) & 0xff;
    sfnt[headOffset + 10] = (adj >>> 8) & 0xff;
    sfnt[headOffset + 11] = adj & 0xff;

    return sfnt;
  }

  // Build WOFF 1.0 from an SFNT Uint8Array using a supplied deflate(u8) -> Promise<Uint8Array> | Uint8Array
  async function buildWOFF(sfnt, deflateFn) {
    const view = new DataView(sfnt.buffer, sfnt.byteOffset, sfnt.byteLength);
    const flavor = view.getUint32(0, false);
    const numTables = view.getUint16(4, false);

    const tables = [];
    let totalSfntSize = 12 + numTables * 16;
    for (let i = 0; i < numTables; i++) {
      const recOff = 12 + i * 16;
      const tagBytes = sfnt.slice(recOff, recOff + 4);
      const tag = String.fromCharCode(tagBytes[0], tagBytes[1], tagBytes[2], tagBytes[3]);
      const checksum = view.getUint32(recOff + 4, false);
      const offset = view.getUint32(recOff + 8, false);
      const length = view.getUint32(recOff + 12, false);
      const raw = sfnt.slice(offset, offset + length);
      totalSfntSize += Math.ceil(length / 4) * 4;
      const comp = await deflateFn(raw);
      const useRaw = comp.length >= raw.length;
      tables.push({
        tagBytes,
        tag,
        origChecksum: checksum,
        origLength: length,
        data: useRaw ? raw : comp,
      });
    }

    const dirStart = 44;
    let dataOffset = dirStart + numTables * 20;
    for (const t of tables) {
      t.woffOffset = dataOffset;
      t.compLength = t.data.length;
      dataOffset += Math.ceil(t.compLength / 4) * 4;
    }

    const w = new ByteWriter();
    w.u32(0x774F4646); // 'wOFF'
    w.u32(flavor);
    w.u32(dataOffset); // total WOFF length
    w.u16(numTables);
    w.u16(0); // reserved
    w.u32(totalSfntSize);
    w.u16(1); // majorVersion
    w.u16(0); // minorVersion
    w.u32(0); w.u32(0); w.u32(0); // meta
    w.u32(0); w.u32(0); // priv
    for (const t of tables) {
      w.bytes(t.tagBytes);
      w.u32(t.woffOffset);
      w.u32(t.compLength);
      w.u32(t.origLength);
      w.u32(t.origChecksum);
    }
    for (const t of tables) {
      w.bytes(t.data);
      w.pad4();
    }
    return w.toUint8Array();
  }

  return {
    applyShadowRule,
    encodeHex,
    decodeHex,
    rowToTryte,
    tryteToRow,
    encodeTryteAsm,
    decodeTryteAsm,
    glyphToBoolGrid,
    traceBitmapContours,
    buildTTF,
    buildWOFF,
  };
});
