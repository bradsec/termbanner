import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveFont, listFontNames } from './resolve-font.js';

const indexes = {
  ansi: { regular: { name: 'ANSI Regular', height: 7, glyphs: {} } },
  flf: [
    { kind: 'flf-plain', key: 'ANSI_Shadow', name: 'ANSI Shadow', path: './fonts/flf/ANSI_Shadow.json' },
    { kind: 'flf-plain', key: 'Roman', name: 'Roman', path: './fonts/flf/Roman.json' },
    { kind: 'flf-plain', key: '1943____', name: '1943    ', path: './fonts/flf/1943____.json' },
  ],
  tdf: [
    { kind: 'tdf-color', key: '1911', name: '1911', path: './fonts/tdf/1911.json' },
    { kind: 'tdf-color', key: 'Roman', name: 'Roman', path: './fonts/tdf/Roman.json' },
  ],
};

test('kind-prefixed key resolves to the exact font (escape hatch)', () => {
  assert.equal(resolveFont('tdf:Roman', indexes).source, 'tdf');
  assert.equal(resolveFont('flf:Roman', indexes).source, 'flf');
});

test('bare name resolves case- and separator-insensitively', () => {
  assert.equal(resolveFont('ansi shadow', indexes).key, 'ANSI_Shadow');
  assert.equal(resolveFont('ANSI_SHADOW', indexes).key, 'ANSI_Shadow');
});

test('trailing-space FLF name is reachable normalized', () => {
  assert.equal(resolveFont('1943', indexes).key, '1943____');
});

test('collision (Roman) resolves to figlet group before TheDraw', () => {
  assert.equal(resolveFont('roman', indexes).source, 'flf');
});

test('ANSI inline font resolves with its glyph object attached', () => {
  const d = resolveFont('ANSI Regular', indexes);
  assert.equal(d.source, 'ansi');
  assert.ok(d.font);
});

test('unknown font returns null', () => {
  assert.equal(resolveFont('does-not-exist', indexes), null);
});

test('listFontNames returns names across all indexes', () => {
  const names = listFontNames(indexes);
  assert.ok(names.includes('ANSI Shadow'));
  assert.ok(names.includes('1911'));
});
