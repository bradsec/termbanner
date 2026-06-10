import { ansiStart, quantizeColor, reset } from './color.js';

export function previewLines(rows, colors, mode = 'truecolor') {
  const plain = mode === 'plain';
  return rows.map((text, index) => {
    if (plain) {
      return { text, color: 'rgb(192 192 192)' };
    }
    const raw = colors[index] ?? colors[colors.length - 1] ?? { r: 255, g: 255, b: 255 };
    const color = quantizeColor(raw, mode);
    return {
      text,
      color: `rgb(${color.r} ${color.g} ${color.b})`,
    };
  });
}

export function ansiLines(rows, colors, mode) {
  if (mode === 'plain') {
    return [...rows];
  }

  return rows.map((row, index) => {
    const color = colors[index] ?? colors[colors.length - 1] ?? { r: 255, g: 255, b: 255 };
    return `${ansiStart(mode, color)}${row}${reset}`;
  });
}

export function plainText(rows) {
  return rows.join('\n');
}
