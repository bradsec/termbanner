import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFlfFont } from './flf-parser.mjs';

function makeFlf({ hardblank = '$', commentLines = 0, oldLayout = 0, fullLayout = null, overrides = {} } = {}) {
  const headerParts = [`flf2a${hardblank}`, 1, 1, 5, oldLayout, commentLines];
  if (fullLayout !== null) headerParts.push(0, fullLayout);
  let src = headerParts.join(' ') + '\n';
  for (let code = 32; code <= 126; code++) {
    const ch = String.fromCharCode(code);
    src += (overrides[ch] ?? ` @@`) + '\n';
  }
  return src;
}

test('parseFlfFont reads height and hardblank from header', () => {
  const font = parseFlfFont(makeFlf({ hardblank: '%' }));
  assert.equal(font.height, 1);
  assert.equal(font.hardblank, '%');
});

test('parseFlfFont uses full_layout when present', () => {
  const font = parseFlfFont(makeFlf({ oldLayout: 0, fullLayout: 64 }));
  assert.equal(font.layoutMask, 64);
});

test('parseFlfFont falls back to old_layout when full_layout absent', () => {
  const font = parseFlfFont(makeFlf({ oldLayout: 15 }));
  assert.equal(font.layoutMask, 15);
});

test('parseFlfFont strips @ terminators from glyph rows', () => {
  const font = parseFlfFont(makeFlf({ overrides: { 'A': 'ABC@@' } }));
  assert.deepEqual(font.glyphs['A'], ['ABC']);
});

test('parseFlfFont pads ragged glyph sub-rows to uniform width', () => {
  let src = `flf2a$ 2 2 5 0 0\n`;
  for (let code = 32; code <= 126; code++) {
    const ch = String.fromCharCode(code);
    src += (ch === 'A' ? 'ABCD@\nAB@@' : ' @\n @@') + '\n';
  }
  const font = parseFlfFont(src);
  assert.deepEqual(font.glyphs['A'], ['ABCD', 'AB  ']);
});

test('parseFlfFont skips comment lines', () => {
  let src = 'flf2a$ 1 1 5 0 2\ncomment one\ncomment two\n';
  for (let code = 32; code <= 126; code++) src += ' @@\n';
  const font = parseFlfFont(src);
  assert.ok(font.glyphs[' ']); // space glyph is stored
  assert.ok(font.glyphs['A']);
});

test('parseFlfFont reads all required ASCII 32-126', () => {
  const font = parseFlfFont(makeFlf());
  for (let code = 32; code <= 126; code++) {
    assert.ok(font.glyphs[String.fromCharCode(code)], `missing char ${code}`);
  }
});

test('parseFlfFont reads extended tagged glyphs', () => {
  let src = makeFlf();
  src += '196\nA@@\n';
  const font = parseFlfFont(src);
  assert.deepEqual(font.glyphs['Ä'], ['A']);
});

test('parseFlfFont throws on missing flf2a signature', () => {
  assert.throws(() => parseFlfFont('badheader 1 1 5 0 0\n'), /invalid FLF font/);
});

test('parseFlfFont throws on invalid height', () => {
  assert.throws(() => parseFlfFont('flf2a$ x 1 5 0 0\n'), /invalid FLF font/);
});

test('parseFlfFont handles CRLF line endings', () => {
  const src = makeFlf({ overrides: { 'A': 'ABC@@' } }).replace(/\n/g, '\r\n');
  const font = parseFlfFont(src);
  assert.deepEqual(font.glyphs['A'], ['ABC']);
});
