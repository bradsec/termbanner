import test from 'node:test';
import assert from 'node:assert/strict';
import { compactFlfFont, flfIndexEntry } from './flf-build-data.mjs';

const sampleFont = {
  name: 'Test Font',
  height: 2,
  hardblank: '$',
  layoutMask: 64,
  glyphs: {
    'A': ['AAA', 'aaa'],
    ' ': ['   ', '   '],
  },
};

test('compactFlfFont emits kind, format, key and all font fields', () => {
  const compact = compactFlfFont(sampleFont, 'test');
  assert.equal(compact.kind, 'flf-plain');
  assert.equal(compact.format, 'flf-v1');
  assert.equal(compact.key, 'test');
  assert.equal(compact.name, 'Test Font');
  assert.equal(compact.height, 2);
  assert.equal(compact.hardblank, '$');
  assert.equal(compact.layoutMask, 64);
  assert.deepEqual(compact.glyphs, sampleFont.glyphs);
});

test('compactFlfFont does not add extra properties', () => {
  const compact = compactFlfFont(sampleFont, 'test');
  assert.deepEqual(Object.keys(compact), [
    'kind', 'format', 'key', 'name', 'height', 'hardblank', 'layoutMask', 'glyphs',
  ]);
});

test('flfIndexEntry emits kind, key, name, height, path', () => {
  const entry = flfIndexEntry(sampleFont, 'test', 'test.json');
  assert.deepEqual(Object.keys(entry), ['kind', 'key', 'name', 'height', 'path']);
  assert.equal(entry.kind, 'flf-plain');
  assert.equal(entry.key, 'test');
  assert.equal(entry.name, 'Test Font');
  assert.equal(entry.height, 2);
  assert.equal(entry.path, './fonts/flf/test.json');
});
