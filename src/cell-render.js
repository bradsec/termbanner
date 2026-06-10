import { nearest16Code, nearest256Code, reset } from './color.js';
import { decodeTheDrawColor, theDrawColorToRgb } from './thedraw-color.js';

const SPACE_CELL = { ch: ' ', color: '0x00' };

export function renderCellRows(font, text, options = {}) {
  const letterSpacing = options.letterSpacing ?? 0;
  const spacing = (font.spacing ?? 0) + letterSpacing;
  const chars = Array.from(String(text).toLocaleUpperCase('en-US'));
  const spaceWidth = spaceWidthFor(font);
  const blankCell = () => ({ ...SPACE_CELL });

  let rows = Array.from({ length: font.height }, () => []);

  chars.forEach((char, index) => {
    const glyphRows = char === ' '
      ? Array.from({ length: font.height }, () => Array.from({ length: spaceWidth }, blankCell))
      : glyphCellRows(font, char, index);

    if (index === 0) {
      rows = glyphRows;
      return;
    }

    if (spacing > 0) {
      rows = rows.map((row) => [...row, ...Array.from({ length: spacing }, blankCell)]);
    }

    // Negative spacing pulls glyphs together until they touch, then overlaps
    // them by the remaining amount: cells from the new glyph win over blanks
    // from the previous one, mirroring the figlet smushing overlap effect.
    rows = mergeCellRows(rows, glyphRows, spacing < 0 ? -spacing : 0);
  });

  return rows;
}

function glyphCellRows(font, char, index) {
  const glyph = lookupGlyph(font.glyphs, char);
  if (!glyph) {
    throw new Error(`unsupported character '${char}' at position ${index}`);
  }

  const glyphWidth = glyph.chars[0] ? Array.from(glyph.chars[0]).length : 0;
  return Array.from({ length: font.height }, (_, rowIndex) => {
    // A missing chars row means a blank row; ignore any colors row recorded for
    // it so a short/stray colors string cannot produce malformed slot keys.
    const hasCharsRow = glyph.chars[rowIndex] !== undefined;
    const charsRow = hasCharsRow ? glyph.chars[rowIndex] : ' '.repeat(glyphWidth);
    const colorsRow = hasCharsRow
      ? (glyph.colors[rowIndex] ?? '00'.repeat(glyphWidth))
      : '00'.repeat(glyphWidth);
    if (hasCharsRow) {
      validateCompactGlyphRow(char, rowIndex, charsRow, colorsRow);
    }

    return Array.from(charsRow).map((ch, cellIndex) => ({
      ch,
      color: `0x${colorsRow.slice(cellIndex * 2, cellIndex * 2 + 2).toLowerCase()}`,
    }));
  });
}

function mergeCellRows(leftRows, rightRows, overlap) {
  return leftRows.map((leftRow, rowIndex) => {
    const rightRow = rightRows[rowIndex] ?? [];
    const amount = Math.min(overlap, leftRow.length, rightRow.length);

    if (amount <= 0) return [...leftRow, ...rightRow];

    const splitPoint = leftRow.length - amount;
    const base = leftRow.slice(0, splitPoint);
    const leftTail = leftRow.slice(splitPoint);
    const rightHead = rightRow.slice(0, amount);
    const rightTail = rightRow.slice(amount);

    const merged = leftTail.map((leftCell, i) => mergeOverlapCell(leftCell, rightHead[i]));

    return [...base, ...merged, ...rightTail];
  });
}

// Vertical line-gap overlap: merge a row from the line below onto a row from
// the line above, cell-by-cell. Blank cells in the lower line let the upper
// line's glyph show through instead of erasing it with an opaque background.
export function overlayCellRow(baseRow, overlayRow) {
  const len = Math.max(baseRow.length, overlayRow.length);
  const merged = [];
  for (let i = 0; i < len; i += 1) {
    merged.push(mergeOverlapCell(baseRow[i], overlayRow[i]));
  }
  return merged;
}

// The incoming glyph's cell wins where it has visible content; otherwise the
// outgoing glyph's cell shows through, so overlap looks like real collision
// rather than one glyph cleanly clipping the other.
function mergeOverlapCell(leftCell, rightCell) {
  if (rightCell && rightCell.ch !== ' ') return rightCell;
  if (leftCell && leftCell.ch !== ' ') return leftCell;
  return { ...SPACE_CELL };
}

function lookupGlyph(glyphs, char) {
  return glyphs[char]
    ?? glyphs[char.toLocaleUpperCase('en-US')]
    ?? glyphs[char.toLocaleLowerCase('en-US')];
}

// Width of a rendered space, taken as the median glyph width of the font so the
// gap matches the type size. Falls back to half the font height if no glyph
// widths are available.
function spaceWidthFor(font) {
  const widths = [];
  for (const glyph of Object.values(font.glyphs ?? {})) {
    const width = glyph?.chars?.[0] ? Array.from(glyph.chars[0]).length : 0;
    if (width > 0) widths.push(width);
  }
  if (widths.length === 0) {
    return Math.max(2, Math.round((font.height ?? 0) / 2));
  }
  widths.sort((a, b) => a - b);
  return widths[Math.floor(widths.length / 2)];
}

export function defaultPaletteForSlots(slots) {
  const palette = {};

  for (const slot of new Set(['0x00', ...slots])) {
    const color = decodeTheDrawColor(Number.parseInt(slot, 16));
    palette[slot] = {
      fg: theDrawColorToRgb(color.fg),
      bg: theDrawColorToRgb(color.bg),
    };
  }

  return palette;
}

export function ansiCellLines(rows, palette, mode, options = {}) {
  const transparentBg = options.transparentBg ?? false;

  if (mode === 'plain') {
    return rows.map((row) => row.map((cell) => cell.ch).join(''));
  }

  return rows.map((row) => {
    let line = '';
    let active = null;

    for (const cell of row) {
      const colors = palette[cell.color] ?? defaultPaletteForSlots([cell.color])[cell.color];
      const key = colorKey(colors, transparentBg);
      if (key !== active) {
        line += ansiCellStart(mode, colors, transparentBg);
        active = key;
      }
      line += cell.ch;
    }

    return `${line}${reset}`;
  });
}

export function cellRowsToPlainText(rows) {
  return rows.map((row) => row.map((cell) => cell.ch).join('')).join('\n');
}

export function padCellRows(rows, options = {}) {
  const left = Number.parseInt(options.left ?? 0, 10) || 0;
  const top = Number.parseInt(options.top ?? 0, 10) || 0;
  const bottom = Number.parseInt(options.bottom ?? 0, 10) || 0;
  const topPad = Math.max(0, top);
  const bottomPad = Math.max(0, bottom);
  const topTrim = Math.max(0, -top);
  const bottomTrim = Math.max(0, -bottom);
  const leftPad = Math.max(0, left);
  const leftTrim = Math.max(0, -left);
  const trimmedRows = rows
    .slice(topTrim, Math.max(topTrim, rows.length - bottomTrim))
    .map((row) => row.slice(leftTrim));
  const maxWidth = Math.max(0, ...trimmedRows.map((row) => row.length));
  const blankCell = () => ({ ...SPACE_CELL });
  const blankRow = () => Array.from({ length: maxWidth + leftPad }, blankCell);
  const prefix = () => Array.from({ length: leftPad }, blankCell);

  return [
    ...Array.from({ length: topPad }, blankRow),
    ...trimmedRows.map((row) => [...prefix(), ...row]),
    ...Array.from({ length: bottomPad }, blankRow),
  ];
}

function validateCompactGlyphRow(char, rowIndex, charsRow, colorsRow) {
  const charCount = typeof charsRow === 'string' ? Array.from(charsRow).length : -1;
  const valid = typeof charsRow === 'string'
    && typeof colorsRow === 'string'
    && colorsRow.length === charCount * 2
    && /^[0-9a-fA-F]*$/.test(colorsRow);

  if (!valid) {
    throw new Error(`invalid compact glyph "${char}" row ${rowIndex + 1}`);
  }
}

function isBlack(color) {
  return color.r === 0 && color.g === 0 && color.b === 0;
}

function ansiCellStart(mode, colors, transparentBg = false) {
  const skipBg = transparentBg && isBlack(colors.bg);
  switch (mode) {
    case 'truecolor':
      return skipBg
        ? `\x1b[38;2;${colors.fg.r};${colors.fg.g};${colors.fg.b}m\x1b[49m`
        : `\x1b[38;2;${colors.fg.r};${colors.fg.g};${colors.fg.b}m\x1b[48;2;${colors.bg.r};${colors.bg.g};${colors.bg.b}m`;
    case '256':
      return skipBg
        ? `\x1b[38;5;${nearest256Code(colors.fg)}m\x1b[49m`
        : `\x1b[38;5;${nearest256Code(colors.fg)}m\x1b[48;5;${nearest256Code(colors.bg)}m`;
    case '16':
      return skipBg
        ? `\x1b[${nearest16Code(colors.fg)}m\x1b[49m`
        : `\x1b[${nearest16Code(colors.fg)};${background16Code(colors.bg)}m`;
    default:
      return '';
  }
}

function background16Code(color) {
  return nearest16Code(color) + 10;
}

function colorKey(colors, transparentBg = false) {
  const bgKey = transparentBg && isBlack(colors.bg) ? 'transparent' : `${colors.bg.r},${colors.bg.g},${colors.bg.b}`;
  return `${colors.fg.r},${colors.fg.g},${colors.fg.b},${bgKey}`;
}
