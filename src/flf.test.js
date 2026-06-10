import test from 'node:test';
import assert from 'node:assert/strict';
import { renderFlfRows } from './flf.js';

function makeFont({ height = 1, hardblank = '$', layoutMask = 0, glyphs = {} } = {}) {
  const base = { ' ': Array.from({ length: height }, () => ' ') };
  return { kind: 'flf-plain', format: 'flf-v1', key: 'test', name: 'Test', height, hardblank, layoutMask, glyphs: { ...base, ...glyphs } };
}

// --- full-width mode (layoutMask = 0, neither bit 6 nor 7) ---

test('renderFlfRows full-width: appends glyphs with no overlap', () => {
  const font = makeFont({ glyphs: { A: ['###'], B: ['BBB'] } });
  assert.deepEqual(renderFlfRows(font, 'AB'), ['###BBB']);
});

test('renderFlfRows full-width: trailing spaces on left glyph preserved', () => {
  const font = makeFont({ glyphs: { A: ['A  '], B: ['  B'] } });
  assert.deepEqual(renderFlfRows(font, 'AB'), ['A    B']);
});

// --- fitting mode (layoutMask = 64, bit 6 set) ---

test('renderFlfRows fitting: overlaps trailing and leading spaces', () => {
  const font = makeFont({ layoutMask: 64, glyphs: { A: ['A '], B: [' B'] } });
  assert.deepEqual(renderFlfRows(font, 'AB'), ['AB']);
});

test('renderFlfRows fitting: no overlap when no surrounding spaces', () => {
  const font = makeFont({ layoutMask: 64, glyphs: { A: ['A'], B: ['B'] } });
  assert.deepEqual(renderFlfRows(font, 'AB'), ['AB']);
});

test('renderFlfRows fitting: multi-row uses minimum overlap across rows', () => {
  const font = makeFont({ height: 2, layoutMask: 64, glyphs: { A: ['A ', 'A'], B: [' B', 'B'] } });
  assert.deepEqual(renderFlfRows(font, 'AB'), ['A  B', 'AB']);
});

// --- smushing mode (layoutMask = 128+rules, bit 7 set) ---

test('renderFlfRows smush rule 1: equal chars smush to that char', () => {
  const font = makeFont({ layoutMask: 128 | 1, glyphs: { A: ['A'] } });
  assert.deepEqual(renderFlfRows(font, 'AA'), ['A']);
});

test('renderFlfRows smush rule 1: different chars do not smush', () => {
  const font = makeFont({ layoutMask: 128 | 1, glyphs: { A: ['A'], B: ['B'] } });
  assert.deepEqual(renderFlfRows(font, 'AB'), ['AB']);
});

test('renderFlfRows smush rule 2: _ replaced by hierarchy char', () => {
  const font = makeFont({ layoutMask: 128 | 2, glyphs: { A: ['_'], B: ['|'] } });
  assert.deepEqual(renderFlfRows(font, 'AB'), ['|']);
});

test('renderFlfRows smush rule 2: hierarchy char replaces _', () => {
  const font = makeFont({ layoutMask: 128 | 2, glyphs: { A: ['|'], B: ['_'] } });
  assert.deepEqual(renderFlfRows(font, 'AB'), ['|']);
});

test('renderFlfRows smush rule 4: [ and ] smush to |', () => {
  const font = makeFont({ layoutMask: 128 | 8, glyphs: { A: ['['], B: [']'] } });
  assert.deepEqual(renderFlfRows(font, 'AB'), ['|']);
});

test('renderFlfRows smush rule 5: > and < smush to X', () => {
  const font = makeFont({ layoutMask: 128 | 16, glyphs: { A: ['>'], B: ['<'] } });
  assert.deepEqual(renderFlfRows(font, 'AB'), ['X']);
});

test('renderFlfRows smush rule 5: / and \\ smush to |', () => {
  const font = makeFont({ layoutMask: 128 | 16, glyphs: { A: ['/'], B: ['\\'] } });
  assert.deepEqual(renderFlfRows(font, 'AB'), ['|']);
});

test('renderFlfRows smush rule 5: \\ and / smush to Y', () => {
  const font = makeFont({ layoutMask: 128 | 16, glyphs: { A: ['\\'], B: ['/'] } });
  assert.deepEqual(renderFlfRows(font, 'AB'), ['Y']);
});

test('renderFlfRows smush rule 6: two hardblanks smush to hardblank (replaced by space in output)', () => {
  const font = makeFont({ hardblank: '$', layoutMask: 128 | 32, glyphs: { A: ['$'], B: ['$'] } });
  assert.deepEqual(renderFlfRows(font, 'AB'), [' ']);
});

test('renderFlfRows: hardblanks in output are replaced with spaces', () => {
  const font = makeFont({ hardblank: '$', glyphs: { A: ['A$A'] } });
  assert.deepEqual(renderFlfRows(font, 'A'), ['A A']);
});

// --- universal smushing (smushing bit set, no controlled rule bits) ---

test('renderFlfRows universal smush: later glyph overrides earlier on overlap', () => {
  const font = makeFont({ layoutMask: 128, glyphs: { A: ['A'], B: ['B'] } });
  assert.deepEqual(renderFlfRows(font, 'AB'), ['B']);
});

test('renderFlfRows universal smush: hardblank yields to a real sub-character', () => {
  const font = makeFont({ hardblank: '$', layoutMask: 128, glyphs: { A: ['A'], B: ['$'] } });
  assert.deepEqual(renderFlfRows(font, 'AB'), ['A']);
});

test('renderFlfRows universal smush: tightens width versus fitting', () => {
  const universal = makeFont({ layoutMask: 128, glyphs: { A: ['A'], B: ['B'] } });
  const fitting   = makeFont({ layoutMask: 64,  glyphs: { A: ['A'], B: ['B'] } });
  assert.ok(renderFlfRows(universal, 'AB')[0].length < renderFlfRows(fitting, 'AB')[0].length);
});

// --- letter spacing ---

test('renderFlfRows letterSpacing reduces overlap in fitting mode', () => {
  const font = makeFont({ layoutMask: 64, glyphs: { A: ['A '], B: [' B'] } });
  assert.deepEqual(renderFlfRows(font, 'AB', { letterSpacing: 1 }), ['A B']);
});

test('renderFlfRows letterSpacing adds gap in full-width mode', () => {
  const font = makeFont({ glyphs: { A: ['A'], B: ['B'] } });
  assert.deepEqual(renderFlfRows(font, 'AB', { letterSpacing: 2 }), ['A  B']);
});

test('renderFlfRows negative letterSpacing forces tighter overlap', () => {
  const font = makeFont({ glyphs: { A: ['AA'], B: ['BB'] } });
  assert.deepEqual(renderFlfRows(font, 'AB', { letterSpacing: -1 }), ['ABB']);
  assert.deepEqual(renderFlfRows(font, 'AB', { letterSpacing: -8 }), ['BB']);
});

// --- error ---

test('renderFlfRows throws on unsupported character', () => {
  const font = makeFont({ glyphs: { A: ['A'] } });
  assert.throws(() => renderFlfRows(font, 'AB'), /unsupported character 'B' at position 2/);
});

// --- empty input ---

test('renderFlfRows returns empty rows for empty string', () => {
  const font = makeFont({ height: 2 });
  assert.deepEqual(renderFlfRows(font, ''), ['', '']);
});
