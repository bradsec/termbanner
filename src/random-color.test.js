import test from 'node:test';
import assert from 'node:assert/strict';
import { randomColor, randomGradient, MAX_GRADIENT_STOPS } from './random-color.js';
import { parseHex, quantizeColor } from './color.js';

test('randomColor truecolor uses the raw random channels', () => {
  assert.equal(randomColor('truecolor', () => 0.5), '#808080');
});

test('randomColor quantizes to the selected depth (16)', () => {
  const hex = randomColor('16', () => 0.3);
  const rgb = parseHex(hex);
  assert.deepEqual(quantizeColor(rgb, '16'), rgb); // already a 16-colour member
});

test('randomGradient picks 2..maxStops stops', () => {
  assert.equal(randomGradient('truecolor', 5, () => 0).length, 2); // floor(0) -> 2
  assert.equal(randomGradient('truecolor', 5, () => 0.99).length, 5); // floor(0.99*4) -> +3
  const mid = randomGradient('truecolor', 5, () => 0.5);
  assert.equal(mid.length, 4);
  assert.deepEqual(mid, ['#808080', '#808080', '#808080', '#808080']);
});

test('randomGradient never returns fewer than 2 stops even with maxStops < 2', () => {
  assert.equal(randomGradient('truecolor', 1, () => 0).length, 2);
});

test('randomGradient quantizes every stop to the selected depth (16)', () => {
  const cols = randomGradient('16', MAX_GRADIENT_STOPS, () => 0.7);
  for (const hex of cols) {
    const rgb = parseHex(hex);
    assert.deepEqual(quantizeColor(rgb, '16'), rgb);
  }
});
