export function parseFlfFont(source) {
  const lines = String(source).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  const header = lines[0] ?? '';
  const parts = header.split(' ');

  if (!parts[0]?.startsWith('flf2a') || parts[0].length < 6) {
    throw new Error('invalid FLF font: bad header');
  }

  const hardblank = parts[0][5];
  const height = parseInt(parts[1], 10);
  const oldLayout = parseInt(parts[4], 10);
  const commentLines = parseInt(parts[5], 10);
  const fullLayout = parts[7] !== undefined ? parseInt(parts[7], 10) : null;
  const layoutMask = (fullLayout !== null && Number.isFinite(fullLayout)) ? fullLayout : oldLayout;

  if (!Number.isInteger(height) || height <= 0) {
    throw new Error('invalid FLF font: bad height');
  }
  if (!Number.isInteger(commentLines) || commentLines < 0) {
    throw new Error('invalid FLF font: bad comment_lines');
  }

  let pos = 1 + commentLines;
  const glyphs = {};

  for (let code = 32; code <= 126; code++) {
    if (pos + height > lines.length) {
      throw new Error(`invalid FLF font: truncated at char ${code}`);
    }
    glyphs[String.fromCharCode(code)] = readGlyph(lines, pos, height);
    pos += height;
  }

  while (pos < lines.length) {
    const tagLine = (lines[pos] ?? '').trim();
    if (tagLine === '') {
      pos++;
      continue;
    }

    const tagMatch = tagLine.match(/^(0x[0-9a-fA-F]+|-?\d+)/);
    if (!tagMatch) break;

    const raw = tagMatch[1];
    const codepoint = raw.startsWith('0x') ? parseInt(raw, 16) : parseInt(raw, 10);
    pos++;

    if (!Number.isFinite(codepoint) || codepoint <= 0) {
      pos += height;
      continue;
    }
    if (pos + height > lines.length) break;

    glyphs[String.fromCodePoint(codepoint)] = readGlyph(lines, pos, height);
    pos += height;
  }

  return { height, hardblank, layoutMask, glyphs };
}

function readGlyph(lines, pos, height) {
  const rows = Array.from({ length: height }, (_, i) => {
    return (lines[pos + i] ?? '').replace(/@+\s*$/, '');
  });
  // FLF sub-rows of a single character may be ragged; pad to the character's
  // max width so columns line up vertically and the smush seam is consistent.
  const width = Math.max(0, ...rows.map((r) => r.length));
  return rows.map((r) => r.padEnd(width));
}
