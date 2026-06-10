export const KNOWN_UNSUPPORTED_TDF_FONTS = new Set([
  'fraktur.tdf',
  'kevin1.tdf',
  'keys.tdf',
  'metal.tdf',
  'smat.tdf',
]);

export function isKnownUnsupportedTdf(file) {
  return KNOWN_UNSUPPORTED_TDF_FONTS.has(file);
}

export function compactTdfFont(font) {
  const glyphs = {};

  for (const [ch, rows] of Object.entries(font.glyphs)) {
    glyphs[ch] = {
      chars: rows.map((row) => row.map((cell) => cell.ch).join('')),
      colors: rows.map((row) => row.map((cell) => cell.color.slice(2).toLocaleLowerCase('en-US')).join('')),
    };
  }

  return {
    kind: font.kind,
    format: 'tdf-compact-v1',
    key: font.key,
    name: font.name,
    height: font.height,
    spacing: font.spacing,
    colorSlots: font.colorSlots,
    glyphs,
  };
}

export function tdfIndexEntry(font, outputFile) {
  return {
    kind: font.kind,
    key: font.key,
    name: font.name,
    height: font.height,
    spacing: font.spacing,
    colorSlotCount: font.colorSlots.length,
    path: `./fonts/tdf/${outputFile}`,
  };
}
