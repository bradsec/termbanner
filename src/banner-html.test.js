import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bannerToHtml, htmlPage } from './banner-html.js';

test('plain result renders colored rows and escapes HTML', () => {
  const result = {
    kind: 'plain',
    rows: ['<A>', 'B&C'],
    colors: [{ r: 255, g: 0, b: 0 }, { r: 0, g: 0, b: 255 }],
  };
  const html = bannerToHtml(result, 'truecolor', {});
  assert.ok(html.includes('rgb(255 0 0)'));
  assert.ok(html.includes('&lt;A&gt;'));
  assert.ok(html.includes('B&amp;C'));
  assert.ok(!html.includes('<A>'));
});

test('plain mode renders without color styling', () => {
  const result = { kind: 'plain', rows: ['A'], colors: [{ r: 1, g: 2, b: 3 }] };
  const html = bannerToHtml(result, 'plain', {});
  assert.ok(!html.includes('rgb('));
});

test('htmlPage wraps a body fragment in a full document', () => {
  const page = htmlPage('<pre>x</pre>', { title: 'TermBanner' });
  assert.ok(page.startsWith('<!doctype html>'));
  assert.ok(page.includes('<pre>x</pre>'));
});
