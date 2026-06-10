import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApiQuery, buildCurlCommand, buildApiVariants } from './api-url.js';

const base = {
  text: 'HI', fontKey: 'flf:ANSI_Shadow',
  colorMode: 'gradient', solidColor: '#33ff00', gradientColors: ['#33ff00', '#0066ff'],
  terminalMode: 'truecolor',
  letterSpacing: 0, lineSpacing: 1, paddingLeft: 1, paddingTop: 1, paddingBottom: 1,
};

test('emits only non-default params', () => {
  const p = new URLSearchParams(buildApiQuery(base));
  assert.equal(p.get('text'), 'HI');
  assert.equal(p.get('font'), 'flf:ANSI_Shadow');
  assert.equal(p.get('gradient'), null);
  assert.equal(p.get('letterspacing'), null);
  assert.equal(p.get('depth'), null);
  assert.equal(p.get('mode'), null);
});

test('emits solid color, depth, and spacing when set', () => {
  const p = new URLSearchParams(buildApiQuery({
    ...base, fontKey: 'flf:Roman', colorMode: 'solid', solidColor: '#ff0000',
    terminalMode: '256', letterSpacing: 2,
  }));
  assert.equal(p.get('color'), 'ff0000');
  assert.equal(p.get('depth'), '256');
  assert.equal(p.get('letterspacing'), '2');
});

test('emits mode=plain for plain terminal mode', () => {
  const p = new URLSearchParams(buildApiQuery({ ...base, terminalMode: 'plain' }));
  assert.equal(p.get('mode'), 'plain');
  assert.equal(p.get('gradient'), null);
});

test('encodes a TheDraw palette diff, omitting unchanged slots', () => {
  const p = new URLSearchParams(buildApiQuery({
    ...base, fontKey: 'tdf:1911',
    colorSlots: ['0x01', '0x07'],
    palette: {
      '0x01': { fg: { r: 255, g: 0, b: 0 }, bg: { r: 0, g: 0, b: 0 } }, // changed fg
      '0x07': { fg: { r: 192, g: 192, b: 192 }, bg: { r: 0, g: 0, b: 0 } }, // default
    },
  }));
  assert.ok(p.get('palette').includes('01-ff0000'));
  assert.ok(!p.get('palette').includes('07-'));
});

test('buildCurlCommand wraps the query', () => {
  const cmd = buildCurlCommand(base, 'https://example.com');
  assert.ok(cmd.startsWith('curl "https://example.com/api?'));
  assert.ok(cmd.endsWith('"'));
});

test('buildApiVariants returns ansi, plain, and the 6 script formats in order', () => {
  const v = buildApiVariants(base, 'https://example.com');
  assert.deepEqual(v.map((x) => x.id), ['ansi', 'plain', 'bash', 'powershell', 'python', 'go', 'rust', 'javascript']);
  assert.ok(v[0].curl.startsWith('curl "https://example.com/api?'));
  assert.ok(v.find((x) => x.id === 'plain').curl.includes('mode=plain'));
  assert.ok(v.find((x) => x.id === 'bash').curl.includes('format=bash'));
  assert.ok(v.find((x) => x.id === 'python').curl.includes('format=python'));
  // every variant carries the shared base params (text + font)
  for (const x of v) {
    assert.ok(x.curl.includes('text=HI'));
    assert.ok(x.curl.includes('font='));
  }
});

test('buildApiVariants appends -o termbanner.<ext> to script formats only', () => {
  const v = buildApiVariants(base, 'https://example.com');
  assert.ok(v.find((x) => x.id === 'python').curl.endsWith(" -o termbanner.py"));
  assert.ok(v.find((x) => x.id === 'go').curl.endsWith(" -o termbanner.go"));
  assert.ok(v.find((x) => x.id === 'bash').curl.endsWith(" -o termbanner.sh"));
  assert.ok(v.find((x) => x.id === 'powershell').curl.endsWith(" -o termbanner.ps1"));
  assert.ok(v.find((x) => x.id === 'rust').curl.endsWith(" -o termbanner.rs"));
  assert.ok(v.find((x) => x.id === 'javascript').curl.endsWith(" -o termbanner.js"));
  // ansi/plain print to stdout, no -o
  assert.ok(!v.find((x) => x.id === 'ansi').curl.includes(' -o '));
  assert.ok(!v.find((x) => x.id === 'plain').curl.includes(' -o '));
});

test('buildApiVariants keeps depth on ansi but strips it from script formats', () => {
  const v = buildApiVariants({ ...base, terminalMode: '256' }, 'https://example.com');
  assert.ok(v.find((x) => x.id === 'ansi').curl.includes('depth=256'));
  assert.ok(!v.find((x) => x.id === 'go').curl.includes('depth='));
});

test('plaincolor emitted only when plain block present and mode is manual', () => {
  const withPlain = { ...base, text: '{{hi}}\nHI', plainTextColor: '#ff0000', plainTextColorMode: 'manual' };
  assert.ok(new URLSearchParams(buildApiQuery(withPlain)).get('plaincolor') === 'ff0000');

  const auto = { ...withPlain, plainTextColorMode: 'auto' };
  assert.equal(new URLSearchParams(buildApiQuery(auto)).get('plaincolor'), null);

  const noPlain = { ...base, text: 'HI', plainTextColor: '#ff0000', plainTextColorMode: 'manual' };
  assert.equal(new URLSearchParams(buildApiQuery(noPlain)).get('plaincolor'), null);
});
