import test from 'node:test';
import assert from 'node:assert/strict';
import { randomizePalette } from './random-palette.js';
import { defaultPaletteForSlots } from './cell-render.js';
import { rgbToHsl, quantizeColor } from './color.js';

const lightnessProfile = (pal) =>
  Object.keys(pal)
    .sort()
    .map((slot) => rgbToHsl(pal[slot].fg).l);

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

test('seeding from the default palette keeps lightness closer to the font than compounding (16)', () => {
  // The Random Palette button must randomize from the font default, not the
  // live palette. In a narrow depth, quantization breaks lightness-preservation,
  // so compounding from the previous result drifts brightness away from the
  // font's shading. Re-seeding from the default each time avoids that drift.
  const slots = ['0x07', '0x08', '0x0f', '0x70', '0x01', '0x0c'];
  const def = defaultPaletteForSlots(slots);
  const baseL = lightnessProfile(def);
  const drift = (pal) =>
    lightnessProfile(pal).reduce((sum, l, i) => sum + Math.abs(l - baseL[i]), 0);

  // small deterministic PRNG so the test does not depend on Math.random
  const lcg = (seed) => {
    let s = seed >>> 0;
    return () => {
      s = (1664525 * s + 1013904223) >>> 0;
      return s / 4294967296;
    };
  };

  const trials = 200;
  let seededTotal = 0;
  let compoundTotal = 0;
  for (let t = 0; t < trials; t += 1) {
    const random = lcg(t * 2654435761 + 1);
    // correct behaviour: always randomize from the font default
    seededTotal += drift(randomizePalette(def, Object.keys(def), '16', random));
    // buggy behaviour: feed each result back in (last set palette)
    let live = def;
    for (let i = 0; i < 6; i += 1) {
      live = randomizePalette(live, Object.keys(live), '16', random);
    }
    compoundTotal += drift(live);
  }

  // averaged over many trials, re-seeding from default tracks the font's
  // lightness markedly better than compounding off the previous palette
  assert.ok(
    seededTotal < compoundTotal,
    `seeded total drift ${seededTotal.toFixed(2)} should be below compound total ${compoundTotal.toFixed(2)}`,
  );
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
