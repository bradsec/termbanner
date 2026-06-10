export const THEDRAW_RGB = [
  { r: 0, g: 0, b: 0 },
  { r: 0, g: 0, b: 128 },
  { r: 0, g: 128, b: 0 },
  { r: 0, g: 128, b: 128 },
  { r: 128, g: 0, b: 0 },
  { r: 128, g: 0, b: 128 },
  { r: 128, g: 128, b: 0 },
  { r: 192, g: 192, b: 192 },
  { r: 128, g: 128, b: 128 },
  { r: 0, g: 0, b: 255 },
  { r: 0, g: 255, b: 0 },
  { r: 0, g: 255, b: 255 },
  { r: 255, g: 0, b: 0 },
  { r: 255, g: 0, b: 255 },
  { r: 255, g: 255, b: 0 },
  { r: 255, g: 255, b: 255 },
];

export function decodeTheDrawColor(value) {
  return {
    fg: value & 0x0f,
    bg: (value & 0xf0) >> 4,
  };
}

export function normalizeColorByte(value) {
  return `0x${value.toString(16).padStart(2, '0')}`;
}

export function theDrawColorToRgb(index) {
  return { ...THEDRAW_RGB[index] };
}

const CP437_EXTENDED = [
  'Ç', 'ü', 'é', 'â', 'ä', 'à', 'å', 'ç',
  'ê', 'ë', 'è', 'ï', 'î', 'ì', 'Ä', 'Å',
  'É', 'æ', 'Æ', 'ô', 'ö', 'ò', 'û', 'ù',
  'ÿ', 'Ö', 'Ü', '¢', '£', '¥', '₧', 'ƒ',
  'á', 'í', 'ó', 'ú', 'ñ', 'Ñ', 'ª', 'º',
  '¿', '⌐', '¬', '½', '¼', '¡', '«', '»',
  '░', '▒', '▓', '│', '┤', '╡', '╢', '╖',
  '╕', '╣', '║', '╗', '╝', '╜', '╛', '┐',
  '└', '┴', '┬', '├', '─', '┼', '╞', '╟',
  '╚', '╔', '╩', '╦', '╠', '═', '╬', '╧',
  '╨', '╤', '╥', '╙', '╘', '╒', '╓', '╫',
  '╪', '┘', '┌', '█', '▄', '▌', '▐', '▀',
  'α', 'ß', 'Γ', 'π', 'Σ', 'σ', 'µ', 'τ',
  'Φ', 'Θ', 'Ω', 'δ', '∞', 'φ', 'ε', '∩',
  '≡', '±', '≥', '≤', '⌠', '⌡', '÷', '≈',
  '°', '∙', '·', '√', 'ⁿ', '²', '■', '\u00a0',
];

export function cp437ToUnicode(byte) {
  if (byte < 0x20) return ' ';
  if (byte < 0x7f) return String.fromCharCode(byte);
  if (byte === 0x7f) return ' ';
  return CP437_EXTENDED[byte - 0x80] ?? ' ';
}
