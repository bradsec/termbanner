import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseTdfFont } from './tdf.js';

const CHARACTER_LIST = '!"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';
const GLYPH_DATA_BASE = 233;

const ASCII_TDF = fileURLToPath(new URL('../fonts/tdf/ASCII.TDF', import.meta.url));
const COLOR_TDF = fileURLToPath(new URL('../fonts/tdf/COLOR.TDF', import.meta.url));

test('parseTdfFont reads font metadata and glyph cells', async () => {
  const bytes = await readFile(ASCII_TDF);
  const font = parseTdfFont(bytes, { key: 'ascii' });

  assert.equal(font.kind, 'tdf-color');
  assert.equal(font.key, 'ascii');
  assert.equal(font.name, 'ASCII');
  assert.equal(font.spacing, bytes[42]);
  assert.ok(font.height > 0);
  assert.ok(font.glyphs.A.length > 0);
  assert.ok(font.glyphs.A[0].length > 0);
  assert.match(font.glyphs.A.flat().map((cell) => cell.ch).join(''), /[_/\\|]/);
  assert.ok(font.colorSlots.includes('0x0f'));
});

test('parseTdfFont reads font name using the declared length byte', async () => {
  const bytes = Uint8Array.from(await readFile(ASCII_TDF));
  bytes[24] = 3;
  bytes.fill(0, 25, 41);
  bytes.set([...Buffer.from('ABCEXTRA')], 25);

  const font = parseTdfFont(bytes, { key: 'name-length' });

  assert.equal(font.name, 'ABC');
});

test('parseTdfFont exposes compact metadata for index generation', async () => {
  const bytes = await readFile(COLOR_TDF);
  const font = parseTdfFont(bytes, { key: 'color' });

  const metadata = {
    kind: font.kind,
    key: font.key,
    name: font.name,
    height: font.height,
    spacing: font.spacing,
    colorSlotCount: font.colorSlots.length,
    path: `./fonts/tdf/${font.key}.json`,
  };

  assert.deepEqual(Object.keys(metadata), [
    'kind',
    'key',
    'name',
    'height',
    'spacing',
    'colorSlotCount',
    'path',
  ]);
  assert.equal(metadata.kind, 'tdf-color');
  assert.equal(metadata.key, 'color');
  assert.ok(metadata.colorSlotCount > 1);
});

test('parseTdfFont rejects overlong font names', async () => {
  const bytes = Uint8Array.from(await readFile(ASCII_TDF));
  bytes[24] = 17;

  assert.throws(
    () => parseTdfFont(bytes, { key: 'overlong-name' }),
    /invalid TheDraw font/,
  );
});

test('parseTdfFont rejects glyph rows beyond declared height', async () => {
  const bytes = Uint8Array.from(await readFile(ASCII_TDF));
  const glyphStart = GLYPH_DATA_BASE + readGlyphOffset(bytes, 'A');
  bytes.set([1, 1, 13, 0], glyphStart);

  assert.throws(
    () => parseTdfFont(bytes, { key: 'bad-row' }),
    /invalid TheDraw font/,
  );
});

test('parseTdfFont rejects non TheDraw color font bytes', () => {
  assert.throws(
    () => parseTdfFont(new Uint8Array([1, 2, 3]), { key: 'bad' }),
    /invalid TheDraw font/,
  );
});

function readGlyphOffset(bytes, ch) {
  const index = CHARACTER_LIST.indexOf(ch);
  const offset = 45 + (index * 2);
  return bytes[offset] | (bytes[offset + 1] << 8);
}
