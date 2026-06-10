import { rgbToHsl, hslToRgb, quantizeColor } from './color.js';

// Build a fresh palette that keeps each slot's brightness (HSL lightness) but
// recolours fg and bg with a single random hue scheme. Deep shadows (near
// black) and highlights (near white) are kept neutral so the font's shading
// still reads. Every colour is quantized to the active ANSI depth (`mode`:
// 'truecolor' | '256' | '16') so the result only uses colours that depth can
// display. Returns a new palette object; the input is not mutated.
export function randomizePalette(palette, slots, mode = 'truecolor', random = Math.random) {
  const baseHue = random() * 360;
  const saturation = 0.55 + random() * 0.35; // 0.55..0.90
  const keys = slots && slots.length ? slots : Object.keys(palette);

  const recolor = (color) => {
    const { l } = rgbToHsl(color);
    // keep near-black and near-white anchors so deep shadows and highlights
    // do not turn into saturated colour
    if (l <= 0.02 || l >= 0.98) {
      return quantizeColor({ ...color }, mode);
    }
    const hue = baseHue + (random() - 0.5) * 40; // +/-20 degrees analogous jitter
    return quantizeColor(hslToRgb({ h: hue, s: saturation, l }), mode);
  };

  const out = {};
  for (const slot of keys) {
    const entry = palette[slot];
    if (!entry) continue;
    out[slot] = { fg: recolor(entry.fg), bg: recolor(entry.bg) };
  }
  // defensively carry over any slots not listed in `keys`
  for (const slot of Object.keys(palette)) {
    if (!out[slot]) {
      out[slot] = { fg: { ...palette[slot].fg }, bg: { ...palette[slot].bg } };
    }
  }
  return out;
}
