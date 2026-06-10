import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ansiCellLines,
  cellRowsToPlainText,
  defaultPaletteForSlots,
  padCellRows,
  renderCellRows,
} from './cell-render.js';

const font = {
  kind: 'tdf-color',
  format: 'tdf-compact-v1',
  height: 2,
  spacing: 1,
  colorSlots: ['0x0f', '0x4f'],
  glyphs: {
    A: {
      chars: ['█', '▄'],
      colors: ['0f', '4f'],
    },
    B: {
      chars: ['▀', '█'],
      colors: ['0f', '4f'],
    },
  },
};

test('renderCellRows combines compact glyphs and spacing cells', () => {
  const rows = renderCellRows(font, 'AB');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].map((cell) => cell.ch).join(''), '█ ▀');
  assert.equal(rows[1].map((cell) => cell.ch).join(''), '▄ █');
  assert.equal(rows[0][1].color, '0x00');
});

test('defaultPaletteForSlots decodes foreground and background colors', () => {
  const palette = defaultPaletteForSlots(['0x4f']);
  assert.deepEqual(palette['0x4f'].fg, { r: 255, g: 255, b: 255 });
  assert.deepEqual(palette['0x4f'].bg, { r: 128, g: 0, b: 0 });
});

test('cellRowsToPlainText strips colors', () => {
  assert.equal(cellRowsToPlainText(renderCellRows(font, 'A')), '█\n▄');
});

test('ansiCellLines emits foreground and background ANSI escapes', () => {
  const palette = defaultPaletteForSlots(font.colorSlots);
  assert.deepEqual(ansiCellLines(renderCellRows(font, 'A'), palette, '16'), [
    '\x1b[97;40m█\x1b[0m',
    '\x1b[97;41m▄\x1b[0m',
  ]);
});

test('renderCellRows applies letterSpacing in addition to font spacing', () => {
  const rows = renderCellRows(font, 'AB', { letterSpacing: 2 });
  assert.equal(rows[0].map((cell) => cell.ch).join(''), '█   ▀');
  assert.equal(rows[1].map((cell) => cell.ch).join(''), '▄   █');
  assert.deepEqual(rows[0].slice(1, 4).map((cell) => cell.color), ['0x00', '0x00', '0x00']);
});

test('renderCellRows supports lowercase glyph keys when rendering uppercase text', () => {
  const rows = renderCellRows({
    kind: 'tdf-color',
    format: 'tdf-compact-v1',
    height: 1,
    spacing: 0,
    colorSlots: ['0x0f'],
    glyphs: {
      a: {
        chars: ['x'],
        colors: ['0f'],
      },
    },
  }, 'A');

  assert.equal(cellRowsToPlainText(rows), 'x');
});

test('renderCellRows ignores colors recorded for a missing chars row', () => {
  const rows = renderCellRows({
    kind: 'tdf-color',
    format: 'tdf-compact-v1',
    height: 2,
    spacing: 0,
    colorSlots: ['0x0f'],
    glyphs: {
      A: {
        chars: ['██'], // second row missing: blank
        colors: ['0f0f', '0f'], // stray short colors row for the blank row
      },
    },
  }, 'A');

  assert.deepEqual(rows[1].map((cell) => cell.color), ['0x00', '0x00']);
});

test('renderCellRows rejects unsupported characters', () => {
  assert.throws(
    () => renderCellRows(font, 'AZ'),
    /unsupported character 'Z' at position 1/,
  );
});

test('renderCellRows renders a space as a blank gap instead of throwing', () => {
  assert.doesNotThrow(() => renderCellRows(font, 'A B'));
});

test('renderCellRows sizes a space to the median glyph width', () => {
  const wideFont = {
    kind: 'tdf-color',
    format: 'tdf-compact-v1',
    height: 1,
    spacing: 0,
    colorSlots: ['0x0f'],
    glyphs: {
      A: { chars: ['AAA'], colors: ['0f0f0f'] },
      B: { chars: ['BBB'], colors: ['0f0f0f'] },
    },
  };
  const rows = renderCellRows(wideFont, 'A B');
  // A(3) + space(median glyph width 3) + B(3)
  assert.equal(rows[0].map((cell) => cell.ch).join(''), 'AAA   BBB');
  assert.deepEqual(rows[0].slice(3, 6).map((cell) => cell.color), ['0x00', '0x00', '0x00']);
});

test('renderCellRows rejects malformed compact glyph rows', async (t) => {
  await t.test('short odd color row', () => {
    assert.throws(
      () => renderCellRows({
        ...font,
        glyphs: {
          ...font.glyphs,
          A: {
            chars: ['██', '▄'],
            colors: ['0', '4f'],
          },
        },
      }, 'A'),
      /invalid compact glyph "A" row 1/,
    );
  });

  await t.test('non-hex color row', () => {
    assert.throws(
      () => renderCellRows({
        ...font,
        glyphs: {
          ...font.glyphs,
          A: {
            chars: ['█', '▄'],
            colors: ['zz', '4f'],
          },
        },
      }, 'A'),
      /invalid compact glyph "A" row 1/,
    );
  });
});

test('ansiCellLines groups adjacent same-color cells into a single escape sequence', () => {
  const palette = defaultPaletteForSlots(['0x0f']);
  const rows = [[
    { ch: 'A', color: '0x0f' },
    { ch: 'B', color: '0x0f' },
    { ch: 'C', color: '0x0f' },
  ]];

  assert.deepEqual(ansiCellLines(rows, palette, '16'), ['\x1b[97;40mABC\x1b[0m']);
});

test('ansiCellLines supports plain, 256, and truecolor output', () => {
  const palette = defaultPaletteForSlots(['0x4f']);
  const rows = [[{ ch: 'X', color: '0x4f' }]];

  assert.deepEqual(ansiCellLines(rows, palette, 'plain'), ['X']);
  assert.match(ansiCellLines(rows, palette, '256')[0], /^\x1b\[38;5;\d+m\x1b\[48;5;\d+mX\x1b\[0m$/);
  assert.equal(ansiCellLines(rows, palette, 'truecolor')[0], '\x1b[38;2;255;255;255m\x1b[48;2;128;0;0mX\x1b[0m');
});

test('padCellRows adds left, top, and bottom padding', () => {
  const rows = renderCellRows(font, 'A');

  assert.equal(cellRowsToPlainText(padCellRows(rows, { left: 1, top: 1, bottom: 1 })), '  \n █\n ▄\n  ');
});

test('padCellRows trims left, top, and bottom with negative padding', () => {
  const rows = [
    [{ ch: 'A', color: '0x00' }, { ch: 'B', color: '0x00' }],
    [{ ch: 'C', color: '0x00' }, { ch: 'D', color: '0x00' }],
    [{ ch: 'E', color: '0x00' }, { ch: 'F', color: '0x00' }],
  ];

  assert.equal(cellRowsToPlainText(padCellRows(rows, { left: -1, top: -1, bottom: -1 })), 'D');
});
