// Authorship: ConsciousNode SoftWorks (MIT License) — tools/ttf-read.js
// Independent TrueType (.ttf) and WOFF 1.0 (.woff) reader & rasterizer.
// Shares NO code with tools/font-codec.js.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CNSWTtfRead = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function readU16(u8, off) {
    return (u8[off] << 8) | u8[off + 1];
  }
  function readI16(u8, off) {
    const v = (u8[off] << 8) | u8[off + 1];
    return v >= 0x8000 ? v - 0x10000 : v;
  }
  function readU32(u8, off) {
    return ((u8[off] << 24) | (u8[off + 1] << 16) | (u8[off + 2] << 8) | u8[off + 3]) >>> 0;
  }
  function readTag(u8, off) {
    return String.fromCharCode(u8[off], u8[off + 1], u8[off + 2], u8[off + 3]);
  }

  function sumWords(u8, start, length) {
    let sum = 0;
    const end = start + length;
    for (let p = start; p < end; p += 4) {
      const b0 = p < end ? u8[p] : 0;
      const b1 = p + 1 < end ? u8[p + 1] : 0;
      const b2 = p + 2 < end ? u8[p + 2] : 0;
      const b3 = p + 3 < end ? u8[p + 3] : 0;
      sum = (sum + (((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0)) >>> 0;
    }
    return sum;
  }

  async function decompressWoffToSfnt(woffBytes, inflateFn) {
    if (readTag(woffBytes, 0) !== 'wOFF') {
      throw new Error('Not a WOFF 1.0 file');
    }
    const flavor = readU32(woffBytes, 4);
    const numTables = readU16(woffBytes, 12);
    const entries = [];
    for (let i = 0; i < numTables; i++) {
      const base = 44 + i * 20;
      const tag = readTag(woffBytes, base);
      const offset = readU32(woffBytes, base + 4);
      const compLength = readU32(woffBytes, base + 8);
      const origLength = readU32(woffBytes, base + 12);
      const origChecksum = readU32(woffBytes, base + 16);
      const slice = woffBytes.slice(offset, offset + compLength);
      const raw = compLength === origLength ? slice : await inflateFn(slice);
      if (raw.length !== origLength) {
        throw new Error(`WOFF table ${tag} length mismatch: got ${raw.length}, expected ${origLength}`);
      }
      entries.push({ tag, origChecksum, origLength, raw });
    }

    const headerLen = 12 + numTables * 16;
    let totalLen = headerLen;
    for (const e of entries) {
      e.sfntOffset = totalLen;
      totalLen += Math.ceil(e.origLength / 4) * 4;
    }
    const sfnt = new Uint8Array(totalLen);
    // Write sfnt header
    sfnt[0] = (flavor >>> 24) & 0xff;
    sfnt[1] = (flavor >>> 16) & 0xff;
    sfnt[2] = (flavor >>> 8) & 0xff;
    sfnt[3] = flavor & 0xff;
    sfnt[4] = (numTables >>> 8) & 0xff;
    sfnt[5] = numTables & 0xff;
    const entrySel = Math.floor(Math.log2(numTables));
    const searchR = Math.pow(2, entrySel) * 16;
    const rangeS = numTables * 16 - searchR;
    sfnt[6] = (searchR >>> 8) & 0xff; sfnt[7] = searchR & 0xff;
    sfnt[8] = (entrySel >>> 8) & 0xff; sfnt[9] = entrySel & 0xff;
    sfnt[10] = (rangeS >>> 8) & 0xff; sfnt[11] = rangeS & 0xff;

    for (let i = 0; i < numTables; i++) {
      const e = entries[i];
      const rec = 12 + i * 16;
      for (let k = 0; k < 4; k++) sfnt[rec + k] = e.tag.charCodeAt(k);
      const vals = [e.origChecksum, e.sfntOffset, e.origLength];
      for (let v = 0; v < 3; v++) {
        const x = vals[v];
        sfnt[rec + 4 + v * 4] = (x >>> 24) & 0xff;
        sfnt[rec + 5 + v * 4] = (x >>> 16) & 0xff;
        sfnt[rec + 6 + v * 4] = (x >>> 8) & 0xff;
        sfnt[rec + 7 + v * 4] = x & 0xff;
      }
      sfnt.set(e.raw, e.sfntOffset);
    }
    return sfnt;
  }

  function parseSfnt(sfnt) {
    const sfntVersion = readU32(sfnt, 0);
    if (sfntVersion !== 0x00010000) {
      throw new Error(`Unsupported sfnt version: 0x${sfntVersion.toString(16)}`);
    }
    const numTables = readU16(sfnt, 4);
    const tables = {};
    const checksumErrors = [];

    for (let i = 0; i < numTables; i++) {
      const rec = 12 + i * 16;
      const tag = readTag(sfnt, rec);
      const checksum = readU32(sfnt, rec + 4);
      const offset = readU32(sfnt, rec + 8);
      const length = readU32(sfnt, rec + 12);
      tables[tag] = { tag, checksum, offset, length };

      let computed = sumWords(sfnt, offset, length);
      if (tag === 'head') {
        // Subtract checkSumAdjustment field (at offset + 8)
        const adj = readU32(sfnt, offset + 8);
        computed = (computed - adj) >>> 0;
      }
      if (computed !== checksum) {
        checksumErrors.push(`${tag}: expected 0x${checksum.toString(16)}, got 0x${computed.toString(16)}`);
      }
    }

    const wholeSum = sumWords(sfnt, 0, sfnt.length);
    const checkSumAdjustmentValid = wholeSum === 0xB1B0AFBA;

    // Parse head
    const headOff = tables.head.offset;
    const head = {
      unitsPerEm: readU16(sfnt, headOff + 18),
      xMin: readI16(sfnt, headOff + 36),
      yMin: readI16(sfnt, headOff + 38),
      xMax: readI16(sfnt, headOff + 40),
      yMax: readI16(sfnt, headOff + 42),
      indexToLocFormat: readI16(sfnt, headOff + 50),
    };

    // Parse hhea
    const hheaOff = tables.hhea.offset;
    const hhea = {
      ascent: readI16(sfnt, hheaOff + 4),
      descent: readI16(sfnt, hheaOff + 6),
      lineGap: readI16(sfnt, hheaOff + 8),
      advanceWidthMax: readU16(sfnt, hheaOff + 10),
      numberOfHMetrics: readU16(sfnt, hheaOff + 34),
    };

    // Parse maxp
    const maxpOff = tables.maxp.offset;
    const maxp = {
      numGlyphs: readU16(sfnt, maxpOff + 4),
    };

    // Parse hmtx
    const hmtxOff = tables.hmtx.offset;
    const advances = [];
    for (let g = 0; g < maxp.numGlyphs; g++) {
      if (g < hhea.numberOfHMetrics) {
        advances.push(readU16(sfnt, hmtxOff + g * 4));
      } else {
        advances.push(advances[hhea.numberOfHMetrics - 1]);
      }
    }

    // Parse cmap (find format 4 subtable)
    const cmapOff = tables.cmap.offset;
    const cmapCount = readU16(sfnt, cmapOff + 2);
    let subOff = -1;
    for (let i = 0; i < cmapCount; i++) {
      const rOff = cmapOff + 4 + i * 8;
      const plat = readU16(sfnt, rOff);
      const enc = readU16(sfnt, rOff + 2);
      const rel = readU32(sfnt, rOff + 4);
      if ((plat === 3 && enc === 1) || (plat === 0 && enc === 3)) {
        subOff = cmapOff + rel;
        break;
      }
    }
    const cmapMap = new Map();
    if (subOff !== -1 && readU16(sfnt, subOff) === 4) {
      const segCount = readU16(sfnt, subOff + 6) / 2;
      const endCodesOff = subOff + 14;
      const startCodesOff = endCodesOff + segCount * 2 + 2;
      const idDeltaOff = startCodesOff + segCount * 2;
      const idRangeOff = idDeltaOff + segCount * 2;
      for (let s = 0; s < segCount; s++) {
        const endC = readU16(sfnt, endCodesOff + s * 2);
        const startC = readU16(sfnt, startCodesOff + s * 2);
        const delta = readI16(sfnt, idDeltaOff + s * 2);
        const range = readU16(sfnt, idRangeOff + s * 2);
        if (startC === 0xFFFF && endC === 0xFFFF) continue;
        for (let code = startC; code <= endC; code++) {
          let gid = 0;
          if (range === 0) {
            gid = (code + delta) & 0xffff;
          } else {
            const addr = idRangeOff + s * 2 + range + (code - startC) * 2;
            const gVal = readU16(sfnt, addr);
            gid = gVal === 0 ? 0 : ((gVal + delta) & 0xffff);
          }
          cmapMap.set(code, gid);
        }
      }
    }

    // Parse loca
    const locaOff = tables.loca.offset;
    const glyphOffsets = [];
    for (let g = 0; g <= maxp.numGlyphs; g++) {
      if (head.indexToLocFormat === 1) {
        glyphOffsets.push(readU32(sfnt, locaOff + g * 4));
      } else {
        glyphOffsets.push(readU16(sfnt, locaOff + g * 2) * 2);
      }
    }

    // Parse glyf contours
    const glyfBase = tables.glyf.offset;
    const glyphs = [];
    for (let g = 0; g < maxp.numGlyphs; g++) {
      const start = glyphOffsets[g];
      const end = glyphOffsets[g + 1];
      if (start === end) {
        glyphs.push({ contours: [] });
        continue;
      }
      const p = glyfBase + start;
      const numContours = readI16(sfnt, p);
      if (numContours <= 0) {
        glyphs.push({ contours: [] });
        continue;
      }
      const endPts = [];
      for (let c = 0; c < numContours; c++) {
        endPts.push(readU16(sfnt, p + 10 + c * 2));
      }
      const totalPts = endPts[numContours - 1] + 1;
      const instrLen = readU16(sfnt, p + 10 + numContours * 2);
      let cur = p + 12 + numContours * 2 + instrLen;

      const flags = [];
      while (flags.length < totalPts) {
        const f = sfnt[cur++];
        flags.push(f);
        if (f & 0x08) {
          const rep = sfnt[cur++];
          for (let r = 0; r < rep; r++) flags.push(f);
        }
      }

      const xs = new Array(totalPts);
      let x = 0;
      for (let i = 0; i < totalPts; i++) {
        const f = flags[i];
        if (f & 0x02) {
          const dx = sfnt[cur++];
          x += (f & 0x10) ? dx : -dx;
        } else if (!(f & 0x10)) {
          x += readI16(sfnt, cur);
          cur += 2;
        }
        xs[i] = x;
      }

      const ys = new Array(totalPts);
      let y = 0;
      for (let i = 0; i < totalPts; i++) {
        const f = flags[i];
        if (f & 0x04) {
          const dy = sfnt[cur++];
          y += (f & 0x20) ? dy : -dy;
        } else if (!(f & 0x20)) {
          y += readI16(sfnt, cur);
          cur += 2;
        }
        ys[i] = y;
      }

      const contours = [];
      let prevEnd = -1;
      for (let c = 0; c < numContours; c++) {
        const cPts = [];
        for (let i = prevEnd + 1; i <= endPts[c]; i++) {
          cPts.push([xs[i], ys[i]]);
        }
        contours.push(cPts);
        prevEnd = endPts[c];
      }
      glyphs.push({ contours });
    }

    return {
      tables: Object.keys(tables),
      checksumErrors,
      checkSumAdjustmentValid,
      wholeSum,
      head,
      hhea,
      maxp,
      advances,
      cmapMap,
      glyphs,
    };
  }

  function signedArea(pts) {
    let a = 0;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % n];
      a += x1 * y2 - x2 * y1;
    }
    return a * 0.5;
  }

  function pointInContour(px, py, pts) {
    let inside = false;
    const n = pts.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  function segmentsIntersectProper(a, b, c, d) {
    function orient(p, q, r) {
      return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    }
    const o1 = orient(a, b, c);
    const o2 = orient(a, b, d);
    const o3 = orient(c, d, a);
    const o4 = orient(c, d, b);
    return (o1 > 0 && o2 < 0 || o1 < 0 && o2 > 0) && (o3 > 0 && o4 < 0 || o3 < 0 && o4 > 0);
  }

  function validateContours(contours) {
    const issues = [];
    for (let ci = 0; ci < contours.length; ci++) {
      const pts = contours[ci];
      if (pts.length < 3) {
        issues.push(`Contour ${ci} has < 3 points`);
        continue;
      }
      const area = signedArea(pts);
      if (area === 0) {
        issues.push(`Contour ${ci} has zero area`);
        continue;
      }
      // Check self-intersection
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % n];
        for (let j = i + 2; j < n; j++) {
          if (i === 0 && j === n - 1) continue;
          const c = pts[j];
          const d = pts[(j + 1) % n];
          if (segmentsIntersectProper(a, b, c, d)) {
            issues.push(`Contour ${ci} self-intersects at edges ${i} and ${j}`);
          }
        }
      }
      // Check winding: test an interior midpoint slightly shifted or a vertex/edge midpoint
      // Use midpoint of edge 0 nudged slightly or test another contour's point
      let depth = 0;
      const testX = (pts[0][0] + pts[1][0]) * 0.5;
      const testY = (pts[0][1] + pts[1][1]) * 0.5;
      for (let cj = 0; cj < contours.length; cj++) {
        if (cj === ci) continue;
        if (pointInContour(testX, testY, contours[cj])) depth++;
      }
      const expectedCW = depth % 2 === 0;
      const isCW = area < 0;
      if (expectedCW !== isCW) {
        issues.push(`Contour ${ci} wrong winding (depth=${depth}, area=${area})`);
      }
    }
    return issues;
  }

  // Rasterize a glyph's contours at pixel centers using point-in-polygon (even-odd rule)
  function rasterizeGlyph(contours, width, height, pixelUnits, baselineRow) {
    const yTop = (baselineRow + 1) * pixelUnits;
    const rows = [];
    for (let r = 0; r < height; r++) {
      const py = yTop - (r + 0.5) * pixelUnits;
      let line = '';
      for (let c = 0; c < width; c++) {
        const px = (c + 0.5) * pixelUnits;
        let inside = false;
        for (const pts of contours) {
          if (pointInContour(px, py, pts)) inside = !inside;
        }
        line += inside ? '#' : '.';
      }
      rows.push(line);
    }
    return rows;
  }

  return {
    decompressWoffToSfnt,
    parseSfnt,
    validateContours,
    rasterizeGlyph,
  };
});
