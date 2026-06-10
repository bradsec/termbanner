import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeText, padRows, renderRows, validateFonts } from './font.js';

test('validateFonts accepts named fonts and generates a space glyph', () => {
  const fonts = validateFonts({
    demo: {
      name: 'Demo',
      height: 2,
      glyphs: {
        A: ['AA', 'AA'],
      },
    },
  });

  assert.equal(fonts.demo.glyphs[' '].length, 2);
  assert.deepEqual(fonts.demo.glyphs[' '], [' ', ' ']);
});

test('validateFonts rejects glyphs with wrong height', () => {
  assert.throws(
    () => validateFonts({
      demo: {
        name: 'Demo',
        height: 2,
        glyphs: {
          A: ['AA'],
        },
      },
    }),
    /glyph "A" has 1 rows, expected 2/,
  );
});

test('normalizeText uppercases letters', () => {
  assert.equal(normalizeText('hello!'), 'HELLO!');
});

test('renderRows combines glyph rows', () => {
  const fonts = validateFonts({
    demo: {
      name: 'Demo',
      height: 2,
      glyphs: {
        A: ['A1', 'A2'],
        B: ['B1', 'B2'],
      },
    },
  });

  assert.deepEqual(renderRows(fonts.demo, 'ab'), ['A1B1', 'A2B2']);
});

test('renderRows preserves glyph cells and applies letter spacing', () => {
  const fonts = validateFonts({
    demo: {
      name: 'Demo',
      height: 2,
      glyphs: {
        A: ['A  ', 'AA '],
        B: ['B  ', 'BB '],
      },
    },
  });

  assert.deepEqual(renderRows(fonts.demo, 'AB', { letterSpacing: 1 }), ['A  B ', 'AA BB']);
  assert.deepEqual(renderRows(fonts.demo, 'AB', { letterSpacing: 0 }), ['A B ', 'AABB']);
});

test('renderRows preserves fixed glyph bearings', () => {
  const fonts = validateFonts({
    demo: {
      name: 'Demo',
      height: 3,
      glyphs: {
        I: ['  I  ', '  I  ', '  I  '],
        X: ['X X  ', ' X   ', 'X X  '],
      },
    },
  });

  assert.deepEqual(renderRows(fonts.demo, 'IX', { letterSpacing: 1 }), ['  I X X', '  I  X ', '  I X X']);
});

test('renderRows negative letterSpacing reduces the built-in advance gap', () => {
  const fonts = validateFonts({
    demo: {
      name: 'ANSI Demo',
      height: 1,
      advanceGap: 2,
      glyphs: {
        A: ['A'],
        B: ['B'],
      },
    },
  });

  assert.deepEqual(renderRows(fonts.demo, 'AB', { letterSpacing: -1 }), ['A B']);
  assert.deepEqual(renderRows(fonts.demo, 'AB', { letterSpacing: -4 }), ['AB']);
});

test('padRows adds left, top, and bottom padding', () => {
  assert.deepEqual(padRows(['AAA', 'BBB'], { left: 2, top: 2, bottom: 1 }), ['', '', '  AAA', '  BBB', '']);
});

test('padRows trims left, top, and bottom with negative padding', () => {
  assert.deepEqual(padRows(['AAA', 'BBB', 'CCC'], { left: -1, top: -1, bottom: -1 }), ['BB']);
  assert.deepEqual(padRows(['A', 'B'], { left: -4, top: -4, bottom: -4 }), []);
});

test('renderRows rejects unsupported characters', () => {
  const fonts = validateFonts({
    demo: {
      name: 'Demo',
      height: 1,
      glyphs: {
        A: ['A'],
      },
    },
  });

  assert.throws(() => renderRows(fonts.demo, 'A$'), /unsupported character '\$' at position 2/);
});
