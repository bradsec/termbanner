import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseTdfFont } from '../src/tdf.js';
import { compactTdfFont, isKnownUnsupportedTdf, tdfIndexEntry } from './tdf-build-data.mjs';

const COLOR_TDF = fileURLToPath(new URL('../fonts/tdf/COLOR.TDF', import.meta.url));

test('compactTdfFont emits compact TDF font data', async () => {
  const font = parseTdfFont(await readFile(COLOR_TDF), { key: 'color' });
  const compact = compactTdfFont(font);

  assert.equal(compact.format, 'tdf-compact-v1');
  assert.equal(compact.kind, 'tdf-color');
  assert.equal(compact.key, 'color');
  assert.deepEqual(compact.colorSlots, font.colorSlots);
});

test('compactTdfFont stores glyph rows as chars and packed colors', async () => {
  const font = parseTdfFont(await readFile(COLOR_TDF), { key: 'color' });
  const compact = compactTdfFont(font);
  const glyph = compact.glyphs.A;

  assert.ok(Array.isArray(glyph.chars));
  assert.ok(Array.isArray(glyph.colors));
  assert.equal(glyph.chars.length, glyph.colors.length);
  assert.equal(glyph.colors[0].length, [...glyph.chars[0]].length * 2);
  assert.equal('ch' in glyph, false);
  assert.equal('color' in glyph, false);
  assert.equal(JSON.stringify(glyph).includes('"ch"'), false);
  assert.equal(JSON.stringify(glyph).includes('"color"'), false);
});

test('tdfIndexEntry emits compact metadata for index generation', async () => {
  const font = parseTdfFont(await readFile(COLOR_TDF), { key: 'color' });
  const metadata = tdfIndexEntry(font, 'color.json');

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
  assert.equal(metadata.path, './fonts/tdf/color.json');
});

test('isKnownUnsupportedTdf only accepts allowlisted source files', () => {
  assert.equal(isKnownUnsupportedTdf('keys.tdf'), true);
  assert.equal(isKnownUnsupportedTdf('unexpected.tdf'), false);
});
