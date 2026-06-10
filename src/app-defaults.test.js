import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_BANNER_TEXT, buildFontOptionsHtml, browseFontsLabel, orderedFontEntries, randomFontKey, totalFontCount } from './app-defaults.js';

test('default banner text is TERM BANNER with a termbanner.com plain-text line', () => {
  assert.equal(DEFAULT_BANNER_TEXT, 'TERM\nBANNER\n{{termbanner.com}}');
});

test('randomFontKey picks from ANSI, Figlet, and TheDraw font keys', () => {
  const plainFonts = {
    block: { name: 'Block' },
    shade: { name: 'Shade' },
  };
  const flfIndex = [{ key: 'slant' }];
  const tdfIndex = [{ key: 'future.tdf' }];

  assert.equal(randomFontKey({ plainFonts, flfIndex, tdfIndex }, () => 0), 'plain:block');
  assert.equal(randomFontKey({ plainFonts, flfIndex, tdfIndex }, () => 0.49), 'plain:shade');
  assert.equal(randomFontKey({ plainFonts, flfIndex, tdfIndex }, () => 0.5), 'flf:slant');
  assert.equal(randomFontKey({ plainFonts, flfIndex, tdfIndex }, () => 0.99), 'tdf:future.tdf');
});

test('randomFontKey falls back to ANSI Shadow when no font lists are loaded', () => {
  assert.equal(randomFontKey({ plainFonts: {}, flfIndex: [], tdfIndex: [] }, () => 0), 'flf:ANSI_Shadow');
});

test('randomFontKey with thedraw filter only returns TheDraw keys', () => {
  const fontState = {
    plainFonts: { block: { name: 'Block' } },
    flfIndex: [{ key: 'slant', name: 'Slant' }],
    tdfIndex: [{ key: 'future.tdf', name: 'Future' }, { key: 'ascii.tdf', name: 'ASCII' }],
    fontTypeFilter: 'thedraw',
  };
  assert.equal(randomFontKey(fontState, () => 0), 'tdf:future.tdf');
  assert.equal(randomFontKey(fontState, () => 0.99), 'tdf:ascii.tdf');
});

test('buildFontOptionsHtml groups ANSI Regular with Figlet fonts near ANSI Shadow', () => {
  const html = buildFontOptionsHtml({
    plainFonts: {
      regular: { name: 'ANSI Regular' },
    },
    flfIndex: [
      { key: 'Slant', name: 'Slant' },
      { key: 'ANSI_Shadow', name: 'ANSI Shadow' },
      { key: 'Big', name: 'Big' },
    ],
    tdfIndex: [],
  });

  assert.equal(html.includes('optgroup label="ANSI"'), false);
  assert.equal(html.includes('<optgroup label="Figlet">'), true);
  assert.match(html, /ANSI Shadow<\/option><option value="plain:regular">ANSI Regular<\/option>/);
});

test('orderedFontEntries puts ANSI Regular after ANSI Shadow and TheDraw after Figlet', () => {
  const entries = orderedFontEntries({
    plainFonts: {
      regular: { name: 'ANSI Regular' },
    },
    flfIndex: [
      { key: 'Slant', name: 'Slant' },
      { key: 'ANSI_Shadow', name: 'ANSI Shadow' },
      { key: 'Big', name: 'Big' },
    ],
    tdfIndex: [
      { key: 'future.tdf', name: 'Future' },
    ],
  });

  assert.deepEqual(entries.map((entry) => entry.key), [
    'flf:Slant',
    'flf:ANSI_Shadow',
    'plain:regular',
    'flf:Big',
    'tdf:future.tdf',
  ]);
});

test('totalFontCount includes ANSI, Figlet, and TheDraw fonts', () => {
  assert.equal(totalFontCount({
    plainFonts: {
      regular: { name: 'ANSI Regular' },
      block: { name: 'Block' },
    },
    flfIndex: [{ key: 'Slant', name: 'Slant' }],
    tdfIndex: [
      { key: 'future.tdf', name: 'Future' },
      { key: 'ascii.tdf', name: 'ASCII' },
    ],
  }), 5);
});

test('browseFontsLabel formats the total font count', () => {
  assert.equal(browseFontsLabel({ plainFonts: {}, flfIndex: [], tdfIndex: [] }), 'Browse All Fonts...');
  assert.equal(browseFontsLabel({
    plainFonts: { regular: { name: 'ANSI Regular' } },
    flfIndex: Array.from({ length: 1200 }, (_, index) => ({ key: `f${index}`, name: `F${index}` })),
    tdfIndex: [{ key: 'future.tdf', name: 'Future' }],
  }), 'Browse All Fonts... (1,202)');
});
