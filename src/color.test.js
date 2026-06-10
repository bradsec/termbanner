import test from 'node:test';
import assert from 'node:assert/strict';
import { ansiStart, gradient, nearest16Code, nearest256Code, parseHex, rgbToHsl, hslToRgb } from './color.js';

test('rgbToHsl maps primary red', () => {
  const hsl = rgbToHsl({ r: 255, g: 0, b: 0 });
  assert.equal(Math.round(hsl.h), 0);
  assert.equal(hsl.s, 1);
  assert.equal(hsl.l, 0.5);
});

test('rgbToHsl maps greys to zero saturation', () => {
  assert.deepEqual(rgbToHsl({ r: 0, g: 0, b: 0 }), { h: 0, s: 0, l: 0 });
  assert.deepEqual(rgbToHsl({ r: 255, g: 255, b: 255 }), { h: 0, s: 0, l: 1 });
});

test('hslToRgb is the inverse of rgbToHsl within rounding', () => {
  for (const c of [{ r: 128, g: 64, b: 64 }, { r: 12, g: 200, b: 90 }, { r: 200, g: 200, b: 210 }]) {
    const back = hslToRgb(rgbToHsl(c));
    assert.ok(Math.abs(back.r - c.r) <= 1, `r ${back.r} vs ${c.r}`);
    assert.ok(Math.abs(back.g - c.g) <= 1, `g ${back.g} vs ${c.g}`);
    assert.ok(Math.abs(back.b - c.b) <= 1, `b ${back.b} vs ${c.b}`);
  }
});

test('hslToRgb wraps and clamps hue', () => {
  assert.deepEqual(hslToRgb({ h: 360, s: 1, l: 0.5 }), { r: 255, g: 0, b: 0 });
  assert.deepEqual(hslToRgb({ h: -360, s: 1, l: 0.5 }), { r: 255, g: 0, b: 0 });
});

test('parseHex accepts short and long forms', () => {
  assert.deepEqual(parseHex('#0df'), { r: 0, g: 221, b: 255 });
  assert.deepEqual(parseHex('ff4d8d'), { r: 255, g: 77, b: 141 });
});

test('parseHex rejects invalid values', () => {
  assert.throws(() => parseHex('#12xz00'), /invalid hex color/);
});

test('gradient interpolates top to bottom', () => {
  assert.deepEqual(
    gradient([{ r: 0, g: 0, b: 0 }, { r: 100, g: 50, b: 0 }], 3),
    [{ r: 0, g: 0, b: 0 }, { r: 50, g: 25, b: 0 }, { r: 100, g: 50, b: 0 }],
  );
});

test('nearest palette matching supports 16 and 256 color output', () => {
  assert.equal(nearest16Code({ r: 255, g: 0, b: 0 }), 91);
  assert.equal(nearest256Code({ r: 255, g: 0, b: 0 }), 196);
});

test('ansiStart emits selected terminal mode', () => {
  const red = { r: 255, g: 0, b: 0 };

  assert.equal(ansiStart('plain', red), '');
  assert.equal(ansiStart('truecolor', red), '\x1b[38;2;255;0;0m');
  assert.equal(ansiStart('256', red), '\x1b[38;5;196m');
  assert.equal(ansiStart('16', red), '\x1b[91m');
});
