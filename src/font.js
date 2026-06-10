export function validateFonts(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('font data must be an object');
  }

  const fonts = {};
  for (const [key, font] of Object.entries(data)) {
    if (!font || typeof font !== 'object') {
      throw new Error(`font "${key}" must be an object`);
    }
    if (typeof font.name !== 'string' || font.name.length === 0) {
      throw new Error(`font "${key}" must have a name`);
    }
    if (!Number.isInteger(font.height) || font.height <= 0) {
      throw new Error(`font "${key}" must have a positive height`);
    }
    if (!font.glyphs || typeof font.glyphs !== 'object' || Array.isArray(font.glyphs)) {
      throw new Error(`font "${key}" must have glyphs`);
    }

    const glyphs = {};
    let maxWidth = 1;
    for (const [char, rows] of Object.entries(font.glyphs)) {
      if ([...char].length !== 1) {
        throw new Error(`font "${key}" glyph key "${char}" must be one character`);
      }
      if (!Array.isArray(rows)) {
        throw new Error(`font "${key}" glyph "${char}" must be an array`);
      }
      if (rows.length !== font.height) {
        throw new Error(`font "${key}" glyph "${char}" has ${rows.length} rows, expected ${font.height}`);
      }
      for (const row of rows) {
        if (typeof row !== 'string') {
          throw new Error(`font "${key}" glyph "${char}" has a non-string row`);
        }
      }
      const trimmedRows = rows.map((r) => r.trimEnd());
      const charWidth = Math.max(0, ...trimmedRows.map((r) => r.length));
      glyphs[char] = trimmedRows.map((r) => r.padEnd(charWidth));
      maxWidth = Math.max(maxWidth, charWidth);
    }

    glyphs[' '] = Array.from({ length: font.height }, () => ' '.repeat(Math.max(1, Math.ceil(maxWidth / 2))));
    fonts[key] = {
      name: font.name,
      height: font.height,
      advanceGap: Number.isInteger(font.advanceGap) ? Math.max(0, font.advanceGap) : defaultAdvanceGap(font.name),
      glyphs,
    };
  }

  return fonts;
}

export function normalizeText(text) {
  return text.toLocaleUpperCase('en-US');
}

export function renderRows(font, text, options = {}) {
  const normalized = normalizeText(text);
  const rows = Array.from({ length: font.height }, () => '');
  const extraSpacing = Number.parseInt(options.letterSpacing ?? 0, 10) || 0;
  const spacing = ' '.repeat(Math.max(0, (font.advanceGap ?? 0) + extraSpacing));

  let position = 0;
  let rendered = 0;
  for (const char of normalized) {
    position += 1;
    const glyph = font.glyphs[char];
    if (!glyph) {
      throw new Error(`unsupported character '${char}' at position ${position}`);
    }
    for (let row = 0; row < font.height; row += 1) {
      if (rendered > 0 && char !== ' ') {
        rows[row] += spacing;
      }
      rows[row] += glyph[row];
    }
    rendered += 1;
  }

  return rows;
}

function defaultAdvanceGap(name) {
  return name.startsWith('ANSI ') ? 1 : 0;
}

export function padRows(rows, options = {}) {
  const left = Number.parseInt(options.left ?? 0, 10) || 0;
  const top = Number.parseInt(options.top ?? 0, 10) || 0;
  const bottom = Number.parseInt(options.bottom ?? 0, 10) || 0;
  const prefix = ' '.repeat(Math.max(0, left));
  const topPad = Math.max(0, top);
  const bottomPad = Math.max(0, bottom);
  const topTrim = Math.max(0, -top);
  const bottomTrim = Math.max(0, -bottom);
  const leftTrim = Math.max(0, -left);
  const trimmedRows = rows
    .slice(topTrim, Math.max(topTrim, rows.length - bottomTrim))
    .map((row) => row.slice(leftTrim));

  return [
    ...Array.from({ length: topPad }, () => ''),
    ...trimmedRows.map((row) => `${prefix}${row}`),
    ...Array.from({ length: bottomPad }, () => ''),
  ];
}
