const FITTING_BIT  = 64;
const SMUSHING_BIT = 128;

const HIER = '|/\\[]{}()<>';
const HIER_ORDER = ['|', '/', '\\', '[', ']', '{', '}', '(', ')', '<', '>'];

export function renderFlfRows(font, text, options = {}) {
  const { hardblank, layoutMask, glyphs, height } = font;
  const chars = [...text];
  const extraSpacing = Number.parseInt(options.letterSpacing ?? 0, 10) || 0;

  if (chars.length === 0) {
    return Array.from({ length: height }, () => '');
  }

  const lookupGlyph = (char) => glyphs[char] ?? glyphs[char.toLocaleUpperCase('en-US')];

  const firstGlyph = lookupGlyph(chars[0]);
  if (!firstGlyph) throw new Error(`unsupported character '${chars[0]}' at position 1`);
  let rows = firstGlyph.slice();

  for (let ci = 1; ci < chars.length; ci++) {
    const char = chars[ci];
    const glyph = lookupGlyph(char);
    if (!glyph) throw new Error(`unsupported character '${char}' at position ${ci + 1}`);

    const naturalOverlap = computeSmushAmount(rows, glyph, hardblank, layoutMask);
    const overlap = naturalOverlap - extraSpacing;

    if (overlap >= 0) {
      rows = mergeGlyphs(rows, glyph, hardblank, layoutMask, overlap);
    } else {
      const gap = ' '.repeat(-overlap);
      rows = rows.map((row, i) => row + gap + (glyph[i] ?? ''));
    }
  }

  return rows.map((row) => row.split(hardblank).join(' '));
}

function computeSmushAmount(leftRows, rightRows, hardblank, layoutMask) {
  const fitting  = (layoutMask & FITTING_BIT) !== 0;
  const smushing = (layoutMask & SMUSHING_BIT) !== 0;
  const smushRules = layoutMask & 63;

  if (!fitting && !smushing) return 0;

  let baseOverlap = Infinity;
  for (let row = 0; row < leftRows.length; row++) {
    const trailing = countTrailingSpaces(leftRows[row]);
    const leading  = countLeadingSpaces(rightRows[row] ?? '');
    baseOverlap = Math.min(baseOverlap, trailing + leading);
  }
  if (!isFinite(baseOverlap)) baseOverlap = 0;

  if (!smushing) return baseOverlap;

  const canSmushAll = leftRows.every((left, row) => {
    const right = rightRows[row] ?? '';
    const leftIdx  = left.length - baseOverlap - 1;
    const rightIdx = baseOverlap;
    const lc = leftIdx >= 0  ? (left[leftIdx]   ?? ' ') : ' ';
    const rc = rightIdx < right.length ? (right[rightIdx] ?? ' ') : ' ';
    if (lc === ' ' || rc === ' ') return true;
    return canSmushCells(lc, rc, hardblank, smushRules);
  });

  return canSmushAll ? baseOverlap + 1 : baseOverlap;
}

function mergeGlyphs(leftRows, rightRows, hardblank, layoutMask, overlap) {
  const smushing   = (layoutMask & SMUSHING_BIT) !== 0;
  const smushRules = layoutMask & 63;

  return leftRows.map((left, row) => {
    const right = rightRows[row] ?? '';

    if (overlap === 0) return left + right;

    const leftBase      = left.slice(0, left.length - overlap);
    const leftOverlap   = left.slice(left.length - overlap);
    const rightOverlap  = right.slice(0, overlap);
    const rightTail     = right.slice(overlap);

    let merged = '';
    const len = Math.max(leftOverlap.length, rightOverlap.length);
    for (let i = 0; i < len; i++) {
      const lc = leftOverlap[i]  ?? ' ';
      const rc = rightOverlap[i] ?? ' ';
      merged += mergeCell(lc, rc, hardblank, smushing, smushRules);
    }

    return leftBase + merged + rightTail;
  });
}

function mergeCell(lc, rc, hardblank, smushing, smushRules) {
  if (lc === ' ') return rc;
  if (rc === ' ') return lc;
  if (smushing) {
    if ((smushRules & 63) === 0) {
      // Universal smushing: a hardblank yields to a real sub-character,
      // otherwise the later glyph overrides the earlier one.
      if (lc === hardblank) return rc;
      if (rc === hardblank) return lc;
      return rc;
    }
    const result = applySmushRules(lc, rc, hardblank, smushRules);
    if (result !== null) return result;
  }
  return rc;
}

function canSmushCells(lc, rc, hardblank, smushRules) {
  // Universal smushing (no controlled rules selected) always smushes.
  if ((smushRules & 63) === 0) return true;
  return applySmushRules(lc, rc, hardblank, smushRules) !== null;
}

function applySmushRules(lc, rc, hardblank, smushRules) {
  if ((smushRules & 32) && lc === hardblank && rc === hardblank) return hardblank;
  if (lc === hardblank || rc === hardblank) return null;
  if ((smushRules & 1) && lc === rc) return lc;
  if (smushRules & 2) {
    if (lc === '_' && HIER.includes(rc)) return rc;
    if (rc === '_' && HIER.includes(lc)) return lc;
  }
  if (smushRules & 4) {
    const li = HIER_ORDER.indexOf(lc);
    const ri = HIER_ORDER.indexOf(rc);
    if (li >= 0 && ri >= 0) return li >= ri ? lc : rc;
  }
  if (smushRules & 8) {
    if ((lc === '[' && rc === ']') || (lc === ']' && rc === '[')) return '|';
    if ((lc === '{' && rc === '}') || (lc === '}' && rc === '{')) return '|';
    if ((lc === '(' && rc === ')') || (lc === ')' && rc === '(')) return '|';
  }
  if (smushRules & 16) {
    if (lc === '>' && rc === '<') return 'X';
    if (lc === '\\' && rc === '/') return '|';
    if (lc === '/' && rc === '\\') return 'Y';
  }
  return null;
}

function countTrailingSpaces(str) {
  let count = 0;
  for (let i = str.length - 1; i >= 0; i--) {
    if (str[i] === ' ') count++;
    else break;
  }
  return count;
}

function countLeadingSpaces(str) {
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === ' ') count++;
    else break;
  }
  return count;
}
