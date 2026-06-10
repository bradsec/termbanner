import { cp437ToUnicode, normalizeColorByte } from './thedraw-color.js';

const MAGIC = '\x13TheDraw FONTS file\x1a';
const MIN_LENGTH = 233;
const FONT_TYPE_OFFSET = 41;
const FONT_TYPE_COLOR = 2;
const SPACING_OFFSET = 42;
const NAME_LENGTH_OFFSET = 24;
const NAME_OFFSET = 25;
const NAME_MAX_LENGTH = FONT_TYPE_OFFSET - NAME_OFFSET;
const CHAR_OFFSET_TABLE = 45;
const GLYPH_DATA_BASE = 233;
const MISSING_GLYPH = 0xffff;

const CHARACTER_LIST = '!"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';

const INVALID_TDF_FONT = 'invalid TheDraw font';

export function parseTdfFont(input, options = {}) {
  try {
    const bytes = toUint8Array(input);

    if (bytes.length < MIN_LENGTH || !hasMagic(bytes) || bytes[FONT_TYPE_OFFSET] !== FONT_TYPE_COLOR) {
      throw new Error(INVALID_TDF_FONT);
    }

    const glyphs = {};
    const colorSlots = new Set();
    const offsets = readCharacterOffsets(bytes);
    const nameLength = bytes[NAME_LENGTH_OFFSET];

    if (nameLength > NAME_MAX_LENGTH) {
      throw new Error(INVALID_TDF_FONT);
    }

    let height = 0;

    for (let i = 0; i < CHARACTER_LIST.length; i += 1) {
      const offset = offsets[i];

      if (offset === MISSING_GLYPH) {
        continue;
      }

      const glyph = readGlyph(bytes, GLYPH_DATA_BASE + offset, colorSlots);
      glyphs[CHARACTER_LIST[i]] = glyph.rows;
      height = Math.max(height, glyph.height);
    }

    return {
      kind: 'tdf-color',
      key: options.key ?? 'tdf',
      name: readAscii(bytes, NAME_OFFSET, nameLength).replace(/\0+$/g, ''),
      height,
      spacing: bytes[SPACING_OFFSET],
      colorSlots: [...colorSlots].sort(),
      glyphs,
    };
  } catch {
    throw new Error(INVALID_TDF_FONT);
  }
}

function toUint8Array(input) {
  if (input instanceof Uint8Array) {
    return input;
  }

  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }

  if (
    input instanceof ArrayBuffer
    || (typeof SharedArrayBuffer !== 'undefined' && input instanceof SharedArrayBuffer)
  ) {
    return new Uint8Array(input);
  }

  throw new Error(INVALID_TDF_FONT);
}

function hasMagic(bytes) {
  if (bytes.length < MAGIC.length) {
    return false;
  }

  for (let i = 0; i < MAGIC.length; i += 1) {
    if (bytes[i] !== MAGIC.charCodeAt(i)) {
      return false;
    }
  }

  return true;
}

function readAscii(bytes, offset, length) {
  assertAvailable(bytes, offset, length);

  let text = '';

  for (let i = offset; i < offset + length; i += 1) {
    text += String.fromCharCode(bytes[i]);
  }

  return text;
}

function readCharacterOffsets(bytes) {
  const offsets = [];

  for (let i = 0; i < CHARACTER_LIST.length; i += 1) {
    offsets.push(readUint16LE(bytes, CHAR_OFFSET_TABLE + (i * 2)));
  }

  return offsets;
}

function readUint16LE(bytes, offset) {
  assertAvailable(bytes, offset, 2);
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readGlyph(bytes, offset, colorSlots) {
  assertAvailable(bytes, offset, 2);

  const width = bytes[offset];
  const height = bytes[offset + 1];
  let cursor = offset + 2;
  let row = 0;
  let col = 0;
  const rows = createGlyphRows(width, height);

  while (true) {
    assertAvailable(bytes, cursor, 1);

    const ch = bytes[cursor];
    cursor += 1;

    if (ch === 0) {
      break;
    }

    if (ch === 13) {
      row += 1;
      col = 0;

      if (row >= height) {
        throw new Error(INVALID_TDF_FONT);
      }

      continue;
    }

    assertAvailable(bytes, cursor, 1);

    if (row >= height || col >= width) {
      throw new Error(INVALID_TDF_FONT);
    }

    const color = normalizeColorByte(bytes[cursor]);
    cursor += 1;
    colorSlots.add(color);
    rows[row][col] = { ch: cp437ToUnicode(ch), color };
    col += 1;
  }

  return { rows, height };
}

function createGlyphRows(width, height) {
  return Array.from({ length: height }, () => (
    Array.from({ length: width }, () => ({ ch: ' ', color: '0x00' }))
  ));
}

function assertAvailable(bytes, offset, length) {
  if (offset < 0 || length < 0 || offset + length > bytes.length) {
    throw new Error(INVALID_TDF_FONT);
  }
}
