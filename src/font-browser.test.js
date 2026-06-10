import test from 'node:test';
import assert from 'node:assert/strict';
import { previewTextCandidates } from './font-browser.js';

test('previewTextCandidates uses current text when a font supports it', () => {
  const glyphs = { T: {}, E: {}, R: {}, M: {}, A: {}, B: {}, C: {} };

  assert.deepEqual(previewTextCandidates('TERM', glyphs), ['TERM', 'ABC']);
});

test('previewTextCandidates falls back to supported glyphs when ABC is unavailable', () => {
  const glyphs = {
    X: {},
    Y: {},
    Z: {},
    ' ': {},
  };

  assert.deepEqual(previewTextCandidates('TERM', glyphs), ['XYZ']);
});

test('previewTextCandidates prefers readable sample glyphs over arbitrary glyph order', () => {
  const glyphs = {
    '0': {},
    '?': {},
    B: {},
    A: {},
    N: {},
    R: {},
  };

  assert.deepEqual(previewTextCandidates('TERM', glyphs), ['BANR']);
});
