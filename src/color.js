export const reset = '\x1b[0m';

export function parseHex(value) {
  const original = value;
  let hex = String(value).trim();
  if (hex.startsWith('#')) {
    hex = hex.slice(1);
  }

  if (hex.length === 3) {
    hex = [...hex].map((char) => `${char}${char}`).join('');
  }

  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    throw new Error(`invalid hex color "${original}"`);
  }

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

export function toHex(color) {
  return `#${hex2(color.r)}${hex2(color.g)}${hex2(color.b)}`;
}

// {r,g,b} 0-255 -> {h:0-360, s:0-1, l:0-1}
export function rgbToHsl({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) {
    return { h: 0, s: 0, l };
  }
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h * 60, s, l };
}

// {h:any degrees, s:0-1, l:0-1} -> {r,g,b} 0-255
export function hslToRgb({ h, s, l }) {
  const hue = (((h % 360) + 360) % 360) / 360;
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t) => {
    let tc = t;
    if (tc < 0) tc += 1;
    if (tc > 1) tc -= 1;
    if (tc < 1 / 6) return p + (q - p) * 6 * tc;
    if (tc < 1 / 2) return q;
    if (tc < 2 / 3) return p + (q - p) * (2 / 3 - tc) * 6;
    return p;
  };
  return {
    r: Math.round(channel(hue + 1 / 3) * 255),
    g: Math.round(channel(hue) * 255),
    b: Math.round(channel(hue - 1 / 3) * 255),
  };
}

export function gradient(stops, rows) {
  if (rows <= 0) {
    return [];
  }
  if (stops.length === 0) {
    return Array.from({ length: rows }, () => ({ r: 255, g: 255, b: 255 }));
  }
  if (stops.length === 1 || rows === 1) {
    return Array.from({ length: rows }, () => ({ ...stops[0] }));
  }

  const result = [];
  const maxRow = rows - 1;
  const maxStop = stops.length - 1;

  for (let row = 0; row < rows; row += 1) {
    const pos = (row / maxRow) * maxStop;
    const left = Math.floor(pos);
    const right = Math.min(Math.ceil(pos), maxStop);
    const t = pos - left;
    result.push(interpolate(stops[left], stops[right], t));
  }

  return result;
}

const PALETTE_16 = [
  { code: 30, color: { r: 0, g: 0, b: 0 } },
  { code: 31, color: { r: 128, g: 0, b: 0 } },
  { code: 32, color: { r: 0, g: 128, b: 0 } },
  { code: 33, color: { r: 128, g: 128, b: 0 } },
  { code: 34, color: { r: 0, g: 0, b: 128 } },
  { code: 35, color: { r: 128, g: 0, b: 128 } },
  { code: 36, color: { r: 0, g: 128, b: 128 } },
  { code: 37, color: { r: 192, g: 192, b: 192 } },
  { code: 90, color: { r: 128, g: 128, b: 128 } },
  { code: 91, color: { r: 255, g: 0, b: 0 } },
  { code: 92, color: { r: 0, g: 255, b: 0 } },
  { code: 93, color: { r: 255, g: 255, b: 0 } },
  { code: 94, color: { r: 0, g: 0, b: 255 } },
  { code: 95, color: { r: 255, g: 0, b: 255 } },
  { code: 96, color: { r: 0, g: 255, b: 255 } },
  { code: 97, color: { r: 255, g: 255, b: 255 } },
];

const PALETTE_256 = (() => {
  const palette = [];
  const base = [
    { r: 0, g: 0, b: 0 },
    { r: 128, g: 0, b: 0 },
    { r: 0, g: 128, b: 0 },
    { r: 128, g: 128, b: 0 },
    { r: 0, g: 0, b: 128 },
    { r: 128, g: 0, b: 128 },
    { r: 0, g: 128, b: 128 },
    { r: 192, g: 192, b: 192 },
    { r: 128, g: 128, b: 128 },
    { r: 255, g: 0, b: 0 },
    { r: 0, g: 255, b: 0 },
    { r: 255, g: 255, b: 0 },
    { r: 0, g: 0, b: 255 },
    { r: 255, g: 0, b: 255 },
    { r: 0, g: 255, b: 255 },
    { r: 255, g: 255, b: 255 },
  ];
  base.forEach((color, code) => palette.push({ code, color }));
  const levels = [0, 95, 135, 175, 215, 255];
  for (let r = 0; r < 6; r += 1) {
    for (let g = 0; g < 6; g += 1) {
      for (let b = 0; b < 6; b += 1) {
        palette.push({ code: 16 + 36 * r + 6 * g + b, color: { r: levels[r], g: levels[g], b: levels[b] } });
      }
    }
  }
  for (let i = 0; i < 24; i += 1) {
    const level = 8 + i * 10;
    palette.push({ code: 232 + i, color: { r: level, g: level, b: level } });
  }
  return palette;
})();

export function ansiStart(mode, color) {
  switch (mode) {
    case 'plain':
      return '';
    case 'truecolor':
      return `\x1b[38;2;${color.r};${color.g};${color.b}m`;
    case '256':
      return `\x1b[38;5;${nearestEntry(color, PALETTE_256, true).code}m`;
    case '16':
      return `\x1b[${nearestEntry(color, PALETTE_16).code}m`;
    default:
      return '';
  }
}

export function quantizeColor(color, mode) {
  if (mode === 'plain' || mode === 'truecolor') return color;
  if (mode === '256') return nearestEntry(color, PALETTE_256, true).color;
  if (mode === '16') return nearestEntry(color, PALETTE_16).color;
  return color;
}

export function nearest16Code(color) {
  return nearestEntry(color, PALETTE_16).code;
}

export function nearest256Code(color) {
  return nearestEntry(color, PALETTE_256, true).code;
}

function nearestEntry(color, palette, preferExtended = false) {
  let best = palette[0];
  let bestDistance = distance(color, best.color);

  for (const candidate of palette.slice(1)) {
    const candidateDistance = distance(color, candidate.color);
    const extendedTie = preferExtended && candidateDistance === bestDistance && candidate.code >= 16 && best.code < 16;
    if (candidateDistance < bestDistance || extendedTie) {
      best = candidate;
      bestDistance = candidateDistance;
    }
  }

  return best;
}

function interpolate(a, b, t) {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

function distance(a, b) {
  return (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2;
}

function hex2(value) {
  return value.toString(16).padStart(2, '0');
}
