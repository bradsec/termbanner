import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateFonts } from './font.js';
import { handleApi, outputCellCount } from './api-handler.js';

const ansi = validateFonts({
  demo: { name: 'Demo', height: 2, glyphs: { A: ['#', '#'], B: ['*', '*'] } },
});

const loaders = {
  async indexes() {
    return {
      ansi,
      flf: [],
      tdf: [],
    };
  },
  async loadFont(descriptor) {
    return descriptor.font;
  },
};

// Loaders exposing a single TheDraw font for palette/override tests.
const tdfFont = {
  kind: 'tdf-color', key: 't', height: 1, spacing: 0,
  colorSlots: ['0x01'],
  glyphs: { A: { chars: ['A'], colors: ['01'] } },
};
const tdfLoaders = {
  async indexes() {
    return { ansi: {}, flf: [], tdf: [{ kind: 'tdf-color', key: 't', name: 'TT', path: './t.json' }] };
  },
  async loadFont() { return tdfFont; },
};

test('missing text -> 400', async () => {
  const res = await handleApi('font=demo', '', loaders);
  assert.equal(res.status, 400);
  assert.match(res.body, /text/i);
});

test('unknown font -> 400', async () => {
  const res = await handleApi('text=AB&font=nope', '', loaders);
  assert.equal(res.status, 400);
  assert.match(res.body, /font/i);
});

test('text over 200 chars -> 400', async () => {
  const res = await handleApi(`text=${'A'.repeat(201)}&font=demo`, '', loaders);
  assert.equal(res.status, 400);
});

test('bad hex color -> 400', async () => {
  const res = await handleApi('text=A&font=demo&color=xyz', '', loaders);
  assert.equal(res.status, 400);
});

test('more than 10 gradient stops -> 400', async () => {
  const stops = Array.from({ length: 11 }, () => 'ff0000').join(',');
  const res = await handleApi(`text=A&font=demo&gradient=${stops}`, '', loaders);
  assert.equal(res.status, 400);
});

test('curl request -> text/plain ANSI', async () => {
  const res = await handleApi('text=A&font=demo&color=ff0000', '', loaders);
  assert.equal(res.status, 200);
  assert.match(res.headers['Content-Type'], /text\/plain/);
  assert.ok(res.body.includes('\x1b[38;2;255;0;0m'));
});

test('plain mode -> no escape codes', async () => {
  const res = await handleApi('text=A&font=demo&mode=plain', '', loaders);
  assert.equal(res.status, 200);
  assert.ok(!res.body.includes('\x1b'));
});

test('browser Accept -> text/html page', async () => {
  const res = await handleApi('text=A&font=demo', 'text/html,application/xhtml+xml', loaders);
  assert.equal(res.status, 200);
  assert.match(res.headers['Content-Type'], /text\/html/);
  assert.ok(res.body.startsWith('<!doctype html>'));
});

test('\\n in text becomes a newline (multi-line)', async () => {
  const res = await handleApi('text=A\\nB&font=demo&mode=plain', '', loaders);
  assert.equal(res.status, 200);
  assert.ok(res.body.split('\n').length >= 4); // 2 rows per line, 2 lines
});

test('letterspacing out of range -> 400', async () => {
  const res = await handleApi('text=A&font=demo&letterspacing=999', '', loaders);
  assert.equal(res.status, 400);
});

test('non-integer padding -> 400', async () => {
  const res = await handleApi('text=A&font=demo&padleft=abc', '', loaders);
  assert.equal(res.status, 400);
});

test('TheDraw palette override applies fg color', async () => {
  const res = await handleApi('text=A&font=TT&palette=01-090909', '', tdfLoaders);
  assert.equal(res.status, 200);
  assert.ok(res.body.includes('38;2;9;9;9'));
});

test('unknown palette slot -> 400', async () => {
  const res = await handleApi('text=A&font=TT&palette=ff-090909', '', tdfLoaders);
  assert.equal(res.status, 400);
});

test('format=bash returns a shell script with filename header', () => {
  return handleApi('text=A&font=demo&color=ff0000&format=bash', '', loaders).then((res) => {
    assert.equal(res.status, 200);
    assert.ok(res.body.startsWith('#!/bin/sh'));
    assert.match(res.headers['Content-Disposition'], /termbanner\.sh/);
  });
});

test('format=py returns a python script', async () => {
  const res = await handleApi('text=A&font=demo&format=py', '', loaders);
  assert.equal(res.status, 200);
  assert.match(res.headers['Content-Disposition'], /termbanner\.py/);
});

test('unknown format -> 400', async () => {
  const res = await handleApi('text=A&font=demo&format=cobol', '', loaders);
  assert.equal(res.status, 400);
  assert.match(res.body, /format/i);
});

test('format ignores html Accept (script wins, stays text/plain)', async () => {
  const res = await handleApi('text=A&font=demo&format=bash', 'text/html', loaders);
  assert.equal(res.status, 200);
  assert.match(res.headers['Content-Type'], /text\/plain/);
  assert.ok(res.body.startsWith('#!/bin/sh'));
});

test('outputCellCount sums row lengths (strings and cell arrays)', () => {
  assert.equal(outputCellCount({ rows: ['abc', 'de'] }), 5);
  assert.equal(outputCellCount({ rows: [[1, 2], [3]] }), 3);
});

test('success caches; error does not', async () => {
  const ok = await handleApi('text=A&font=demo', '', loaders);
  assert.match(ok.headers['Cache-Control'], /max-age/);
  const bad = await handleApi('font=demo', '', loaders);
  assert.equal(bad.headers['Cache-Control'], 'no-store');
});

test('plaincolor applies to plain text rows', async () => {
  const res = await handleApi('text=' + encodeURIComponent('{{hi}}\nA') + '&font=demo&plaincolor=ff0000', '', loaders);
  assert.equal(res.status, 200);
  assert.ok(res.body.includes('\x1b[38;2;255;0;0m')); // red plain row
  const colorEscapes = [...res.body.matchAll(/\x1b\[38;2;(\d+;\d+;\d+)m/g)].map((m) => m[1]);
  assert.ok(colorEscapes.includes('255;0;0')); // plain row is red
  assert.ok(colorEscapes.some((c) => c !== '255;0;0')); // font row uses a different color
});

test('invalid plaincolor -> 400', async () => {
  const res = await handleApi('text=' + encodeURIComponent('{{hi}}') + '&font=demo&plaincolor=nope', '', loaders);
  assert.equal(res.status, 400);
});

test('plaincolor omitted -> auto (solid color), no error', async () => {
  const res = await handleApi('text=' + encodeURIComponent('{{hi}}\nA') + '&font=demo&color=00ff00', '', loaders);
  assert.equal(res.status, 200);
  assert.ok(res.body.includes('\x1b[38;2;0;255;0m')); // plain row took the solid color
});
