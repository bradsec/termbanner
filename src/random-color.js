import { quantizeColor, toHex } from './color.js';

// Largest gradient stop count the UI allows (also the cap for the manual
// "Add stop" button). Random gradients pick a stop count up to this.
export const MAX_GRADIENT_STOPS = 5;

// A fully random colour, quantized to the active ANSI depth so the result only
// uses colours that depth can show ('truecolor' | '256' | '16' | 'plain').
export function randomColor(mode = 'truecolor', random = Math.random) {
  const rgb = {
    r: Math.floor(random() * 256),
    g: Math.floor(random() * 256),
    b: Math.floor(random() * 256),
  };
  return toHex(quantizeColor(rgb, mode));
}

// A random gradient with a random number of stops between 2 and `maxStops`
// (inclusive). Each stop is a random colour quantized to `mode`.
export function randomGradient(mode = 'truecolor', maxStops = MAX_GRADIENT_STOPS, random = Math.random) {
  const max = Math.max(2, maxStops);
  const count = 2 + Math.floor(random() * (max - 1));
  const colors = [];
  for (let i = 0; i < count; i += 1) {
    colors.push(randomColor(mode, random));
  }
  return colors;
}
