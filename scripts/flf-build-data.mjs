export function compactFlfFont(font, key) {
  return {
    kind: 'flf-plain',
    format: 'flf-v1',
    key,
    name: font.name,
    height: font.height,
    hardblank: font.hardblank,
    layoutMask: font.layoutMask,
    glyphs: font.glyphs,
  };
}

export function flfIndexEntry(font, key, outputFile) {
  return {
    kind: 'flf-plain',
    key,
    name: font.name,
    height: font.height,
    path: `./fonts/flf/${outputFile}`,
  };
}
