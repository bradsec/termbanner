import test from 'node:test';
import assert from 'node:assert/strict';
import { randomizePalette } from './random-palette.js';
import { rgbToHsl, quantizeColor } from './color.js';

const samplePalette = () => ({
  '0x00': { fg: { r: 0, g: 0, b: 0 }, bg: { r: 0, g: 0, b: 0 } },
  '0x01': { fg: { r: 128, g: 64, b: 64 }, bg: { r: 0, g: 0, b: 0 } },
  '0x02': { fg: { r: 200, g: 200, b: 200 }, bg: { r: 20, g: 20, b: 20 } },
});

test('randomizePalette preserves lightness and applies one hue scheme (truecolor)', () => {
  const palette = samplePalette();
  const out = randomizePalette(palette, Object.keys(palette), 'truecolor', () => 0.5);

  // near-black stays black
  assert.deepEqual(out['0x00'].fg, { r: 0, g: 0, b: 0 });

  // lightness preserved within rounding for a mid-tone slot
  const lIn = rgbToHsl(palette['0x01'].fg).l;
  const lOut = rgbToHsl(out['0x01'].fg).l;
  assert.ok(Math.abs(lIn - lOut) < 0.02, `lightness ${lOut} vs ${lIn}`);

  // hue is the scheme hue (random 0.5 -> 180 deg, zero jitter)
  assert.ok(Math.abs(rgbToHsl(out['0x01'].fg).h - 180) < 1);

  // does not mutate the input
  assert.deepEqual(palette['0x01'].fg, { r: 128, g: 64, b: 64 });

  // keys preserved
  assert.deepEqual(Object.keys(out).sort(), ['0x00', '0x01', '0x02']);
});

test('randomizePalette near-white anchor stays neutral', () => {
  const palette = samplePalette();
  const out = randomizePalette(palette, Object.keys(palette), 'truecolor', () => 0.5);
  // 0x02 fg is light grey (l ~0.78) so it gets recoloured, but pure white would not.
  const white = { '0xff': { fg: { r: 255, g: 255, b: 255 }, bg: { r: 0, g: 0, b: 0 } } };
  const outWhite = randomizePalette(white, Object.keys(white), 'truecolor', () => 0.5);
  assert.deepEqual(outWhite['0xff'].fg, { r: 255, g: 255, b: 255 });
});

test('randomizePalette quantizes output to the selected depth (16)', () => {
  const palette = samplePalette();
  const out = randomizePalette(palette, Object.keys(palette), '16', () => 0.3);
  for (const slot of Object.keys(out)) {
    for (const channel of ['fg', 'bg']) {
      const c = out[slot][channel];
      // every colour must already be a member of the 16-colour palette
      assert.deepEqual(quantizeColor(c, '16'), c, `${slot}.${channel} not a 16-colour`);
    }
  }
});
