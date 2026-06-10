import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateFonts } from './font.js';
import { renderBanner, bannerToAnsi, segmentText, hasPlainText, dominantCellColor } from './banner.js';
import { parseHex } from './color.js';

// Minimal ANSI-style plain font (no `kind` -> renderRows path, like ansi-fonts.json)
const ANSI = validateFonts({
  demo: {
    name: 'Demo',
    height: 2,
    glyphs: {
      A: ['#', '#'],
      B: ['*', '*'],
    },
  },
}).demo;

test('renderBanner plain gradient returns rows and per-row colors', () => {
  const result = renderBanner({
    font: ANSI,
    text: 'AB',
    colorMode: 'gradient',
    gradientColors: ['#ff0000', '#0000ff'],
    paddingLeft: 0, paddingTop: 0, paddingBottom: 0, lineSpacing: 1,
  });
  assert.equal(result.kind, 'plain');
  assert.equal(result.rows.length, 2);
  assert.equal(result.colors.length, 2);
  assert.deepEqual(result.colors[0], { r: 255, g: 0, b: 0 });
});

test('bannerToAnsi plain mode emits no escape codes', () => {
  const result = renderBanner({
    font: ANSI, text: 'A',
    paddingLeft: 0, paddingTop: 0, paddingBottom: 0,
  });
  const out = bannerToAnsi(result, 'plain', {});
  assert.ok(!out.includes('\x1b'));
});

test('bannerToAnsi truecolor wraps rows in SGR escapes', () => {
  const result = renderBanner({
    font: ANSI, text: 'A', colorMode: 'solid', solidColor: '#ff0000',
    paddingLeft: 0, paddingTop: 0, paddingBottom: 0,
  });
  const out = bannerToAnsi(result, 'truecolor', {});
  assert.ok(out.includes('\x1b[38;2;255;0;0m'));
});

test('renderBanner rejects empty text', () => {
  assert.throws(() => renderBanner({ font: ANSI, text: '   ' }), /Enter text/);
});

test('renderBanner applies TheDraw palette overrides onto defaults', () => {
  const tdf = {
    kind: 'tdf-color', key: 't', height: 1, spacing: 0,
    colorSlots: ['0x01', '0x07'],
    glyphs: { A: { chars: ['A'], colors: ['01'] } },
  };
  const result = renderBanner({
    font: tdf, text: 'A',
    paletteOverrides: { '0x01': { fg: { r: 9, g: 9, b: 9 } } },
    paddingLeft: 0, paddingTop: 0, paddingBottom: 0,
  });
  assert.equal(result.kind, 'tdf-color');
  assert.deepEqual(result.palette['0x01'].fg, { r: 9, g: 9, b: 9 });
  // unspecified slot keeps its built-in color
  assert.ok(result.palette['0x07']);
});

test('segmentText: plain block above font lines, blanks preserved', () => {
  const text = '{{\nCreated by BRADSEC\n\n\n   termbanner.com\n}}\nTERM\nBANNER';
  assert.deepEqual(segmentText(text), [
    { type: 'plain', row: 'Created by BRADSEC' },
    { type: 'plain', row: '' },
    { type: 'plain', row: '' },
    { type: 'plain', row: '   termbanner.com' },
    { type: 'font', line: 'TERM' },
    { type: 'font', line: 'BANNER' },
  ]);
});

test('segmentText: single-line block is one plain row, whitespace kept', () => {
  assert.deepEqual(segmentText('{{  hi  }}'), [{ type: 'plain', row: '  hi  ' }]);
});

test('segmentText: empty block is one blank plain row', () => {
  assert.deepEqual(segmentText('{{}}'), [{ type: 'plain', row: '' }]);
});

test('segmentText: font lines are trimmed and blanks dropped', () => {
  assert.deepEqual(segmentText('  TERM  \n\nBANNER'), [
    { type: 'font', line: 'TERM' },
    { type: 'font', line: 'BANNER' },
  ]);
});

test('segmentText: mid-line marker splits into plain then font', () => {
  assert.deepEqual(segmentText('{{x}} TERM'), [
    { type: 'plain', row: 'x' },
    { type: 'font', line: 'TERM' },
  ]);
});

test('segmentText: unbalanced open marker stays in font segment', () => {
  assert.deepEqual(segmentText('{{ TERM'), [{ type: 'font', line: '{{ TERM' }]);
});

test('hasPlainText detects a block', () => {
  assert.equal(hasPlainText('TERM\n{{hi}}'), true);
  assert.equal(hasPlainText('TERM\nBANNER'), false);
});

test('segmentText/hasPlainText handle null and undefined', () => {
  assert.deepEqual(segmentText(null), []);
  assert.deepEqual(segmentText(undefined), []);
  assert.equal(hasPlainText(null), false);
  assert.equal(hasPlainText(undefined), false);
});

test('dominantCellColor picks the most frequent non-space fg', () => {
  const palette = {
    '0x01': { fg: { r: 255, g: 0, b: 0 }, bg: { r: 0, g: 0, b: 0 } },
    '0x02': { fg: { r: 0, g: 0, b: 255 }, bg: { r: 0, g: 0, b: 0 } },
  };
  const rows = [
    [{ ch: 'A', color: '0x01' }, { ch: 'B', color: '0x01' }, { ch: ' ', color: '0x02' }],
    [{ ch: 'C', color: '0x02' }],
  ];
  assert.deepEqual(dominantCellColor(rows, palette), { r: 255, g: 0, b: 0 });
});

test('dominantCellColor returns white when no visible cells', () => {
  assert.deepEqual(dominantCellColor([[{ ch: ' ', color: '0x01' }]], {}), { r: 255, g: 255, b: 255 });
});

const ANSI3 = validateFonts({
  demo: { name: 'Demo', height: 1, glyphs: { A: ['#'], B: ['*'] } },
}).demo;

test('plain line renders as one literal row with the plain color', () => {
  const result = renderBanner({
    font: ANSI3, text: '{{hi}}\nA',
    colorMode: 'solid', solidColor: '#00ff00', plainTextColor: '#ff0000',
    paddingLeft: 0, paddingTop: 0, paddingBottom: 0, lineSpacing: 0,
  });
  assert.equal(result.kind, 'plain');
  assert.equal(result.rows[0], 'hi');                 // literal plain row
  assert.deepEqual(result.colors[0], { r: 255, g: 0, b: 0 }); // plain color
  assert.deepEqual(result.colors[1], { r: 0, g: 255, b: 0 }); // font color
});

test('no plain text: output identical to plain font render', () => {
  const opts = {
    font: ANSI3, text: 'A\nB', colorMode: 'gradient',
    gradientColors: ['#ff0000', '#0000ff'],
    paddingLeft: 0, paddingTop: 0, paddingBottom: 0, lineSpacing: 0,
  };
  const result = renderBanner(opts);
  assert.deepEqual(result.rows, ['#', '*']);
  assert.deepEqual(result.colors[0], { r: 255, g: 0, b: 0 });
  assert.deepEqual(result.colors[1], { r: 0, g: 0, b: 255 });
  assert.ok(result.plainColor); // every render result carries plainColor
});

test('plain color auto-defaults to solidColor for FLF/ANSI', () => {
  const result = renderBanner({
    font: ANSI3, text: '{{hi}}', colorMode: 'solid', solidColor: '#123456',
    paddingLeft: 0, paddingTop: 0, paddingBottom: 0,
  });
  assert.deepEqual(result.colors[0], parseHex('#123456'));
  assert.equal(result.plainColor.toLowerCase(), '#123456');
});

test('multi-line block preserves blank rows', () => {
  const result = renderBanner({
    font: ANSI3, text: '{{\nx\n\ny\n}}',
    paddingLeft: 0, paddingTop: 0, paddingBottom: 0, lineSpacing: 0,
  });
  assert.deepEqual(result.rows, ['x', '', 'y']);
});

test('renderBanner does not mutate a caller-provided palette', () => {
  const tdf = {
    kind: 'tdf-color', key: 't', height: 1, spacing: 0,
    colorSlots: ['0x01'],
    glyphs: { A: { chars: ['A'], colors: ['01'] } },
  };
  const palette = { '0x01': { fg: { r: 1, g: 2, b: 3 }, bg: { r: 0, g: 0, b: 0 } } };
  renderBanner({
    font: tdf, text: '{{hi}}\nA', palette, plainTextColor: '#ff0000',
    paddingLeft: 0, paddingTop: 0, paddingBottom: 0, lineSpacing: 0,
  });
  assert.equal(palette.__plain, undefined); // original object untouched
});

test('TheDraw plain row uses the synthetic plain slot colored by plainTextColor', () => {
  const tdf = {
    kind: 'tdf-color', key: 't', height: 1, spacing: 0,
    colorSlots: ['0x01'],
    glyphs: { A: { chars: ['A'], colors: ['01'] } },
  };
  const result = renderBanner({
    font: tdf, text: '{{hi}}\nA', plainTextColor: '#ff0000',
    paddingLeft: 0, paddingTop: 0, paddingBottom: 0, lineSpacing: 0,
  });
  assert.equal(result.kind, 'tdf-color');
  assert.ok(result.palette.__plain);
  assert.deepEqual(result.palette.__plain.fg, { r: 255, g: 0, b: 0 });
  assert.equal(result.rows[0][0].color, '__plain');
});
