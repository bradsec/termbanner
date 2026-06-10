import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cp437ToUnicode,
  decodeTheDrawColor,
  normalizeColorByte,
  theDrawColorToRgb,
} from './thedraw-color.js';

test('decodeTheDrawColor splits foreground and background nibbles', () => {
  assert.deepEqual(decodeTheDrawColor(0x4f), { fg: 15, bg: 4 });
  assert.deepEqual(decodeTheDrawColor(0x08), { fg: 8, bg: 0 });
});

test('normalizeColorByte emits stable hex slot ids', () => {
  assert.equal(normalizeColorByte(0), '0x00');
  assert.equal(normalizeColorByte(15), '0x0f');
  assert.equal(normalizeColorByte(127), '0x7f');
});

test('theDrawColorToRgb maps bright black foreground to dark gray', () => {
  assert.deepEqual(theDrawColorToRgb(8), { r: 128, g: 128, b: 128 });
});

test('cp437ToUnicode converts common block drawing bytes', () => {
  assert.equal(cp437ToUnicode(0xdb), '█');
  assert.equal(cp437ToUnicode(0xdc), '▄');
  assert.equal(cp437ToUnicode(0xdf), '▀');
  assert.equal(cp437ToUnicode(0xb3), '│');
});

test('cp437ToUnicode converts extended CP437 bytes outside box drawing', () => {
  assert.equal(cp437ToUnicode(0x80), 'Ç');
  assert.equal(cp437ToUnicode(0x9c), '£');
  assert.equal(cp437ToUnicode(0xff), '\u00a0');
});

test('cp437ToUnicode normalizes delete to space', () => {
  assert.equal(cp437ToUnicode(0x7f), ' ');
});
